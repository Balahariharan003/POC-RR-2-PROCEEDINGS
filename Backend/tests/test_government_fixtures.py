"""
Government Fixtures Verification Test Suite (Phase P2)
======================================================
Tests the 6 real government recovery certificate types:
1. Customs Sec 142(1)(c)(ii) (1248/2026-ஈ2)
2. Maintenance Warrant BNSS/CrPC 144 (6963/2026-ஈ2)
3. Motor Accident Claims Tribunal (MCOP Sec 174) (9666/2026-ஈ2)
4. Land Acquisition / D2 Reference (2087/2026-D2)
5. MCOP Sub-Court Reference (10117/2026-D2)
6. Labour Court Award Sec 33C(1) (10415/2026-D4)
"""

import pytest
from app.domain.rules.extraction_gate import run_gate
from app.domain.rules.jurisdiction import route_to_jurisdiction
from app.services.llm_service import postprocess_case, case_to_extracted_entities
from app.domain.rules.tamil_numerals import number_to_tamil_currency_words


FIXTURES = {
    "CUSTOMS_1248_2026": {
        "case_file_no": "1248/2026",
        "department_type": "CUSTOMS",
        "statute_cited": "Customs Act 1962 Sec 142(1)(c)(ii)",
        "taluk_name": "பெருந்துறை",
        "district_name": "ஈரோடு",
        "defaulter_name": "M/s Sri Venkateshwara Tex",
        "door_no": "Plot No 45",
        "street_and_locality": "SIPCOT Industrial Complex",
        "village": "Perundurai",
        "pincode": "638052",
        "principal_amount": 250000.0,
        "penalty_amount": 50000.0,
        "interest_amount": 15000.0,
        "total_recoverable_amount": 315000.0,
        "review_flags": []
    },
    "MAINTENANCE_6963_2026": {
        "case_file_no": "6963/2026",
        "department_type": "MAINTENANCE",
        "statute_cited": "பாரதிய நாகரிக் சுரக்ஷா சன்ஹிதா பிரிவு 144",
        "taluk_name": "சத்தியமங்கலம்",
        "district_name": "ஈரோடு",
        "defaulter_name": "கே. ராமசாமி",
        "relation_text": "த/பெ கந்தசாமி",
        "door_no": "12/4",
        "street_and_locality": "பவானிசாகர் ரோடு",
        "village": "சத்தியமங்கலம்",
        "pincode": "638401",
        "principal_amount": 72000.0,
        "penalty_amount": 0.0,
        "interest_amount": 0.0,
        "total_recoverable_amount": 72000.0,
        "maintenance": {
            "beneficiary_name": "ஆர். சரஸ்வதி",
            "monthly_rate": 6000.0,
            "arrears_period_from": "01.01.2025",
            "arrears_period_to": "31.12.2025",
            "number_of_months": 12
        },
        "review_flags": []
    },
    "MCOP_9666_2026": {
        "case_file_no": "9666/2026",
        "department_type": "MCOP",
        "statute_cited": "Motor Vehicles Act 1988 Sec 174",
        "taluk_name": "ஈரோடு",
        "district_name": "ஈரோடு",
        "defaulter_name": "P. Saravanan",
        "relation_text": "S/O Soundararajan",
        "door_no": "88",
        "street_and_locality": "E.P.B Nagar",
        "village": "Veerappanchathiram",
        "pincode": "638004",
        "principal_amount": 55998.0,
        "penalty_amount": 0.0,
        "interest_amount": 0.0,
        "total_recoverable_amount": 55998.0,
        "review_flags": []
    },
    "LAND_ACQ_2087_2026_D2": {
        "case_file_no": "2087/2026",
        "department_type": "LAND_ACQUISITION",
        "statute_cited": "RFCTLARR Act 2013 Sec 30 / RR Act 1864",
        "taluk_name": "மொடக்குறிச்சி",
        "district_name": "ஈரோடு",
        "defaulter_name": "வி. பெரியசாமி",
        "door_no": "4/10",
        "street_and_locality": "மெயின் ரோடு",
        "village": "எழுமாத்தூர்",
        "pincode": "638104",
        "principal_amount": 185000.0,
        "penalty_amount": 0.0,
        "interest_amount": 15000.0,
        "total_recoverable_amount": 200000.0,
        "review_flags": []
    },
    "MCOP_10117_2026_D2": {
        "case_file_no": "10117/2026",
        "department_type": "MCOP",
        "statute_cited": "Motor Vehicles Act 1988 Sec 174",
        "taluk_name": "பவானி",
        "district_name": "ஈரோடு",
        "defaulter_name": "எஸ். முருகேசன்",
        "door_no": "25",
        "street_and_locality": "சங்கமேஸ்வரர் கோவில் தெரு",
        "village": "பவானி",
        "pincode": "638301",
        "principal_amount": 120000.0,
        "penalty_amount": 0.0,
        "interest_amount": 10000.0,
        "total_recoverable_amount": 130000.0,
        "review_flags": []
    },
    "LABOUR_10415_2026_D4": {
        "case_file_no": "10415/2026",
        "department_type": "LABOUR",
        "statute_cited": "Industrial Disputes Act 1947 Sec 33C(1)",
        "taluk_name": "அந்தியூர்",
        "district_name": "ஈரோடு",
        "defaulter_name": "M/s Sakthi Spinning Mills",
        "door_no": "SF 102",
        "street_and_locality": "பர்கூர் மெயின் ரோடு",
        "village": "அந்தியூர்",
        "pincode": "638501",
        "principal_amount": 425000.0,
        "penalty_amount": 25000.0,
        "interest_amount": 0.0,
        "total_recoverable_amount": 450000.0,
        "review_flags": []
    }
}


@pytest.mark.parametrize("fixture_name, fixture_data", FIXTURES.items())
def test_fixture_passes_gate(fixture_name, fixture_data):
    """All 6 standard government fixtures must pass the fail-closed extraction gate."""
    dummy_ocr = (
        f"Case: {fixture_data['case_file_no']} Amount: Rs. {int(fixture_data['total_recoverable_amount'])} "
        f"Defaulter: {fixture_data['defaulter_name']} Statute: {fixture_data['statute_cited']}"
    )
    result = run_gate(fixture_data, ocr_text=dummy_ocr)
    assert result.ok, f"Fixture {fixture_name} failed gate with errors: {result.errors} | {result.error_details}"


@pytest.mark.parametrize("fixture_name, fixture_data", FIXTURES.items())
def test_fixture_entity_conversion(fixture_name, fixture_data):
    """Verifies typed schema transformation and Tamil numeral generation."""
    dummy_ocr = f"File {fixture_data['case_file_no']} Total {fixture_data['total_recoverable_amount']}"
    entities = case_to_extracted_entities(fixture_data, dummy_ocr)
    assert entities.reference_details.case_or_file_no == fixture_data["case_file_no"]
    assert entities.financials.total_recoverable_amount == fixture_data["total_recoverable_amount"]
    assert "ரூபாய்" in entities.financials.amount_in_words_tamil


@pytest.mark.parametrize("fixture_name, fixture_data", FIXTURES.items())
def test_fixture_jurisdiction_routing(fixture_name, fixture_data):
    """Verifies that each fixture routes to its designated Erode taluk."""
    route = route_to_jurisdiction(
        raw_address=f"{fixture_data.get('street_and_locality', '')} {fixture_data.get('village', '')}",
        pincode=fixture_data.get("pincode"),
        explicit_taluk=fixture_data.get("taluk_name"),
        explicit_district=fixture_data.get("district_name")
    )
    assert route["district"] == fixture_data["district_name"]
    assert route["taluk"] == fixture_data["taluk_name"]


if __name__ == "__main__":
    for k, v in FIXTURES.items():
        test_fixture_passes_gate(k, v)
        test_fixture_entity_conversion(k, v)
        test_fixture_jurisdiction_routing(k, v)
    print("ALL 6 GOVERNMENT FIXTURES VERIFIED SUCCESSFULLY!")
