"""
Document Delivery Endpoints: Protected file streaming with path traversal protection.
"""

from pathlib import Path
from fastapi import APIRouter, HTTPException, status
from fastapi.responses import FileResponse

from app.core.config import settings
from app.infrastructure.storage.local_storage import LocalStorageProvider

router = APIRouter()
storage = LocalStorageProvider()


@router.get("/{filename}/docx", tags=["Documents"])
async def download_docx(filename: str):
    try:
        path = storage.get_output_file(filename)
        return FileResponse(
            path=path,
            filename=filename,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        )
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Requested DOCX file not found.")


@router.get("/{filename}/pdf", tags=["Documents"])
async def download_pdf(filename: str):
    try:
        pdf_name = filename if filename.endswith(".pdf") else f"{Path(filename).stem}.pdf"
        path = storage.get_output_file(pdf_name)
        return FileResponse(
            path=path,
            filename=pdf_name,
            media_type="application/pdf"
        )
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Requested PDF file not found.")
