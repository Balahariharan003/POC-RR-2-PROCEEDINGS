"""
Mathematical Validation Rule Engine.
Enforces statutory arithmetic integrity on demanded sums, penalties, and interest.
"""

from typing import Tuple, List
from app.domain.schemas.legal_entities import FinancialDetails
from app.domain.schemas.validation import RuleViolation, ValidationInsight


def validate_financial_math(financials: FinancialDetails) -> Tuple[bool, List[RuleViolation], List[ValidationInsight], float]:
    """
    Validates that:
    total_recoverable_amount == principal_amount + penalty_amount + interest_amount
    Returns (is_valid, violations, insights, discrepancy)
    """
    violations: List[RuleViolation] = []
    insights: List[ValidationInsight] = []
    
    principal = round(float(financials.principal_amount or 0.0), 2)
    penalty = round(float(financials.penalty_amount or 0.0), 2)
    interest = round(float(financials.interest_amount or 0.0), 2)
    provided_total = round(float(financials.total_recoverable_amount or 0.0), 2)
    
    calculated_sum = round(principal + penalty + interest, 2)
    discrepancy = round(abs(calculated_sum - provided_total), 2)

    # Allow tiny rounding tolerances up to 1.00 rupee for statutory truncation
    if discrepancy > 1.0:
        violations.append(
            RuleViolation(
                rule_id="RULE_MATH_TOTAL_MISMATCH",
                severity="ERROR",
                field="financials.total_recoverable_amount",
                message=f"Total mismatch: Demanded sum is Rs {provided_total:,.2f}, but sum of Principal ({principal:,.2f}) + Penalty ({penalty:,.2f}) + Interest ({interest:,.2f}) equals Rs {calculated_sum:,.2f}. Discrepancy: Rs {discrepancy:,.2f}.",
                suggested_fix=f"Update total to Rs {calculated_sum:,.2f} or verify individual claim breakdown in original certificate."
            )
        )
        insights.append(
            ValidationInsight(
                category="FINANCIAL_ARITHMETIC",
                description=f"Math error: Calculated Rs {calculated_sum:,.2f} != Provided Rs {provided_total:,.2f}",
                is_valid=False
            )
        )
        return False, violations, insights, discrepancy

    insights.append(
        ValidationInsight(
            category="FINANCIAL_ARITHMETIC",
            description=f"Math verified: Rs {principal:,.2f} + Rs {penalty:,.2f} + Rs {interest:,.2f} = Rs {calculated_sum:,.2f}",
            is_valid=True
        )
    )
    return True, violations, insights, 0.0
