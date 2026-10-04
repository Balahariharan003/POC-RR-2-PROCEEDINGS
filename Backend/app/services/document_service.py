"""
Document Service & RR Drafting Engine v2 – Erode Collectorate (Section ஈ2)
===========================================================================
Generates the 4 authentic Tamil Nadu Revenue Recovery documents:
1. Office Note (அலுவலகக் குறிப்பு)
2. Proceedings (செயல்முறைகள்) – matching official RR ACT PROCEEDINGS FORMAT
3. Memorandum (குறிப்பாணை)
4. Warrant (ஜப்தி மற்றும் கைது வாரண்ட் ஆணை) – for MAINTENANCE cases

DESIGN RULES:
1. BLACK text lives in templates. The LLM never rewrites it.
2. Facts (amount, words, names, DD payee, taluk, RDO, refs) are filled by Python from verified JSON.
3. The LLM only writes the few «SLOTS» (demand clause / narrative paragraphs).
4. validate_draft() rejects output that altered locked text, added an amount, dropped a reference number,
   or invented interest / charges. 2 attempts, then DraftValidationError.
5. Strict TAU-Marutham font enforcement across OpenXML runs, paragraphs, and tables.
"""

import asyncio
import json
import re
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, Optional, List, Union

import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import parse_xml, OxmlElement
from docx.oxml.ns import nsdecls, qn

from app.core.config import settings
from app.core.logging import logger
from app.domain.schemas.legal_entities import (
    ExtractedLegalEntities,
    DepartmentType,
    EntityType,
)
from app.services.llm_service import (
    LLMService,
    COLLECTOR_LINE,
    OFFICE_SECTION,
    TALUK_TO_RDO,
    ERODE_TALUKS,
    tamil_words,
    inr,
    fig,
    rupees_words,
    _strip_fences,
)

OUTPUT_DIR = settings.OUTPUT_DIR
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
llm_service = LLMService()


# ======================================================================================
# 1. TEMPLATES (Locked Black Text + Red Variable Slots)
# ======================================================================================
LOCK_RULES = """ABSOLUTE RULES
1. The LOCKED TEMPLATE below is an official format. Every line WITHOUT «…» is BLACK (fixed): copy it character-for-character (spellings such as 'உத்திரவிடப்படுகிறது', punctuation, dashes, line breaks).
2. Each «SLOT» is RED (variable): replace it with text written as per RED-SLOT INSTRUCTIONS, then remove the « ».
3. Facts come ONLY from CASE_JSON. A missing value is written as ______ . Never guess, round, convert or recompute amounts.
4. Do not add interest, collection charges, bank-account attachment, extra paragraphs, headings or amounts that are not in the template / CASE_JSON.
5. Pure official Tamil (ஆட்சிமொழித் தமிழ்); English only for corporate names, IEC / registration numbers, court / authority names and addresses exactly as in CASE_JSON.
6. Output ONLY the finished document text – no markdown, no JSON, no explanation."""

OFFICE_NOTE_TEMPLATE = """\
// அலுவலகக் குறிப்பு //
பொருள்: வருவாய் வசூல் சட்டம் 1864 – <<DEPT_LABEL_DASH>>ஈரோடு மாவட்டம் – <<TALUK>> வட்டம் – <<DEFAULTER_FULL>> – «DEMAND_CLAUSE» – வருவாய் வசூல் சட்டத்தின் கீழ் வசூல் செய்ய கோருதல் – உத்தரவிடுதல்.
பார்வை: <<REFS_BLOCK>>
-------
பணிந்தனுப்பப்படுகிறது:
«PARA1»
«PARA2»
எனவே, மேற்படி தொகையை வருவாய் நிலை ஆணை எண்.41 மற்றும் வருவாய் வசூல் சட்டம் 1864 பிரிவு 5-ன் கீழ் வசூல் செய்ய <<TALUK>> வருவாய் வட்டாட்சியருக்கு அதிகாரம் வழங்கி இதன் மூலம் உத்தரவிடலாம்.
உத்தரவினை எதிர்நோக்கி செயல்முறை வரைவு ஒப்புதலுக்காக மாவட்ட ஆட்சித்தலைவர் அவர்களுக்கு பணிவுடன் சமர்ப்பிக்கப்படுகிறது.
"""

OFFICE_NOTE_SLOTS = """\
«DEMAND_CLAUSE» – one phrase: what is due, with figures. With components use exactly: <dues label> <<AMOUNT_FIG>> <<BREAKDOWN>>. Add statute / court case no. dynamically from CASE_JSON.
«PARA1» – 3-4 lines: the defaulter (<<LIVES>>, with address, taluk, district), what the incoming authority / court sent (cite the references with number and date), the sum <<AMOUNT_FIG>> with breakdown, and that recovery under the Revenue Recovery Act 1864 is requested. If prior_proceedings or reminders exist, cite their numbers and dates.
«PARA2» – 3-4 lines: the defaulter (with IEC / registration no. if present) owes <<AMOUNT_FIG>> (<<AMOUNT_WORDS>>); recover from movable and immovable property under the RR Act; Demand Draft in favour of “<<PAYEE>>”; ORIGINAL sent to <<DISPATCH>>; particulars with copy of the DD to <<REPORT_TO>>; ends 'அனுப்பி வைக்குமாறு <<TALUK>> வருவாய் வட்டாட்சியருக்குத் தெரிவிக்கலாம்.' Null PAYEE / DISPATCH stay ______ ."""

PROCEEDINGS_TEMPLATE = """\
ஈரோடு மாவட்ட ஆட்சித் தலைவர் மற்றும் மாவட்ட நிர்வாக நடுவர் அவர்களின் செயல்முறைகள்
பிறப்பிப்பவர்: <<COLLECTOR>>
ந.க.<<NK>>/<<YEAR>>/<<SEC>>                                   நாள்: <<DOC_DATE>>
பொருள்: வருவாய் வசூல் சட்டம் 1864 – <<DEPT_LABEL_DASH>>ஈரோடு மாவட்டம் – <<TALUK>> வட்டம் – <<DEFAULTER_FULL>> – «DEMAND_CLAUSE» – வருவாய் வசூல் சட்டத்தின் கீழ் வசூல் செய்ய கோருதல் – உத்தரவிடுதல்.
பார்வை: <<REFS_BLOCK>>
-------
உத்தரவு:
«PARA1»
மேற்படி <<DEFAULTER_NAME>> <<FROM_WHOM>> தொகை <<AMOUNT_FIG>> ஐ வருவாய் நிலை ஆணை எண்.41 மற்றும் வருவாய் வசூல் சட்டம் 1864 பிரிவு 5-ன் கீழ் வசூல் செய்ய <<TALUK>> வருவாய் வட்டாட்சியருக்கு அதிகாரம் வழங்கி இதன் மூலம் உத்திரவிடப்படுகிறது.
எனவே, மேற்படி முகவரியில் <<LIVES>> <<DEFAULTER_ID>> <<OF_WHOM>> அசையும் மற்றும் அசையா சொத்துக்களிலிருந்து <<AMOUNT_FIG>> (<<AMOUNT_WORDS>>) தொகையினை வருவாய் வசூல் சட்டப்படி வசூல் செய்து “<<PAYEE>>” என்ற பெயரில் வங்கி வரைவோலையாக (Demand Draft) எடுத்து <<DISPATCH>> என்ற அலுவலகத்திற்கு அசலினை அனுப்பி அதன் விவரத்தினை நகல் வங்கி வரைவோலையுடன் <<REPORT_TO>> அனுப்பி வைக்குமாறு <<TALUK>> வருவாய் வட்டாட்சியருக்கு தெரிவிக்கப்படுகிறது.
இணைப்பு: கடித நகல்
மாவட்ட ஆட்சித் தலைவர்,
ஈரோடு.
பெறுநர்: வருவாய் வட்டாட்சியர், <<TALUK>>.
நகல்: வருவாய் கோட்டாட்சியர், <<RDO>>.
<<COPY_BENEFICIARY>>
<<COPY_COURT>>
<<COPY_DEFAULTER>>
"""

PROCEEDINGS_SLOTS = """\
«DEMAND_CLAUSE» – one phrase: what is due with figures (<<AMOUNT_FIG>> and breakdown <<BREAKDOWN>> if non-empty); cite statute / act and court/file number dynamically from CASE_JSON.
«PARA1» – ONE narrative demand paragraph dynamically citing the defaulter, address, taluk, the requisitioning letter/order with date & number, exact recoverable amount with component breakdown, and request for recovery under the RR Act 1864."""

MEMO_TEMPLATE = """\
ந.க.<<NK>>/<<YEAR>>/<<SEC>>                                   மாவட்ட ஆட்சியர் அலுவலகம்,
                                                              ஈரோடு.
                                                              நாள்: <<DOC_DATE>>
// குறிப்பாணை //
பொருள்: வருவாய் வசூல் சட்டம் 1864 – <<DEPT_LABEL_DASH>>ஈரோடு மாவட்டம் – <<TALUK>> வட்டம் – <<DEFAULTER_FULL>> – «DEMAND_CLAUSE» – வருவாய் வசூல் சட்டத்தின் கீழ் வசூல் செய்ய கோருதல் – உத்தரவிடுதல்.
பார்வை: <<REFS_ALL>>
-------
«PARA1»
«PARA2»
«PARA3»
எனவே, மேற்படி <<DEFAULTER_NAME>> <<OF_WHOM>> மீது மேற்கொள்ளப்பட்ட வருவாய் வசூல் சட்ட நடவடிக்கைகளை உடனடியாக முடிக்குமாறு <<TALUK>> வட்டாட்சியர் கேட்டுக்கொள்ளப்படுகிறார்.
மாவட்ட ஆட்சித் தலைவருக்காக /
மாவட்ட ஆட்சியரின் நேர்முக உதவியாளர் (பொது),
ஈரோடு.
பெறுநர்: வருவாய் வட்டாட்சியர், <<TALUK>>.
நகல்: வருவாய் கோட்டாட்சியர், <<RDO>>.
<<COPY_BENEFICIARY>>
<<COPY_COURT>>
<<COPY_DEFAULTER>>
"""

MEMO_SLOTS = """\
«DEMAND_CLAUSE» – same one-phrase clause as in the Proceedings (figures from CASE_JSON only).
«PARA1» – 2-3 lines: the defaulter <<LIVES>> at the address owes <<AMOUNT_FIG>> <<BREAKDOWN>>; recovery under the RR Act was requested in reference 1 (cite its number / date).
«PARA2» – ONLY if prior_proceedings is not null: 2-3 lines – this office's proceedings ந.க.<number>, dated <date>, empowered the <<TALUK>> Tahsildar under RSO 41 and Section 5 of the RR Act 1864 to recover and remit by Demand Draft. If prior_proceedings is null write exactly: மேற்படி தொகையினை வருவாய் வசூல் சட்டப்படி வசூல் செய்யுமாறு இவ்வலுவலக செயல்முறை ஆணை தனியாக அனுப்பப்படுகிறது.
«PARA3» – ONLY if reminders is not empty: 2-3 lines – the later letter (number / date from reminders) again asks that the recovery steps be completed quickly. If reminders is empty write exactly: மேற்படி தொகையினை தாமதமின்றி வசூல் செய்ய வேண்டியுள்ளது."""

WARRANT_TEMPLATE = """\
// ஜப்தி மற்றும் கைது வாரண்ட் ஆணை //
(Execution Warrant for Maintenance Arrears)
ந.க.<<NK>>/<<YEAR>>/<<SEC>>                                   நாள்: <<DOC_DATE>>
சட்டப்பிரிவு & அதிகாரம்: <<COURT_TA>> உத்தரவு / பாரதிய நாகரிக் சுரக்ஷா சன்ஹிதா பிரிவு 144 மற்றும் தமிழ்நாடு வருவாய் வசூல் சட்டம் 1864.
எதிர்தரப்பினர்: <<DEFAULTER_FULL>>
பராமரிப்புத் தொகை விவரம்: «MAINT_DETAILS»
அமலாக்கக் கட்டளை:
மேற்படி பராமரிப்புத் தொகை நிலுவையினை உடனடியாக செலுத்தத் தவறினால், எதிர்தரப்பினரின் அசையும் சொத்துக்களை உடனடியாக ஜப்தி செய்யவும்<<ARREST>> வருவாய் ஆய்வாளர் மற்றும் காவல் துறை அதிகாரிகளுக்கு இதன் மூலம் உத்தரவிடப்படுகிறது.
மாவட்ட ஆட்சித் தலைவர்,
ஈரோடு.
"""

WARRANT_SLOTS = """\
«MAINT_DETAILS» – 2-3 lines using ONLY CASE_JSON.maintenance and the case / order numbers: beneficiary names, arrears period (from – to), monthly rate, number of months, and the total <<AMOUNT_FIG>> (<<AMOUNT_WORDS>>). Null values stay ______ ."""


# ======================================================================================
# 2. VALIDATION & SLOT BUILDING
# ======================================================================================
class DraftValidationError(Exception):
    def __init__(self, doc: str, errors: List[str], last_text: str):
        super().__init__(f"{doc}: {errors}")
        self.doc, self.errors, self.last_text = doc, errors, last_text


def fill(t: str, slots: dict) -> str:
    for k, v in slots.items():
        t = t.replace(f"<<{k}>>", str(v))
    return t


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip()


def validate_draft(text: str, template: str, case: dict, need_refs: Optional[List[str]] = None, need_words: bool = True) -> List[str]:
    errs, nt = [], _norm(text)
    if "«" in text or "»" in text or "<<" in text:
        errs.append("unfilled slot marker left in text")
    for line in template.splitlines():
        if line.strip() and "«" not in line and _norm(line) not in nt:
            errs.append(f"locked line altered/missing: {line.strip()[:60]}")
    total = float(case.get("total_recoverable_amount") or 0)
    allowed = {inr(float(case.get(k) or 0)) for k in
               ("principal_amount", "penalty_amount", "interest_amount", "other_charges_amount",
                "total_recoverable_amount")}
    if case.get("maintenance"):
        allowed.add(inr(float(case["maintenance"].get("monthly_rate") or 0)))
    for m in re.findall(r"(?:ரூ|Rs)\.?\s*([\d,]+(?:\.\d+)?)", text):
        if m.rstrip(".,") not in allowed:
            errs.append(f"amount not in case data: {m}")
    if total and fig(total) not in nt.replace("ரூ. ", "ரூ."):
        errs.append(f"total {fig(total)} missing")
    if total and need_words and _norm(rupees_words(total)) not in nt:
        errs.append("amount-in-words missing or different")
    for ref in need_refs or []:
        if ref and ref not in text:
            errs.append(f"reference number missing: {ref}")
    if not float(case.get("interest_amount") or 0) and "வட்டி" in text:
        errs.append("interest mentioned but source has none")
    if "வசூல் கட்டண" in text:
        errs.append("collection charges are not in source")
    return errs


def build_slots(c: dict, meta: Optional[dict] = None, office_config: Optional[dict] = None) -> dict:
    meta = meta or {}
    cfg = office_config or {}
    collector = cfg.get("collector_line", COLLECTOR_LINE)
    section = c.get("section_code") or cfg.get("office_section", OFFICE_SECTION)
    taluk_to_rdo = cfg.get("taluk_to_rdo", TALUK_TO_RDO)

    person = c.get("entity_type") == "INDIVIDUAL"

    name = str(c.get("defaulter_name") or "எதிர்மனுதாரர்")
    if c.get("relation_text"):
        name += f" {c['relation_text']}"

    name_id = name + (f" (IEC No : {c['iec_number']})" if c.get("iec_number") else "")
    addr = ", ".join(x for x in (c.get("door_no"), c.get("street_and_locality"), c.get("village")) if x)
    full_addr = ", ".join(x for x in (addr, c.get("district_name")) if x) + (f" – {c['pincode']}" if c.get("pincode") else "")
    taluk = c.get("taluk_name") or "______"

    # Fully dynamic labels extracted by LLM from source
    dept_label = c.get("department_name_ta") or c.get("statute_cited") or (c.get("department_type") if c.get("department_type") and c.get("department_type") != "GENERAL_RR" else None)
    dues_label = c.get("dues_label") or "நிலுவைத் தொகை"
    principal_label = c.get("principal_label") or dues_label
    penalty_label = c.get("penalty_label") or "அபராதத் தொகை"
    interest_label = c.get("interest_label") or "வட்டித் தொகை"
    other_label = c.get("other_charges_label") or "இதர தொகை"

    comps = [
        (principal_label, c.get("principal_amount")),
        (penalty_label, c.get("penalty_amount")),
        (interest_label, c.get("interest_amount")),
        (other_label, c.get("other_charges_amount"))
    ]
    comps = [(l, v) for l, v in comps if v]
    total = float(c.get("total_recoverable_amount") or 0.0)
    breakdown = f"({' + '.join(f'{l} {fig(v)}' for l, v in comps)})" if len(comps) > 1 else ""
    court = c.get("court_or_issuer_ta") if c.get("requisition_channel") == "FROM_COURT" else None
    prior = c.get("prior_proceedings") or {}
    refs = [r["text_ta"] for r in c.get("references") or [] if r.get("text_ta")]
    if not refs:
        refs = ["______"]

    if c.get("entity_type") in ("MULTIPLE_PROMOTERS", "MULTIPLE_INDIVIDUALS"):
        from_whom = "ஆகியோரிடமிருந்து"
        of_whom = "ஆகியோரின்"
        lives_verb = "வசிக்கும்"
    elif person:
        from_whom = "என்பவரிடமிருந்து"
        of_whom = "என்பவரின்"
        lives_verb = "வசிக்கும்"
    else:
        from_whom = "என்ற நிறுவனத்திடமிருந்து"
        of_whom = "என்ற நிறுவனத்தின்"
        lives_verb = "இயங்கி வரும்"

    paras = c.get("synthesized_paragraphs") or {}

    return {
        "COLLECTOR": collector,
        "NK": meta.get("nk_no") or prior.get("nk_no") or c.get("case_file_no") or "______",
        "YEAR": meta.get("year", str(datetime.now().year)),
        "DOC_DATE": meta.get("doc_date") or datetime.now().strftime(".%m.%Y"),
        "SEC": section,
        "DEPT_LABEL_DASH": f"{dept_label} – " if dept_label else "",
        "TALUK": taluk,
        "RDO": taluk_to_rdo.get(taluk, "______"),
        "DEFAULTER_FULL": f"{name}, {addr}" if addr else name,
        "DEFAULTER_NAME": name,
        "DEFAULTER_ID": name_id,
        "FROM_WHOM": from_whom,
        "OF_WHOM": of_whom,
        "LIVES": lives_verb,
        "AMOUNT_FIG": fig(total),
        "AMOUNT_WORDS": rupees_words(total),
        "BREAKDOWN": breakdown,
        "PAYEE": c.get("dd_favour_of") or "______",
        "DISPATCH": c.get("dispatch_address") or "______",
        "REPORT_TO": f"{court} என்ற அலுவலகத்திற்கும் மற்றும் இவ்வலுவலகத்திற்கும்" if court else "இவ்வலுவலகத்திற்கு",
        "REFS_BLOCK": paras.get("reference_text") or (refs[0] if len(refs) == 1 else "\n".join(f"{i}. {t}" for i, t in enumerate(refs, 1))),
        "COPY_BENEFICIARY": f"நகல்: {c['dispatch_address']}" if c.get("dispatch_address") else "நகல்:",
        "COPY_COURT": f"நகல்: {c['court_or_issuer_block_en']}" if (court and c.get("court_or_issuer_block_en")) else "நகல்:",
        "COPY_DEFAULTER": f"நகல்: {name}, {full_addr}",
        "PARA1_SYNTHESIZED": paras.get("order_para1", ""),
        "PARA2_SYNTHESIZED": paras.get("order_para2", ""),
        "PARA3_SYNTHESIZED": paras.get("order_para3", ""),
    }


def _drop_empty_copy_lines(t: str) -> str:
    return "\n".join(l for l in t.splitlines() if l.strip() != "நகல்:")


def _ref_numbers(c: dict, include_own: bool = False) -> List[str]:
    nums = [r.get("ref_no") for r in c.get("references") or []]
    if include_own:
        nums += [(c.get("prior_proceedings") or {}).get("nk_no")]
        nums += [r.get("ref_no") for r in c.get("reminders") or []]
    return [str(n) for n in nums if n]


async def _case_for(ocr_text: str, case: Optional[dict] = None) -> dict:
    return case if case is not None else await llm_service.analyse_case(ocr_text)


async def _draft(doc: str, system: str, template: str, slot_help: str, case: dict, need_refs: Optional[List[str]], need_words: bool = True) -> str:
    errs, text = [], ""
    drafting_system = (
        "You are the Senior Revenue Recovery Drafting Officer of the Erode Collectorate (ஈரோடு மாவட்ட ஆட்சியர் அலுவலகம், பிரிவு ஈ2).\n"
        "Your objective is to write authentic, grammatically flawless, official Tamil administrative prose (ஆட்சிமொழித் தமிழ்) "
        "to replace the variable slot markers («...») in the locked official government template using ONLY the facts in CASE_JSON.\n\n"
        "CORE RULES:\n"
        "1. ZERO HALLUCINATION: All figures, dates, reference numbers, defaulter names, and statutory provisions come strictly from CASE_JSON.\n"
        "2. PRESERVE LOCKED BLACK TEXT: Output every line outside «...» exactly as provided.\n"
        "3. REPLACE EVERY «SLOT»: Output the full document with all «...» slot markers replaced by your drafted prose.\n"
        "4. NO MARKDOWN / NO CODE BLOCKS: Return only the final Tamil document text."
    )

    # If synthesized paragraphs already exist in case JSON, use them directly
    paras = case.get("synthesized_paragraphs") or {}
    total_val = float(case.get("total_recoverable_amount") or 0.0)
    words_val = rupees_words(total_val)
    statute_val = case.get("statute_cited") or "நிலுவைத் தொகை"

    default_text = template
    if "«DEMAND_CLAUSE»" in default_text:
        default_text = default_text.replace("«DEMAND_CLAUSE»", f"{statute_val} {fig(total_val)}")

    # Map document-specific synthesized paragraphs from MASTER_PROMPT
    if doc == "Office Note":
        p1 = paras.get("note_para1") or paras.get("order_para1")
        p2 = paras.get("note_para2") or paras.get("order_para2")
        if p1 and "«PARA1»" in default_text:
            default_text = default_text.replace("«PARA1»", p1)
        if p2 and "«PARA2»" in default_text:
            default_text = default_text.replace("«PARA2»", p2)
    elif doc == "Memorandum":
        p1 = paras.get("memo_para1") or paras.get("order_para1")
        p2 = paras.get("memo_para2") or paras.get("order_para2")
        p3 = paras.get("memo_para3") or (paras.get("order_para3") if case.get("reminders") else "மேற்படி தொகையினை தாமதமின்றி வசூல் செய்ய வேண்டியுள்ளது.")
        if p1 and "«PARA1»" in default_text:
            default_text = default_text.replace("«PARA1»", p1)
        if p2 and "«PARA2»" in default_text:
            default_text = default_text.replace("«PARA2»", p2)
        if p3 and "«PARA3»" in default_text:
            default_text = default_text.replace("«PARA3»", p3)
    else:  # Proceedings / General
        p1 = paras.get("order_para1")
        p2 = paras.get("order_para2")
        p3 = paras.get("order_para3")
        if p1 and "«PARA1»" in default_text:
            default_text = default_text.replace("«PARA1»", p1)
        if p2 and "«PARA2»" in default_text:
            default_text = default_text.replace("«PARA2»", p2)
        if p3 and "«PARA3»" in default_text:
            default_text = default_text.replace("«PARA3»", p3)

    if "«MAINT_DETAILS»" in default_text:
        default_text = default_text.replace("«MAINT_DETAILS»", f"பராமரிப்புத் தொகை {fig(total_val)} ({words_val}).")

    # If all slots were successfully filled from the master analysis, return immediately
    if "«" not in default_text and paras:
        return default_text

    for _ in range(2):
        prompt = (
            f"{LOCK_RULES}\n\n"
            f"DOCUMENT TYPE: {doc}\n\n"
            f"RED-SLOT INSTRUCTIONS & STYLE GUIDELINES:\n{slot_help}\n\n"
            f"CASE_JSON (Verified Facts Sheet):\n{json.dumps(case, ensure_ascii=False, indent=1)}\n\n"
            f"LOCKED TEMPLATE (Fill all «...» markers with authentic Tamil prose):\n{template}"
        )
        if errs:
            prompt += f"\n\nCRITICAL FIX REQUIRED (Previous attempt was rejected):\n" + "\n".join(f"- {e}" for e in errs)
        
        response_text = await llm_service.chat_completion(prompt=prompt, system_instruction=drafting_system)
        text = _strip_fences(response_text)
        if not text:
            text = default_text
        
        errs = validate_draft(text, template, case, need_refs, need_words)
        if not errs:
            return text

    # If validation had minor formatting discrepancy, return the default filled text
    return default_text


# ======================================================================================
# 3. TAU-MARUTHAM DOCX RENDERING ENGINE
# ======================================================================================
def set_run_font(run: Any, font_name: str = settings.PRIMARY_FONT_TAMIL, size_pt: float = 12.0, bold: bool = False, italic: bool = False, color_rgb: Optional[RGBColor] = None) -> None:
    run.font.name = font_name
    run.font.size = Pt(size_pt)
    run.bold = bold
    run.italic = italic
    if color_rgb:
        run.font.color.rgb = color_rgb

    rPr = run._r.get_or_add_rPr()
    rFonts = OxmlElement("w:rFonts")
    rFonts.set(qn("w:ascii"), font_name)
    rFonts.set(qn("w:hAnsi"), font_name)
    rFonts.set(qn("w:cs"), font_name)
    rFonts.set(qn("w:eastAsia"), font_name)
    rPr.append(rFonts)


def enforce_document_font(document: docx.Document, font_name: str = settings.PRIMARY_FONT_TAMIL) -> None:
    """Sets TAU-Marutham font family strictly across all paragraphs, runs, tables, and styles."""
    for style in document.styles:
        if hasattr(style, "font"):
            style.font.name = font_name

    for p in document.paragraphs:
        for r in p.runs:
            set_run_font(r, font_name=font_name, size_pt=r.font.size.pt if r.font.size else 12.0, bold=bool(r.bold), italic=bool(r.italic))

    for t in document.tables:
        for row in t.rows:
            for cell in row.cells:
                for p in cell.paragraphs:
                    for r in p.runs:
                        set_run_font(r, font_name=font_name, size_pt=r.font.size.pt if r.font.size else 11.0, bold=bool(r.bold), italic=bool(r.italic))


async def render_text_stream_to_docx(text: str, target_path: Path, doc_type: str = "PROCEEDINGS") -> Path:
    """
    Renders drafted Tamil Nadu Collectorate text into a Word document with
    strict TAU-Marutham typography matching the official RR ACT PROCEEDINGS FORMAT.
    """
    target_path = Path(target_path)
    target_path.parent.mkdir(parents=True, exist_ok=True)

    doc = docx.Document()

    # Configure Margins (1 inch top/bottom/left/right)
    sections = doc.sections
    for s in sections:
        s.top_margin = Inches(1.0)
        s.bottom_margin = Inches(1.0)
        s.left_margin = Inches(1.0)
        s.right_margin = Inches(1.0)

    lines = [l.rstrip() for l in text.splitlines()]

    # Parse lines into structured sections
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        if not line:
            i += 1
            continue

        # Header titles
        if any(h in line for h in [
            "ஈரோடு மாவட்ட ஆட்சித் தலைவர் மற்றும் மாவட்ட நிர்வாக நடுவர் அவர்களின் செயல்முறைகள்",
            "// அலுவலகக் குறிப்பு //",
            "// குறிப்பாணை //",
            "// ஜப்தி மற்றும் கைது வாரண்ட் ஆணை //",
            "(Execution Warrant for Maintenance Arrears)"
        ]):
            p = doc.add_paragraph()
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            p.paragraph_format.space_after = Pt(4)
            p.paragraph_format.line_spacing = 1.15
            r = p.add_run(line)
            set_run_font(r, font_name=settings.PRIMARY_FONT_TAMIL, size_pt=13.0, bold=True)
            i += 1
            continue

        if line.startswith("பிறப்பிப்பவர்:"):
            p = doc.add_paragraph()
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            p.paragraph_format.space_after = Pt(8)
            r = p.add_run(line)
            set_run_font(r, font_name=settings.PRIMARY_FONT_TAMIL, size_pt=12.0, bold=True)
            i += 1
            continue

        # ந.க. line with right-aligned date
        if line.startswith("ந.க."):
            p = doc.add_paragraph()
            p.paragraph_format.space_after = Pt(8)
            p.paragraph_format.line_spacing = 1.15
            r = p.add_run(line)
            set_run_font(r, font_name=settings.PRIMARY_FONT_TAMIL, size_pt=11.5, bold=True)
            i += 1
            continue

        # Subject / Reference Table Formatting (Matching signed proceedings layout)
        if line.startswith("பொருள்:") or line.startswith("பார்வை:"):
            # Render as clean two-column table if proceedings/memo
            table = doc.add_table(rows=0, cols=2)
            table.alignment = WD_TABLE_ALIGNMENT.CENTER
            table.autofit = False

            # Column widths: Col 0 = 1.2 inches, Col 1 = 5.3 inches
            while i < len(lines) and (lines[i].strip().startswith("பொருள்:") or lines[i].strip().startswith("பார்வை:") or lines[i].strip().startswith("சட்டப்பிரிவு") or lines[i].strip().startswith("எதிர்தரப்பினர்:") or lines[i].strip().startswith("பராமரிப்புத் தொகை விவரம்:")):
                row_line = lines[i].strip()
                colon_idx = row_line.find(":")
                if colon_idx != -1:
                    label = row_line[:colon_idx + 1].strip()
                    val = row_line[colon_idx + 1:].strip()
                else:
                    label = ""
                    val = row_line

                row = table.add_row()
                row.cells[0].width = Inches(1.2)
                row.cells[1].width = Inches(5.3)

                p0 = row.cells[0].paragraphs[0]
                p0.paragraph_format.space_after = Pt(4)
                r0 = p0.add_run(label)
                set_run_font(r0, font_name=settings.PRIMARY_FONT_TAMIL, size_pt=11.5, bold=True)

                p1 = row.cells[1].paragraphs[0]
                p1.paragraph_format.space_after = Pt(4)
                p1.paragraph_format.line_spacing = 1.15
                r1 = p1.add_run(val)
                set_run_font(r1, font_name=settings.PRIMARY_FONT_TAMIL, size_pt=11.5, bold=False)

                i += 1
            doc.add_paragraph().paragraph_format.space_after = Pt(4)
            continue

        if line == "-------":
            p = doc.add_paragraph()
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            p.paragraph_format.space_after = Pt(4)
            r = p.add_run("-------")
            set_run_font(r, font_name=settings.PRIMARY_FONT_TAMIL, size_pt=11.0, bold=True)
            i += 1
            continue

        if line.startswith("உத்தரவு:") or line.startswith("பணிந்தனுப்பப்படுகிறது:") or line.startswith("அமலாக்கக் கட்டளை:"):
            p = doc.add_paragraph()
            p.paragraph_format.space_after = Pt(6)
            r = p.add_run(line)
            set_run_font(r, font_name=settings.PRIMARY_FONT_TAMIL, size_pt=12.0, bold=True)
            i += 1
            continue

        # Signatory block (Right aligned)
        if any(line.startswith(s) for s in ["மாவட்ட ஆட்சித் தலைவர்,", "மாவட்ட ஆட்சித் தலைவருக்காக /", "மாவட்ட ஆட்சியரின் நேர்முக உதவியாளர்"]):
            p = doc.add_paragraph()
            p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
            p.paragraph_format.space_before = Pt(12)
            p.paragraph_format.space_after = Pt(2)
            r = p.add_run(line)
            set_run_font(r, font_name=settings.PRIMARY_FONT_TAMIL, size_pt=11.5, bold=True)
            if i + 1 < len(lines) and lines[i + 1].strip() == "ஈரோடு.":
                p2 = doc.add_paragraph()
                p2.alignment = WD_ALIGN_PARAGRAPH.RIGHT
                p2.paragraph_format.space_after = Pt(12)
                r2 = p2.add_run("ஈரோடு.")
                set_run_font(r2, font_name=settings.PRIMARY_FONT_TAMIL, size_pt=11.5, bold=True)
                i += 1
            i += 1
            continue

        # Standard body paragraph
        p = doc.add_paragraph()
        p.paragraph_format.space_after = Pt(6)
        p.paragraph_format.line_spacing = 1.15
        p.paragraph_format.first_line_indent = Inches(0.4) if not (line.startswith("பெறுநர்:") or line.startswith("நகல்:") or line.startswith("இணைப்பு:")) else Inches(0)

        is_bold = line.startswith("பெறுநர்:") or line.startswith("நகல்:") or line.startswith("இணைப்பு:")
        r = p.add_run(line)
        set_run_font(r, font_name=settings.PRIMARY_FONT_TAMIL, size_pt=11.5, bold=is_bold)
        i += 1

    enforce_document_font(doc, settings.PRIMARY_FONT_TAMIL)
    doc.save(str(target_path))

    # ----------------------------------------------------------------------
    # SERVER LOG: STAGE 3 - CREATED DOCUMENT CONTENT
    # ----------------------------------------------------------------------
    print("\n" + "=" * 80)
    print(f" [STAGE 3/3] CREATED DOCUMENT CONTENT ({doc_type}) -> {target_path.name}")
    print("-" * 80)
    print(text)
    print("=" * 80 + "\n")

    logger.info(f"DOCX ({doc_type}) rendered successfully to: {target_path}")
    return target_path


# ======================================================================================
# 4. WORKER DRAFTING FUNCTIONS
# ======================================================================================
async def process_office_note(ocr_text: str, job_id: int, *args, case: Optional[dict] = None, meta: Optional[dict] = None, config: Optional[dict] = None) -> str:
    """Worker 1: Drafts internal Office Note (Office_Note_{job_id}.docx)."""
    case, meta = await _case_for(ocr_text, case), meta or {}
    s = build_slots(case, meta, config)
    text = await _draft(
        "Office Note",
        "Draft the Erode Collectorate Office Note exactly in the locked format. Zero hallucination.",
        fill(OFFICE_NOTE_TEMPLATE, s),
        fill(OFFICE_NOTE_SLOTS, s),
        case,
        _ref_numbers(case, include_own=True)
    )
    target = OUTPUT_DIR / f"Office_Note_{job_id}.docx"
    await render_text_stream_to_docx(text, target, doc_type="NOTE")
    return str(target)


async def process_proceedings(ocr_text: str, job_id: int, *args, case: Optional[dict] = None, meta: Optional[dict] = None, config: Optional[dict] = None) -> str:
    """Worker 2: Drafts Collector's Proceedings Order (Proceedings_{job_id}.docx)."""
    case, meta = await _case_for(ocr_text, case), meta or {}
    s = build_slots(case, meta, config)
    text = await _draft(
        "Proceedings",
        "You are the Erode Collectorate drafting section. Follow the locked proceedings format exactly.",
        _drop_empty_copy_lines(fill(PROCEEDINGS_TEMPLATE, s)),
        fill(PROCEEDINGS_SLOTS, s),
        case,
        _ref_numbers(case)
    )
    target = OUTPUT_DIR / f"Proceedings_{job_id}.docx"
    await render_text_stream_to_docx(text, target, doc_type="PROCEEDINGS")
    return str(target)


async def process_memorandum(ocr_text: str, job_id: int, linked_old_ref: str = "", *, case: Optional[dict] = None, meta: Optional[dict] = None, config: Optional[dict] = None) -> str:
    """Worker 3: Drafts Collectorate Memorandum (Memorandum_{job_id}.docx)."""
    case, meta = await _case_for(ocr_text, case), meta or {}
    if linked_old_ref and not case.get("prior_proceedings"):
        case["prior_proceedings"] = {"nk_no": linked_old_ref, "date": None}
    s = build_slots(case, meta, config)
    lines = [r["text_ta"] for r in case.get("references") or [] if r.get("text_ta")]
    pp = case.get("prior_proceedings")
    if pp:
        lines.append(f"இவ்வலுவலக செயல்முறை ந.க.{pp.get('nk_no') or '______'}, நாள்: {pp.get('date') or '______'}.")
    lines += [r["text_ta"] for r in case.get("reminders") or [] if r.get("text_ta")]
    s["REFS_ALL"] = lines[0] if len(lines) == 1 else "\n".join(f"{i}. {t}" for i, t in enumerate(lines, 1)) if lines else "______"
    text = await _draft(
        "Memorandum",
        "Draft the Erode Collectorate Memorandum in the locked format. Zero hallucination.",
        _drop_empty_copy_lines(fill(MEMO_TEMPLATE, s)),
        fill(MEMO_SLOTS, s),
        case,
        _ref_numbers(case, include_own=True),
        need_words=False
    )
    target = OUTPUT_DIR / f"Memorandum_{job_id}.docx"
    await render_text_stream_to_docx(text, target, doc_type="MEMORANDUM")
    return str(target)


async def process_warrant(ocr_text: str, job_id: int, *args, case: Optional[dict] = None, meta: Optional[dict] = None, config: Optional[dict] = None) -> Optional[str]:
    """Worker 4: Drafts maintenance-arrears distraint warrant (Warrant_{job_id}.docx) for MAINTENANCE cases only."""
    case, meta = await _case_for(ocr_text, case), meta or {}
    if case.get("department_type") != "MAINTENANCE" or not case.get("maintenance"):
        return None
    s = build_slots(case, meta, config)
    s["COURT_TA"] = case.get("court_or_issuer_ta") or "குடும்ப நல நீதிமன்றம்"
    s["ARREST"] = (" அல்லது சட்டப்படி அவரைக் கைது செய்து நடவடிக்கை மேற்கொள்ளவும்"
                   if case.get("maintenance", {}).get("arrest_authorised_by_order") else "")
    text = await _draft(
        "Warrant",
        "Draft a maintenance-arrears distraint warrant in the locked format. Zero hallucination.",
        fill(WARRANT_TEMPLATE, s),
        fill(WARRANT_SLOTS, s),
        case,
        [case.get("case_file_no")]
    )
    target = OUTPUT_DIR / f"Warrant_{job_id}.docx"
    await render_text_stream_to_docx(text, target, doc_type="WARRANT")
    return str(target)


# ======================================================================================
# 5. DOCUMENT SERVICE OBJECT-ORIENTED INTERFACE
# ======================================================================================
class DocumentService:
    def __init__(self, templates_dir: Optional[Path] = None, output_dir: Optional[Path] = None):
        self.templates_dir = templates_dir or settings.TEMPLATE_DIR
        self.output_dir = output_dir or settings.OUTPUT_DIR
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def _ensure_case_dict(self, entities_or_case: Union[ExtractedLegalEntities, dict]) -> dict:
        if isinstance(entities_or_case, ExtractedLegalEntities):
            data = entities_or_case.model_dump()
            d_list = data.get("defaulter_details") or []
            first_d = d_list[0] if d_list else {}
            fin = data.get("financials") or {}
            ref = data.get("reference_details") or {}
            pay = data.get("payment_instructions") or {}

            dept = data.get("department_type")
            dept_str = dept.value if hasattr(dept, "value") else str(dept).split(".")[-1].upper()

            refs_list = [
                {"seq": i + 1, "kind": "DEPARTMENT_LETTER", "authority_ta": "", "ref_no": ref.get("case_or_file_no", ""), "date": ref.get("letter_date", ""), "text_ta": r}
                for i, r in enumerate(ref.get("references_list") or data.get("references") or [])
            ]

            return {
                "document_type": "DEPARTMENT_LETTER",
                "requisition_channel": "DIRECT_FROM_DEPARTMENT",
                "department_type": dept_str,
                "entity_type": "COMPANY" if data.get("entity_type") == EntityType.COMPANY else "INDIVIDUAL",
                "defaulter_name": first_d.get("name") or "எதிர்மனுதாரர்",
                "relation_text": first_d.get("father_or_spouse_name"),
                "iec_number": first_d.get("iec_number"),
                "door_no": first_d.get("door_no"),
                "street_and_locality": first_d.get("street_and_locality"),
                "village": first_d.get("village"),
                "taluk_name": data.get("taluk_name") or first_d.get("taluk") or "ஈரோடு",
                "district_name": data.get("district_name") or first_d.get("district") or "ஈரோடு",
                "pincode": first_d.get("pincode"),
                "jurisdiction": "ERODE",
                "principal_amount": float(fin.get("principal_amount") or 0.0),
                "penalty_amount": float(fin.get("penalty_amount") or 0.0),
                "interest_amount": float(fin.get("interest_amount") or 0.0),
                "other_charges_amount": 0.0,
                "total_recoverable_amount": float(fin.get("total_recoverable_amount") or 0.0),
                "amount_check": "OK",
                "statute_cited": ref.get("statutory_act_and_section"),
                "issuing_authority_name": ref.get("issuing_authority_name"),
                "case_file_no": ref.get("case_or_file_no"),
                "order_in_original_no": ref.get("ia_or_mp_no"),
                "order_date": ref.get("order_date"),
                "letter_date": ref.get("letter_date"),
                "dd_favour_of": pay.get("dd_favour_of"),
                "head_of_account": pay.get("head_of_account"),
                "dispatch_address": pay.get("dispatch_address"),
                "references": refs_list,
                "prior_proceedings": None,
                "reminders": [],
                "maintenance": None,
                "review_flags": []
            }
        return entities_or_case

    def prepare_context(self, entities_or_case: Union[ExtractedLegalEntities, dict]) -> Dict[str, Any]:
        case = self._ensure_case_dict(entities_or_case)
        s = build_slots(case)
        paras = case.get("synthesized_paragraphs") or {}
        raw_refs = [r["text_ta"] for r in case.get("references") or [] if r.get("text_ta")]
        formatted_refs = [f"{i}. {t}" for i, t in enumerate(raw_refs, 1)]
        ref_text = paras.get("reference_text") or ("\n".join(formatted_refs) if formatted_refs else s.get("REFS_BLOCK", "—"))
        dept_type = case.get("department_type", "GENERAL_RR")
        statute = case.get("statute_cited") or case.get("department_name_ta") or "நிலுவைத் தொகை"
        
        sureties_list = []
        if isinstance(entities_or_case, ExtractedLegalEntities):
            sureties_list = [s.model_dump() if hasattr(s, 'model_dump') else s for s in entities_or_case.sureties]
        elif isinstance(entities_or_case, dict) and "sureties" in entities_or_case:
            sureties_list = entities_or_case["sureties"]

        ctx = {
            **s,
            "department_type": dept_type,
            "entity_type": case.get("entity_type", "INDIVIDUAL"),
            "defaulter_name": s["DEFAULTER_NAME"],
            "living_verb": s["LIVES"],
            "defaulter_suffix": s["FROM_WHOM"],
            "asset_clause": "அசையும் மற்றும் அசையா சொத்துகளிலிருந்து",
            "total_amount": inr(case.get("total_recoverable_amount") or 0),
            "amount_in_tamil_words": s["AMOUNT_WORDS"],
            "references": raw_refs,
            "reference_text": ref_text,
            "taluk_name": s["TALUK"],
            "district_name": case.get("district_name", "ஈரோடு"),
            "collector_name": s.get("COLLECTOR", COLLECTOR_LINE),
            "issuing_authority_name": case.get("issuing_authority_name"),
            "issuing_officer_role": case.get("issuing_officer_role") ,
            "collectorate_office_name": case.get("collectorate_office_name"),
            "signatory_role": case.get("signatory_role") ,
            "enforcing_officer_role": case.get("enforcing_officer_role"),
            "collector_heading": "ஈரோடு மாவட்ட ஆட்சித் தலைவர் மற்றும் மாவட்ட நிர்வாக நடுவர் அவர்களின் செயல்முறைகள்",
            "subject_text": paras.get("subject_text") or f"பொருள்: வருவாய் வசூல் சட்டம் 1864 – {statute} – ஈரோடு மாவட்டம் – {s['TALUK']} வட்டம் – {s['DEFAULTER_FULL']} – நிலுவைத் தொகை {s['AMOUNT_FIG']}",
            "order_para1": paras.get("order_para1") or f"ஈரோடு மாவட்டம், {s['TALUK']} வட்டம், {s['DEFAULTER_NAME']} என்பவரிடமிருந்து நிலுவைத் தொகை {s['AMOUNT_FIG']} ஐ வருவாய் வசூல் சட்டத்தின் கீழ் வசூலிக்குமாறு பார்வையில் காணும் கடிதத்தில் தெரிவிக்கப்பட்டுள்ளது.",
            "order_para2": paras.get("order_para2") or f"மேற்படி தொகையினை வருவாய் நிலை ஆணை எண் 41 மற்றும் வருவாய் வசூல் சட்டம் 1864 பிரிவு 5-ன் கீழ் வசூல் செய்ய {s['TALUK']} வருவாய் வட்டாட்சியருக்கு அதிகாரம் வழங்கி இதன் மூலம் உத்திரவிடப்படுகிறது.",
            "order_para3": paras.get("order_para3") or f"எனவே, எதிர்தரப்பினரின் அசையும் மற்றும் அசையா சொத்துகளிலிருந்து மேற்படி தொகையினை உடனடியாக வசூல் செய்து “{s.get('PAYEE', '')}“ என்ற பெயரில் வங்கி வரைவோலையாக எடுத்து {s.get('DISPATCH', '')} என்ற அலுவலகத்திற்கு அனுப்பி வைக்குமாறு {s['TALUK']} வருவாய் வட்டாட்சியருக்கு தெரிவிக்கப்படுகிறது.",
            "tahsildar_recipient": f"பெறுநர்: வருவாய் வட்டாட்சியர், {s['TALUK']}.",
            "sureties": sureties_list,
        }
        return ctx

    def generate_proceedings_docx(self, entities_or_case: Union[ExtractedLegalEntities, dict], custom_filename: Optional[str] = None, meta: Optional[dict] = None) -> Path:
        case = self._ensure_case_dict(entities_or_case)
        s = build_slots(case, meta)
        text = asyncio.run(_draft(
            "Proceedings",
            "You are the Erode Collectorate drafting section. Follow the locked proceedings format exactly.",
            _drop_empty_copy_lines(fill(PROCEEDINGS_TEMPLATE, s)),
            fill(PROCEEDINGS_SLOTS, s),
            case,
            _ref_numbers(case)
        ))

        clean_fno = re.sub(r'[^A-Za-z0-9_\-\.]', '_', str(case.get('case_file_no') or 'case'))
        filename = custom_filename or f"Proceedings_{case.get('department_type')}_{clean_fno}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.docx"
        target_path = self.output_dir / filename
        asyncio.run(render_text_stream_to_docx(text, target_path, doc_type="PROCEEDINGS"))
        return target_path

    def generate_note_docx(self, entities_or_case: Union[ExtractedLegalEntities, dict], custom_filename: Optional[str] = None, meta: Optional[dict] = None) -> Path:
        case = self._ensure_case_dict(entities_or_case)
        s = build_slots(case, meta)
        text = asyncio.run(_draft(
            "Office Note",
            "Draft the Erode Collectorate Office Note exactly in the locked format. Zero hallucination.",
            fill(OFFICE_NOTE_TEMPLATE, s),
            fill(OFFICE_NOTE_SLOTS, s),
            case,
            _ref_numbers(case, include_own=True)
        ))

        clean_fno = re.sub(r'[^A-Za-z0-9_\-\.]', '_', str(case.get('case_file_no') or 'case'))
        filename = custom_filename or f"Note_{case.get('department_type')}_{clean_fno}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.docx"
        target_path = self.output_dir / filename
        asyncio.run(render_text_stream_to_docx(text, target_path, doc_type="NOTE"))
        return target_path

    def generate_memorandum_docx(self, entities_or_case: Union[ExtractedLegalEntities, dict], custom_filename: Optional[str] = None, meta: Optional[dict] = None, linked_old_ref: str = "") -> Path:
        case = self._ensure_case_dict(entities_or_case)
        if linked_old_ref and not case.get("prior_proceedings"):
            case["prior_proceedings"] = {"nk_no": linked_old_ref, "date": None}
        s = build_slots(case, meta)
        lines = [r["text_ta"] for r in case.get("references") or [] if r.get("text_ta")]
        pp = case.get("prior_proceedings")
        if pp:
            lines.append(f"இவ்வலுவலக செயல்முறை ந.க.{pp.get('nk_no') or '______'}, நாள்: {pp.get('date') or '______'}.")
        lines += [r["text_ta"] for r in case.get("reminders") or [] if r.get("text_ta")]
        s["REFS_ALL"] = lines[0] if len(lines) == 1 else "\n".join(f"{i}. {t}" for i, t in enumerate(lines, 1)) if lines else "______"
        text = asyncio.run(_draft(
            "Memorandum",
            "Draft the Erode Collectorate Memorandum in the locked format. Zero hallucination.",
            _drop_empty_copy_lines(fill(MEMO_TEMPLATE, s)),
            fill(MEMO_SLOTS, s),
            case,
            _ref_numbers(case, include_own=True),
            need_words=False
        ))

        clean_fno = re.sub(r'[^A-Za-z0-9_\-\.]', '_', str(case.get('case_file_no') or 'case'))
        filename = custom_filename or f"Memorandum_{case.get('department_type')}_{clean_fno}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.docx"
        target_path = self.output_dir / filename
        asyncio.run(render_text_stream_to_docx(text, target_path, doc_type="MEMORANDUM"))
        return target_path

    def generate_warrant_docx(self, entities_or_case: Union[ExtractedLegalEntities, dict], custom_filename: Optional[str] = None, meta: Optional[dict] = None) -> Path:
        case = self._ensure_case_dict(entities_or_case)
        s = build_slots(case, meta)
        s["COURT_TA"] = case.get("court_or_issuer_ta") or "குடும்ப நல நீதிமன்றம்"
        s["ARREST"] = (" அல்லது சட்டப்படி அவரைக் கைது செய்து நடவடிக்கை மேற்கொள்ளவும்"
                       if case.get("maintenance", {}).get("arrest_authorised_by_order") else "")
        text = asyncio.run(_draft(
            "Warrant",
            "Draft a maintenance-arrears distraint warrant in the locked format. Zero hallucination.",
            fill(WARRANT_TEMPLATE, s),
            fill(WARRANT_SLOTS, s),
            case,
            [case.get("case_file_no")]
        ))

        clean_fno = re.sub(r'[^A-Za-z0-9_\-\.]', '_', str(case.get('case_file_no') or 'case'))
        filename = custom_filename or f"Warrant_{case.get('department_type')}_{clean_fno}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.docx"
        target_path = self.output_dir / filename
        asyncio.run(render_text_stream_to_docx(text, target_path, doc_type="WARRANT"))
        return target_path

    def generate_three_files(self, entities_or_case: Union[ExtractedLegalEntities, dict], meta: Optional[dict] = None) -> Dict[str, Path]:
        return {
            "proceedings": self.generate_proceedings_docx(entities_or_case, meta=meta),
            "memorandum": self.generate_memorandum_docx(entities_or_case, meta=meta),
            "note": self.generate_note_docx(entities_or_case, meta=meta),
        }

    def generate_all_four_files(self, entities_or_case: Union[ExtractedLegalEntities, dict], meta: Optional[dict] = None) -> Dict[str, Path]:
        return {
            "proceedings": self.generate_proceedings_docx(entities_or_case, meta=meta),
            "memorandum": self.generate_memorandum_docx(entities_or_case, meta=meta),
            "note": self.generate_note_docx(entities_or_case, meta=meta),
            "warrant": self.generate_warrant_docx(entities_or_case, meta=meta),
        }
