"""
Unit Test Suite for Phase P0: Fail-Closed Extraction Gate
==========================================================
Verifies that no invalid or unverified legal document can pass through the gate.
"""

import pytest
from app.domain.rules.extraction_gate import run_gate, GateError, GateResult
from app.domain.rules.math_validator import validate_financial_math
from app.domain.schemas.legal_entities import FinancialDetails
from app.core.exceptions import GateRejectionError, ExtractionUnavailable, RenderContractError


def test_gate_rejects_zero_total():
    case = {
        "case_file_no": "1248/2026",
        "statute_cited": "Customs Act 1962 Sec 142(1)(c)(ii)",
        "taluk_name": "ஈரோடு",
        "defaulter_name": "M/s ABC Textiles",
        "total_recoverable_amount": 0,
        "principal_amount": 0,
        "penalty_amount": 0,
        "interest_amount": 0,
    }
    result = run_gate(case, ocr_text="1248/2026")
    assert not result.ok
    assert GateError.TOTAL_MISSING in result.errors


def test_gate_rejects_negative_amount():
    case = {
        "case_file_no": "1248/2026",
        "statute_cited": "Customs Act 1962 Sec 142(1)(c)(ii)",
        "taluk_name": "ஈரோடு",
        "defaulter_name": "M/s ABC Textiles",
        "total_recoverable_amount": -50000,
        "principal_amount": -50000,
    }
    result = run_gate(case, ocr_text="1248/2026")
    assert not result.ok
    assert GateError.NEGATIVE_AMOUNT in result.errors


def test_gate_rejects_placeholder_defaulter():
    case = {
        "case_file_no": "1248/2026",
        "statute_cited": "Customs Act 1962 Sec 142(1)(c)(ii)",
        "taluk_name": "ஈரோடு",
        "defaulter_name": "எதிர்மனுதாரர்",
        "total_recoverable_amount": 100000,
        "principal_amount": 100000,
    }
    result = run_gate(case, ocr_text="1248/2026 100000")
    assert not result.ok
    assert GateError.NO_NAMED_DEFAULTER in result.errors


def test_gate_rejects_llm_fallback():
    case = {
        "case_file_no": None,
        "statute_cited": None,
        "taluk_name": None,
        "defaulter_name": None,
        "total_recoverable_amount": 0.0,
        "review_flags": ["LLM_PARSE_FALLBACK"]
    }
    result = run_gate(case, ocr_text="")
    assert not result.ok
    assert GateError.LLM_FALLBACK_USED in result.errors


def test_gate_rejects_math_mismatch():
    case = {
        "case_file_no": "1248/2026",
        "statute_cited": "Customs Act 1962 Sec 142(1)(c)(ii)",
        "taluk_name": "ஈரோடு",
        "defaulter_name": "M/s ABC Textiles",
        "total_recoverable_amount": 100000,
        "principal_amount": 50000,
        "penalty_amount": 20000,
        "interest_amount": 10000,  # 50k + 20k + 10k = 80k != 100k
    }
    result = run_gate(case, ocr_text="1248/2026 100000")
    assert not result.ok
    assert GateError.AMOUNT_SUM_MISMATCH in result.errors


def test_gate_rejects_missing_statute():
    case = {
        "case_file_no": "1248/2026",
        "statute_cited": "",
        "taluk_name": "ஈரோடு",
        "defaulter_name": "M/s ABC Textiles",
        "total_recoverable_amount": 100000,
        "principal_amount": 100000,
    }
    result = run_gate(case, ocr_text="1248/2026 100000")
    assert not result.ok
    assert GateError.STATUTE_MISSING in result.errors


def test_gate_rejects_unresolved_jurisdiction():
    case = {
        "case_file_no": "1248/2026",
        "statute_cited": "Customs Act 1962 Sec 142(1)(c)(ii)",
        "taluk_name": "மதுரை",  # Not in Erode district
        "defaulter_name": "M/s ABC Textiles",
        "total_recoverable_amount": 100000,
        "principal_amount": 100000,
    }
    result = run_gate(case, ocr_text="1248/2026 100000")
    assert not result.ok
    assert GateError.JURISDICTION_UNRESOLVED in result.errors


def test_gate_passes_valid_case():
    case = {
        "case_file_no": "1248/2026",
        "statute_cited": "Customs Act 1962 Sec 142(1)(c)(ii)",
        "taluk_name": "ஈரோடு",
        "defaulter_name": "M/s ABC Textiles",
        "total_recoverable_amount": 100000,
        "principal_amount": 100000,
        "penalty_amount": 0,
        "interest_amount": 0,
        "other_charges_amount": 0,
        "review_flags": []
    }
    result = run_gate(case, ocr_text="1248/2026 100000 M/s ABC Textiles")
    assert result.ok
    assert len(result.errors) == 0


def test_case_to_extracted_entities_handles_all_none_fallback():
    from app.services.llm_service import case_to_extracted_entities
    fallback_case = {
        "document_type": None,
        "requisition_channel": None,
        "department_type": None,
        "department_name_ta": None,
        "statute_cited": None,
        "dues_label": None,
        "entity_type": None,
        "defaulter_name": None,
        "taluk_name": None,
        "district_name": None,
        "principal_amount": 0.0,
        "penalty_amount": 0.0,
        "interest_amount": 0.0,
        "other_charges_amount": 0.0,
        "total_recoverable_amount": 0.0,
        "review_flags": ["LLM_PARSE_FALLBACK"]
    }
    entities = case_to_extracted_entities(fallback_case)
    assert entities.district_name is None
    assert entities.taluk_name is None
    assert entities.department_type is None
    assert entities.financials.total_recoverable_amount == 0.0


if __name__ == "__main__":
    test_gate_rejects_zero_total()
    test_gate_rejects_negative_amount()
    test_gate_rejects_placeholder_defaulter()
    test_gate_rejects_llm_fallback()
    test_gate_rejects_math_mismatch()
    test_gate_rejects_missing_statute()
    test_gate_rejects_unresolved_jurisdiction()
    test_gate_passes_valid_case()
    test_math_validator_rejects_zero()
    test_case_to_extracted_entities_handles_all_none_fallback()
    print("ALL GATE ACCEPTANCE TESTS PASSED!")
