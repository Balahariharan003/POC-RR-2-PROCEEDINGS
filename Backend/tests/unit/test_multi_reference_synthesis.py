"""
Unit tests for Multi-Reference Extraction and Entity-Aware Proceedings Synthesis.
Tests edge cases across Customs, TNRERA (Multi-promoter), MCOP, Medical Bond (7 references), and Warrant.
"""

import pytest
from app.domain.schemas.legal_entities import (
    ExtractedLegalEntities,
    DefaulterDetail,
    FinancialDetails,
    ReferenceDetails,
    ReferenceItem,
    SuretyDetail,
    PaymentInstructions,
    DepartmentType,
    EntityType,
)
from app.services.llm_service import LLMService
from app.services.document_service import DocumentService


@pytest.fixture
def doc_service(tmp_path):
    return DocumentService(output_dir=tmp_path)


def test_customs_company_synthesis(doc_service):
    """Test Customs Company extraction and synthesis."""
    entities = ExtractedLegalEntities(
        department_type=DepartmentType.CUSTOMS,
        entity_type=EntityType.COMPANY,
        defaulter_details=[
            DefaulterDetail(
                name="M/s Prisma Garments",
                door_no="46",
                street_and_locality="Perundurai Road, Erode",
                taluk="ஈரோடு",
                district="ஈரோடு",
                pincode="638011",
                iec_number="3205015860"
            )
        ],
        financials=FinancialDetails(
            principal_amount=173308.0,
            penalty_amount=9000.0,
            interest_amount=0.0,
            total_recoverable_amount=182308.0,
            amount_in_words_tamil="ஒரு லட்சத்து எண்பத்தி இரண்டாயிரத்து முன்னூற்று எட்டு ரூபாய் மட்டும்"
        ),
        reference_details=ReferenceDetails(
            issuing_authority_name="Office of Commissioner of Customs (Chennai IV)",
            case_or_file_no="F.NO. 516/2024-ARC",
            ia_or_mp_no="105790/2024",
            order_date="24.12.2025",
            letter_date="28.03.2024",
            references_list=[
                "உதவி ஆணையர் (ஏற்றுமதி), சுங்கத்துறை ஆணையரகம் (சென்னை IV), கடித F.NO. 516/2024-ARC, நாள் 28.03.2024.",
                "Order in Original No. 105790/2024, நாள் 24.12.2025."
            ]
        ),
        payment_instructions=PaymentInstructions(
            dd_favour_of="Commissioner of Customs, Export Commissionerate (Chennai IV)",
            head_of_account="037 – Customs",
            dispatch_address="Custom House, 60, Rajaji Salai, Chennai- 600 001."
        ),
        district_name="ஈரோடு",
        taluk_name="ஈரோடு"
    )

    ctx = doc_service.prepare_context(entities)
    assert "M/s Prisma Garments" in ctx["defaulter_name"]
    assert "இயங்கி வரும்" in ctx["living_verb"]
    assert "நிறுவனத்திடமிருந்து" in ctx["defaulter_suffix"]
    assert "182,308" in ctx["total_amount"]
    assert len(ctx["references"]) == 2
    assert "1. உதவி ஆணையர்" in ctx["reference_text"]
    assert "2. Order in Original" in ctx["reference_text"]


def test_tnrera_multi_promoters_synthesis(doc_service):
    """Test TNRERA Multi-Promoter case with multiple references."""
    entities = ExtractedLegalEntities(
        department_type=DepartmentType.TNRERA,
        entity_type=EntityType.MULTIPLE_PROMOTERS,
        defaulter_details=[
            DefaulterDetail(name="Tvl. V.K. Subramaniam", door_no="12", street_and_locality="Gandhi Nagar", taluk="ஈரோடு", district="ஈரோடு", pincode="638009"),
            DefaulterDetail(name="S. Sekar", door_no="14", street_and_locality="Gandhi Nagar", taluk="ஈரோடு", district="ஈரோடு", pincode="638009"),
            DefaulterDetail(name="N. Thangavel", door_no="16", street_and_locality="Gandhi Nagar", taluk="ஈரோடு", district="ஈரோடு", pincode="638009")
        ],
        financials=FinancialDetails(
            principal_amount=150000.0,
            penalty_amount=50000.0,
            interest_amount=0.0,
            total_recoverable_amount=200000.0,
            amount_in_words_tamil="இரண்டு லட்சம் ரூபாய் மட்டும்"
        ),
        reference_details=ReferenceDetails(
            issuing_authority_name="தமிழ்நாடு ரியல் எஸ்டேட் ஒழுங்குமுறை ஆணையம் (TNRERA)",
            case_or_file_no="TNRERA/A/34/2022",
            ia_or_mp_no="Order No. 45/2023",
            order_date="15.06.2023",
            references_list=[
                "தமிழ்நாடு ரியல் எஸ்டேட் ஒழுங்குமுறை ஆணையம், சென்னை, கடித ந.க. TNRERA/A/34/2022, நாள் 15.06.2023.",
                "TNRERA இறுதி ஆணை எண். 45/2023, நாள் 10.05.2023."
            ]
        ),
        payment_instructions=PaymentInstructions(
            dd_favour_of="The Member Secretary, TNRERA, Chennai",
            head_of_account="0070 - Other Administrative Services",
            dispatch_address="CMDA Complex, No.1A, Gandhi Irwin Bridge Road, Egmore, Chennai - 600008."
        ),
        district_name="ஈரோடு",
        taluk_name="ஈரோடு"
    )

    ctx = doc_service.prepare_context(entities)
    assert ctx["entity_type"] == "MULTIPLE_PROMOTERS"
    assert "Tvl. V.K. Subramaniam" in ctx["defaulter_name"]
    assert "ஆகியோரிடமிருந்து" in ctx["defaulter_suffix"]
    assert len(ctx["references"]) == 2
    assert "TNRERA" in ctx["subject_text"]


def test_medical_bond_defaulter_with_seven_references(doc_service):
    """Test 14-page Salem Collectorate Style Medical Bond dossier with 7 references and sureties."""
    refs = [
        "இயக்குநர், மருத்துவக் கல்வி இயக்ககம், சென்னை அவர்களின் கடித ந.க. எண் 11204/ME1/2021, நாள் 12.03.2021.",
        "முதல்வர், அரசு மோகன் குமாரமங்கலம் மருத்துவக் கல்லூரி, சேலம் அவர்களின் கடிதம் ந.க. எண் 4521/ME/2022, நாள் 15.08.2022.",
        "அரசாணை (நிலை) எண் 185, மக்கள் நல்வாழ்வு மற்றும் குடும்ப நலத்துறை, நாள் 24.06.2020.",
        "முதுநிலை மருத்துவ படிப்பு (MD) ஒப்பந்தப் பத்திரம் (Bond), நாள் 10.05.2017.",
        "உயர் சிறப்பு மருத்துவ படிப்பு (DM Cardio) ஒப்பந்தப் பத்திரம் (Bond), நாள் 20.08.2019.",
        "சேலம் மாவட்ட ஆட்சியர் அவர்களின் நினைவூட்டுக் கடிதம் ந.க. 4088/2023/ஈ2, நாள் 10.01.2024.",
        "வருவாய் நிலை ஆணை எண் 41 மற்றும் தமிழ்நாடு வருவாய் வசூல் சட்டம் 1864 பிரிவு 5."
    ]

    entities = ExtractedLegalEntities(
        department_type=DepartmentType.GENERAL_RR,
        entity_type=EntityType.GOVERNMENT_SERVANT,
        defaulter_details=[
            DefaulterDetail(
                name="Dr. G. Narayanan, DM (Cardiology)",
                father_or_spouse_name="S/o Gopalakrishnan",
                door_no="12/4",
                street_and_locality="Suramangalam Main Road",
                taluk="சேலம்",
                district="சேலம்",
                pincode="636005",
                representation_or_title="முன்னாள் அரசு மருத்துவ மாணவர் / அரசு மருத்துவர்"
            )
        ],
        sureties=[
            SuretyDetail(name="K. Gopalakrishnan", relationship="தந்தை (Surety 1)", address="12/4, Suramangalam Main Road, Salem"),
            SuretyDetail(name="G. Radhika", relationship="மனைவி (Surety 2)", address="12/4, Suramangalam Main Road, Salem")
        ],
        financials=FinancialDetails(
            principal_amount=5000000.0,
            penalty_amount=0.0,
            interest_amount=1250000.0,
            interest_rate_percent=12.0,
            total_recoverable_amount=6250000.0,
            amount_in_words_tamil="அறுபத்து இரண்டு லட்சத்து ஐம்பதாயிரம் ரூபாய் மட்டும்"
        ),
        reference_details=ReferenceDetails(
            issuing_authority_name="இயக்குநர், மருத்துவக் கல்வி மற்றும் ஆராய்ச்சி இயக்ககம், சென்னை",
            case_or_file_no="11204/ME1/2021",
            ia_or_mp_no="G.O.Ms.185",
            order_date="12.03.2021",
            references_list=refs
        ),
        payment_instructions=PaymentInstructions(
            dd_favour_of="The Director of Medical Education, Chennai",
            head_of_account="0210 - Medical and Public Health",
            dispatch_address="Directorate of Medical Education, Kilpauk, Chennai - 600010."
        ),
        district_name="சேலம்",
        taluk_name="சேலம்"
    )

    ctx = doc_service.prepare_context(entities)
    assert len(ctx["references"]) == 7
    assert "1. இயக்குநர், மருத்துவக் கல்வி இயக்ககம்" in ctx["reference_text"]
    assert "7. வருவாய் நிலை ஆணை" in ctx["reference_text"]
    assert "Dr. G. Narayanan" in ctx["defaulter_name"]
    assert "6,250,000" in ctx["total_amount"]
    assert "அறுபத்து இரண்டு லட்சத்து" in ctx["amount_in_tamil_words"]
    assert len(ctx["sureties"]) == 2
    assert "K. Gopalakrishnan" in ctx["sureties"][0]["name"]


def test_regex_fallback_multi_reference_extraction():
    """Test deterministic regex fallback extracting multiple references, entities, and amounts."""
    raw_ocr = """
    GOVERNMENT OF TAMIL NADU
    REVENUE AND DISASTER MANAGEMENT DEPARTMENT
    
    From: The Commissioner of Customs, Export Commissionerate, Chennai IV
    To: The District Collector, Erode District.
    
    Ref: 1. F.No. 516/2024-ARC dated 28.03.2024
         2. Order in Original No. 105790/2024 dated 24.12.2025
         3. Notice under section 142(1)(c)(ii) of Customs Act, 1962
         
    Sub: Revenue Recovery Certificate issued against M/s Prisma Garments, Door No. 46, Perundurai Road, Erode - 638011.
    
    Sir,
    The defaulter M/s Prisma Garments (IEC: 3205015860) has failed to pay Principal Duty of Rs. 1,73,308/- and Penalty of Rs. 9,000/- totaling Rs. 1,82,308/-.
    Please recover under TN Revenue Recovery Act 1864.
    """
    
    llm = LLMService()
    extracted = llm._parse_with_regex_fallback(raw_ocr, {})
    
    assert extracted.department_type == DepartmentType.CUSTOMS
    assert extracted.entity_type == EntityType.COMPANY
    assert "Prisma Garments" in extracted.defaulter_details[0].name
    assert extracted.financials.principal_amount == 173308.0
    assert extracted.financials.penalty_amount == 9000.0
    assert extracted.financials.total_recoverable_amount == 182308.0
    assert len(extracted.reference_details.references_list) >= 2
