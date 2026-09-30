"""
OCR Service: Enterprise Optical Character Recognition.
Strictly configured for Datalab Chandra OCR API:
- Primary Tier: Accurate Mode (high precision legal glyph recognition)
- Fallback Tier: Balanced Mode (rapid inference fallback on latency/timeout)
RapidOCR and ONNX runtimes are completely eliminated.
"""

from pathlib import Path
from typing import Dict, Any, List, Optional
import pypdfium2 as pdfium
from PIL import Image
import io

from app.core.config import settings
from app.core.logging import logger
from app.core.exceptions import OCRProcessingError
from app.infrastructure.chandra_client import ChandraOCRClient


class OCRService:
    def __init__(self, chandra_client: Optional[ChandraOCRClient] = None):
        self.chandra_client = chandra_client or ChandraOCRClient()

    def _render_pdf_to_images(self, pdf_path: Path, dpi: int = 150) -> List[Image.Image]:
        """Renders all PDF pages to PIL Images using pypdfium2."""
        images = []
        try:
            pdf = pdfium.PdfDocument(str(pdf_path))
            for page_idx in range(len(pdf)):
                page = pdf[page_idx]
                scale = dpi / 72.0
                bitmap = page.render(scale=scale)
                pil_image = bitmap.to_pil()
                images.append(pil_image)
        except Exception as e:
            logger.error(f"Failed to render PDF pages from {pdf_path}: {e}")
            raise OCRProcessingError(f"Could not render PDF document pages: {str(e)}")
        return images

    async def extract_text(self, file_path: Path) -> Dict[str, Any]:
        """
        Extracts Tamil and English text from PDF or Image file.
        Executes Chandra OCR API in accurate mode, falling back to balance mode if needed.
        """
        path = Path(file_path)
        if not path.exists():
            raise OCRProcessingError(f"File not found: {path}")

        images: List[Image.Image] = []
        ext = path.suffix.lower()

        if ext == ".pdf":
            images = self._render_pdf_to_images(path)
        elif ext in {".png", ".jpg", ".jpeg", ".tiff", ".bmp", ".webp"}:
            try:
                images = [Image.open(str(path))]
            except Exception as e:
                raise OCRProcessingError(f"Could not open image file: {str(e)}")
        else:
            raise OCRProcessingError(f"Unsupported file format for OCR: {ext}")

        if not images:
            raise OCRProcessingError("Document contains 0 readable pages.")

        page_results = []
        full_text_list = []
        overall_confidence = 0.95
        last_mode_used = settings.CHANDRA_PRIMARY_MODE

        for page_num, img in enumerate(images, start=1):
            logger.info(f"Submitting Page {page_num}/{len(images)} to Chandra OCR API (Primary: {settings.CHANDRA_PRIMARY_MODE})...")
            
            # Step 1: Attempt Primary Mode (accurate)
            try:
                result = await self.chandra_client.recognize_image(img, mode=settings.CHANDRA_PRIMARY_MODE)
                text = result.get("text", "").strip()
                page_results.append({
                    "page": page_num,
                    "mode": settings.CHANDRA_PRIMARY_MODE,
                    "text": text,
                    "confidence": result.get("confidence", 0.96)
                })
                full_text_list.append(text)
                last_mode_used = settings.CHANDRA_PRIMARY_MODE
            except Exception as primary_err:
                logger.warning(
                    f"Chandra OCR Accurate mode failed on page {page_num} ({primary_err}). "
                    f"Initiating fallback to Balanced mode ({settings.CHANDRA_FALLBACK_MODE})..."
                )
                # Step 2: Attempt Fallback Mode (balance)
                try:
                    result = await self.chandra_client.recognize_image(img, mode=settings.CHANDRA_FALLBACK_MODE)
                    text = result.get("text", "").strip()
                    page_results.append({
                        "page": page_num,
                        "mode": settings.CHANDRA_FALLBACK_MODE,
                        "text": text,
                        "confidence": result.get("confidence", 0.90)
                    })
                    full_text_list.append(text)
                    last_mode_used = settings.CHANDRA_FALLBACK_MODE
                except Exception as fallback_err:
                    logger.error(f"Both Accurate and Balanced Chandra OCR modes failed for page {page_num}: {fallback_err}")
                    raise OCRProcessingError(f"Chandra OCR failed completely on page {page_num}: {str(fallback_err)}")

        joined_text = "\n\n--- [PAGE BREAK] ---\n\n".join(full_text_list).strip()

        return {
            "text": joined_text,
            "page_count": len(images),
            "pages": page_results,
            "engine": "Datalab-Chandra-v2",
            "mode_used": last_mode_used,
            "confidence": overall_confidence
        }
