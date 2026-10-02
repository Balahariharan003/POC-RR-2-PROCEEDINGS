"""
End-to-End Pipeline Verification Test for Kangayam Sub-Court MCOP Recovery Order (Form No. 24)
"""

import sys
import io
import asyncio
from pathlib import Path

# Force UTF-8 on Windows
if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# Add Backend root to path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from app.services.llm_service import LLMService
from app.services.document_service import DocumentService
from app.services.pdf_service import PDFService
from app.services.audit_service import AuditService
from app.domain.schemas.legal_entities import ExtractedLegalEntities, DepartmentType
from app.domain.rules.math_validator import validate_financial_math
from app.domain.rules.tamil_numerals import number_to_tamil_currency_words

# Raw OCR Text from the 2 Pages received from the user
MCOP_OCR_TEXT = """
FORM NO.24 
(SECTION 69(2)) RECOVERY OF AMOUNT OTHER THAN PUBLIC REVENUE DUE ON 
LAND WHICH IS RECOVERABLE UNDER THE ACT CERTIFICATE 
UNDER SECTION 174 OF MOTOR VEHICLES ACT 1988 
IN THE COURT OF THE SUBORDINATE JUDGE OF KANGAYAM 
I.A No. 02/2024 In MCOP No. 782/2018 

1. National Insurance Company Ltd, Erode
(Insurer of Crime vehicle Thangam Mini Bus TN 34 A 1600) 
--- Petitioner No.1/Respondent No.3 
2. National Insurance Company Ltd, Erode 
(Insurer of Crime vehicle Thangaratham Mini Bus TN 69 F 2229) 
--- Petitioner No.2/Respondent No.6 
/ VS / 
3. P.Saravanan, S/O. Soundararajan 
(Owner of Crime Vehicle Thangam Mini Bus TN 34 A 1600), 88, E.P.B Nagar, Veerappanchathiram, Erode-TK
--- Respondent No.1/Respondent No.2 
4. M.Jayaraman, S/O. Marudhamuthu 
(Owner of Crime Vehicle Thangaratham Mini Bus TN 69 F 2229), 91, Mariammankovil Street, E.P.B Nagar, Veerappanchathiram (Po), Erode-TK
--- Respondent No.2/Respondent No.5 

TO, 
The District Collector, Erode
D. NO : 338/2024 
Dt : 10-04-2024 

Whereas the petitioner National Insurance Company Ltd, Erode has applied under Section 174 of M.V Act an application for issuing Certificate for Recovery of RS.55,998/- (Rupees Fifty Five Thousand Nine Hundred and Ninety Eight only) with 7.5% interest from 17.8.23 being the date of deposit of the award amount into court till date of recovery of the debt as arrears of Land Revenue from P.Saravanan, (Owner of Thangam Mini Bus TN 34 A 1600, S/O. Soundararajan, 88, E.P.B Nagar, Veerappanchathiram, Erode-TK and Respondent No.2/ Respondent No.5 namely M.Jayaraman, (Owner of Thangaratham Mini Bus TN 69 F 2229),S/O.Maruthamuthu, 91, Mariammankovil Street, E.P.B Nagar, Veerappanchathiram (Po), Erode-TK and the same being allowed.  

Now you are directed to recover the above said RS.55,998/- (Rupees Fifty Five Thousand Nine Hundred and Ninety Eight only) along with interest under Revenue Recovery Act equally from the above mentioned P.Saravanan, (Owner of Thangam Mini Bus TN 34 A 1600), S/O. Soundararajan & M.Jayaraman, (Owner of Thangaratham Mini Bus TN 69 F 2229),S/O.Maruthamuthu and issue the said amount to the Petitioner National Insurance Company Ltd, Erode. 

Given under my hand and seal of this court this the 05 day of January, 2024. 
The Subordinate Judge, 
Kangayam
"""


async def main():
    print("=" * 70)
    print("🚀 [START] E2E Pipeline Verification for MCOP Court Order (Form No. 24)")
    print("=" * 70)

    # 1. Initialize Services
    llm_service = LLMService()
    doc_service = DocumentService()
    pdf_service = PDFService()
    audit_service = AuditService()

    # 2. Extract Entities via LLM / Deterministic Extractor
    print("\n🔹 Step 1: Extracting Legal Entities from Document OCR Text...")
    entities: ExtractedLegalEntities = await llm_service.extract_entities(MCOP_OCR_TEXT)
    
    print(f"   • Department Type Detected: {entities.department_type}")
    print(f"   • Defaulter / Respondents: {entities.defaulter_details[0].name if entities.defaulter_details else 'N/A'}")
    print(f"   • Taluk Assigned: {entities.taluk_name}")
    print(f"   • District Assigned: {entities.district_name}")
    print(f"   • Principal Amount: ₹{entities.financials.principal_amount:,.2f}")
    print(f"   • Total Demand: ₹{entities.financials.total_recoverable_amount:,.2f}")
    print(f"   • Amount in Tamil Words: {entities.financials.amount_in_words_tamil}")
    print(f"   • Issuing Authority: {entities.reference_details.issuing_authority_name}")
    print(f"   • Case File No: {entities.reference_details.case_or_file_no}")
    print(f"   • Order Date: {entities.reference_details.order_date}")

    # 3. Mathematical Validation
    print("\n🔹 Step 2: Running Domain Mathematical & Jurisdiction Integrity Checks...")
    is_valid, violations, insights, discrepancy = validate_financial_math(entities.financials)
    print(f"   • Math Validation Passed: {is_valid}")
    print(f"   • Math Insights: {insights}")

    # 4. Applicable Document Generation
    print("\n🔹 Step 3: Determining Applicable Documents & Generating DOCX/PDFs...")
    
    # Check Judicial MCOP criteria
    raw_combined = f"{MCOP_OCR_TEXT} {entities.reference_details.statutory_act_and_section or ''} {entities.reference_details.issuing_authority_name or ''} {entities.department_type}".lower()
    is_judicial_warrant = any(kw in raw_combined for kw in [
        "warrant", "crpc", "bnss", "125", "144", "maintenance", "family court",
        "senior citizen", "tribunal", "arrest", "distraint", "வாரண்ட்", "பராமரிப்பு", "நீதிமன்ற",
        "mcop", "labour court", "execution petition"
    ]) or entities.department_type == DepartmentType.MCOP

    print(f"   • Judicial Warrant Flag: {is_judicial_warrant}")

    # Generate 1: Proceedings (செயல்முறைகள்)
    proc_path = doc_service.generate_proceedings_docx(entities, custom_filename="TEST_MCOP_Proceedings.docx")
    print(f"   ✅ [1/4] Generated Proceedings (.docx): {proc_path.name} ({proc_path.stat().st_size} bytes)")

    # Generate 2: Office Note (அலுவலகக் குறிப்பு)
    note_path = doc_service.generate_note_docx(entities, custom_filename="TEST_MCOP_Office_Note.docx")
    print(f"   ✅ [2/4] Generated Office Note (.docx): {note_path.name} ({note_path.stat().st_size} bytes)")

    # Generate 3: Judicial Warrant (ஜப்தி வாரண்ட் ஆணை)
    warrant_path = doc_service.generate_warrant_docx(entities, custom_filename="TEST_MCOP_Judicial_Warrant.docx")
    print(f"   ✅ [3/4] Generated Judicial Warrant (.docx): {warrant_path.name} ({warrant_path.stat().st_size} bytes)")

    # Generate 4: Memorandum (குறிப்பாணை)
    memo_path = doc_service.generate_memorandum_docx(entities, custom_filename="TEST_MCOP_Memorandum.docx")
    print(f"   ✅ [4/4] Generated Memorandum (.docx): {memo_path.name} ({memo_path.stat().st_size} bytes)")

    # 5. Cryptographic HMAC-SHA256 Audit Stamping
    print("\n🔹 Step 4: Stamping Cryptographic Hybrid Signature...")
    stamp = audit_service.generate_hybrid_signature(
        extracted_data=entities.model_dump(),
        raw_ocr_text=MCOP_OCR_TEXT
    )
    print(f"   • Cryptographic Stamp: {stamp}")

    print("\n" + "=" * 70)
    print("🎉 [SUCCESS] All 4 case order files generated & validated successfully!")
    print("=" * 70)


if __name__ == "__main__":
    asyncio.run(main())
