"""
OCR Text Extraction Engine for Tamil and English.
Step 2 of the 5-Step Pipeline.
Supports Datalab Chandra OCR v2 API in Balanced Mode with fallback to
local RapidOCR PP-OCRv4 ONNX (Multilingual Tamil ta_dict).
"""

import os
import base64
import io
import time
import logging
from typing import List, Dict, Any, Union, Optional
from pathlib import Path
import numpy as np
import requests
from PIL import Image

from config import (
    OCR_DET_LIMIT_SIDE_LEN,
    OCR_CONFIDENCE_THRESHOLD,
    PP_OCR_V4_DET_PATH,
    PP_OCR_V4_REC_PATH,
    PP_OCR_V4_REC_DICT_PATH,
    CHANDRA_OCR_URL,
    CHANDRA_OCR_MODE,
    DATALAB_API_KEY,
    CHANDRA_TIMEOUT_SECONDS,
)

logger = logging.getLogger("rr_proceedings.ocr")

try:
    from rapidocr_onnxruntime.rapid_ocr_api import read_yaml, concat_model_path, root_dir
    from rapidocr_onnxruntime import RapidOCR
    from rapidocr_onnxruntime.ch_ppocr_v3_rec.text_recognize import TextRecognizer
    from rapidocr_onnxruntime.utils import LoadImage
    RAPID_OCR_AVAILABLE = True
except ImportError:
    RapidOCR = object
    read_yaml = lambda x: {}
    concat_model_path = lambda x: x
    root_dir = Path(__file__).resolve().parent
    TextRecognizer = None
    LoadImage = None
    RAPID_OCR_AVAILABLE = False


class ChandraOCRClient:
    """
    Client for Datalab Chandra OCR v2 API in Balanced Mode.
    Provides layout-aware, high-precision South Asian / Tamil text extraction.
    """
    def __init__(self, api_url: str = CHANDRA_OCR_URL, api_key: str = DATALAB_API_KEY, mode: str = CHANDRA_OCR_MODE):
        self.api_url = api_url
        self.api_key = api_key
        self.mode = mode
        self.timeout = CHANDRA_TIMEOUT_SECONDS

    def is_configured(self) -> bool:
        """Returns True if Chandra API endpoint is set and key is present."""
        return bool(self.api_key and self.api_key.strip() and self.api_url)

    def extract_from_image(self, img_input: Union[str, Path, np.ndarray]) -> Optional[Dict[str, Any]]:
        """
        Sends image to Chandra OCR v2 API in balanced mode.
        Returns parsed lines and full text if successful, or None on failure.
        """
        if not self.is_configured():
            return None

        try:
            # Convert img_input to JPEG/PNG bytes
            img_bytes = None
            if isinstance(img_input, (str, Path)):
                with open(str(img_input), "rb") as f:
                    img_bytes = f.read()
            elif isinstance(img_input, np.ndarray):
                pil_img = Image.fromarray(img_input)
                buf = io.BytesIO()
                pil_img.save(buf, format="PNG")
                img_bytes = buf.getvalue()

            if not img_bytes:
                return None

            headers = {
                "Authorization": f"Bearer {self.api_key.strip()}",
                "X-Api-Key": self.api_key.strip(),
            }

            # Datalab Chandra OCR v2 multipart or JSON request
            files = {"file": ("document.png", img_bytes, "image/png")}
            data = {
                "mode": self.mode,  # "balance" / "balanced"
                "language": "ta,en",
                "return_bounding_boxes": "true"
            }

            logger.info(f"Calling Datalab Chandra OCR v2 API ({self.api_url}) in '{self.mode}' mode...")
            response = requests.post(
                self.api_url,
                headers=headers,
                files=files,
                data=data,
                timeout=self.timeout
            )

            if response.status_code == 200:
                res_json = response.json()
                # Parse Chandra response format
                full_text = res_json.get("text") or res_json.get("markdown") or res_json.get("content") or ""
                lines = []
                raw_blocks = res_json.get("blocks") or res_json.get("lines") or []
                for b in raw_blocks:
                    t = b.get("text", "").strip()
                    if t:
                        lines.append({
                            "text": t,
                            "bbox": b.get("bbox") or b.get("box") or [[0, 0], [0, 0], [0, 0], [0, 0]],
                            "confidence": float(b.get("confidence", 0.95)),
                            "top": b.get("top", 0),
                            "left": b.get("left", 0)
                        })
                logger.info(f"Chandra OCR v2 successfully extracted {len(lines)} lines.")
                return {
                    "full_text": full_text,
                    "lines": lines,
                    "line_count": len(lines),
                    "engine": "Chandra-v2-Balance"
                }
            else:
                logger.warning(f"Chandra OCR API returned HTTP {response.status_code}: {response.text[:200]}")
                return None
        except Exception as e:
            logger.warning(f"Chandra OCR API request failed: {e}. Falling back to local RapidOCR.")
            return None


class TamilMultilingualPPOCRv4(RapidOCR):
    """
    Custom PaddleOCR PP-OCRv4 ONNX Execution Engine.
    Explicitly binds detection weights, recognition weights, and the official
    multilingual Tamil character dictionary map (ta_dict.txt).
    """
    def __init__(self, det_path: str, rec_path: str, keys_path: str, score_thresh: float = 0.52):
        config_path = str(root_dir / 'config.yaml')
        config = read_yaml(config_path)
        config = concat_model_path(config)

        # 1. Bind language-agnostic detection and Tamil multilingual recognition weights
        config['Det']['model_path'] = det_path
        config['Rec']['model_path'] = rec_path
        config['Rec']['keys_path'] = keys_path

        # 2. Configure global execution parameters
        global_config = config['Global']
        self.print_verbose = False
        self.text_score = score_thresh
        self.min_height = global_config.get('min_height', 30)
        self.width_height_ratio = global_config.get('width_height_ratio', 8)

        # 3. Initialize Detector
        self.use_text_det = True
        TextDetector = self.init_module(config['Det']['module_name'], config['Det']['class_name'])
        self.text_detector = TextDetector(config['Det'])

        # 4. Initialize Recognizer with explicit Tamil character mapping
        self.text_recognizer = TextRecognizer(config['Rec'])

        # 5. Angle classifier disabled by default for faster inference on upright legal court orders
        self.use_angle_cls = False
        self.text_cls = None
        self.load_img = LoadImage()


class OCRExtractionEngine:
    def __init__(self):
        self.chandra_client = ChandraOCRClient()
        self.local_engine = None
        self.character_dict: List[str] = []
        self._init_local_ocr()

    def _init_local_ocr(self):
        """Initializes local PP-OCRv4 ONNX with ta_dict.txt fallback."""
        if RAPID_OCR_AVAILABLE:
            det_p = Path(PP_OCR_V4_DET_PATH)
            rec_p = Path(PP_OCR_V4_REC_PATH)
            dict_p = Path(PP_OCR_V4_REC_DICT_PATH)

            if dict_p.exists():
                try:
                    with open(str(dict_p), "r", encoding="utf-8") as f:
                        for line in f.readlines():
                            self.character_dict.append(line.strip("\n").strip("\r"))
                    self.character_dict.append(" ")
                except Exception as e:
                    logger.warning(f"Failed to load character dictionary: {e}")

            if det_p.exists() and rec_p.exists() and dict_p.exists():
                try:
                    self.local_engine = TamilMultilingualPPOCRv4(
                        det_path=str(det_p),
                        rec_path=str(rec_p),
                        keys_path=str(dict_p),
                        score_thresh=OCR_CONFIDENCE_THRESHOLD
                    )
                    logger.info("Local PP-OCRv4 Tamil engine loaded successfully as fallback.")
                    return
                except Exception as ex:
                    logger.warning(f"Failed to initialize TamilMultilingualPPOCRv4: {ex}")

            self.local_engine = RapidOCR()
        else:
            logger.warning("rapidocr_onnxruntime is not installed.")

    def extract_text_from_image(self, img_input: Union[str, Path, np.ndarray]) -> Dict[str, Any]:
        """
        Runs OCR on a single image.
        1. Attempts Datalab Chandra OCR v2 in balanced mode if configured.
        2. Falls back seamlessly to local RapidOCR PP-OCRv4 ONNX with ta_dict.txt.
        """
        # Try Chandra OCR v2 first if configured
        if self.chandra_client.is_configured():
            chandra_res = self.chandra_client.extract_from_image(img_input)
            if chandra_res and chandra_res.get("full_text"):
                return chandra_res

        # Fallback to local engine
        if isinstance(img_input, (str, Path)):
            img_path = str(img_input)
            if self.local_engine:
                try:
                    result, elapse = self.local_engine(img_path, det_limit_side_len=OCR_DET_LIMIT_SIDE_LEN)
                except Exception:
                    result, elapse = self.local_engine(img_path)
            else:
                result, elapse = [], 0
        else:
            if self.local_engine:
                try:
                    result, elapse = self.local_engine(img_input, det_limit_side_len=OCR_DET_LIMIT_SIDE_LEN)
                except Exception:
                    result, elapse = self.local_engine(img_input)
            else:
                result, elapse = [], 0

        if not result:
            return {"full_text": "", "lines": [], "line_count": 0, "engine": "None"}

        lines = []
        for item in result:
            bbox = item[0]
            text = str(item[1]).strip()
            score = float(item[2]) if len(item) > 2 else 1.0

            if text and score >= OCR_CONFIDENCE_THRESHOLD:
                y_coord = bbox[0][1]
                x_coord = bbox[0][0]
                lines.append({
                    "text": text,
                    "bbox": bbox,
                    "confidence": score,
                    "top": y_coord,
                    "left": x_coord
                })

        sorted_lines = self._sort_reading_order(lines)
        full_text = "\n".join([line["text"] for line in sorted_lines])

        return {
            "full_text": full_text,
            "lines": sorted_lines,
            "line_count": len(sorted_lines),
            "engine": "PaddleOCR-PP-OCRv4-Tamil"
        }

    def _sort_reading_order(self, lines: List[Dict[str, Any]], line_tolerance: float = 15.0) -> List[Dict[str, Any]]:
        """Sorts bounding boxes into top-to-bottom, left-to-right reading order."""
        if not lines:
            return []

        sorted_by_y = sorted(lines, key=lambda item: item["top"])
        clustered_rows = []
        current_row = [sorted_by_y[0]]

        for item in sorted_by_y[1:]:
            if abs(item["top"] - current_row[0]["top"]) <= line_tolerance:
                current_row.append(item)
            else:
                clustered_rows.append(sorted(current_row, key=lambda x: x["left"]))
                current_row = [item]

        if current_row:
            clustered_rows.append(sorted(current_row, key=lambda x: x["left"]))

        flat_results = []
        for row in clustered_rows:
            flat_results.extend(row)

        return flat_results

    def extract_all_pages(self, pages: List[tuple]) -> Dict[str, Any]:
        """Extracts OCR text from all document pages."""
        all_text_blocks = []
        total_pages_data = []

        for page_num, img_array, img_path in pages:
            page_ocr = self.extract_text_from_image(img_array)
            total_pages_data.append({
                "page": page_num,
                "text": page_ocr["full_text"],
                "lines": page_ocr["lines"],
                "line_count": page_ocr["line_count"],
                "engine": page_ocr.get("engine", "PaddleOCR")
            })
            if page_ocr["full_text"]:
                all_text_blocks.append(f"--- [Page {page_num}] ---\n" + page_ocr["full_text"])

        complete_text = "\n\n".join(all_text_blocks)
        return {
            "combined_text": complete_text,
            "pages": total_pages_data,
            "total_pages": len(pages),
            "ocr_engine": total_pages_data[0].get("engine", "PaddleOCR") if total_pages_data else "PaddleOCR"
        }
