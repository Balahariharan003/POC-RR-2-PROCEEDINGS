// Empty state shapes; populated only from uploaded documents.
export const DEFAULT_ENTITIES = {
  "department_type": "",
  "case_details": {
    "court_name": "",
    "court_location": "",
    "case_number": "",
    "order_in_original_no": "",
    "file_number": "",
    "court_order_date": "",
    "certificate_date": ""
  },
  "legal_acts": {
    "primary_act": "",
    "primary_act_section": "",
    "recovery_act": "",
    "standing_order": "",
    "revenue_standing_order": "",
    "other_sections": []
  },
  "defaulter": {
    "name": "",
    "iec_number": "",
    "door_no": "",
    "street_area": "",
    "village": "",
    "taluk": "",
    "district": "",
    "pincode": "",
    "full_address": ""
  },
  "beneficiary": {
    "name": "",
    "address": "",
    "head_of_account": "",
    "payment_mode": ""
  },
  "financials": {
    "principal_amount": 0,
    "penalty_amount": 0,
    "formatted_amount": "",
    "amount_in_words_tamil": "",
    "interest_applicable": false,
    "total_recoverable_amount": 0
  },
  "jurisdiction": {
    "district": "",
    "taluk": "",
    "tahsildar_title": "",
    "rdo_title": "",
    "collector_name": "",
    "collector_designation": ""
  },
  "proceedings_roc_number": "",
  "proceedings_date": "",
  "enclosures": [],
  "copy_recipients": []
};
export const DEFAULT_VALIDATION = {
  "math_valid": false,
  "math_details": "",
  "jurisdiction_routed": false,
  "routed_taluk": "",
  "routed_district": "",
  "interest_applied": false,
  "interest_calculation_breakdown": "",
  "tamil_amount_words": "",
  "warnings": [],
  "grounding_score": 0,
  "hallucination_score": 0
};
