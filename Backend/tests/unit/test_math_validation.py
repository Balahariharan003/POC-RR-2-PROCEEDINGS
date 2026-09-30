"""
Unit Tests for Statutory Mathematical Validation.
"""

from app.domain.schemas.legal_entities import FinancialDetails
from app.domain.rules.math_validator import validate_financial_math


def test_accurate_math():
    # M/s Prisma Garments exact certificate figures: 173,308 + 9,000 = 182,308
    fin = FinancialDetails(
        principal_amount=173308.0,
        penalty_amount=9000.0,
        interest_amount=0.0,
        total_recoverable_amount=182308.0
    )
    is_valid, violations, insights, disc = validate_financial_math(fin)
    assert is_valid is True
    assert len(violations) == 0
    assert disc == 0.0


def test_math_mismatch_detected():
    fin = FinancialDetails(
        principal_amount=173308.0,
        penalty_amount=9000.0,
        interest_amount=0.0,
        total_recoverable_amount=190000.0  # Discrepancy of 7,692
    )
    is_valid, violations, insights, disc = validate_financial_math(fin)
    assert is_valid is False
    assert len(violations) == 1
    assert violations[0].rule_id == "RULE_MATH_TOTAL_MISMATCH"
    assert disc == 7692.0
