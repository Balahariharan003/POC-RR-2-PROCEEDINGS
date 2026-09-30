"""
Validation Schemas for Revenue Recovery Verification.
"""

from typing import List, Optional
from pydantic import BaseModel, Field


class RuleViolation(BaseModel):
    rule_id: str
    severity: str = Field(..., description="ERROR | WARNING | INFO")
    field: str
    message: str
    suggested_fix: Optional[str] = None


class ValidationInsight(BaseModel):
    category: str
    description: str
    is_valid: bool


class ValidationResult(BaseModel):
    is_valid: bool = True
    has_errors: bool = False
    violations: List[RuleViolation] = Field(default_factory=list)
    insights: List[ValidationInsight] = Field(default_factory=list)
    calculated_total: float = 0.0
    provided_total: float = 0.0
    math_discrepancy: float = 0.0
    jurisdiction_matched: bool = True
    jurisdiction_assigned_taluk: Optional[str] = None
