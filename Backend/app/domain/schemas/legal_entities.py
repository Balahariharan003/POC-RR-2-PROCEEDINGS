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
    MAINTENANCE = "MAINTENANCE"
    EPFO_ESIC = "EPFO_ESIC"
    LABOUR_COURT = "LABOUR_COURT"
    MINES_MINERALS = "MINES_MINERALS"
    TRANSPORT = "TRANSPORT"
    OTHER_COLLECTORATE = "OTHER_COLLECTORATE"
    GENERAL_RR = "GENERAL_RR"



class EntityType(str, Enum):
    COMPANY = "COMPANY"
    INDIVIDUAL = "INDIVIDUAL"
    MULTIPLE_INDIVIDUALS = "MULTIPLE_INDIVIDUALS"
    PROPRIETORSHIP = "PROPRIETORSHIP"
    PARTNERSHIP = "PARTNERSHIP"
    MULTIPLE_PROMOTERS = "MULTIPLE_PROMOTERS"
    GOVERNMENT_SERVANT = "GOVERNMENT_SERVANT"


class ReferenceItem(BaseModel):
    authority: Optional[str] = None
    reference_number: Optional[str] = None
    date: Optional[str] = None
    description: Optional[str] = None


class SuretyDetail(BaseModel):
    name: str = Field(..., description="Name of surety/guarantor")
    father_or_spouse_name: Optional[str] = None
    relationship: Optional[str] = None
    address: Optional[str] = None
    liability_share: Optional[float] = None


class DefaulterDetail(BaseModel):
    name: Optional[str] = Field(None, description="Full legal name of defaulter or entity")
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
    issuing_authority_name: Optional[str] = Field(None, description="E.g., Office of Commissioner of Customs (Chennai IV)")
    issuing_authority_designation: Optional[str] = None
    case_or_file_no: Optional[str] = Field(None, description="Originating file number e.g. F.NO. 516/2024-ARC")
    ia_or_mp_no: Optional[str] = Field(None, description="Order in Original No e.g. 105790/2024")
    order_date: Optional[str] = None
    letter_date: Optional[str] = None
    statutory_act_and_section: Optional[str] = None
    references_list: Optional[List[str]] = Field(default_factory=list, description="Dynamic list of references for பார்வை")


class PaymentInstructions(BaseModel):
    dd_favour_of: Optional[str] = None
    head_of_account: Optional[str] = None
    dispatch_address: Optional[str] = None


class ExtractedLegalEntities(BaseModel):
    """
    Standardized payload capturing the complete extraction from a Revenue Recovery certificate.
    """
    department_type: Optional[DepartmentType] = None
    entity_type: Optional[EntityType] = None
    
    # Core Entity Records
    defaulter_details: List[DefaulterDetail] = Field(default_factory=list)
    sureties: Optional[List[SuretyDetail]] = Field(default_factory=list, description="Guarantors or Sureties (e.g., Medical Bond cases)")
    financials: FinancialDetails
    reference_details: ReferenceDetails
    payment_instructions: PaymentInstructions
    references: Optional[List[str]] = Field(default_factory=list, description="Dynamic list of references for பார்வை")
    references_items: Optional[List[ReferenceItem]] = Field(default_factory=list, description="Structured reference items")
    
    # Revenue Administration Routing
    district_name: Optional[str] = None
    taluk_name: Optional[str] = None
    assigned_tahsildar: Optional[str] = None
    routing_confidence: float = 1.0
    
    # File Tracking
    file_no: Optional[str] = None
    file_year: Optional[str] = None
    section_code: Optional[str] = None
    roc_number: Optional[str] = None
    proceedings_date: Optional[str] = None
    collector_name: Optional[str] = None

    # Raw Text & Provenance
    source_file_sha256: Optional[str] = None
    ocr_confidence_score: float = 0.95
    extraction_raw_text: Optional[str] = None
