"""
RR LLM & Case Analysis Engine v2 – Erode Collectorate (Section ஈ2)
===================================================================
Incoming requisition ──► MASTER PROMPT (analyse_case) ──► verified CASE JSON
                                                            │
   ┌──────────────┬───────────────┬──────────────┬──────────┴────────────┐
Office Note    Proceedings    Memorandum     Warrant (MAINTENANCE only)

DESIGN RULES:
1. 100% Dynamic Reasoning: Zero hardcoded department heuristics or rigid regex mappings.
2. The LLM extracts the legal domain, statutory citation, defaulter entities, amounts, taluk, and references.
3. Postprocess guards validate arithmetic integrity, Indian currency formatting, and official Tamil synthesis.
"""

import json
import re
from typing import Dict, Any, Optional, List, Union
from datetime import datetime
import httpx

from app.core.config import settings
from app.core.logging import logger
from app.domain.schemas.legal_entities import (
    ExtractedLegalEntities,
    DefaulterDetail,
    SuretyDetail,
    FinancialDetails,
    ReferenceDetails,
    PaymentInstructions,
    DepartmentType,
    EntityType,
)

# ======================================================================================
# 0. OFFICE CONFIG (Default constants; overridable via DB)
# ======================================================================================
COLLECTOR_LINE = "திரு.ச.கந்தசாமி, இ.ஆ.ப.,"
OFFICE_SECTION = "ஈ2"
TALUK_TO_RDO = {
    "ஈரோடு": "ஈரோடு",
    "கொடுமுடி": "ஈரோடு",
    "மொடக்குறிச்சி": "ஈரோடு",
    "பெருந்துறை": "ஈரோடு",
    "பவானி": "கோபிச்செட்டிபாளையம்",
    "அந்தியூர்": "கோபிச்செட்டிபாளையம்",
    "கோபிச்செட்டிபாளையம்": "கோபிச்செட்டிபாளையம்",
    "நம்பியூர்": "கோபிச்செட்டிபாளையம்",
    "சத்தியமங்கலம்": "கோபிச்செட்டிபாளையம்",
    "தாளவாடி": "கோபிச்செட்டிபாளையம்",
}
ERODE_TALUKS = [
    "ஈரோடு", "மொடக்குறிச்சி", "கொடுமுடி", "பெருந்துறை", "பவானி",
    "அந்தியூர்", "கோபிச்செட்டிபாளையம்", "நம்பியூர்", "சத்தியமங்கலம்", "தாளவாடி"
]


# ======================================================================================
# 1. DYNAMIC LEGAL MASTER PROMPT (Zero Hardcoding)
# ======================================================================================
MASTER_PROMPT = r"""
You are the Senior Revenue Recovery (RR) Legal Analyst for Erode Collectorate (ஈரோடு மாவட்ட ஆட்சியர் அலுவலகம், பிரிவு ஈ2).
Your task is to analyze the incoming requisition order / letter / recovery certificate OCR text, dynamically identify the legal domain and statutory provisions with ZERO hardcoding, and extract structured legal entities.

REVENUE RECOVERY JURISDICTIONS (Tamil Nadu Revenue Recovery Act 1864 & RSO 41):
1. CUSTOMS: Customs duty, penalties, interest under Section 142(1)(c)(ii) of Customs Act 1962.
2. TNRERA: Real estate recovery / refund orders under Section 40(1) of RERA Act 2016.
3. MCOP / MACT: Motor accident compensation claims tribunal awards under Section 174 of Motor Vehicles Act 1988.
4. FAMILY COURT MAINTENANCE: Maintenance arrears under BNSS Section 144 / CrPC Section 125.
5. COMMERCIAL TAXES / GST: Sales tax, VAT, GST arrears and penalties under Commercial Taxes & RR Act.
6. EPFO & ESIC: Provident fund & ESI statutory dues under EPF Act Sec 8B / ESI Act Sec 45B.
7. LABOUR & GRATUITY: Labour court awards and Payment of Gratuity Act Sec 8 requisitions.
8. MINES & MINERALS: Seigniorage fee, penalty, and illegal mining recovery under Mines & Minerals Act 1957.
9. TRANSPORT: Motor vehicles tax arrears under TN Motor Vehicles Taxation Act 1974.
10. EXCISE & PROHIBITION: Liquor license / excise arrears under TN Prohibition Act 1937.
11. OTHER COLLECTORATE RR: Requisitions forwarded from other District Collectors for recovery within Erode.
12. ANY OTHER GOVERNMENT REQUISITION: Agricultural loans, medical bonds, municipal dues, or statutory arrears.

DYNAMIC EXTRACTION RULES:
- Identify the issuing department, court, or tribunal dynamically from context.
- Translate and format the statute name in official Tamil (ஆட்சிமொழித் தமிழ்) e.g., 'மோட்டார் வாகனச் சட்டம் 1988 பிரிவு 174', 'சுங்கச் சட்டம் 1962 பிரிவு 142(1)(c)(ii)'.
- Extract exact defaulter name(s), father/spouse name, door number, street, village, taluk, district, and pincode.
- If multiple defaulters / respondents are listed, extract all names separated by commas and set entity_type to 'MULTIPLE_INDIVIDUALS'.
- Extract all financial figures: principal, penalty, interest, and total recoverable amount.
- Extract Demand Draft payee (dd_favour_of), dispatch address, order dates, and case file numbers.
- Return ONLY a valid JSON object matching the schema below:

{
  "document_type": "DEPARTMENT_LETTER|COURT_ORDER|OTHER_COLLECTORATE_RR|REMINDER",
  "requisition_channel": "DIRECT_FROM_DEPARTMENT|FROM_COURT|FROM_OTHER_COLLECTORATE",
  "department_type": "CUSTOMS|TNRERA|MCOP|COMMERCIAL_TAX|EXCISE|MAINTENANCE|EPFO_ESIC|LABOUR_COURT|MINES_MINERALS|TRANSPORT|OTHER_COLLECTORATE|GENERAL_RR",
  "department_name_ta": "Department / Court name in official Tamil",
  "statute_cited": "Exact Act and Section in Tamil",
  "dues_label": "Specific dues label in Tamil (e.g. இழப்பீட்டுத் தொகை, நிலுவைத் தொகை, சுங்க வரி, பராமரிப்புத் தொகை)",
  "principal_label": "Principal label in Tamil",
  "penalty_label": null,
  "interest_label": null,
  "other_charges_label": null,
  "entity_type": "INDIVIDUAL|MULTIPLE_INDIVIDUALS|COMPANY|PROPRIETORSHIP|PARTNERSHIP|GOVERNMENT_SERVANT",
  "defaulter_name": "Full Defaulter / Respondent Name(s)",
  "relation_text": "Father / Husband / Spouse name or null",
  "iec_number": null,
  "door_no": null,
  "street_and_locality": null,
  "village": null,
  "taluk_name": "Jurisdictional Taluk in Tamil (e.g. ஈரோடு, பெருந்துறை, பவானி, கோபிச்செட்டிபாளையம், சத்தியமங்கலம், மொடக்குறிச்சி, கொடுமுடி, அந்தியூர், நம்பியூர், தாளவாடி)",
  "district_name": "ஈரோடு",
  "pincode": null,
  "jurisdiction": "ERODE",
  "principal_amount": 0.0,
  "penalty_amount": 0.0,
  "interest_amount": 0.0,
  "other_charges_amount": 0.0,
  "total_recoverable_amount": 0.0,
  "issuing_authority_name": "Court / Authority / Department Name",
  "case_file_no": "Requisition / Case / D.No / F.No number",
  "order_date": "DD.MM.YYYY",
  "letter_date": "DD.MM.YYYY",
  "beneficiary_name": "Beneficiary / Claimant / Insurer name",
  "dd_favour_of": "Payee name for Demand Draft",
  "dispatch_address": "Where original Demand Draft should be dispatched",
  "court_or_issuer_ta": "Court / Issuer title in Tamil",
  "references": [
    {
      "seq": 1,
      "kind": "COURT_ORDER|DEPARTMENT_LETTER",
      "authority_ta": "Authority name in Tamil",
      "ref_no": "Number",
      "date": "DD.MM.YYYY",
      "text_ta": "Complete reference citation in Tamil"
    }
  ],
  "review_flags": []
}

[SOURCE TEXT]
<<OCR_TEXT>>
"""

# ======================================================================================
# 2. DETERMINISTIC HELPERS (money, Tamil words, formatting)
# ======================================================================================
_ONES = ["", "ஒன்று", "இரண்டு", "மூன்று", "நான்கு", "ஐந்து", "ஆறு", "ஏழு", "எட்டு", "ஒன்பது", "பத்து",
         "பதினொன்று", "பன்னிரண்டு", "பதிமூன்று", "பதினான்கு", "பதினைந்து", "பதினாறு", "பதினேழு",
         "பதினெட்டு", "பத்தொன்பது"]
_TENS = {2: "இருபது", 3: "முப்பது", 4: "நாற்பது", 5: "ஐம்பது", 6: "அறுபது", 7: "எழுபது", 8: "எண்பது", 9: "தொண்ணூறு"}
_TENS_C = {2: "இருபத்து", 3: "முப்பத்து", 4: "நாற்பத்து", 5: "ஐம்பத்து", 6: "அறுபத்து", 7: "எழுபத்து",
           8: "எண்பத்து", 9: "தொண்ணூற்று"}
_HUND = {1: ("நூறு", "நூற்று"), 2: ("இருநூறு", "இருநூற்று"), 3: ("முந்நூறு", "முந்நூற்று"),
         4: ("நானூறு", "நானூற்று"), 5: ("ஐந்நூறு", "ஐந்நூற்று"), 6: ("அறுநூறு", "அறுநூற்று"),
         7: ("எழுநூறு", "எழுநூற்று"), 8: ("எண்ணூறு", "எண்ணூற்று"), 9: ("தொள்ளாயிரம்", "தொள்ளாயிரத்து")}
_K = {1: "ஆ", 2: "இரண்டா", 3: "மூவா", 4: "நாலா", 5: "ஐயா", 6: "ஆறா", 7: "ஏழா", 8: "எண்ணா", 9: "ஒன்பதா",
      10: "பத்தா", 11: "பதினோரா", 12: "பன்னீரா", 13: "பதிமூவா", 14: "பதினாலா", 15: "பதினையா",
      16: "பதினாறா", 17: "பதினேழா", 18: "பதினெண்ணா", 19: "பத்தொன்பதா"}


def _below100(n: int) -> str:
    if n < 20:
        return _ONES[n]
    t, u = divmod(n, 10)
    return _TENS[t] if u == 0 else f"{_TENS_C[t]} {_ONES[u]}"


def _below1000(n: int) -> str:
    h, r = divmod(n, 100)
    parts = []
    if h:
        parts.append(_HUND[h][1] if r else _HUND[h][0])
    if r:
        parts.append(_below100(r))
    return " ".join(parts)


def _k_prefix(m: int) -> str:
    if m in _K:
        return _K[m]
    t, u = divmod(m, 10)
    return _TENS[t][:-1] + "ா" if u == 0 else f"{_TENS_C[t]} {_K[u]}"


def tamil_words(n: int) -> str:
    """Indian-system words: 182308 -> ஒரு இலட்சத்து எண்பத்து இரண்டாயிரத்து முந்நூற்று எட்டு"""
    if n == 0:
        return "பூஜ்ஜியம்"
    crore, n = divmod(n, 10 ** 7)
    lakh, n = divmod(n, 10 ** 5)
    thou, rest = divmod(n, 1000)
    out = []
    if crore:
        w = "ஒரு" if crore == 1 else (_below100(crore) if crore < 100 else tamil_words(crore))
        out.append(w + (" கோடியே" if (lakh or thou or rest) else " கோடி"))
    if lakh:
        out.append(("ஒரு" if lakh == 1 else _below100(lakh)) + (" இலட்சத்து" if (thou or rest) else " இலட்சம்"))
    if thou:
        out.append(_k_prefix(thou) + ("யிரத்து" if rest else "யிரம்"))
    if rest:
        out.append(_below1000(rest))
    return " ".join(out)


def inr(amount: Union[int, float, str]) -> str:
    """Indian grouping: 182308 -> 1,82,308 (paise only if present)."""
    try:
        val = float(amount or 0.0)
    except (ValueError, TypeError):
        return "0"
    paise = round((val - int(val)) * 100)
    s = str(int(val))
    if len(s) > 3:
        head, tail, parts = s[:-3], s[-3:], []
        while len(head) > 2:
            parts.insert(0, head[-2:])
            head = head[:-2]
        if head:
            parts.insert(0, head)
        s = ",".join(parts + [tail])
    return s + (f".{paise:02d}" if paise else "")


def fig(amount: Union[int, float, str]) -> str:
    return f"ரூ.{inr(amount)}/-"


def rupees_words(amount: Union[int, float, str]) -> str:
    try:
        val = float(amount or 0.0)
    except (ValueError, TypeError):
        return "ரூபாய் பூஜ்ஜியம் மட்டும்"
    paise = round((val - int(val)) * 100)
    return (f"ரூபாய் {tamil_words(int(val))}"
            + (f" மற்றும் {tamil_words(paise)} பைசா" if paise else "") + " மட்டும்")


# ======================================================================================
# 3. MASTER RUNNER + GUARDS
# ======================================================================================
def _strip_fences(t: str) -> str:
    return re.sub(r"^```(?:json)?\s*|\s*```$", "", t.strip()).strip()


def postprocess_case(case: dict, ocr_text: str) -> dict:
    """Validates extracted facts and deterministically generates official Tamil administrative prose."""
    flags = list(case.get("review_flags") or [])
    tk = case.get("taluk_name")
    if tk and tk not in ERODE_TALUKS:
        flags.append("TALUK_NOT_IN_ERODE_LIST")
    if tk and tk not in TALUK_TO_RDO:
        flags.append("RDO_MAPPING_MISSING")
    if case.get("jurisdiction") != "ERODE":
        flags.append("JURISDICTION_NOT_CONFIRMED")
        
    parts = sum(float(case.get(k) or 0) for k in
                ("principal_amount", "penalty_amount", "interest_amount", "other_charges_amount"))
    total = float(case.get("total_recoverable_amount") or 0)
    if total <= 0:
        flags.append("TOTAL_MISSING")
    if parts and abs(parts - total) > 0.01:
        case["amount_check"] = "MISMATCH"
        flags.append("AMOUNT_MISMATCH")
        
    case["review_flags"] = sorted(set(flags))

    # Dynamic Paragraph Synthesis Guarantee
    paras = case.get("synthesized_paragraphs") or {}
    total_val = float(case.get("total_recoverable_amount") or 0.0)
    words_val = rupees_words(total_val)
    name_val = case.get("defaulter_name") or "எதிர்மனுதாரர்"
    rel_val = f" {case['relation_text']}" if case.get("relation_text") else ""
    full_defaulter = f"{name_val}{rel_val}"
    taluk_val = case.get("taluk_name") or "ஈரோடு"
    district_val = case.get("district_name") or "ஈரோடு"
    statute_val = case.get("statute_cited") or case.get("department_name_ta") or "நிலுவைத் தொகை"
    dues_lbl = case.get("dues_label") or "நிலுவைத் தொகை"
    payee_val = case.get("dd_favour_of") or "வட்டாட்சியர்"
    dispatch_val = case.get("dispatch_address") or "இவ்வலுவலகம்"
    
    addr_parts = [p for p in (case.get("door_no"), case.get("street_and_locality"), case.get("village")) if p]
    addr_str = ", ".join(addr_parts) if addr_parts else f"{taluk_val} வட்டம்"

    refs_list = case.get("references") or []
    ref_lines = [r.get("text_ta") for r in refs_list if r.get("text_ta")]
    if not ref_lines:
        ref_fno = case.get("case_file_no") or "RR-2026"
        ref_dt = case.get("order_date") or case.get("letter_date") or datetime.now().strftime("%d.%m.%Y")
        auth_str = case.get("issuing_authority_name") or "கோரிக்கை அலுவலக"
        ref_lines = [
            f"{auth_str} கடிதம் / உத்தரவு எண்.{ref_fno}, நாள்: {ref_dt}.",
            "வருவாய் நிலை ஆணை எண் 41 மற்றும் தமிழ்நாடு வருவாய் வசூல் சட்டம் 1864 பிரிவு 5."
        ]
    ref_block_text = ref_lines[0] if len(ref_lines) == 1 else "\n".join(f"{i}. {t}" for i, t in enumerate(ref_lines, 1))

    if not paras.get("subject_text"):
        paras["subject_text"] = f"வருவாய் வசூல் சட்டம் 1864 – {statute_val} – {district_val} மாவட்டம் – {taluk_val} வட்டம் – {full_defaulter} – {dues_lbl} {fig(total_val)} வசூல் செய்யக் கோருதல் – உத்திரவிடுதல்."
    if not paras.get("reference_text"):
        paras["reference_text"] = ref_block_text
    if not paras.get("order_para1"):
        paras["order_para1"] = f"{district_val} மாவட்டம், {taluk_val} வட்டம், {addr_str} என்ற முகவரியில் வசிக்கும் {full_defaulter} என்பவரிடமிருந்து {statute_val}-ன்படி அரசுக்குச் செலுத்த வேண்டிய {dues_lbl} {fig(total_val)} ({words_val}) ஐ தமிழ்நாடு வருவாய் வசூல் சட்டத்தின் கீழ் வசூல் செய்யுமாறு பார்வையில் காணும் உத்தரவின் வாயிலாக தெரிவிக்கப்பட்டுள்ளது."
    if not paras.get("order_para2"):
        paras["order_para2"] = f"மேற்படி {full_defaulter} என்பவரிடமிருந்து தொகை {fig(total_val)} ஐ வருவாய் நிலை ஆணை எண் 41 மற்றும் வருவாய் வசூல் சட்டம் 1864 பிரிவு 5-ன் கீழ் வசூல் செய்ய {taluk_val} வருவாய் வட்டாட்சியருக்கு அதிகாரம் வழங்கி இதன் மூலம் உத்திரவிடப்படுகிறது."
    if not paras.get("order_para3"):
        paras["order_para3"] = f"எனவே, எதிர்தரப்பினரின் அசையும் மற்றும் அசையா சொத்துகளிலிருந்து மேற்படி தொகையினை உடனடியாக வசூல் செய்து “{payee_val}“ என்ற பெயரில் வங்கி வரைவோலையாக (Demand Draft) எடுத்து {dispatch_val} என்ற அலுவலகத்திற்கு அசலினை அனுப்பி அதன் விவரத்தினை நகல் வங்கி வரைவோலையுடன் இவ்வலுவலகத்திற்கு அனுப்பி வைக்குமாறு {taluk_val} வருவாய் வட்டாட்சியருக்கு தெரிவிக்கப்படுகிறது."
    if not paras.get("note_para1"):
        paras["note_para1"] = paras["order_para1"]
    if not paras.get("note_para2"):
        paras["note_para2"] = f"எனவே, மேற்படி தொகையை வருவாய் நிலை ஆணை எண் 41 மற்றும் வருவாய் வசூல் சட்டம் 1864 பிரிவு 5-ன் கீழ் வசூல் செய்ய {taluk_val} வருவாய் வட்டாட்சியருக்கு அதிகாரம் வழங்கி இதன் மூலம் உத்தரவிடலாம்."

    case["synthesized_paragraphs"] = paras
    return case


def case_to_extracted_entities(case: dict, ocr_text: str = "") -> ExtractedLegalEntities:
    """Converts the verified CASE JSON into the typed ExtractedLegalEntities schema."""
    dept = case.get("department_type", "GENERAL_RR")
    try:
        dept_enum = DepartmentType(dept)
    except Exception:
        dept_enum = DepartmentType.GENERAL_RR

    ent = case.get("entity_type", "INDIVIDUAL")
    try:
        ent_enum = EntityType(ent)
    except Exception:
        ent_enum = EntityType.INDIVIDUAL

    total = float(case.get("total_recoverable_amount") or 0.0)
    principal = float(case.get("principal_amount") or (total if total > 0 else 0.0))
    penalty = float(case.get("penalty_amount") or 0.0)
    interest = float(case.get("interest_amount") or 0.0)

    taluk = case.get("taluk_name")
    district = case.get("district_name")

    defaulters = [
        DefaulterDetail(
            name=case.get("defaulter_name") ,
            father_or_spouse_name=case.get("relation_text"),
            representation_or_title=None,
            door_no=case.get("door_no"),
            street_and_locality=case.get("street_and_locality"),
            village=case.get("village"),
            taluk=taluk,
            district=district,
            pincode=case.get("pincode"),
            iec_number=case.get("iec_number"),
        )
    ]

    refs = case.get("references")
    refs_text_list = [r.get("text_ta") for r in refs if r.get("text_ta")]
    if not refs_text_list and case.get("case_file_no"):
        refs_text_list = [f"{case.get('issuing_authority_name') or 'அலுவலக'} கடிதம் எண். {case.get('case_file_no')}, நாள்: {case.get('order_date') or case.get('letter_date')}."]

    return ExtractedLegalEntities(
        department_type=dept_enum,
        entity_type=ent_enum,
        defaulter_details=defaulters,
        sureties=[],
        financials=FinancialDetails(
            principal_amount=principal,
            penalty_amount=penalty,
            interest_amount=interest,
            total_recoverable_amount=total,
            amount_in_words_tamil=rupees_words(total),
        ),
        reference_details=ReferenceDetails(
            issuing_authority_name=case.get("issuing_authority_name") or "",
            case_or_file_no=case.get("case_file_no") or "",
            ia_or_mp_no=case.get("order_in_original_no"),
            order_date=case.get("order_date"),
            letter_date=case.get("letter_date"),
            statutory_act_and_section=case.get("statute_cited"),
            references_list=refs_text_list,
        ),
        payment_instructions=PaymentInstructions(
            dd_favour_of=case.get("dd_favour_of"),
            head_of_account=case.get("head_of_account"),
            dispatch_address=case.get("dispatch_address"),
        ),
        references=refs_text_list,
        district_name=district,
        taluk_name=taluk,
        assigned_tahsildar=f"வருவாய் வட்டாட்சியர், {taluk}",
        file_no=case.get("case_file_no") or datetime.now().strftime("%m%d%H%M"),
        file_year=str(datetime.now().year),
        section_code=OFFICE_SECTION,
        roc_number=f"ந.க. {case.get('case_file_no') or '1248'}/{datetime.now().year}/{OFFICE_SECTION}",
        collector_name=COLLECTOR_LINE,
        extraction_raw_text=ocr_text,
    )


def parse_and_repair_json(raw: str) -> Optional[dict]:
    """Robust JSON parser that repairs markdown fences, unescaped chars, and truncated outputs."""
    if not raw or not raw.strip():
        return None
    cleaned = _strip_fences(raw)
    
    # 1. Direct parse attempt
    try:
        return json.loads(cleaned)
    except Exception:
        pass

    # 2. Extract outermost JSON object { ... }
    match = re.search(r'(\{[\s\S]*\})', cleaned)
    if match:
        candidate = match.group(1)
        try:
            return json.loads(candidate)
        except Exception:
            pass
        
        # 3. Clean unescaped newlines/tabs inside string values
        try:
            fixed = re.sub(r'[\r\n\t]+', ' ', candidate)
            return json.loads(fixed)
        except Exception:
            pass

        # 4. Truncated JSON recovery: test closing brackets / braces
        for i in range(len(candidate) - 1, 0, -1):
            if candidate[i] in ('}', ']'):
                sub = candidate[:i+1]
                try:
                    return json.loads(sub)
                except Exception:
                    pass
            elif candidate[i] == '"':
                for suffix in ['"}', '"} }', '"]}', '"} } }']:
                    try:
                        return json.loads(candidate[:i] + suffix)
                    except Exception:
                        pass
    return None


class LLMService:
    def __init__(
        self,
        base_url: Optional[str] = None,
        model: Optional[str] = None,
        timeout_seconds: Optional[int] = None,
        connect_timeout_seconds: Optional[float] = None,
        temperature: Optional[float] = None,
        top_p: Optional[float] = None,
        num_ctx: Optional[int] = None,
        num_predict: Optional[int] = None,
    ):
        raw_url = base_url or settings.OLLAMA_BASE_URL
        self.base_url = raw_url.rstrip("/").replace("://localhost", "://127.0.0.1")
        self.model = model or settings.OLLAMA_MODEL
        self.fallback_model = settings.OLLAMA_FALLBACK_MODEL
        self.timeout_seconds = float(timeout_seconds if timeout_seconds is not None else settings.OLLAMA_TIMEOUT_SECONDS)
        self.connect_timeout_seconds = float(connect_timeout_seconds if connect_timeout_seconds is not None else settings.OLLAMA_CONNECT_TIMEOUT_SECONDS)
        self.temperature = float(temperature if temperature is not None else settings.OLLAMA_TEMPERATURE)
        self.top_p = float(top_p if top_p is not None else settings.OLLAMA_TOP_P)
        self.num_ctx = int(num_ctx if num_ctx is not None else settings.OLLAMA_NUM_CTX)
        self.num_predict = int(num_predict if num_predict is not None else settings.OLLAMA_NUM_PREDICT)

    async def chat_completion(self, prompt: str, system_instruction: str = "", json_mode: bool = False) -> str:
        """Generates chat completion text using Ollama with parameters loaded from .env / settings."""
        model_name = self.model
        try:
            timeout_cfg = httpx.Timeout(timeout=self.timeout_seconds, connect=self.connect_timeout_seconds)
            payload: Dict[str, Any] = {
                "model": model_name,
                "system": system_instruction,
                "prompt": prompt,
                "stream": False,
                "options": {
                    "temperature": self.temperature,
                    "top_p": self.top_p,
                    "num_ctx": self.num_ctx,
                    "num_predict": self.num_predict,
                }
            }
            if json_mode:
                payload["format"] = "json"

            async with httpx.AsyncClient(timeout=timeout_cfg) as client:
                res = await client.post(
                    f"{self.base_url}/api/generate",
                    json=payload
                )
                if res.status_code == 200:
                    return res.json().get("response", "").strip()
                else:
                    logger.warning(f"Ollama chat completion with {model_name} returned status {res.status_code}: {res.text[:200]}")
        except Exception as e:
            err_msg = str(e) or f"Request timed out after reaching {self.timeout_seconds}s"
            logger.warning(f"Ollama chat completion with {model_name} failed ({type(e).__name__}): {err_msg}")
        return ""

    async def analyse_case(self, ocr_text: str) -> dict:
        """
        Dynamically analyzes the OCR text using the LLM with ZERO hardcoded templates or department checks.
        The LLM determines department, statute, dues label, entities, amounts, references, and addresses.
        """
        raw = await self.chat_completion(
            prompt=MASTER_PROMPT.replace("<<OCR_TEXT>>", ocr_text),
            system_instruction="You are an expert Revenue Recovery Legal Classifier and Entity Extractor. Return ONLY a valid JSON object. Zero hardcoding. Zero hallucination. Dynamically determine department, acts, defaulters, amounts, and jurisdictions from the source text.",
            json_mode=True
        )
        
        parsed = parse_and_repair_json(raw)
        if not parsed:
            logger.warning("LLM Master Prompt returned unparseable output. Using clean empty structure.")
            parsed = {
                "document_type": "DEPARTMENT_LETTER",
                "requisition_channel": "DIRECT_FROM_DEPARTMENT",
                "department_type": "GENERAL_RR",
                "department_name_ta": "வருவாய்த்துறை",
                "statute_cited": "தமிழ்நாடு வருவாய் வசூல் சட்டம் 1864 பிரிவு 5",
                "dues_label": "நிலுவைத் தொகை",
                "principal_label": "நிலுவைத் தொகை",
                "entity_type": "INDIVIDUAL",
                "defaulter_name": "எதிர்மனுதாரர்",
                "relation_text": None,
                "iec_number": None,
                "door_no": None,
                "street_and_locality": None,
                "village": None,
                "taluk_name": "ஈரோடு",
                "district_name": "ஈரோடு",
                "pincode": None,
                "jurisdiction": "ERODE",
                "principal_amount": 0.0,
                "penalty_amount": 0.0,
                "interest_amount": 0.0,
                "other_charges_amount": 0.0,
                "total_recoverable_amount": 0.0,
                "issuing_authority_name": "கோரிக்கை அலுவலகம்",
                "case_file_no": None,
                "order_date": None,
                "letter_date": None,
                "beneficiary_name": None,
                "dd_favour_of": "வட்டாட்சியர்",
                "dispatch_address": "இவ்வலுவலகம்",
                "court_or_issuer_ta": None,
                "references": [],
                "review_flags": ["LLM_PARSE_FALLBACK"]
            }

        return postprocess_case(parsed, ocr_text)

    async def extract_entities(self, raw_ocr_text: str) -> ExtractedLegalEntities:
        """Standardized interface returning typed ExtractedLegalEntities from master prompt analysis."""
        case = await self.analyse_case(raw_ocr_text)
        return case_to_extracted_entities(case, raw_ocr_text)
