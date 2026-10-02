import pytest
from pathlib import Path
from app.services.document_service import DocumentService
from app.domain.schemas.legal_entities import (
    ExtractedLegalEntities, DefaulterDetail, FinancialDetails,
    ReferenceDetails, PaymentInstructions, DepartmentType, EntityType
)


def test_triple_proceedings_memorandum_and_note_generation(tmp_path):
    doc_service = DocumentService(output_dir=tmp_path)
    
    entities = ExtractedLegalEntities(
        department_type=DepartmentType.CUSTOMS,
        entity_type=EntityType.COMPANY,
        district_name="ஈரோடு",
        taluk_name="ஈரோடு",
        defaulter_details=[
            DefaulterDetail(
                name="M/s Prisma Garments",
                door_no="46",
                street_and_locality="உழவன் நகர், 6வது உழவர் வீதி, பெருமாள் கவுண்டர் தோட்டம்",
                taluk="ஈரோடு",
                district="ஈроடு",
                pincode="638009",
                iec_number="3205015860"
            )
        ],
        financials=FinancialDetails(
            principal_amount=173308.0,
            penalty_amount=9000.0,
            interest_amount=0.0,
            total_recoverable_amount=182308.0
        ),
        reference_details=ReferenceDetails(
            issuing_authority_name="Office of the Commissioner of Customs (Chennai IV)",
            case_or_file_no="F.No.516/2024-ARC",
            ia_or_mp_no="105820/2023",
            order_date="11.08.2023",
            letter_date="13.11.2024",
            references_list=[
                "சுங்கத்துறை ஆணையரகம் (சென்னை IV) கடித ந.க. எண் F.No.516/2024-ARC நாள். 13.11.2024.",
                "அசல் ஆணை எண். 105820/2023 நாள் 11.08.2023."
            ]
        ),
        payment_instructions=PaymentInstructions(
            dd_favour_of="சுங்கத்துறை ஆணையர் (Commissioner of Customs)",
            head_of_account="0037-00-101-AA-0000",
            dispatch_address="உதவி சுங்க ஆணையர் (ARC), கஸ்டம் ஹவுஸ், சென்னை - 600 001."
        )
    )

    # 1. Generate Proceedings (செயல்முறைகள்)
    proc_file = doc_service.generate_proceedings_docx(entities)
    assert proc_file.exists()
    assert proc_file.name.startswith("Proceedings_")

    # 2. Generate Memorandum (குறிப்பாணை)
    memo_file = doc_service.generate_memorandum_docx(entities)
    assert memo_file.exists()
    assert memo_file.name.startswith("Memorandum_")

    # 3. Generate Office Note (அலுவலகக் குறிப்பு)
    note_file = doc_service.generate_note_docx(entities)
    assert note_file.exists()
    assert note_file.name.startswith("Note_")

    # 4. Generate all three files in sequence
    three = doc_service.generate_three_files(entities)
    assert "proceedings" in three
    assert "memorandum" in three
    assert "note" in three
    assert three["proceedings"].exists()
    assert three["memorandum"].exists()
    assert three["note"].exists()

    # 5. Context validation
    context = doc_service.prepare_context(entities)
    assert "செயல்முறைகள்" in context["collector_heading"]
    assert "M/s Prisma Garments" in context["defaulter_name"]
    assert "ரூ.182,308/-" in context["order_para1"]
    assert "சுங்கச் சட்டம் 1962" in context["subject_text"]
    assert "பெறுநர்" in context["tahsildar_recipient"] or "வருவாய் வட்டாட்சியர்" in context["tahsildar_recipient"]
