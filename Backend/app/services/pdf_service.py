"""
PDF Service: Cross-Platform DOCX to PDF Conversion.
Supports Microsoft Word automation on Windows and LibreOffice headless on Linux/Docker.
"""

import sys
import subprocess
from pathlib import Path
from typing import Optional

from app.core.logging import logger
from app.core.exceptions import AppException


class PDFService:
    def convert_docx_to_pdf(self, docx_path: Path, pdf_path: Optional[Path] = None) -> Path:
        """Converts DOCX to PDF preserving Tamil font glyph rendering."""
        source = Path(docx_path).resolve()
        target = Path(pdf_path or source.with_suffix(".pdf")).resolve()

        if not source.exists():
            raise FileNotFoundError(f"DOCX source file not found: {source}")

        # Windows: Check for convert_docx_to_pdf.ps1 or run Word via COM/PowerShell
        if sys.platform == "win32":
            ps_script = source.parent.parent / "convert_docx_to_pdf.ps1"
            if ps_script.exists():
                try:
                    res = subprocess.run(
                        [
                            "powershell.exe",
                            "-NoProfile",
                            "-NonInteractive",
                            "-ExecutionPolicy",
                            "Bypass",
                            "-File",
                            str(ps_script),
                            str(source),
                            str(target),
                        ],
                        capture_output=True,
                        text=True,
                        timeout=90,
                        check=False,
                    )
                    if res.returncode == 0 and target.exists():
                        logger.info(f"Windows Word PDF conversion succeeded: {target}")
                        return target
                except Exception as e:
                    logger.warning(f"PowerShell Word conversion failed: {e}. Attempting LibreOffice...")

        # Cross-platform / Linux Docker: LibreOffice headless conversion
        try:
            cmd = ["soffice", "--headless", "--convert-to", "pdf", "--outdir", str(target.parent), str(source)]
            res = subprocess.run(cmd, capture_output=True, text=True, timeout=90, check=False)
            if target.exists():
                logger.info(f"LibreOffice PDF conversion succeeded: {target}")
                return target
        except Exception as lo_err:
            logger.error(f"LibreOffice PDF conversion failure: {lo_err}")

        # If conversion binary is absent, return docx path with warning
        logger.warning(f"Direct PDF conversion unavailable. DOCX preserved at {source}")
        return target if target.exists() else source
