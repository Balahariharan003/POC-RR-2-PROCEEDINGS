"""
Unit Test Suite: Robust JSON Stream Repair & Joint-Defaulter Resolution
========================================================================
Verifies that:
1. Truncated/unterminated JSON strings from LLM streaming are automatically repaired.
2. Joint respondents (multiple defaulters) are accurately extracted, converted, and drafted.
"""

import pytest
from app.services.llm_service import parse_and_repair_json, case_to_extracted_entities
from app.services.document_service import build_slots
from app.domain.rules.extraction_gate import run_gate


def test_parse_truncated_json_unterminated_string():
    """Simulates qwen2.5 output truncated mid-string before closing bracket."""
    truncated_raw = """
    ```json
    {
      "department_type": "MCOP",
      "statute_cited": "மோட்டார் வாகனச் சட்டம் 1988 பிரிவு 174",
      "taluk_name": "ஈரோடு",
      "defaulter_name": "P. Saravanan, S/O. Soundararajan",
      "principal_amount": 55998.0,
      "total_recoverable_amount": 55998.0,
      "case_file_no": "338/2024",
      "synthesized_paragraphs": {
        "order_para1": "ஈரோடு மாவட்டம், ஈரோடு வட்டம், P. Saravanan என்பவரிடமிருந்து இழப்பீட்டுத் தொகை ரூ. 55,998/- வசூல்
    """
    parsed = parse_and_repair_json(truncated_raw)
    assert parsed is not None
    assert parsed.get("department_type") == "MCOP"
    assert parsed.get("total_recoverable_amount") == 55998.0
    assert parsed.get("case_file_no") == "338/2024"


def test_joint_defaulters_extraction_and_slots():
    """Simulates court order with two joint vehicle owners."""
    joint_case = {
        "case_file_no": "338/2024",
        "department_type": "MCOP",
        "statute_cited": "மோட்டார் வாகனச் சட்டம் 1988 பிரிவு 174",
        "taluk_name": "ஈரோடு",
        "district_name": "ஈரோடு",
        "entity_type": "MULTIPLE_INDIVIDUALS",
        "defaulter_name": "P. Saravanan, M. Jayaraman",
        "defaulters": [
            {
                "name": "P. Saravanan",
                "father_or_spouse_name": "S/O. Soundararajan",
                "door_no": "88",
                "street_and_locality": "E.P.B Nagar",
                "village": "Veerappanchathiram",
                "taluk": "ஈரோடு",
                "district": "ஈரோடு",
                "pincode": "638004"
            },
            {
                "name": "M. Jayaraman",
                "father_or_spouse_name": "S/O. Marudhamuthu",
                "door_no": "91",
                "street_and_locality": "Mariammankovil Street, E.P.B Nagar",
                "village": "Veerappanchathiram",
                "taluk": "ஈரோடு",
                "district": "ஈரோடு",
                "pincode": "638004"
            }
        ],
        "principal_amount": 55998.0,
        "penalty_amount": 0.0,
        "interest_amount": 0.0,
        "total_recoverable_amount": 55998.0,
        "review_flags": []
    }

    # 1. Gate passes
    gate = run_gate(joint_case, ocr_text="338/2024 55998 P. Saravanan M. Jayaraman")
    assert gate.ok, f"Gate failed: {gate.errors}"

    # 2. Extracted entities contain both defaulters
    entities = case_to_extracted_entities(joint_case)
    assert len(entities.defaulter_details) == 2
    assert entities.defaulter_details[0].name == "P. Saravanan"
    assert entities.defaulter_details[1].name == "M. Jayaraman"

    # 3. Slots format plural Tamil suffixes
    slots = build_slots(joint_case)
    assert "ஆகியோரிடமிருந்து" in slots["FROM_WHOM"]
    assert "ஆகியோரின்" in slots["OF_WHOM"]
    assert "P. Saravanan S/O. Soundararajan" in slots["DEFAULTER_NAME"]
    assert "M. Jayaraman S/O. Marudhamuthu" in slots["DEFAULTER_NAME"]
