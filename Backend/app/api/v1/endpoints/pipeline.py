"""
Pipeline Endpoints: Document Ingestion, OCR Extraction, Legal Entity Synthesis, Download, and Recalculation.
"""

from pathlib import Path
from fastapi import APIRouter, UploadFile, File, Depends, Form, HTTPException, status, Query
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
import shutil
import uuid

from app.core.config import settings
from app.core.database import get_db
from app.domain.models import User
from app.domain.schemas.legal_entities import ExtractedLegalEntities, FinancialDetails
from app.domain.rules.math_validator import validate_financial_math
from app.domain.rules.tamil_numerals import number_to_tamil_currency_words
from app.api.dependencies import get_current_user
from app.services.pipeline_service import PipelineService
from app.services.pdf_service import PDFService
from app.infrastructure.storage.local_storage import LocalStorageProvider

router = APIRouter()
pipeline_service = PipelineService()
pdf_service = PDFService()
storage_provider = LocalStorageProvider()


@router.post("/process", tags=["Pipeline"])
async def process_document(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Uploads a requisition certificate (e.g. Customs Sec 142(1)(c)(ii)),
    extracts entities via Chandra OCR & Ollama, routes jurisdiction,
    renders official Proceedings in TAU-Marutham font, and stamps with Advanced Hybrid HMAC-SHA256.
    """
    clean_filename = f"{uuid.uuid4().hex[:8]}_{Path(file.filename).name}"
    saved_path = storage_provider.save_upload(file.file, clean_filename)

    try:
        result = await pipeline_service.execute_pipeline(
            file_path=saved_path,
            db=db,
            user_id=str(current_user.id)
        )
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Pipeline processing error: {str(e)}"
        )


@router.get("/download/{filename:path}", tags=["Pipeline"])
async def download_pipeline_document(filename: str, format: str = Query("docx")):
    """Streams generated proceedings/memorandum docx or pdf file."""
    safe_name = Path(filename).name
    try:
        if format.lower() == "pdf":
            pdf_name = safe_name if safe_name.endswith(".pdf") else f"{Path(safe_name).stem}.pdf"
            try:
                path = storage_provider.get_output_file(pdf_name)
            except FileNotFoundError:
                docx_name = safe_name if safe_name.endswith(".docx") else f"{Path(safe_name).stem}.docx"
                docx_path = storage_provider.get_output_file(docx_name)
                path = pdf_service.convert_docx_to_pdf(docx_path)
            return FileResponse(path=str(path), filename=path.name, media_type="application/pdf")
        else:
            docx_name = safe_name if safe_name.endswith(".docx") else f"{Path(safe_name).stem}.docx"
            path = storage_provider.get_output_file(docx_name)
            return FileResponse(
                path=str(path),
                filename=path.name,
                media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            )
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"File '{filename}' not found.")


@router.post("/recalculate", tags=["Pipeline"])
async def recalculate_financials(
    principal: float = Form(...),
    penalty: float = Form(0.0),
    interest_rate: float = Form(0.0),
    months: int = Form(0),
):
    """
    Dynamic recalculation of demanded dues.
    Computes accrued simple interest, total recoverable sum, and updates Tamil currency words.
    """
    accrued_interest = round(principal * (interest_rate / 100.0) * (months / 12.0), 2) if (interest_rate and months) else 0.0
    total = round(principal + penalty + accrued_interest, 2)
    tamil_words = number_to_tamil_currency_words(total)

    fin = FinancialDetails(
        principal_amount=principal,
        penalty_amount=penalty,
        interest_amount=accrued_interest,
        interest_rate_percent=interest_rate,
        total_recoverable_amount=total,
        amount_in_words_tamil=tamil_words
    )

    is_valid, violations, insights, discrepancy = validate_financial_math(fin)

    return {
        "financials": fin.model_dump(),
        "is_valid": is_valid,
        "violations": [v.model_dump() for v in violations],
        "amount_in_words_tamil": tamil_words
    }
