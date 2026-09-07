"""
OCR Text Extraction Engine for Tamil and English.
Step 2 of the 5-Step Pipeline.
Extracts structured text lines preserving reading order and layout geometry.
"""

from typing import List, Dict, Any, Union
from pathlib import Path
import numpy as np

from config import (
    OCR_DET_LIMIT_SIDE_LEN,
    OCR_CONFIDENCE_THRESHOLD,
    PP_OCR_V4_DET_PATH,
    PP_OCR_V4_REC_PATH,
    PP_OCR_V4_REC_DICT_PATH
)

try:
    from rapidocr_onnxruntime.rapid_ocr_api import read_yaml, concat_model_path, root_dir
    from rapidocr_onnxruntime import RapidOCR
    from rapidocr_onnxruntime.ch_ppocr_v3_rec.text_recognize import TextRecognizer
    from rapidocr_onnxruntime.utils import LoadImage
    RAPID_OCR_AVAILABLE = True
except ImportError:
    RAPID_OCR_AVAILABLE = False


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
        self.engine = None
        self.character_dict: List[str] = []
        self._init_ocr()

    def _init_ocr(self):
        """
        Initializes the OCR engine with PP-OCRv4 ONNX runtime and loads
        the Multilingual Text Dictionary Mapping Key (ta_dict.txt).
        """
        if RAPID_OCR_AVAILABLE:
            det_p = Path(PP_OCR_V4_DET_PATH)
            rec_p = Path(PP_OCR_V4_REC_PATH)
            dict_p = Path(PP_OCR_V4_REC_DICT_PATH)

            # Load the Multilingual Text Dictionary Mapping Key
            if dict_p.exists():
                try:
                    with open(str(dict_p), "r", encoding="utf-8") as f:
                        for line in f.readlines():
                            self.character_dict.append(line.strip("\n").strip("\r"))
                    # PaddleOCR appends a blank space token at the final fallback indexing position
                    self.character_dict.append(" ")
                except Exception as e:
                    print(f"Warning: Failed to load character dictionary: {e}")

            if det_p.exists() and rec_p.exists() and dict_p.exists():
                try:
                    print(f"Loading PaddleOCR PP-OCRv4 Multilingual (Tamil + English) from {det_p.parent}...")
                    self.engine = TamilMultilingualPPOCRv4(
                        det_path=str(det_p),
                        rec_path=str(rec_p),
                        keys_path=str(dict_p),
                        score_thresh=OCR_CONFIDENCE_THRESHOLD
                    )
                    print(f"PaddleOCR PP-OCRv4 Tamil engine loaded successfully ({len(self.character_dict)} dictionary tokens).")
                    return
                except Exception as ex:
                    print(f"Warning: Failed to initialize TamilMultilingualPPOCRv4: {ex}. Falling back to default RapidOCR.")

            # Fallback to default packaged weights
            print("Loading default PaddleOCR ONNX models...")
            self.engine = RapidOCR()
        else:
            print("Warning: rapidocr_onnxruntime is not installed. Using fallback text extraction.")

    def extract_text_from_image(self, img_input: Union[str, Path, np.ndarray]) -> Dict[str, Any]:
        """
        Runs OCR on a single page image with confidence threshold filtering.
        Returns:
            {
                "full_text": str,
                "lines": List[Dict[str, Any]] (text, bbox, confidence)
            }
        """
        if isinstance(img_input, (str, Path)):
            img_path = str(img_input)
            if self.engine:
                try:
                    result, elapse = self.engine(img_path, det_limit_side_len=OCR_DET_LIMIT_SIDE_LEN)
                except Exception:
                    result, elapse = self.engine(img_path)
            else:
                result, elapse = [], 0
        else:
            if self.engine:
                try:
                    result, elapse = self.engine(img_input, det_limit_side_len=OCR_DET_LIMIT_SIDE_LEN)
                except Exception:
                    result, elapse = self.engine(img_input)
            else:
                result, elapse = [], 0

        if not result:
            return {"full_text": "", "lines": [], "line_count": 0}

        lines = []
        for item in result:
            # RapidOCR returns [dt_boxes, rec_res, score]
            bbox = item[0]
            text = str(item[1]).strip()
            score = float(item[2]) if len(item) > 2 else 1.0

            # Filter out low-confidence outputs to ignore background noise/stamp artifacts
            if text and score >= OCR_CONFIDENCE_THRESHOLD:
                # Calculate bounding box coordinates for spatial reading order sorting
                y_coord = bbox[0][1]
                x_coord = bbox[0][0]
                lines.append({
                    "text": text,
                    "bbox": bbox,
                    "confidence": score,
                    "top": y_coord,
                    "left": x_coord
                })

        # Sort lines based on reading order: top to bottom, then left to right
        sorted_lines = self._sort_reading_order(lines)
        full_text = "\n".join([line["text"] for line in sorted_lines])

        return {
            "full_text": full_text,
            "lines": sorted_lines,
            "line_count": len(sorted_lines)
        }

    def _sort_reading_order(self, lines: List[Dict[str, Any]], line_tolerance: float = 15.0) -> List[Dict[str, Any]]:
        """
        Sorts bounding boxes into proper reading order.
        Groups lines with similar vertical positions (Y) together, then sorts by horizontal (X).
        """
        if not lines:
            return []

        # Sort primarily by vertical Y position
        sorted_by_y = sorted(lines, key=lambda item: item["top"])
        
        clustered_rows = []
        current_row = [sorted_by_y[0]]

        for item in sorted_by_y[1:]:
            # If line is within vertical tolerance of the current line's top
            if abs(item["top"] - current_row[0]["top"]) <= line_tolerance:
                current_row.append(item)
            else:
                # Sort previous row from left to right
                clustered_rows.append(sorted(current_row, key=lambda x: x["left"]))
                current_row = [item]

        if current_row:
            clustered_rows.append(sorted(current_row, key=lambda x: x["left"]))

        # Flatten rows
        flat_results = []
        for row in clustered_rows:
            flat_results.extend(row)

        return flat_results

    def extract_all_pages(self, pages: List[tuple]) -> Dict[str, Any]:
        """
        Extracts OCR text from a list of (page_num, img_array, img_path) tuples.
        """
        all_text_blocks = []
        total_pages_data = []

        for page_num, img_array, img_path in pages:
            page_ocr = self.extract_text_from_image(img_array)
            total_pages_data.append({
                "page": page_num,
                "text": page_ocr["full_text"],
                "lines": page_ocr["lines"],
                "line_count": page_ocr["line_count"]
            })
            if page_ocr["full_text"]:
                all_text_blocks.append(f"--- [Page {page_num}] ---\n" + page_ocr["full_text"])

        complete_text = "\n\n".join(all_text_blocks)
        return {
            "combined_text": complete_text,
            "pages": total_pages_data,
            "total_pages": len(pages)
        }
