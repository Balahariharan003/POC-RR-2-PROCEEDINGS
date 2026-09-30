"""
Domain Pydantic Schemas / DTOs.
"""

from .auth import LoginRequest, TokenResponse, UserClaims
from .user import UserCreate, UserUpdate, UserResponse
from .legal_entities import (
    ExtractedLegalEntities,
    DefaulterDetail,
    FinancialDetails,
    ReferenceDetails,
    PaymentInstructions,
    DepartmentType,
    EntityType,
)
from .validation import ValidationResult, RuleViolation, ValidationInsight
from .template import TemplateCreate, TemplateUpdate, TemplateResponse

__all__ = [
    "LoginRequest",
    "TokenResponse",
    "UserClaims",
    "UserCreate",
    "UserUpdate",
    "UserResponse",
    "ExtractedLegalEntities",
    "DefaulterDetail",
    "FinancialDetails",
    "ReferenceDetails",
    "PaymentInstructions",
    "DepartmentType",
    "EntityType",
    "ValidationResult",
    "RuleViolation",
    "ValidationInsight",
    "TemplateCreate",
    "TemplateUpdate",
    "TemplateResponse",
]
