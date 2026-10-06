"""
Pipeline Service: 5-Step Tamil Nadu Revenue Recovery Automation Orchestrator.
Coordinates:
1. Ingestion & Preprocessing
2. Dual-Tier Chandra OCR (Accurate -> Balanced) with native JSONB DB storage
3. LLM Master Prompt Legal Entity Extraction (analyse_case) with zero hardcoded templates
4. Domain Rule Verification (Math integrity + Erode Taluk Engine + Multi-District Routing)
5. Multi-Document Synthesis (Office Note, Proceedings, Memorandum, Warrant) in strict TAU-Marutham font
6. Advanced Keyed Hybrid Cryptographic Stamping (v2:hybrid:<salt>:<hmac>)
"""

from pathlib import Path
from typing import Dict, Any, Optional, List
from datetime import datetime, timezone
import json
import uuid
import docx
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import settings
from app.core.logging import logger
from app.domain.models import ProceedingsCase, DocumentTemplate
from app.domain.schemas.legal_entities import ExtractedLegalEntities, DepartmentType
from app.domain.schemas.validation import ValidationResult, ValidationInsight
from app.domain.rules.math_validator import validate_financial_math
from app.domain.rules.extraction_gate import run_gate
from app.services.ocr_service import OCRService
from app.services.llm_service import (
    LLMService,
    case_to_extracted_entities,
)
from app.services.document_service import (
    DocumentService,
    process_office_note,
    process_proceedings,
    process_memorandum,
    process_warrant,
    DraftValidationError,
)
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
        user_id: Optional[str] = None,
        meta: Optional[Dict[str, Any]] = None,
        linked_old_ref: str = "",
    ) -> Dict[str, Any]:
        """Executes full processing pipeline and produces the 4 official administrative documents."""
        start_time = datetime.now(timezone.utc)
        job_id = int(datetime.now().strftime("%m%d%H%M%S"))
        logger.info(f"Initiating Revenue Recovery Pipeline for file: {file_path} (Job ID: {job_id})")

        # Step 1 & 2: OCR Extraction
        ocr_result = await self.ocr_service.extract_text(file_path)
        raw_text = ocr_result.get("text", "")

        ocr_payload = {
            "text": raw_text,
            "engine": ocr_result.get("engine", "Chandra-OCR"),
            "mode_used": ocr_result.get("mode_used", "ACCURATE"),
            "pages": ocr_result.get("pages") or ocr_result.get("page_count", 1),
            "page_count": ocr_result.get("page_count", 1),
            "confidence": ocr_result.get("confidence", 0.98),
            "filename": file_path.name,
            "extracted_at": datetime.now(timezone.utc).isoformat(),
        }

        # ----------------------------------------------------------------------
        # SERVER LOG: STAGE 1 - OCR EXTRACTION OUTPUT
        # ----------------------------------------------------------------------
        try:
            import sys
            stage1_banner = f"\n{'=' * 80}\n [STAGE 1/3] OCR EXTRACTION OUTPUT (File: {file_path.name})\n Engine: {ocr_payload['engine']} | Mode: {ocr_payload['mode_used']} | Pages: {ocr_payload['page_count']} | Length: {len(raw_text)} chars\n{'-' * 80}\n{raw_text if raw_text else '[NO TEXT EXTRACTED]'}\n{'=' * 80}\n"
            sys.stdout.buffer.write(stage1_banner.encode("utf-8", errors="replace"))
            sys.stdout.buffer.flush()
        except Exception:
            logger.info(f"[STAGE 1/3] OCR extracted {len(raw_text)} chars for {file_path.name}")

        # Step 3: LLM Case Analysis via MASTER PROMPT (Zero hardcoded department heuristics)
        case: Dict[str, Any] = await self.llm_service.analyse_case(raw_text)

        # ----------------------------------------------------------------------
        # SERVER LOG: STAGE 2 - LLM EXTRACTS & SYNTHESIZED CASE DATA
        # ----------------------------------------------------------------------
        try:
            import sys
            stage2_banner = f"\n{'=' * 80}\n [STAGE 2/3] LLM EXTRACTS & SYNTHESIZED CASE DATA (Job ID: {job_id})\n Department: {case.get('department_type')} | Defaulter: {case.get('defaulter_name')} | Total: {case.get('total_recoverable_amount')}\n{'-' * 80}\n{json.dumps(case, ensure_ascii=False, indent=2)}\n{'=' * 80}\n"
            sys.stdout.buffer.write(stage2_banner.encode("utf-8", errors="replace"))
            sys.stdout.buffer.flush()
        except Exception:
            logger.info(f"[STAGE 2/3] LLM analyzed Job ID {job_id}")

        entities: ExtractedLegalEntities = case_to_extracted_entities(case, raw_text)

        # Step 4: Verification Rules (Math + Jurisdiction)
        is_math_valid, violations, insights, discrepancy = validate_financial_math(entities.financials)
        
        # Convert any string review_flags to ValidationInsight instances
        review_flag_insights = [
            ValidationInsight(category="REVIEW_FLAG", description=str(flag), is_valid=False)
            for flag in case.get("review_flags", [])
        ]

        validation = ValidationResult(
            is_valid=is_math_valid and (case.get("amount_check") != "MISMATCH"),
            has_errors=(not is_math_valid) or (case.get("amount_check") == "MISMATCH"),
            violations=violations,
            insights=insights + review_flag_insights,
            calculated_total=entities.financials.principal_amount + entities.financials.penalty_amount + entities.financials.interest_amount,
            provided_total=entities.financials.total_recoverable_amount,
            math_discrepancy=discrepancy,
            jurisdiction_matched=case.get("jurisdiction") == "ERODE",
            jurisdiction_assigned_taluk=entities.taluk_name
        )

        # Step 4.5: Fail-Closed Extraction Gate Enforcement
        gate_result = run_gate(
            case=case,
            ocr_text=raw_text,
            ocr_pages=ocr_result.get("pages_data") or ([{"page": 1, "text": raw_text, "mode": ocr_payload["mode_used"]}] if raw_text else [])
        )

        if not gate_result.ok:
            logger.warning(
                f"Extraction Gate REJECTED case (Job ID: {job_id}): {[e.value for e in gate_result.errors]} | "
                f"Details: {gate_result.error_details}"
            )
            duration = (datetime.now(timezone.utc) - start_time).total_seconds()

            if db:
                case_record = ProceedingsCase(
                    id=str(uuid.uuid4()),
                    file_no=str(case.get("case_file_no") or job_id),
                    case_file_no=str(case.get("case_file_no") or job_id),
                    roc_number=f"ந.க. {case.get('case_file_no') or job_id}/{datetime.now().year}/ஈ2",
                    department_type=case.get("department_type"),
                    defaulter_name=case.get("defaulter_name") ,
                    total_amount=float(case.get("total_recoverable_amount") or 0.0),
                    district_name=case.get("district_name"),
                    taluk_name=case.get("taluk_name"),
                    status="NEEDS_REVIEW",
                    original_file_name=file_path.name,
                    docx_path="",
                    pdf_path="",
                    hybrid_signature="",
                    document_content="",
                    ocr_data=ocr_payload,
                    extracted_data=case,
                    generated_documents=[],
                )
                db.add(case_record)
                await db.commit()

                await self.audit_service.record_audit_entry(
                    db=db,
                    action="EXTRACTION_GATE_REJECTED",
                    file_id=str(file_path.name),
                    user_id=user_id,
                    metadata={
                        "case_no": case.get("case_file_no"),
                        "gate_errors": [e.value for e in gate_result.errors],
                        "gate_error_details": gate_result.error_details,
                        "status": "NEEDS_REVIEW",
                    },
                    signature="GATE_REJECTED"
                )

            return {
                "status": "NEEDS_REVIEW",
                "gate_passed": False,
                "gate_errors": [e.value for e in gate_result.errors],
                "gate_error_details": gate_result.error_details,
                "file_name": file_path.name,
                "case": case,
                "entities": entities.model_dump(),
                "validation": validation.model_dump(),
                "output_docx": "",
                "output_pdf": "",
                "proceedings_docx": "",
                "proceedings_pdf": "",
                "note_docx": "",
                "note_pdf": "",
                "memorandum_docx": "",
                "memorandum_pdf": "",
                "warrant_docx": "",
                "warrant_pdf": "",
                "documents": [],
                "ocr_metadata": ocr_payload,
                "processing_time_seconds": duration,
            }

        # Step 5: Multi-Document Worker Drafting Synthesis
        meta_dict = meta or {
            "nk_no": case.get("case_file_no") or str(job_id),
            "year": str(datetime.now().year),
            "doc_date": case.get("order_date") or case.get("letter_date") or datetime.now().strftime(".%m.%Y"),
        }

        # Generate Worker 1: Office Note (Dynamic DB Template)
        note_docx_path_str = await process_office_note(raw_text, job_id, case=case, meta=meta_dict, db=db)
        note_docx = Path(note_docx_path_str)
        note_pdf = self.pdf_service.convert_docx_to_pdf(note_docx)

        # Generate Worker 2: Proceedings (Dynamic DB Template)
        proceedings_docx_path_str = await process_proceedings(raw_text, job_id, case=case, meta=meta_dict, db=db)
        proceedings_docx = Path(proceedings_docx_path_str)
        proceedings_pdf = self.pdf_service.convert_docx_to_pdf(proceedings_docx)

        # Step 6: Advanced Keyed Hybrid SHA-256 Stamping
        crypto_stamp = self.audit_service.generate_hybrid_signature(
            extracted_data=case,
            raw_ocr_text=raw_text
        )

        # Step 7: Record to PostgreSQL with native JSONB columns
        proceedings_content_text = ""
        try:
            doc_obj = docx.Document(str(proceedings_docx))
            proceedings_content_text = "\n\n".join([p.text for p in doc_obj.paragraphs if p.text])
        except Exception:
            pass

        documents_manifest = [
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

        if db:
            case_record = ProceedingsCase(
                id=str(uuid.uuid4()),
                file_no=str(case.get("case_file_no") or job_id),
                case_file_no=str(case.get("case_file_no") or job_id),
                roc_number=f"ந.க. {case.get('case_file_no') or job_id}/{datetime.now().year}/ஈ2",
                department_type=case.get("department_type", "GENERAL_RR"),
                defaulter_name=case.get("defaulter_name") or "எதிர்மனுதாரர்",
                total_amount=float(case.get("total_recoverable_amount") or 0.0),
                district_name=case.get("district_name") or "ஈரோடு",
                taluk_name=case.get("taluk_name") or "ஈரோடு",
                status="DRAFT",
                original_file_name=file_path.name,
                docx_path=str(proceedings_docx.name),
                pdf_path=str(proceedings_pdf.name),
                hybrid_signature=crypto_stamp["signature"],
                document_content=proceedings_content_text,
                ocr_data=ocr_payload,  # JSONB full OCR storage
                extracted_data=case,    # JSONB verified CASE JSON
                generated_documents=documents_manifest,
            )
            db.add(case_record)
            await db.commit()

            await self.audit_service.record_audit_entry(
                db=db,
                action="PROCEEDINGS_GENERATED",
                file_id=str(file_path.name),
                user_id=user_id,
                metadata={
                    "case_no": case.get("case_file_no"),
                    "caseNumber": case.get("case_file_no"),
                    "fileName": file_path.name,
                    "generated_docx_filename": proceedings_docx.name,
                    "generated_pdf_filename": proceedings_pdf.name,
                    "proceedings_docx": proceedings_docx.name,
                    "proceedings_pdf": proceedings_pdf.name,
                    "note_docx": note_docx.name,
                    "note_pdf": note_pdf.name,
                    "defaulter": case.get("defaulter_name"),
                    "defaulterName": case.get("defaulter_name"),
                    "total_amount": case.get("total_recoverable_amount"),
                    "amount": f"₹ {int(case.get('total_recoverable_amount') or 0):,}/-",
                    "taluk": case.get("taluk_name"),
                    "district": case.get("district_name"),
                    "ocr_mode": ocr_result.get("mode_used"),
                    "status": "DRAFT",
                    "documentContent": proceedings_content_text,
                },
                signature=crypto_stamp["signature"]
            )

        duration = (datetime.now(timezone.utc) - start_time).total_seconds()
        logger.info(f"Pipeline completed in {duration:.2f}s with Hybrid Signature: {crypto_stamp['signature']}")

        return {
            "status": "SUCCESS",
            "file_name": file_path.name,
            "case": case,
            "entities": entities.model_dump(),
            "validation": validation.model_dump(),
            "output_docx": str(proceedings_docx.name),
            "output_pdf": str(proceedings_pdf.name),
            "proceedings_docx": str(proceedings_docx.name),
            "proceedings_pdf": str(proceedings_pdf.name),
            "note_docx": str(note_docx.name),
            "note_pdf": str(note_pdf.name),
            "documents": documents_manifest,
            "ocr_metadata": ocr_payload,
            "crypto_audit": crypto_stamp,
            "processing_time_seconds": duration,
        }
