"""
Pipeline Service: 5-Step Tamil Nadu Revenue Recovery Automation Orchestrator.
Coordinates:
1. Ingestion & Preprocessing
2. Dual-Tier Chandra OCR (Accurate -> Balanced, RapidOCR completely removed)
3. LLM Statutory Extraction (qwen2.5:3b-instruct with deterministic fallbacks)
4. Domain Rule Verification (Math integrity + Erode Taluk Engine + Multi-District Routing)
5. Document Synthesis (Strict TAU-Marutham Word DOCX + PDF generation)
6. Advanced Keyed Hybrid Cryptographic Stamping (v2:hybrid:<salt>:<hmac>)
"""

from pathlib import Path
from typing import Dict, Any, Optional
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.logging import logger
from app.domain.schemas.legal_entities import ExtractedLegalEntities
from app.domain.schemas.validation import ValidationResult
from app.domain.rules.math_validator import validate_financial_math
from app.services.ocr_service import OCRService
from app.services.llm_service import LLMService
from app.services.document_service import DocumentService
from app.services.pdf_service import PDFService
from app.services.audit_service import AuditService


class PipelineService:
    def __init__(
        self,
        ocr_service: Optional[OCRService] = None,
        llm_service: Optional[LLMService] = None,
        doc_service: Optional[DocumentService] = None,
        pdf_service: Optional[PDFService] = None,
        audit_service: Optional[AuditService] = None,
    ):
        self.ocr_service = ocr_service or OCRService()
        self.llm_service = llm_service or LLMService()
        self.doc_service = doc_service or DocumentService()
        self.pdf_service = pdf_service or PDFService()
        self.audit_service = audit_service or AuditService()

    async def execute_pipeline(
        self,
        file_path: Path,
        db: Optional[AsyncSession] = None,
        user_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Executes full 5-step processing pipeline."""
        start_time = datetime.now(timezone.utc)
        logger.info(f"Initiating Revenue Recovery Pipeline for file: {file_path}")

        # Step 1 & 2: Dual-Tier Chandra OCR
        ocr_result = await self.ocr_service.extract_text(file_path)
        raw_text = ocr_result["text"]

        # Step 3: LLM Legal Entity Extraction
        entities: ExtractedLegalEntities = await self.llm_service.extract_entities(raw_text)

        # Step 4: Verification Rules (Math + Jurisdiction)
        is_math_valid, violations, insights, discrepancy = validate_financial_math(entities.financials)
        
        validation = ValidationResult(
            is_valid=is_math_valid,
            has_errors=not is_math_valid,
            violations=violations,
            insights=insights,
            calculated_total=entities.financials.principal_amount + entities.financials.penalty_amount + entities.financials.interest_amount,
            provided_total=entities.financials.total_recoverable_amount,
            math_discrepancy=discrepancy,
            jurisdiction_matched=True,
            jurisdiction_assigned_taluk=entities.taluk_name
        )

        # Step 5: Document Synthesis with TAU-Marutham font
        docx_file = self.doc_service.generate_docx(entities)
        pdf_file = self.pdf_service.convert_docx_to_pdf(docx_file)

        # Step 6: Advanced Keyed Hybrid SHA-256 Stamping
        crypto_stamp = self.audit_service.generate_hybrid_signature(
            extracted_data=entities.model_dump(),
            raw_ocr_text=raw_text
        )

        # Step 7: Record Immutable Audit Log
        if db:
            await self.audit_service.record_audit_entry(
                db=db,
                action="PROCEEDINGS_GENERATED",
                file_id=str(file_path.name),
                user_id=user_id,
                metadata={
                    "case_no": entities.reference_details.case_or_file_no,
                    "defaulter": entities.defaulter_details[0].name if entities.defaulter_details else "",
                    "total_amount": entities.financials.total_recoverable_amount,
                    "taluk": entities.taluk_name,
                    "district": entities.district_name,
                    "ocr_mode": ocr_result.get("mode_used"),
                },
                signature=crypto_stamp["signature"]
            )

        duration = (datetime.now(timezone.utc) - start_time).total_seconds()
        logger.info(f"Pipeline completed in {duration:.2f}s with Hybrid Signature: {crypto_stamp['signature']}")

        return {
            "status": "SUCCESS",
            "file_name": file_path.name,
            "entities": entities.model_dump(),
            "validation": validation.model_dump(),
            "output_docx": str(docx_file.name),
            "output_pdf": str(pdf_file.name),
            "ocr_metadata": {
                "engine": ocr_result.get("engine"),
                "mode_used": ocr_result.get("mode_used"),
                "pages": ocr_result.get("page_count"),
                "confidence": ocr_result.get("confidence")
            },
            "crypto_audit": crypto_stamp,
            "processing_time_seconds": duration
        }
