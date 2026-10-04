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


@router.get("/original/{filename:path}", tags=["Documents"])
@router.get("/source/{filename:path}", tags=["Documents"])
@router.get("/{filename:path}/raw", tags=["Documents"])
async def stream_original_document(filename: str):
    """Streams original scanned petition/order or uploaded document for in-app preview."""
    try:
        path = storage.find_file(filename)
        media_type = "application/octet-stream"
        suffix = path.suffix.lower()
        if suffix == ".pdf":
            media_type = "application/pdf"
        elif suffix in [".png", ".jpg", ".jpeg"]:
            media_type = f"image/{suffix.replace('.', '')}"
        elif suffix == ".docx":
            media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

        return FileResponse(
            path=str(path),
            filename=path.name,
            media_type=media_type,
            content_disposition_type="inline",
            headers={"Content-Disposition": f'inline; filename="{path.name}"'}
        )
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Original document not found.")

