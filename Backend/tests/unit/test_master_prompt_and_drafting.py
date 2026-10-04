"""
Unit Tests for Master Prompt Case Analysis, Deterministic Helpers,
Draft Validation, and 4-Worker Document Generation.
"""

import pytest
import os
from pathlib import Path
from app.services.llm_service import (
    tamil_words,
    inr,
    fig,
    rupees_words,
    postprocess_case,
    case_to_extracted_entities,
    COLLECTOR_LINE,
    OFFICE_SECTION,
    TALUK_TO_RDO,
    ERODE_TALUKS,
)
from app.services.document_service import (
    build_slots,
    fill,
    validate_draft,
    process_office_note,
    process_proceedings,
    process_memorandum,
    process_warrant,
    render_text_stream_to_docx,
    OFFICE_NOTE_TEMPLATE,
    PROCEEDINGS_TEMPLATE,
    MEMO_TEMPLATE,
    WARRANT_TEMPLATE,
    DraftValidationError,
)


def test_inr_formatting():
    assert inr(182308) == "1,82,308"
    assert inr(460690) == "4,60,690"
    assert inr(10000000) == "1,00,00,000"
    assert inr(500) == "500"
    assert fig(182308) == "ரூ.1,82,308/-"


def test_tamil_words_conversion():
    tw = tamil_words(182308)
    assert "இலட்சத்து" in tw
    assert "இரண்டாயிரத்து" in tw or "இரண்டா" in tw
    assert "எட்டு" in tw

    rw = rupees_words(182308)
    assert rw.startswith("ரூபாய் ")
    assert rw.endswith(" மட்டும்")

    zero_rw = rupees_words(0)
    assert zero_rw == "ரூபாய் பூஜ்ஜியம் மட்டும்"


def test_postprocess_case_guards():
    ocr_text = """
    OFFICE OF THE COMMISSIONER OF CUSTOMS
    Order-in-Original No: 105790/2024
    Demand: Principal Rs. 173308, Penalty Rs. 9000, Total Rs. 182308.
    Defaulter: M/s XYZ Garments, Erode Taluk, Erode District.
    """
    case_data = {
        "department_type": "CUSTOMS",
        "entity_type": "COMPANY",
        "defaulter_name": "M/s XYZ Garments",
        "taluk_name": "ஈரோடு",
        "district_name": "ஈரோடு",
        "jurisdiction": "ERODE",
        "principal_amount": 173308.0,
        "penalty_amount": 9000.0,
        "interest_amount": 0.0,
        "other_charges_amount": 0.0,
        "total_recoverable_amount": 182308.0,
        "amount_check": "OK",
        "case_file_no": "105790/2024",
        "references": [{"ref_no": "105790/2024", "text_ta": "சுங்கத்துறை கடிதம்"}],
        "review_flags": []
    }

    processed = postprocess_case(case_data, ocr_text)
    assert processed["department_type"] == "CUSTOMS"
    assert processed["amount_check"] == "OK"
    assert "UNGROUNDED_AMOUNT:principal_amount" not in processed["review_flags"]


def test_validate_draft_checks():
    case_data = {
        "department_type": "CUSTOMS",
        "entity_type": "COMPANY",
        "defaulter_name": "M/s XYZ",
        "taluk_name": "ஈரோடு",
        "total_recoverable_amount": 182308.0,
        "principal_amount": 173308.0,
        "penalty_amount": 9000.0,
        "interest_amount": 0.0,
        "references": [{"ref_no": "105790/2024", "text_ta": "சுங்கத்துறை கடிதம்"}],
    }

    template = "// அலுவலகக் குறிப்பு //\nபொருள்: வருவாய் வசூல் சட்டம் 1864\n-------\nபணிந்தனுப்பப்படுகிறது:"
    valid_text = "// அலுவலகக் குறிப்பு //\nபொருள்: வருவாய் வசூல் சட்டம் 1864\n-------\nபணிந்தனுப்பப்படுகிறது:\nதொகை ரூ.1,82,308/- (ரூபாய் ஒரு இலட்சத்து எண்பத்து இரண்டாயிரத்து முந்நூற்று எட்டு மட்டும்) 105790/2024."
    
    errs = validate_draft(valid_text, template, case_data, need_refs=["105790/2024"], need_words=True)
    assert len(errs) == 0

    # Test rejection when locked line is altered
    invalid_text = "// தவறு //\nபொருள்: வருவாய் வசூல் சட்டம் 1864"
    errs2 = validate_draft(invalid_text, template, case_data)
    assert any("locked line altered/missing" in e for e in errs2)


@pytest.mark.asyncio
async def test_four_workers_document_generation(tmp_path):
    sample_case = {
        "document_type": "COURT_ORDER",
        "requisition_channel": "FROM_COURT",
        "originating_collectorate": None,
        "department_type": "MCOP",
        "department_evidence": "MCOP-225/2022",
        "department_confidence": 0.98,
        "entity_type": "INDIVIDUAL",
        "defaulter_name": "திரு.T.P.ராமலிங்கம்",
        "relation_text": "த/பெ.பழனிச்சாமி",
        "iec_number": None,
        "door_no": "90/6",
        "street_and_locality": "சந்தை மேடு, சிவகிரி",
        "village": "சிவகிரி",
        "taluk_name": "கொடுமுடி",
        "district_name": "ஈரோடு",
        "pincode": "638109",
        "jurisdiction": "ERODE",
        "principal_amount": 460690.0,
        "penalty_amount": 0.0,
        "interest_amount": 0.0,
        "other_charges_amount": 0.0,
        "total_recoverable_amount": 460690.0,
        "amount_check": "OK",
        "statute_cited": "மோட்டார் வாகனச் சட்டம் 1988 பிரிவு 174",
        "issuing_authority_name": "ஈரோடு மோட்டார் வாகன விபத்து இழப்பீட்டு தீர்ப்பாயம்",
        "case_file_no": "MCOP-225/2022",
        "order_in_original_no": "I.A.No.08/2026",
        "order_date": "26.03.2026",
        "letter_date": "26.03.2026",
        "beneficiary_name": "Cholamandalam MS General Insurance Company Limited",
        "dd_favour_of": "Cholamandalam MS General Insurance Company Limited, Erode",
        "head_of_account": None,
        "dispatch_address": "Cholamandalam MS General Insurance Company Limited, D.No.14, Sri Senniappa Complex, Thiruvika Road, Erode-638011.",
        "court_or_issuer_ta": "ஈரோடு மோட்டார் வாகன விபத்து இழப்பீட்டு தீர்ப்பாயம்",
        "court_or_issuer_block_en": "Special Sub Judge, Special Sub Court for MCOP Cases / The Exclusive Motor Accidents Claims Tribunal, Erode.",
        "references": [
            {
                "seq": 1,
                "kind": "COURT_ORDER",
                "authority_ta": "ஈரோடு மோட்டார் வாகன விபத்து இழப்பீட்டு தீர்ப்பாயம்",
                "ref_no": "MCOP-225/2022",
                "date": "26.03.2026",
                "text_ta": "ஈரோடு, மோட்டார் வாகன விபத்து இழப்பீட்டு தீர்ப்பாயம் / சிறப்பு சார்பு நீதிமன்றம், MCOP-225/2022, உத்தரவு, நாள் 26.03.2026."
            }
        ],
        "prior_proceedings": None,
        "reminders": [],
        "maintenance": None,
        "review_flags": []
    }

    job_id = 9999
    meta = {"nk_no": "9666", "year": "2026", "doc_date": "05.05.2026"}

    # Worker 1: Office Note
    note_path = await process_office_note("", job_id, case=sample_case, meta=meta)
    assert os.path.exists(note_path)

    # Worker 2: Proceedings
    proc_path = await process_proceedings("", job_id, case=sample_case, meta=meta)
    assert os.path.exists(proc_path)

    # Worker 3: Memorandum
    memo_path = await process_memorandum("", job_id, case=sample_case, meta=meta)
    assert os.path.exists(memo_path)

    # Maintenance Warrant (None for MCOP)
    warr_path = await process_warrant("", job_id, case=sample_case, meta=meta)
    assert warr_path is None
