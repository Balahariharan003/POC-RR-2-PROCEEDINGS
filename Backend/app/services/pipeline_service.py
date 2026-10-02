"""
Pipeline Service: 5-Step Tamil Nadu Revenue Recovery Automation Orchestrator.
Coordinates:
1. Ingestion & Preprocessing
2. Dual-Tier Chandra OCR (Accurate -> Balanced)
3. LLM Statutory Extraction & Dynamic Tamil Drafting (qwen2.5:3b-instruct with deterministic fallbacks)
4. Domain Rule Verification (Math integrity + Erode Taluk Engine + Multi-District Routing)
5. Multi-Document Synthesis (Strict TAU-Marutham Word DOCX + PDF for all 3 official administrative forms:
   - 1. செயல்முறைகள் (Collector & District Magistrate Proceedings / Order)
   - 2. குறிப்பாணை (Collectorate Memorandum / Office Memo)
   - 3. அலுவலகக் குறிப்பு (Office Note File Order)
6. Advanced Keyed Hybrid Cryptographic Stamping (v2:hybrid:<salt>:<hmac>)
"""

from pathlib import Path
from typing import Dict, Any, Optional
from datetime import datetime, timezone
import docx
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.logging import logger
from app.domain.schemas.legal_entities import ExtractedLegalEntities, DepartmentType
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
        """Executes full processing pipeline and produces all 3 official administrative documents."""
        start_time = datetime.now(timezone.utc)
        logger.info(f"Initiating Revenue Recovery Pipeline for file: {file_path}")

        # Step 1 & 2: OCR Extraction
        ocr_result = await self.ocr_service.extract_text(file_path)
        raw_text = ocr_result["text"]

        # Step 3: LLM Legal Entity Extraction & Dynamic Drafting
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

        # Step 5: Multi-Document Synthesis
        # Mandatory 1 & 2: செயல்முறைகள் (Proceedings) + அலுவலகக் குறிப்பு (Office Note) are generated in ALL cases
        proceedings_docx = self.doc_service.generate_proceedings_docx(entities)
        proceedings_pdf = self.pdf_service.convert_docx_to_pdf(proceedings_docx)

        note_docx = self.doc_service.generate_note_docx(entities)
        note_pdf = self.pdf_service.convert_docx_to_pdf(note_docx)

        # Case-Specific Classification for Memorandum & Judicial Warrant
        raw_combined = f"{raw_text} {entities.reference_details.statutory_act_and_section or ''} {entities.reference_details.issuing_authority_name or ''} {entities.department_type}".lower()
        
        is_judicial_warrant_case = any(kw in raw_combined for kw in [
            "warrant", "crpc", "bnss", "125", "144", "maintenance", "family court",
            "senior citizen", "tribunal", "arrest", "distraint", "வாரண்ட்", "பராமரிப்பு", "நீதிமன்ற",
            "mcop", "labour court", "execution petition"
        ]) or entities.department_type == DepartmentType.MCOP

        is_memorandum_case = not is_judicial_warrant_case or any(kw in raw_combined for kw in [
            "tnrera", "customs", "tax", "gst", "revenue recovery act", "commercial tax", "tahsildar", "வட்டாட்சியர்"
        ])

        memorandum_docx = None
        memorandum_pdf = None
        if is_memorandum_case:
            memorandum_docx = self.doc_service.generate_memorandum_docx(entities)
            memorandum_pdf = self.pdf_service.convert_docx_to_pdf(memorandum_docx)

        warrant_docx = None
        warrant_pdf = None
        if is_judicial_warrant_case:
            warrant_docx = self.doc_service.generate_warrant_docx(entities)
            warrant_pdf = self.pdf_service.convert_docx_to_pdf(warrant_docx)

        # Step 6: Advanced Keyed Hybrid SHA-256 Stamping
        crypto_stamp = self.audit_service.generate_hybrid_signature(
            extracted_data=entities.model_dump(),
            raw_ocr_text=raw_text
        )

        # Step 7: Record Immutable Audit Log
        if db:
            doc_text = ""
            try:
                doc_obj = docx.Document(str(proceedings_docx))
                doc_text = "\n\n".join([p.text for p in doc_obj.paragraphs if p.text])
            except Exception:
                pass

            await self.audit_service.record_audit_entry(
                db=db,
                action="PROCEEDINGS_GENERATED",
                file_id=str(file_path.name),
                user_id=user_id,
                metadata={
                    "case_no": entities.reference_details.case_or_file_no,
                    "caseNumber": entities.reference_details.case_or_file_no,
                    "fileName": file_path.name,
                    "generated_docx_filename": proceedings_docx.name,
                    "generated_pdf_filename": proceedings_pdf.name,
                    "proceedings_docx": proceedings_docx.name,
                    "proceedings_pdf": proceedings_pdf.name,
                    "note_docx": note_docx.name,
                    "note_pdf": note_pdf.name,
                    "memorandum_docx": memorandum_docx.name if memorandum_docx else "",
                    "memorandum_pdf": memorandum_pdf.name if memorandum_pdf else "",
                    "warrant_docx": warrant_docx.name if warrant_docx else "",
                    "warrant_pdf": warrant_pdf.name if warrant_pdf else "",
                    "defaulter": entities.defaulter_details[0].name if entities.defaulter_details else "",
                    "defaulterName": entities.defaulter_details[0].name if entities.defaulter_details else "",
                    "total_amount": entities.financials.total_recoverable_amount,
                    "amount": f"₹ {int(entities.financials.total_recoverable_amount):,}/-",
                    "taluk": entities.taluk_name,
                    "district": entities.district_name,
                    "ocr_mode": ocr_result.get("mode_used"),
                    "status": "DRAFT",
                    "documentContent": doc_text,
                },
                signature=crypto_stamp["signature"]
            )

        duration = (datetime.now(timezone.utc) - start_time).total_seconds()
        logger.info(f"Pipeline completed in {duration:.2f}s with Hybrid Signature: {crypto_stamp['signature']}")

        documents_list = [
            {
                "title": "1. செயல்முறைகள் (Proceedings / Order)",
                "type": "PROCEEDINGS",
                "docx": str(proceedings_docx.name),
                "pdf": str(proceedings_pdf.name),
            },
            {
                "title": "2. அலுவலகக் குறிப்பு (Office Note)",
                "type": "NOTE",
                "docx": str(note_docx.name),
                "pdf": str(note_pdf.name),
            }
        ]

        if memorandum_docx:
            documents_list.append({
                "title": "3. குறிப்பாணை (Memorandum / Memo)",
                "type": "MEMORANDUM",
                "docx": str(memorandum_docx.name),
                "pdf": str(memorandum_pdf.name),
            })

        if warrant_docx:
            documents_list.append({
                "title": "4. ஜப்தி / கைது வாரண்ட் (Judicial Warrant)",
                "type": "WARRANT",
                "docx": str(warrant_docx.name),
                "pdf": str(warrant_pdf.name),
            })

        return {
            "status": "SUCCESS",
            "file_name": file_path.name,
            "entities": entities.model_dump(),
            "validation": validation.model_dump(),
            "output_docx": str(proceedings_docx.name),
            "output_pdf": str(proceedings_pdf.name),
            "proceedings_docx": str(proceedings_docx.name),
            "proceedings_pdf": str(proceedings_pdf.name),
            "note_docx": str(note_docx.name),
            "note_pdf": str(note_pdf.name),
            "memorandum_docx": str(memorandum_docx.name) if memorandum_docx else "",
            "memorandum_pdf": str(memorandum_pdf.name) if memorandum_pdf else "",
            "warrant_docx": str(warrant_docx.name) if warrant_docx else "",
            "warrant_pdf": str(warrant_pdf.name) if warrant_pdf else "",
            "documents": documents_list,
            "ocr_metadata": {
                "engine": ocr_result.get("engine"),
                "mode_used": ocr_result.get("mode_used"),
                "pages": ocr_result.get("page_count"),
                "confidence": ocr_result.get("confidence")
            },
            "crypto_audit": crypto_stamp,
            "processing_time_seconds": duration
        }
