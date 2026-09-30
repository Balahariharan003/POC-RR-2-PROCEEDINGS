"""
Legal Entities Schemas for Tamil Nadu Revenue Recovery Proceedings.
Captures all extracted metadata from requisition certificates (Customs, TNRERA, MCOP, etc.).
"""

from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class DepartmentType(str, Enum):
    CUSTOMS = "CUSTOMS"
    TNRERA = "TNRERA"
    MCOP = "MCOP"
    COMMERCIAL_TAX = "COMMERCIAL_TAX"
    EXCISE = "EXCISE"
    GENERAL_RR = "GENERAL_RR"


class EntityType(str, Enum):
    COMPANY = "COMPANY"
    INDIVIDUAL = "INDIVIDUAL"
    PARTNERSHIP = "PARTNERSHIP"


class DefaulterDetail(BaseModel):
    name: str = Field(..., description="Full legal name of defaulter or entity")
    father_or_spouse_name: Optional[str] = None
    representation_or_title: Optional[str] = None
    door_no: Optional[str] = None
    street_and_locality: Optional[str] = None
    village: Optional[str] = None
    taluk: Optional[str] = None
    district: Optional[str] = None
    pincode: Optional[str] = None
    iec_number: Optional[str] = None
    pan_number: Optional[str] = None
    gstin: Optional[str] = None


class FinancialDetails(BaseModel):
    principal_amount: float = Field(0.0, description="Principal demanded sum in INR")
    penalty_amount: float = Field(0.0, description="Statutory penalty in INR")
    interest_amount: float = Field(0.0, description="Accrued interest in INR")
    interest_rate_percent: Optional[float] = None
    total_recoverable_amount: float = Field(..., description="Principal + Penalty + Interest sum")
    amount_in_words_tamil: Optional[str] = None
    amount_in_words_english: Optional[str] = None


class ReferenceDetails(BaseModel):
    issuing_authority_name: str = Field(..., description="E.g., Office of Commissioner of Customs (Chennai IV)")
    issuing_authority_designation: Optional[str] = None
    case_or_file_no: str = Field(..., description="Originating file number e.g. F.NO. 516/2024-ARC")
    ia_or_mp_no: Optional[str] = Field(None, description="Order in Original No e.g. 105790/2024")
    order_date: Optional[str] = None
    letter_date: Optional[str] = None
    statutory_act_and_section: Optional[str] = "Section 142(1)(c)(ii) of Customs Act, 1962"


class PaymentInstructions(BaseModel):
    dd_favour_of: Optional[str] = None
    head_of_account: Optional[str] = None
    dispatch_address: Optional[str] = None


class ExtractedLegalEntities(BaseModel):
    """
    Standardized payload capturing the complete extraction from a Revenue Recovery certificate.
    """
    department_type: DepartmentType = DepartmentType.CUSTOMS
    entity_type: EntityType = EntityType.COMPANY
    
    # Core Entity Records
    defaulter_details: List[DefaulterDetail] = Field(default_factory=list)
    financials: FinancialDetails
    reference_details: ReferenceDetails
    payment_instructions: PaymentInstructions
    
    # Revenue Administration Routing
    district_name: str = "ஈரோடு"
    taluk_name: str = "ஈரோடு"
    assigned_tahsildar: Optional[str] = "வருவாய் வட்டாட்சியர், ஈரோடு"
    routing_confidence: float = 1.0
    
    # File Tracking
    file_no: str = "1248"
    file_year: str = "2026"
    section_code: str = "ஈ2"
    roc_number: Optional[str] = None
    proceedings_date: Optional[str] = None
    collector_name: str = "திரு.ச.கந்தசாமி, இ.ஆ.ப."

    # Raw Text & Provenance
    source_file_sha256: Optional[str] = None
    ocr_confidence_score: float = 0.95
    extraction_raw_text: Optional[str] = None
