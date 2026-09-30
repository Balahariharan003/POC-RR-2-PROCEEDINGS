"""
Test Document Generation with Dynamic Multi-References and Template Data JSONB.
"""

import pytest
from pathlib import Path
from app.services.document_service import DocumentService
from app.domain.schemas.legal_entities import (
    ExtractedLegalEntities,
    DepartmentType,
    EntityType,
    DefaulterDetail,
    FinancialDetails,
    ReferenceDetails,
    PaymentInstructions,
)


def test_prepare_context_dynamic_multi_references():
    """Verify that multiple dynamic references format into numbered list under பார்வை:."""
    entities = ExtractedLegalEntities(
        department_type=DepartmentType.CUSTOMS,
        entity_type=EntityType.COMPANY,
        defaulter_details=[
            DefaulterDetail(
                name="M/s Prisma Garments",
                door_no="46",
                street_and_locality="Uzhavan Nagar, 6th Uzhavar Street",
                taluk="ஈரோடு",
                district="ஈரோடு",
                pincode="638009",
                iec_number="3205015860",
            )
        ],
        financials=FinancialDetails(
            principal_amount=173308.0,
            penalty_amount=9000.0,
            total_recoverable_amount=182308.0,
            amount_in_words_tamil="ரூபாய் ஒரு இலட்சத்து எண்பத்திரண்டாயிரத்து முன்னூற்று எட்டு மட்டும்",
        ),
        reference_details=ReferenceDetails(
            issuing_authority_name="சென்னை சுங்கத்துறை ஆணையரகம் (சென்னை IV)",
            case_or_file_no="F.NO. 516/2024-ARC",
            ia_or_mp_no="105790/2024",
            order_date="28.03.2024",
            letter_date="24.12.2025",
            references_list=[
                "சென்னை சுங்கத்துறை ஆணையரகம் (சென்னை IV), கடித F.NO. 516/2024-ARC, நாள் 24.12.2025.",
                "Order in Original No: 105790/2024, நாள் 28.03.2024.",
                "வருவாய் நிலை ஆணை எண் 41 மற்றும் தமிழ்நாடு வருவாய் வசூல் சட்டம் 1864 பிரிவு 5.",
            ],
        ),
        payment_instructions=PaymentInstructions(
            dd_favour_of="Commissioner of Customs, Export Commissionerate, Chennai IV",
            head_of_account="037 - Customs",
            dispatch_address="Custom House, 60, Rajaji Salai, Chennai- 600 001.",
        ),
        district_name="ஈரோடு",
        taluk_name="ஈரோடு",
    )

    doc_service = DocumentService()
    context = doc_service.prepare_context(entities)

    assert "references" in context
    assert len(context["references"]) == 3
    assert context["references"][0].startswith("சென்னை சுங்கத்துறை")
    assert "1. சென்னை சுங்கத்துறை" in context["reference_text"]
    assert "2. Order in Original No: 105790/2024" in context["reference_text"]
    assert "3. வருவாய் நிலை ஆணை" in context["reference_text"]
    assert "பொருள்" not in context["reference_text"]

    # Generate document and verify file creation
    docx_path = doc_service.generate_docx(entities, custom_filename="test_prisma_garments_proc.docx")
    assert docx_path.exists()
    assert docx_path.stat().st_size > 5000
    
    # Cleanup test output
    docx_path.unlink()
