"""
Department Registry and Statutory Recovery Metadata Provider.
Provides declarative, extensible registration of all government, judicial, and regulatory
authorities for Tamil Nadu Revenue Recovery Proceedings (RSO 41 & Act II of 1864),
with dynamic LLM-driven resolution.
"""

from typing import Dict, List, Optional, Any, Union
from pydantic import BaseModel, Field
from app.domain.schemas.legal_entities import DepartmentType


class DepartmentSpec(BaseModel):
    department_type: Union[DepartmentType, str]
    title_ta: str
    issuing_authority_default: str
    statutory_act_and_section: str
    head_of_account_default: str = "0029 - Land Revenue"
    section_code_default: str = "ஈ2"
    default_enclosure: str = "கோரிக்கைக் கடித நகல்"
    detection_keywords: List[str] = Field(default_factory=list)
    default_reference_templates: List[str] = Field(default_factory=list)


DEPARTMENT_SPECS: Dict[DepartmentType, DepartmentSpec] = {
    DepartmentType.CUSTOMS: DepartmentSpec(
        department_type=DepartmentType.CUSTOMS,
        title_ta="சுங்கத்துறை (Customs Commissionerate)",
        issuing_authority_default="Office of the Commissioner of Customs",
        statutory_act_and_section="Section 142(1)(c)(ii) of the Customs Act, 1962",
        head_of_account_default="037 – Customs",
        section_code_default="ஈ2",
        default_enclosure="கடித நகல் மற்றும் அசல் சான்றிதழ்",
        detection_keywords=[
            "CUSTOMS", "CUSTOM HOUSE", "COMMISSIONER OF CUSTOMS", "EXPORT COMMISSIONERATE",
            "SECTION 142", "IEC NO", "IMPORT EXPORT", "DRAWBACK", "SEZ"
        ],
        default_reference_templates=[
            "{issuing_authority}, கடித F.NO. {case_no}, நாள் {letter_date}.",
            "வருவாய் நிலை ஆணை எண் 41 மற்றும் தமிழ்நாடு வருவாய் வசூல் சட்டம் 1864 பிரிவு 5."
        ]
    ),
    DepartmentType.TNRERA: DepartmentSpec(
        department_type=DepartmentType.TNRERA,
        title_ta="தமிழ்நாடு ரியல் எஸ்டேட் ஒழுங்குமுறை ஆணையம்",
        issuing_authority_default="தமிழ்நாடு ரியல் எஸ்டேட் ஒழுங்குமுறை ஆணையம் (TNRERA)",
        statutory_act_and_section="பிரிவு 40(1), தமிழ்நாடு ரியல் எஸ்டேட் (ஒழுங்குமுறை மற்றும் மேம்பாடு) சட்டம் 2016",
        head_of_account_default="0070 - Other Administrative Services / TNRERA",
        section_code_default="டி2",
        default_enclosure="TNRERA ஆணை நகல்",
        detection_keywords=[
            "TNRERA", "REAL ESTATE", "REGULATORY AUTHORITY", "LAYOUT", "PROMOTER",
            "EXECUTION PETITION", "TNRERA/A/", "BUILDER", "APARTMENT"
        ],
        default_reference_templates=[
            "{issuing_authority}, கடித ந.க. {case_no}, நாள் {letter_date}.",
            "தமிழ்நாடு வருவாய் வசூல் சட்டம் 1864 பிரிவு 5."
        ]
    ),
    DepartmentType.MCOP: DepartmentSpec(
        department_type=DepartmentType.MCOP,
        title_ta="மோட்டார் வாகன விபத்து இழப்பீட்டு தீர்ப்பாயம்",
        issuing_authority_default="மோட்டார் வாகன விபத்து இழப்பீட்டு தீர்ப்பாயம்",
        statutory_act_and_section="பிரிவு 174, மோட்டார் வாகனச் சட்டம் 1988 மற்றும் தமிழ்நாடு வருவாய் வசூல் சட்டம் 1864",
        head_of_account_default="0041 - Taxes on Vehicles / MCOP Claims",
        section_code_default="ஈ2",
        default_enclosure="தீர்ப்பாய ஆணை நகல்",
        detection_keywords=[
            "MCOP", "MOTOR ACCIDENT", "CLAIMS TRIBUNAL", "M.C.O.P", "ACCIDENT CLAIMS",
            "MACT", "SPECIAL SUB COURT", "MOTOR VEHICLES ACT", "MOTOR VEHICLE", "SECTION 174",
            "M.V ACT", "M.V. ACT", "SUBORDINATE JUDGE", "SUB JUDGE", "CRIME VEHICLE"
        ],
        default_reference_templates=[
            "{issuing_authority}, {case_no}, உத்தரவு, நாள் {order_date}.",
            "வருவாய் நிலை ஆணை எண் 41 மற்றும் தமிழ்நாடு வருவாய் வசூல் சட்டம் 1864 பிரிவு 5."
        ]
    ),
    DepartmentType.COMMERCIAL_TAX: DepartmentSpec(
        department_type=DepartmentType.COMMERCIAL_TAX,
        title_ta="வணிகவரித் துறை (Commercial Taxes)",
        issuing_authority_default="வணிகவரி உதவி ஆணையர் (மாநில வரிகள்)",
        statutory_act_and_section="தமிழ்நாடு மதிப்புக் கூட்டு வரிச் சட்டம் 2006 / ஜி.எஸ்.டி சட்டம் பிரிவு 79",
        head_of_account_default="0040 - Taxes on Sales, Trade etc.",
        section_code_default="ஈ2",
        default_enclosure="வணிகவரி வட்டாட்சியர் கோரிக்கை படிவம்",
        detection_keywords=[
            "COMMERCIAL TAX", "TNVAT", "GST", "STATE TAX", "DEPUTY COMMISSIONER (CT)",
            "ASSISTANT COMMISSIONER (ST)", "TIN NO", "GSTIN"
        ],
        default_reference_templates=[
            "{issuing_authority}, கடித ந.க. {case_no}, நாள் {letter_date}.",
            "தமிழ்நாடு வருவாய் வசூல் சட்டம் 1864 பிரிவு 5."
        ]
    ),
    DepartmentType.EXCISE: DepartmentSpec(
        department_type=DepartmentType.EXCISE,
        title_ta="கலால் மற்றும் மதுவிலக்குத் துறை (Prohibition & Excise)",
        issuing_authority_default="உதவி ஆணையர் (கலால்), கலால் மற்றும் மதுவிலக்குத் துறை",
        statutory_act_and_section="தமிழ்நாடு மதுவிலக்குச் சட்டம் 1937 மற்றும் வருவாய் வசூல் சட்டம் 1864",
        head_of_account_default="0039 - State Excise",
        section_code_default="ஈ2",
        default_enclosure="கலால் நிலுவை சான்றிதழ்",
        detection_keywords=[
            "EXCISE", "PROHIBITION", "TASMAC", "DISTILLERY", "RECTIFIED SPIRIT", "EXCISE DUTY"
        ],
        default_reference_templates=[
            "{issuing_authority}, கடித ந.க. {case_no}, நாள் {letter_date}.",
            "தமிழ்நாடு வருவாய் வசூல் சட்டம் 1864 பிரிவு 5."
        ]
    ),
    DepartmentType.GENERAL_RR: DepartmentSpec(
        department_type=DepartmentType.GENERAL_RR,
        title_ta="பொது வருவாய் வசூல் (General Revenue Recovery)",
        issuing_authority_default="வருவாய்த்துறை மற்றும் பேரிடர் மேலாண்மைத் துறை",
        statutory_act_and_section="தமிழ்நாடு வருவாய் வசூல் சட்டம் 1864 பிரிவு 5 / வருவாய் நிலை ஆணை 41",
        head_of_account_default="0029 - Land Revenue",
        section_code_default="ஈ2",
        default_enclosure="கோரிக்கைக் கடித நகல்",
        detection_keywords=[
            "REVENUE RECOVERY", "LAND REVENUE", "BOND", "MEDICAL EDUCATION", "GOVERNMENT SERVANT",
            "SURETY", "DISTRAINT WARRANT"
        ],
        default_reference_templates=[
            "{issuing_authority}, கடித ந.க. {case_no}, நாள் {letter_date}.",
            "தமிழ்நாடு வருவாய் வசூல் சட்டம் 1864 பிரிவு 5."
        ]
    ),
}


class DepartmentRegistry:
    """Dynamic, enterprise resolver for revenue departments, statutory acts, and reference structures."""

    @classmethod
    def get_spec(cls, dept_type: Union[DepartmentType, str]) -> DepartmentSpec:
        if isinstance(dept_type, DepartmentType):
            return DEPARTMENT_SPECS.get(dept_type, DEPARTMENT_SPECS[DepartmentType.GENERAL_RR])
        try:
            d_enum = DepartmentType(dept_type)
            return DEPARTMENT_SPECS.get(d_enum, DEPARTMENT_SPECS[DepartmentType.GENERAL_RR])
        except Exception:
            return DepartmentSpec(
                department_type=str(dept_type),
                title_ta=str(dept_type),
                issuing_authority_default="கோரிக்கை அலுவலகம்",
                statutory_act_and_section="தமிழ்நாடு வருவாய் வசூல் சட்டம் 1864 பிரிவு 5 / வருவாய் நிலை ஆணை 41",
            )

    @classmethod
    def create_dynamic_spec(
        cls,
        department_name_ta: str,
        statute_cited: str,
        issuing_authority: Optional[str] = None,
        head_of_account: Optional[str] = None,
        section_code: str = "ஈ2",
        enclosure: str = "கோரிக்கைக் கடித நகல்"
    ) -> DepartmentSpec:
        """Creates a fully dynamic DepartmentSpec from LLM-extracted legal metadata."""
        return DepartmentSpec(
            department_type=DepartmentType.GENERAL_RR,
            title_ta=department_name_ta or "பொது வருவாய் வசூல்",
            issuing_authority_default=issuing_authority or department_name_ta or "கோரிக்கை அலுவலகம்",
            statutory_act_and_section=statute_cited or "தமிழ்நாடு வருவாய் வசூல் சட்டம் 1864 பிரிவு 5",
            head_of_account_default=head_of_account or "0029 - Land Revenue",
            section_code_default=section_code or "ஈ2",
            default_enclosure=enclosure or "கோரிக்கைக் கடித நகல்"
        )

    @classmethod
    def match_department(cls, text: str) -> DepartmentSpec:
        """Determines the department specification based on weighted keyword match frequencies."""
        text_upper = text.upper()
        best_spec = DEPARTMENT_SPECS[DepartmentType.GENERAL_RR]
        max_score = 0

        for dept_type, spec in DEPARTMENT_SPECS.items():
            score = 0
            for kw in spec.detection_keywords:
                if kw in text_upper:
                    if dept_type != DepartmentType.GENERAL_RR:
                        score += 3 if len(kw) > 6 else 2
                    else:
                        score += 1
            if score > max_score:
                max_score = score
                best_spec = spec

        return best_spec

    @classmethod
    def build_default_references(
        cls,
        spec: DepartmentSpec,
        issuing_auth: str,
        case_no: str,
        order_no: str,
        letter_date: str,
        order_date: str,
    ) -> List[str]:
        """Assembles official references dynamically using templated patterns."""
        refs = []
        for tpl in spec.default_reference_templates:
            formatted = tpl.format(
                issuing_authority=issuing_auth or spec.issuing_authority_default,
                case_no=case_no or "RR-2026",
                order_no=order_no or case_no or "RR-ORD-2026",
                letter_date=letter_date or "2026-03-26",
                order_date=order_date or letter_date or "2026-03-26",
            )
            refs.append(formatted)
        return refs
