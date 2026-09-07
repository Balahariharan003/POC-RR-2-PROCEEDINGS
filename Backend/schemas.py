"""
Pydantic Schemas for Structured Legal Entity Extraction and Document Generation.
"""

from typing import List, Optional
from pydantic import BaseModel, Field


class PartyDetails(BaseModel):
    """Details of Defaulter, Respondent, or Promoter."""
    name: str = Field(description="Name of the defaulter/respondent, e.g., 'M/s. Prisma Garments' or 'திரு.P.நல்லசிவம்'")
    father_or_husband_name: Optional[str] = Field(default=None, description="Father or Husband name")
    iec_number: Optional[str] = Field(default=None, description="Importer Exporter Code (IEC) if commercial/customs, e.g., '3205015860'")
    door_no: Optional[str] = Field(default=None, description="Door or building number, e.g., '46'")
    street_area: Optional[str] = Field(default=None, description="Street / Area / Land, e.g., 'உழவன் நகர், 6-வது உழவர் வீதி, பெருமாள் கவுண்டர் தோட்டம்'")
    village: Optional[str] = Field(default=None, description="Village or City name, e.g., 'ஈரோடு'")
    taluk: Optional[str] = Field(default=None, description="Taluk name, e.g., 'ஈரோடு'")
    district: Optional[str] = Field(default=None, description="District name, e.g., 'ஈரோடு'")
    pincode: Optional[str] = Field(default=None, description="Postal pincode, e.g., '638009'")
    full_address: Optional[str] = Field(default=None, description="Full residential / office address in Tamil")
    vehicle_number: Optional[str] = Field(default=None, description="Vehicle Registration Number if motor accident case")


class BeneficiaryDetails(BaseModel):
    """Details of Claimant, Department, or Beneficiary receiving the recovery."""
    name: str = Field(description="Name of the beneficiary, e.g., 'Commissioner of Customs, Export Commissionerate, Chennai IV'")
    address: Optional[str] = Field(default=None, description="Office address of the beneficiary")
    head_of_account: Optional[str] = Field(default=None, description="Head of account, e.g., 'Head of Account: 037 - Customs'")
    payment_mode: str = Field(default="Demand Draft (வங்கி வரைவோலை)", description="Mode of remittance")


class LegalActs(BaseModel):
    """Applicable Legal Acts, Sections, and Board Orders."""
    primary_act: str = Field(default="சுங்கச் சட்டம் 1962 (Customs Act, 1962)", description="Primary act/section")
    primary_act_section: Optional[str] = Field(default="சுங்கச் சட்டம் 1962 பிரிவு 142(1)(c)(i)", description="Specific legal section")
    recovery_act: str = Field(default="தமிழ்நாடு வருவாய் வசூல் சட்டம் 1864 பிரிவு 5", description="TN Revenue Recovery Act 1864 Sec 5")
    standing_order: str = Field(default="வருவாய் நிலை ஆணை எண் 41 (RSO 41)", description="Revenue Standing Order 41")
    other_sections: List[str] = Field(default_factory=list, description="Other cited legal sections")


class CaseDetails(BaseModel):
    """Court case, petition reference, and order dates."""
    court_name: str = Field(description="Issuing Court / Authority, e.g., 'Office of the Commissioner of Customs (Chennai IV - Export)'")
    court_location: Optional[str] = Field(default="ஈரோடு", description="Court / office location")
    case_number: str = Field(description="File No. / Case No. / MCOP No., e.g., 'F.NO. 516/2024-ARC'")
    order_in_original_no: Optional[str] = Field(default=None, description="Order in Original number, e.g., 'Order in Original No. 105790/2024'")
    file_number: Optional[str] = Field(default=None, description="Department File number, e.g., 'F.NO. 516/2024-ARC'")
    ia_number: Optional[str] = Field(default=None, description="IA Number if present")
    court_order_date: Optional[str] = Field(default=None, description="Date of the order, e.g., '28.03.2024'")
    certificate_date: Optional[str] = Field(default=None, description="Certificate / Requisition date, e.g., '24.12.2025'")


class FinancialDetails(BaseModel):
    """Financial amounts, penalties, interest, and calculations."""
    principal_amount: float = Field(description="Principal recovery / duty amount in Rupees, e.g., 173308.0")
    penalty_amount: Optional[float] = Field(default=0.0, description="Penalty amount in Rupees, e.g., 9000.0")
    formatted_amount: str = Field(default="1,82,308/-", description="Formatted currency string")
    amount_in_words_tamil: Optional[str] = Field(default=None, description="Amount in Tamil words")
    interest_rate: Optional[float] = Field(default=None, description="Annual interest percentage, if awarded")
    interest_applicable: bool = Field(default=False, description="Whether statutory interest is recoverable")
    interest_start_date: Optional[str] = Field(default=None, description="Date from which interest is calculated")
    interest_accrued: Optional[float] = Field(default=0.0, description="Calculated accrued interest")
    total_recoverable_amount: float = Field(default=182308.0, description="Total recoverable amount (Principal + Penalty + Interest)")


class JurisdictionDetails(BaseModel):
    """Target Revenue Jurisdiction routing."""
    district: str = Field(default="ஈரோடு", description="Revenue District, e.g., 'ஈரோடு'")
    taluk: str = Field(default="ஈரோடு", description="Target Taluk, e.g., 'ஈரோடு'")
    tahsildar_title: str = Field(default="வருவாய் வட்டாட்சியர், ஈரோடு", description="Target Tahsildar title in Tamil")
    rdo_title: Optional[str] = Field(default="வருவாய் கோட்டாட்சியர், ஈரோடு", description="Revenue Divisional Officer title")
    collector_name: str = Field(default="திரு.ச.கந்தசாமி,இ.ஆ.ப.,", description="District Collector Name & Designation")
    collector_designation: str = Field(default="மாவட்ட ஆட்சித் தலைவர் மற்றும் மாவட்ட நிர்வாக நடுவர்", description="Designation")


class CopyRecipient(BaseModel):
    """Recipient in the 'நகல்' (Copy to) distribution list."""
    designation_or_name: str = Field(description="Recipient designation or party name")
    address_or_department: Optional[str] = Field(default=None, description="Recipient address or department")


class ReferenceDetails(BaseModel):
    """Court or Issuing Authority reference details."""
    issuing_authority_name: str = Field(default="உதவி ஆணையர் (ஏற்றுமதி), சுங்கத்துறை ஆணையரகம் (சென்னை IV)")
    case_or_file_no: str = Field(default="F.NO. 516/2024-ARC")
    ia_or_mp_no: Optional[str] = Field(default="105790/2024")
    order_date: str = Field(default="28.03.2024")
    letter_no: Optional[str] = Field(default=None)
    letter_date: Optional[str] = Field(default="24.12.2025")


class DefaulterDetail(BaseModel):
    """Defaulter person or company detail."""
    name: str = Field(default="M/s. Prisma Garments")
    father_or_spouse_name: Optional[str] = Field(default=None)
    representation_or_title: Optional[str] = Field(default="IEC No: 3205015860")
    door_no: str = Field(default="46")
    street_and_locality: str = Field(default="உழவன் நகர், 6-வது உழவர் வீதி, பெருமாள் கவுண்டர் தோட்டம்")
    taluk: str = Field(default="ஈரோடு")
    district: str = Field(default="ஈரோடு")
    pincode: str = Field(default="638009")


class FinancialsSchema(BaseModel):
    """Financial breakdown and amounts."""
    duty_amount: float = Field(default=173308.0)
    penalty_amount: float = Field(default=9000.0)
    total_amount: float = Field(default=182308.0)
    amount_in_tamil_words: str = Field(default="ரூபாய் ஒரு இலட்சத்து எண்பத்திரண்டாயிரத்து முன்னூற்றி எட்டு மட்டும்")
    interest_rate: Optional[float] = Field(default=None)
    interest_start_date: Optional[str] = Field(default=None)


class PaymentInstructions(BaseModel):
    """Remittance and Demand Draft instructions."""
    dd_favour_of: str = Field(default="Commissioner of Customs, Export Commissionerate, Chennai IV")
    head_of_account: Optional[str] = Field(default="Head of Account: 037 - Customs")
    dispatch_address: str = Field(default="Office of the Commissioner of Customs, Export Commissionerate, Custom House, 60, Rajaji Salai, Chennai – 600001")


class ExtractedLegalEntities(BaseModel):
    """Consolidated Schema extracted by Ollama LLM with Department Classification."""
    department_type: str = Field(default="CUSTOMS", description="Classification: 'CUSTOMS', 'TNRERA', 'MCOP', or 'WARRANT'")
    entity_type: str = Field(default="COMPANY", description="Classification: 'INDIVIDUAL' or 'COMPANY'")
    file_no: str = Field(default="9667")
    file_year: str = Field(default="2026")
    section_code: str = Field(default="ஈ2")
    district_name: str = Field(default="ஈரோடு")
    taluk_name: str = Field(default="ஈரோடு")
    collector_name: str = Field(default="திரு.ச.கந்தசாமி,இ.ஆ.ப.,")

    reference_details: Optional[ReferenceDetails] = Field(default_factory=ReferenceDetails)
    defaulter_details: List[DefaulterDetail] = Field(default_factory=list)
    payment_instructions: Optional[PaymentInstructions] = Field(default_factory=PaymentInstructions)

    case_details: CaseDetails
    legal_acts: LegalActs
    defaulter: PartyDetails
    beneficiary: BeneficiaryDetails
    financials: FinancialDetails
    jurisdiction: JurisdictionDetails
    proceedings_roc_number: Optional[str] = Field(default="ந.க.9667/2026/ஈ2", description="Collector Office ROC / File Reference Number")
    proceedings_date: Optional[str] = Field(default=None, description="Collector proceedings date")
    enclosures: List[str] = Field(default_factory=lambda: ["கடித நகல்"], description="List of enclosures (இணைப்பு)")
    copy_recipients: List[CopyRecipient] = Field(default_factory=list, description="Copy recipients list (நகல்)")


class ValidationResult(BaseModel):
    """Output of the Validation & Insight Engine."""
    department_type: str = "CUSTOMS"
    math_valid: bool = True
    math_details: str = "Total matches award specification."
    jurisdiction_routed: bool = True
    routed_taluk: str = "ஈரோடு"
    routed_district: str = "ஈரோடு"
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
