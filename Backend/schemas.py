"""
Pydantic Schemas for Structured Legal Entity Extraction and Document Generation.
"""

from typing import List, Optional
from pydantic import BaseModel, Field


class PartyDetails(BaseModel):
    """Details of Defaulter, Respondent, or Promoter."""
    name: str = Field(description="Name of the defaulter/respondent")
    father_or_husband_name: Optional[str] = Field(default=None, description="Father or Husband name")
    iec_number: Optional[str] = Field(default=None, description="Importer Exporter Code (IEC) if commercial/customs")
    door_no: Optional[str] = Field(default=None, description="Door or building number")
    street_area: Optional[str] = Field(default=None, description="Street / Area / Land")
    village: Optional[str] = Field(default=None, description="Village or City name")
    taluk: Optional[str] = Field(default=None, description="Taluk name")
    district: Optional[str] = Field(default=None, description="District name")
    pincode: Optional[str] = Field(default=None, description="Postal pincode")
    full_address: Optional[str] = Field(default=None, description="Full residential / office address in Tamil")
    vehicle_number: Optional[str] = Field(default=None, description="Vehicle Registration Number if motor accident case")


class BeneficiaryDetails(BaseModel):
    """Details of Claimant, Department, or Beneficiary receiving the recovery."""
    name: str = Field(description="Name of the beneficiary")
    address: Optional[str] = Field(default=None, description="Office address of the beneficiary")
    head_of_account: Optional[str] = Field(default=None, description="Head of account")
    payment_mode: str = Field(default="", description="Mode of remittance")


class LegalActs(BaseModel):
    """Applicable Legal Acts, Sections, and Board Orders."""
    primary_act: str = Field(default="", description="Primary act/section")
    primary_act_section: Optional[str] = Field(default="", description="Specific legal section")
    recovery_act: str = Field(default="", description="TN Revenue Recovery Act 1864 Sec 5")
    standing_order: str = Field(default="", description="Revenue Standing Order 41")
    other_sections: List[str] = Field(default_factory=list, description="Other cited legal sections")


class CaseDetails(BaseModel):
    """Court case, petition reference, and order dates."""
    court_name: str = Field(description="Issuing Court / Authority")
    court_location: Optional[str] = Field(default="", description="Court / office location")
    case_number: str = Field(description="File No. / Case No. / MCOP No.")
    order_in_original_no: Optional[str] = Field(default=None, description="Order in Original number")
    file_number: Optional[str] = Field(default=None, description="Department File number")
    ia_number: Optional[str] = Field(default=None, description="IA Number if present")
    court_order_date: Optional[str] = Field(default=None, description="Date of the order")
    certificate_date: Optional[str] = Field(default=None, description="Certificate / Requisition date")


class FinancialDetails(BaseModel):
    """Financial amounts, penalties, interest, and calculations."""
    principal_amount: float = Field(description="Principal recovery / duty amount in Rupees")
    penalty_amount: Optional[float] = Field(default=0.0, description="Penalty amount in Rupees")
    formatted_amount: str = Field(default="", description="Formatted currency string")
    amount_in_words_tamil: Optional[str] = Field(default=None, description="Amount in Tamil words")
    interest_rate: Optional[float] = Field(default=None, description="Annual interest percentage, if awarded")
    interest_applicable: bool = Field(default=False, description="Whether statutory interest is recoverable")
    interest_start_date: Optional[str] = Field(default=None, description="Date from which interest is calculated")
    interest_accrued: Optional[float] = Field(default=0.0, description="Calculated accrued interest")
    total_recoverable_amount: float = Field(default=0.0, description="Total recoverable amount (Principal + Penalty + Interest)")


class JurisdictionDetails(BaseModel):
    """Target Revenue Jurisdiction routing."""
    district: str = Field(default="", description="Revenue District")
    taluk: str = Field(default="", description="Target Taluk")
    tahsildar_title: str = Field(default="", description="Target Tahsildar title in Tamil")
    rdo_title: Optional[str] = Field(default="", description="Revenue Divisional Officer title")
    collector_name: str = Field(default="", description="District Collector Name & Designation")
    collector_designation: str = Field(default="", description="Designation")


class CopyRecipient(BaseModel):
    """Recipient in the 'நகல்' (Copy to) distribution list."""
    designation_or_name: str = Field(description="Recipient designation or party name")
    address_or_department: Optional[str] = Field(default=None, description="Recipient address or department")


class ReferenceDetails(BaseModel):
    """Court or Issuing Authority reference details."""
    issuing_authority_name: str = Field(default="")
    case_or_file_no: str = Field(default="")
    ia_or_mp_no: Optional[str] = Field(default="")
    order_date: str = Field(default="")
    letter_no: Optional[str] = Field(default=None)
    letter_date: Optional[str] = Field(default="")


class DefaulterDetail(BaseModel):
    """Defaulter person or company detail."""
    name: str = Field(default="")
    father_or_spouse_name: Optional[str] = Field(default=None)
    representation_or_title: Optional[str] = Field(default="")
    door_no: str = Field(default="")
    street_and_locality: str = Field(default="")
    taluk: str = Field(default="")
    district: str = Field(default="")
    pincode: str = Field(default="")


class FinancialsSchema(BaseModel):
    """Financial breakdown and amounts."""
    duty_amount: float = Field(default=0.0)
    penalty_amount: float = Field(default=0.0)
    total_amount: float = Field(default=0.0)
    amount_in_tamil_words: str = Field(default="")
    interest_rate: Optional[float] = Field(default=None)
    interest_start_date: Optional[str] = Field(default=None)


class PaymentInstructions(BaseModel):
    """Remittance and Demand Draft instructions."""
    dd_favour_of: str = Field(default="")
    head_of_account: Optional[str] = Field(default="")
    dispatch_address: str = Field(default="")


class ExtractedLegalEntities(BaseModel):
    """Consolidated Schema extracted by Ollama LLM with Department Classification."""
    department_type: str = Field(default="", description="Classification: 'CUSTOMS', 'TNRERA', 'MCOP', or 'WARRANT'")
    entity_type: str = Field(default="", description="Classification: 'INDIVIDUAL' or 'COMPANY'")
    file_no: str = Field(default="")
    file_year: str = Field(default="")
    section_code: str = Field(default="")
    district_name: str = Field(default="")
    taluk_name: str = Field(default="")
    collector_name: str = Field(default="")

    reference_details: Optional[ReferenceDetails] = Field(default_factory=ReferenceDetails)
    defaulter_details: List[DefaulterDetail] = Field(default_factory=list)
    payment_instructions: Optional[PaymentInstructions] = Field(default_factory=PaymentInstructions)

    case_details: CaseDetails
    legal_acts: LegalActs
    defaulter: PartyDetails
    beneficiary: BeneficiaryDetails
    financials: FinancialDetails
    jurisdiction: JurisdictionDetails
    proceedings_roc_number: Optional[str] = Field(default="", description="Collector Office ROC / File Reference Number")
    proceedings_date: Optional[str] = Field(default=None, description="Collector proceedings date")
    enclosures: List[str] = Field(default_factory=lambda: ["கடித நகல்"], description="List of enclosures (இணைப்பு)")
    copy_recipients: List[CopyRecipient] = Field(default_factory=list, description="Copy recipients list (நகல்)")


class ValidationResult(BaseModel):
    """Output of the Validation & Insight Engine."""
    department_type: str = ""
    math_valid: bool = False
    math_details: str = ""
    jurisdiction_routed: bool = False
    routed_taluk: str = ""
    routed_district: str = ""
    interest_applied: bool = False
    interest_calculation_breakdown: Optional[str] = None
    tamil_amount_words: str = ""
    warnings: List[str] = Field(default_factory=list)


class ProceedingsGenerationPayload(BaseModel):
    """Payload to render the final DOCX proceedings order."""
    department_type: str
    collector_name: str
    collector_designation: str
    roc_number: str
    proceedings_date: str
    district: str
    taluk: str
    subject_text: str
    reference_text: str
    defaulter_full_description: str
    acts_summary: str
    order_para1: str
    order_para2: str
    order_para3: str
    note_para1: Optional[str] = None
    note_para2: Optional[str] = None
    note_para3: Optional[str] = None
    note_para4: Optional[str] = None
    recovery_amount: str
    amount_in_words_tamil: str
    beneficiary_name: str
    beneficiary_address: str
    tahsildar_recipient: str
    rdo_recipient: str
    recipients: List[CopyRecipient]
    enclosures: List[str]
