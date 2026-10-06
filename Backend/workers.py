"""
Collectorate Administrative Document Workers:
Generates the 4 authentic Tamil Nadu Revenue Recovery documents:
1. Office Note (Office_Note_{job_id}.docx) - // அலுவலகக் குறிப்பு //
2. Proceedings (Proceedings_{job_id}.docx) - மாவட்ட ஆட்சித் தலைவர் செயல்முறைகள்
3. Memorandum (Memorandum_{job_id}.docx) - // குறிப்பாணை //
4. Warrant (Warrant_{job_id}.docx) - // ஜப்தி மற்றும் கைது வாரண்ட் ஆணை //
"""

from pathlib import Path
from typing import Dict, Any, Optional

from app.core.config import settings
from app.core.logging import logger
from app.core.exceptions import GateRejectionError
from app.domain.rules.extraction_gate import run_gate
from app.services.llm_service import LLMService, case_to_extracted_entities
from app.services.document_service import (
    DocumentService,
    process_office_note,
    process_proceedings,
    process_memorandum,
    process_warrant,
)
from app.domain.schemas.legal_entities import ExtractedLegalEntities

llm_service = LLMService()
doc_service = DocumentService()
OUTPUT_DIR = settings.OUTPUT_DIR
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


async def _resolve_case_dict(ocr_text_or_case: Any) -> Dict[str, Any]:
    """Helper ensuring input is parsed into a verified case dict and passed through the extraction gate."""
    raw_text = ""
    if isinstance(ocr_text_or_case, dict):
        case = ocr_text_or_case
    elif isinstance(ocr_text_or_case, ExtractedLegalEntities):
        case = doc_service._ensure_case_dict(ocr_text_or_case)
    else:
        raw_text = str(ocr_text_or_case)
        case = await llm_service.analyse_case(raw_text)

    # Fail-closed gate check on worker path
    gate_result = run_gate(case=case, ocr_text=raw_text)
    if not gate_result.ok:
        logger.error(f"Worker rejected case: {[e.value for e in gate_result.errors]}")
        raise GateRejectionError(
            f"Extraction gate rejected case: {', '.join(e.value for e in gate_result.errors)}"
        )
    return case


async def worker_office_note(ocr_text_or_case: Any, job_id: int, *args) -> str:
    """Worker 1: Drafts internal Section ஈ2 Office Note."""
    case = await _resolve_case_dict(ocr_text_or_case)
    return await process_office_note(str(ocr_text_or_case), job_id, case=case)


async def worker_proceedings(ocr_text_or_case: Any, job_id: int, *args) -> str:
    """Worker 2: Drafts formal District Collector Proceedings Order."""
    case = await _resolve_case_dict(ocr_text_or_case)
    return await process_proceedings(str(ocr_text_or_case), job_id, case=case)


async def worker_memorandum(ocr_text_or_case: Any, job_id: int, linked_ref: str = "", *args) -> str:
    """Worker 3: Drafts Collectorate Memorandum."""
    case = await _resolve_case_dict(ocr_text_or_case)
    return await process_memorandum(str(ocr_text_or_case), job_id, linked_old_ref=linked_ref, case=case)


async def worker_warrant(ocr_text_or_case: Any, job_id: int, *args) -> Optional[str]:
    """Worker 4: Drafts Judicial Distraint & Arrest Warrant for maintenance cases."""
    case = await _resolve_case_dict(ocr_text_or_case)
    return await process_warrant(str(ocr_text_or_case), job_id, case=case)


async def process_all_four_forms(ocr_text_or_case: Any, job_id: int) -> Dict[str, str]:
    """Batch Worker: Concurrently generates all 4 official Collectorate documents."""
    case = await _resolve_case_dict(ocr_text_or_case)
    raw_text = str(ocr_text_or_case) if isinstance(ocr_text_or_case, str) else ""

    note_path = await process_office_note(raw_text, job_id, case=case)
    proc_path = await process_proceedings(raw_text, job_id, case=case)
    memo_path = await process_memorandum(raw_text, job_id, case=case)
    warr_path = await process_warrant(raw_text, job_id, case=case)

    results = {
        "office_note": note_path,
        "proceedings": proc_path,
        "memorandum": memo_path,
    }
    if warr_path:
        results["warrant"] = warr_path
    return results
