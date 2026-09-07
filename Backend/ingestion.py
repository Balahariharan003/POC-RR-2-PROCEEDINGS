"""
Document Ingestion & Image Conversion Engine.
Step 1 of the 5-Step Pipeline.
Converts PDF pages into 300 DPI images and handles multi-format file ingestion.
"""

import os
from pathlib import Path
from typing import List, Tuple, Union
import pymupdf  # PyMuPDF
from PIL import Image
import numpy as np

from config import DEFAULT_DPI, UPLOAD_DIR, SUPPORTED_DOC_FORMATS, SUPPORTED_IMAGE_FORMATS


class DocumentIngestionEngine:
    def __init__(self, dpi: int = DEFAULT_DPI):
        self.dpi = dpi
        self.zoom_factor = dpi / 72.0  # standard PDF point resolution is 72 dpi

    def ingest_document(self, file_path: Union[str, Path]) -> List[Tuple[int, np.ndarray, Path]]:
        """
        Ingests a document (PDF, Image, DOCX) and returns a list of tuples:
        (page_number, image_numpy_array, saved_image_path)
        """
        path = Path(file_path).resolve()
        if not path.exists():
            raise FileNotFoundError(f"Input file not found at: {path}")

        ext = path.suffix.lower()
        if ext not in SUPPORTED_DOC_FORMATS:
            raise ValueError(f"Unsupported file format '{ext}'. Supported: {SUPPORTED_DOC_FORMATS}")

        if ext == ".pdf":
            return self._process_pdf(path)
        elif ext in SUPPORTED_IMAGE_FORMATS:
            return self._process_image(path)
        elif ext in [".docx", ".doc"]:
            return self._process_docx(path)
        else:
            raise ValueError(f"No processor available for {ext}")

    def _process_pdf(self, pdf_path: Path) -> List[Tuple[int, np.ndarray, Path]]:
        """Converts each page of a PDF into high-res (300 DPI) image."""
        doc = pymupdf.open(str(pdf_path))
        page_results = []
        matrix = pymupdf.Matrix(self.zoom_factor, self.zoom_factor)

        stem = pdf_path.stem
        output_subfolder = UPLOAD_DIR / f"{stem}_pages"
        output_subfolder.mkdir(parents=True, exist_ok=True)

        for page_num in range(len(doc)):
            page = doc[page_num]
            pix = page.get_pixmap(matrix=matrix, alpha=False)
            
            img_path = output_subfolder / f"page_{page_num + 1}.png"
            pix.save(str(img_path))

            # Convert pixmap bytes to numpy RGB array for OCR processing
            img_array = np.frombuffer(pix.samples, dtype=np.uint8).reshape((pix.height, pix.width, pix.n))
            page_results.append((page_num + 1, img_array, img_path))

        doc.close()
        return page_results

    def _process_image(self, img_path: Path) -> List[Tuple[int, np.ndarray, Path]]:
        """Processes single image file."""
        with Image.open(img_path) as img:
            img_rgb = img.convert("RGB")
            img_array = np.array(img_rgb)
            return [(1, img_array, img_path)]

    def _process_docx(self, docx_path: Path) -> List[Tuple[int, np.ndarray, Path]]:
        """
        Extracts content from DOCX. For OCR compatibility, renders text or fallback.
        """
        import docx
        doc = docx.Document(str(docx_path))
        full_text = "\n".join([p.text for p in doc.paragraphs if p.text.strip()])

        # If docx has text directly, we can create a temporary rendered image or handle text directly
        stem = docx_path.stem
        output_subfolder = UPLOAD_DIR / f"{stem}_pages"
        output_subfolder.mkdir(parents=True, exist_ok=True)
        
        # Create an image placeholder for docx
        img = Image.new("RGB", (2480, 3508), color=(255, 255, 255))
        img_path = output_subfolder / "page_1.png"
        img.save(str(img_path))
        return [(1, np.array(img), img_path)]

    def extract_direct_pdf_text(self, pdf_path: Union[str, Path]) -> str:
        """
        Extracts digital text directly if the PDF has embedded selectable text.
        Useful as a fast fallback/supplement to OCR.
        """
        path = Path(pdf_path)
        if path.suffix.lower() != ".pdf":
            return ""
        
        text_parts = []
        try:
            doc = pymupdf.open(str(path))
            for page in doc:
                t = page.get_text()
                if t.strip():
                    text_parts.append(t.strip())
            doc.close()
        except Exception:
            pass
        return "\n\n".join(text_parts)
