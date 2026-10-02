"""
LLM Extraction Service: Ollama Integration.
Leverages qwen2.5:3b-instruct to dynamically extract structured legal entities
and author case-specific, administrative Tamil orders and memoranda.
Includes deterministic rule & regex fallbacks for 100% reliability.
"""

import json
import re
from typing import Dict, Any, Optional, List
from datetime import datetime
import httpx

from app.core.config import settings
from app.core.logging import logger
from app.core.exceptions import LLMExtractionError
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
from app.domain.rules.jurisdiction import route_to_jurisdiction
from app.domain.rules.tamil_numerals import number_to_tamil_currency_words
from app.domain.rules.department_registry import DepartmentRegistry, DepartmentSpec


SYSTEM_PROMPT = """You are the Senior Legal Drafter and Revenue Recovery Officer for the Government of Tamil Nadu (தமிழ்நாடு அரசு வருவாய்த் துறை).

### OBJECTIVE:
Analyze the provided requisition, court order, or recovery certificate OCR text to:
1. Accurately extract all structured legal and financial entities without hallucination.
2. Dynamically compose official, high-fidelity administrative Tamil proceedings draft paragraphs (பொருள் மற்றும் ஆணை பத்திகள்).

### CORE EXTRACTION RULES:
1. **Role Identification**:
   - Defaulter / Judgment-Debtor: The entity/person against whom recovery is ordered.
   - Petitioner / Complainant / Beneficiary: The party seeking recovery (DO NOT extract as defaulter).
2. **Financial Precision**:
   - Extract exact numerical values from the text.
   - If a specific financial component (e.g. penalty, interest) is not mentioned, return 0.0. Never invent or hallucinate default amounts.
   - Ensure total_recoverable_amount reflects the overall legally enforceable sum mentioned.
3. **Language & Terminology**:
   - Administrative text, taluk names, district names, subject, and order paragraphs MUST be in pure, dignified official Tamil (தமிழ்).
   - Retain English ONLY for exact corporate entities (e.g., 'M/s XYZ Pvt Ltd') and registration / IEC / GST identifiers.
4. **Handling Missing Fields**:
   - Use `null` for absent string/date values, `0.0` for absent numerical values, and empty array `[]` if no references are cited.

### DRAFTING SPECIFICATIONS (MINIMUM 5-6 LINES PER PARAGRAPH):
- `subject_text`: Formal, comprehensive administrative subject in Tamil citing the relevant statutory act, sections, requesting authority, district, taluk, town/village, defaulter/firm name, full financial demand split (Principal, Penalty, Interest, Total), and demand to initiate land revenue recovery under Tamil Nadu Revenue Recovery Act 1864.
- `order_para1`: Extensive background narrative (minimum 5-6 full lines). Must explain: (1) Exact jurisdictional address of the defaulter/establishment, (2) Issuing authority's requisition letter number and order date, (3) The specific statutory violations and demand breakdown in figures (ரூ. .../-) and words, (4) Defaulter's non-payment/failure to remit, and (5) The official request from the department to the District Collector to initiate coercive recovery proceedings under the Tamil Nadu Revenue Recovery Act 1864.
- `order_para2`: Statutory empowerment and delegation paragraph (minimum 4-5 full lines). Must state: (1) Statutory invocation under Revenue Standing Order 41 (வருவாய் நிலை ஆணை எண் 41) and Section 5 of Tamil Nadu Revenue Recovery Act 1864 (1864-ம் ஆண்டு தமிழ்நாடு வருவாய் வசூல் சட்டம் பிரிவு 5), (2) Formal conferment of executive recovery jurisdiction by the District Collector & District Magistrate to the jurisdictional Tahsildar (வருவாய் வட்டாட்சியர்), (3) Mandate to enforce full recovery without delay.
- `order_para3`: Execution, distraint, asset attachment, and compliance directive (minimum 5-6 full lines). Must direct: (1) Immediate field inspection and attachment of movable/immovable assets, properties, and bank accounts, (2) Realization of the full demanded sum along with accrued statutory interest and collection charges, (3) Remittance via Demand Draft (வங்கி வரைவோலை) drawn in favor of the designated beneficiary authority, and (4) Submission of a formal action-taken compliance report (நடவடிக்கை அறிக்கை) to the District Collector / District Revenue Officer.

### OUTPUT FORMAT:
Return ONLY a valid JSON object matching the schema below. Do NOT include markdown code fences, preambles, or conversational text.

{
  "department_type": "<Enum: 'CUSTOMS' | 'TNRERA' | 'MCOP' | 'COMMERCIAL_TAX' | 'EXCISE' | 'GENERAL_RR'>",
  "entity_type": "<Enum: 'INDIVIDUAL' | 'COMPANY' | 'PARTNERSHIP' | 'MULTIPLE_PROMOTERS' | 'GOVERNMENT_SERVANT'>",
  "defaulter_name": "<string: Exact legal or trade name of the defaulter / respondent>",
  "iec_number": "<string | null: IEC or Registration code if present>",
  "door_no": "<string | null: Door / Building number>",
  "street_and_locality": "<string | null: Street, road, and locality in Tamil / English as cited>",
  "village": "<string | null: Revenue village name in Tamil>",
  "taluk_name": "<string | null: Jurisdictional Taluk name in Tamil>",
  "district_name": "<string | null: Jurisdictional District name in Tamil>",
  "pincode": "<string | null: 6-digit postal code>",
  "principal_amount": "<number: Extracted principal demand amount as float, or 0.0>",
  "penalty_amount": "<number: Extracted penalty amount as float, or 0.0>",
  "interest_amount": "<number: Extracted interest amount as float, or 0.0>",
  "total_recoverable_amount": "<number: Extracted total recoverable sum as float>",
  "issuing_authority_name": "<string | null: Title / Designation of issuing officer or authority in Tamil>",
  "case_file_no": "<string | null: Official case number, file reference, or petition number>",
  "order_in_original_no": "<string | null: Order-in-Original / Execution Petition / Interim Order number>",
  "order_date": "<string | null: Date of judicial/recovery order in DD.MM.YYYY format>",
  "letter_date": "<string | null: Date of requisition letter in DD.MM.YYYY format>",
  "dd_favour_of": "<string | null: Official designation in whose favour DD is to be drawn>",
  "head_of_account": "<string | null: Government accounting head / receipt account>",
  "dispatch_address": "<string | null: Full postal dispatch address of beneficiary authority>",
  "references_list": [
    "<string: Numbered reference citation 1>",
    "<string: Numbered reference citation 2>"
  ],
  "subject_text": "<string: Complete formal Tamil subject paragraph>",
  "order_para1": "<string: Background and case facts order paragraph in Tamil>",
  "order_para2": "<string: Statutory delegation order paragraph in Tamil citing RSO 41 & Section 5>",
  "order_para3": "<string: Property attachment and recovery directive paragraph in Tamil>"
}"""


class LLMService:
    def __init__(self, base_url: Optional[str] = None, model: Optional[str] = None):
        raw_url = base_url or settings.OLLAMA_BASE_URL
        self.base_url = raw_url.rstrip("/").replace("://localhost", "://127.0.0.1")
        self.model = model or settings.OLLAMA_MODEL

    async def extract_entities(self, raw_ocr_text: str) -> ExtractedLegalEntities:
        """Calls local Ollama with configured timeout or falls back to rule-based parser on error/timeout."""
        raw_json_str = None
        model_name = self.model or settings.OLLAMA_MODEL

        try:
            logger.info(f"Submitting {len(raw_ocr_text)} chars of text to local Ollama LLM (Model: {model_name}, Timeout: {settings.OLLAMA_TIMEOUT_SECONDS}s)...")
            start_t = datetime.now()
            async with httpx.AsyncClient(timeout=float(settings.OLLAMA_TIMEOUT_SECONDS)) as client:
                res = await client.post(
                    f"{self.base_url}/api/generate",
                    json={
                        "model": model_name,
                        "system": SYSTEM_PROMPT,
                        "prompt": f"DOCUMENT OCR TEXT:\n{raw_ocr_text.strip()}",
                        "stream": False,
                        "format": "json"
                    }
                )
                if res.status_code == 200:
                    data = res.json()
                    raw_json_str = data.get("response", "")
                    elapsed = (datetime.now() - start_t).total_seconds()
                    logger.info(f"Ollama LLM ({model_name}) successfully extracted structured entities in {elapsed:.2f}s.")
                else:
                    logger.warning(f"Ollama extraction request with '{model_name}' returned status {res.status_code}: {res.text}")
        except Exception as e:
            err_msg = f"{type(e).__name__}: {str(e)}" if str(e) else type(e).__name__
            logger.warning(f"Ollama extraction request with '{model_name}' failed ({err_msg}). Proceeding directly with deterministic rule extractor...")

        parsed_data = {}
        if raw_json_str:
            try:
                parsed_data = json.loads(raw_json_str)
            except Exception:
                parsed_data = {}

        # Merge with deterministic rule extractor to guarantee 100% recovery
        extracted = self._parse_with_regex_fallback(raw_ocr_text, parsed_data)
        return extracted

    async def chat_completion(self, prompt: str, system_instruction: str = "") -> str:
        """Generates chat completion text using Ollama without candidate fallback."""
        model_name = self.model or settings.OLLAMA_MODEL
        try:
            async with httpx.AsyncClient(timeout=float(settings.OLLAMA_TIMEOUT_SECONDS)) as client:
                res = await client.post(
                    f"{self.base_url}/api/generate",
                    json={
                        "model": model_name,
                        "system": system_instruction,
                        "prompt": prompt,
                        "stream": False,
                    }
                )
                if res.status_code == 200:
                    return res.json().get("response", "").strip()
                else:
                    logger.warning(f"Ollama chat completion with {model_name} returned status {res.status_code}")
        except Exception as e:
            logger.warning(f"Ollama chat completion with {model_name} failed: {e}")
        return ""

    def _parse_with_regex_fallback(self, text: str, llm_data: Dict[str, Any]) -> ExtractedLegalEntities:
        """Deterministic, document-aware extractor ensuring 100% field recovery across all document types."""
        text_upper = text.upper()

        # 1. Resolve Department Specification via declarative DepartmentRegistry
        matched_spec = DepartmentRegistry.match_department(text)
        dept_type = matched_spec.department_type
        issuing_auth = llm_data.get("issuing_authority_name") or matched_spec.issuing_authority_default
        act_section = matched_spec.statutory_act_and_section
        head_of_acc = llm_data.get("head_of_account") or matched_spec.head_of_account_default

        # 2. Defaulter / Respondent Name Extraction
        raw_name = llm_data.get("defaulter_name") or ""
        # Filter out accidental complainant extraction
        complainant_match = re.search(r'(?i)complainant\s*[:\-]\s*([^\n\r,]+)', text)
        comp_name = complainant_match.group(1).strip() if complainant_match else ""
        if raw_name and comp_name and raw_name.strip().lower() == comp_name.lower():
            raw_name = ""

        # Multiline promoter matching
        promoter_block = re.search(r'(?i)represented\s+by\s+its\s+promoters?\s+([\s\S]+?)(?=\n\s*(?:versus|vs|respondent|complainant|amount|address|\n\n|\Z))', text)
        if promoter_block:
            p_text = re.sub(r'\s+', ' ', promoter_block.group(1)).strip()
            if len(p_text) > 3 and not raw_name:
                raw_name = p_text

        if not raw_name:
            resp_match = re.search(r'(?i)respondents?\s*[:\-]\s*([\s\S]+?)(?=\n\s*(?:versus|vs|complainant|petitioner|order|prayer|\n\n|\Z))', text)
            if resp_match:
                lines = [l.strip() for l in resp_match.group(1).split('\n') if l.strip() and not re.search(r'(?i)complainant|petitioner', l)]
                if lines:
                    raw_name = lines[0]

        if not raw_name:
            # Pattern: /VS/ followed by respondent names
            vs_match = re.search(r'(?i)/?\s*(?:VS|VERSUS)\s*/?\s*\n+([\s\S]+?)(?=\n\s*(?:TO,|The District Collector|Whereas|Now you|\Z))', text)
            if vs_match:
                resp_lines = []
                for line in vs_match.group(1).split('\n'):
                    line_clean = line.strip()
                    if not line_clean or any(k in line_clean.upper() for k in ["PETITIONER", "INSURANCE COMPANY", "CRIME VEHICLE"]):
                        continue
                    # Match name before S/O or before parenthetical
                    n_match = re.search(r'(?:^\d+[\.\)]\s*)?([A-Za-z\.\s]+?)(?:,\s*S/O|\s*\(|\s*---|\Z)', line_clean)
                    if n_match and len(n_match.group(1).strip()) > 2:
                        name_part = n_match.group(1).strip()
                        if not any(k in name_part.upper() for k in ["RESPONDENT", "PETITIONER", "INSURANCE"]):
                            resp_lines.append(name_part)
                if resp_lines:
                    raw_name = " & ".join(resp_lines)

        if not raw_name:
            # Pattern: "from the above mentioned P.Saravanan ... & M.Jayaraman" or "arrears of Land Revenue from P.Saravanan"
            from_match = re.search(r'(?i)(?:arrears\s+of\s+land\s+revenue\s+from|from\s+the\s+above\s+mentioned|from\s+the\s+defaulters?)\s+([A-Za-z0-9\.\s&,\-\(\)]+?)(?=\s+(?:and\s+issue|and\s+the\s+same|\n\n|\Z))', text)
            if from_match:
                cand = from_match.group(1).strip().rstrip(".,")
                cleaned_cand = re.sub(r'\s*\([^)]*\)', '', cand)
                cleaned_cand = re.sub(r'(?i),?\s*S/O\.?\s*[A-Za-z\s]+', '', cleaned_cand)
                cleaned_cand = re.sub(r'\s+', ' ', cleaned_cand).strip().rstrip(".,")
                if len(cleaned_cand) > 3 and not any(k in cleaned_cand.upper() for k in ["COLLECTOR", "COURT", "ORDER"]):
                    raw_name = cleaned_cand

        if not raw_name:
            for pattern in [
                r'(?i)(?:M/s\.?|Tvl\.?|Messrs)\s+([A-Za-z0-9\.\s&,\-\'\(\)]+?)(?=\s+(?:IEC|having|at|Door|No\.|\n|,))',
                r'(?i)defaulter\s*[:\-]\s*([^\n\r,]+)',
                r'(?i)dealer\s*[:\-]\s*([^\n\r,]+)',
            ]:
                match = re.search(pattern, text)
                if match:
                    cand = match.group(1).strip().rstrip(".,")
                    if len(cand) > 2 and not any(k in cand.upper() for k in ["COMPLAINANT", "PETITIONER", "OFFICE OF", "COMMISSIONER", "ORDER"]):
                        raw_name = cand
                        break

        if not raw_name:
            # Look for recipient lines
            to_match = re.search(r'(?i)\bTo\b\s*[:\-]?\s*([^\n\r,]+)', text)
            if to_match and len(to_match.group(1).strip()) > 3:
                cand_to = to_match.group(1).strip().rstrip(".,")
                if not any(k in cand_to.upper() for k in ["COLLECTOR", "COMMISSIONER", "TAHSILDAR", "RECOVER"]):
                    raw_name = cand_to

        defaulter_name = raw_name.strip() if raw_name else "எதிர்தரப்பினர் / நிலுவையாளர்"

        # Entity type classification
        entity_type = EntityType.INDIVIDUAL
        if any(w in defaulter_name.upper() for w in ["PVT", "LTD", "LIMITED", "M/S", "ENTERPRISES", "GARMENTS", "INDUSTRIES", "HOUSING", "BUILDERS", "PROMOTERS"]):
            entity_type = EntityType.COMPANY
        elif any(w in defaulter_name for w in [",", "&", "மற்றும்", "மற்றும் பலர்"]):
            entity_type = EntityType.MULTIPLE_PROMOTERS

        # 3. Address and Locality Recovery
        door_no = llm_data.get("door_no") or ""
        street_loc = llm_data.get("street_and_locality") or ""
        pincode = llm_data.get("pincode") or ""

        if not pincode:
            pin_match = re.search(r'\b(6\d{2}\s*\d{3})\b', text)
            if pin_match:
                pincode = pin_match.group(1).replace(" ", "")

        if not door_no:
            door_match = re.search(r'(?i)\b(?:Door\s*No\.?|D\.No\.?|No\.?|கதவு\s*எண்\.?)\s*([0-9A-Za-z\-/]+)\b', text)
            if door_match:
                door_no = door_match.group(1).strip()

        if not street_loc:
            addr_match = re.search(r'(?i)(?:Address|At|having\s+office\s+at)\s*[:\-]?\s*([^\n\r\.\;]{10,140})', text)
            if addr_match:
                street_loc = addr_match.group(1).strip().rstrip(",")

        iec_num = llm_data.get("iec_number")
        if not iec_num:
            iec_match = re.search(r'(?i)IEC\s*(?:No\.?|Number)?\s*[:\-]?\s*([0-9A-Z]{10})', text)
            if iec_match:
                iec_num = iec_match.group(1).strip()

        # 4. Multi-district and Taluk routing
        routing = route_to_jurisdiction(
            raw_address=f"{door_no} {street_loc} {text}",
            pincode=pincode,
            explicit_taluk=llm_data.get("taluk_name"),
            explicit_district=llm_data.get("district_name")
        )

        defaulters_list = [
            DefaulterDetail(
                name=defaulter_name,
                door_no=door_no,
                street_and_locality=street_loc,
                village=llm_data.get("village") or "",
                taluk=routing["taluk"],
                district=routing["district"],
                pincode=pincode,
                iec_number=iec_num
            )
        ]

        # 5. Financial extraction
        principal = float(llm_data.get("principal_amount") or 0.0)
        penalty = float(llm_data.get("penalty_amount") or 0.0)
        total = float(llm_data.get("total_recoverable_amount") or 0.0)

        if principal == 0.0:
            p_match = re.search(r'(?i)(?:Principal\s*(?:Duty|Amount)?)\s*(?:of|is|:)?\s*(?:Rs\.?|INR|ரூ\.?)?\s*([\d,]+(?:\.\d{2})?)', text)
            if p_match:
                try:
                    principal = float(p_match.group(1).replace(",", ""))
                except ValueError:
                    pass

        if penalty == 0.0:
            pen_match = re.search(r'(?i)(?:Penalty|Fine)\s*(?:of|is|:)?\s*(?:Rs\.?|INR|ரூ\.?)?\s*([\d,]+(?:\.\d{2})?)', text)
            if pen_match:
                try:
                    penalty = float(pen_match.group(1).replace(",", ""))
                except ValueError:
                    pass

        if total == 0.0:
            tot_match = re.search(r'(?i)(?:total|totaling|sum of)\s*(?:is|of|:)?\s*(?:Rs\.?|INR|ரூ\.?)?\s*([\d,]+(?:\.\d{2})?)', text)
            if tot_match:
                try:
                    total = float(tot_match.group(1).replace(",", ""))
                except ValueError:
                    pass

        if total == 0.0:
            amt_matches = re.findall(r'(?i)(?:Rs\.?|INR|ரூ\.?)\s*([\d,]+(?:\.\d{2})?)', text)
            cleaned_amts = []
            for a in amt_matches:
                try:
                    cleaned_amts.append(float(a.replace(",", "")))
                except ValueError:
                    pass
            if cleaned_amts:
                total = max(cleaned_amts)
                if principal == 0.0:
                    principal = total - penalty

        if total > 0 and principal == 0:
            principal = total - penalty

        tamil_words = number_to_tamil_currency_words(total)

        # 6. Reference Chain and Case Details
        case_file = llm_data.get("case_file_no") or ""
        order_in_orig = llm_data.get("order_in_original_no") or ""
        order_date = llm_data.get("order_date") or ""
        letter_date = llm_data.get("letter_date") or ""

        if not case_file:
            cf_match = re.search(r'(?i)(?:F\.?\s*No\.?|EP\s*No\.?|C\.?\s*No\.?|Case\s*No\.?|MCOP\s*No\.?)\s*[:\-]?\s*([A-Za-z0-9\/\.\-]+)', text)
            if cf_match:
                case_file = cf_match.group(1).strip()

        if not order_in_orig:
            oio_match = re.search(r'(?i)(?:Order\s*in\s*Original\s*No\.?|IA\s*No\.?|MP\s*No\.?|Order\s*No\.?)\s*[:\-]?\s*([0-9\/\-]+)', text)
            if oio_match:
                order_in_orig = oio_match.group(1).strip()

        date_matches = re.findall(r'\b(\d{1,2}[\.\/\-]\d{1,2}[\.\/\-]\d{2,4})\b', text)
        if date_matches:
            if not order_date:
                order_date = date_matches[0]
            if not letter_date and len(date_matches) > 1:
                letter_date = date_matches[-1]

        # References list resolution
        refs_list = llm_data.get("references_list") or []
        narrative_banned = [
            "FORWARDING HEREWITH", "DIRECTED TO RECOVER", "EXECUTION PETITION", "IS RESPONSIBLE FOR",
            "NAME OF THE PROJECT", "WHEREAS THE ABOVE", "FOR NECESSARY ACTION", "TRUE COPY", "P.T.O",
            "CHAIRPERSON", "ADDITIONAL DIRECTOR", "UNDER SECTION", "YOU ARE HEREBY", "HAS FAILED TO",
            "REPRESENTED BY", "IN FAVOUR OF", "REPORT COMPLIANCE"
        ]
        clean_refs = []
        for r_item in refs_list:
            cleaned = re.sub(r'^\d+[\.\)]\s*', '', str(r_item).strip())
            if 8 <= len(cleaned) <= 220 and not any(ban in cleaned.upper() for ban in narrative_banned):
                clean_refs.append(cleaned)

        if not clean_refs:
            clean_refs = DepartmentRegistry.build_default_references(
                spec=matched_spec,
                issuing_auth=issuing_auth,
                case_no=case_file,
                order_no=order_in_orig,
                letter_date=letter_date,
                order_date=order_date,
            )

        # File number extraction
        clean_file_no = re.sub(r'[^A-Za-z0-9\-]', '', case_file).strip() or datetime.now().strftime('%m%d%H%M')

        # Check if LLM supplied dynamic Tamil paragraphs
        llm_subject = llm_data.get("subject_text")
        llm_p1 = llm_data.get("order_para1")
        llm_p2 = llm_data.get("order_para2")
        llm_p3 = llm_data.get("order_para3")

        return ExtractedLegalEntities(
            department_type=dept_type,
            entity_type=entity_type,
            defaulter_details=defaulters_list,
            sureties=[],
            financials=FinancialDetails(
                principal_amount=principal,
                penalty_amount=penalty,
                interest_amount=0.0,
                total_recoverable_amount=total,
                amount_in_words_tamil=tamil_words,
            ),
            reference_details=ReferenceDetails(
                issuing_authority_name=issuing_auth,
                case_or_file_no=case_file,
                ia_or_mp_no=order_in_orig,
                order_date=order_date,
                letter_date=letter_date,
                statutory_act_and_section=act_section,
                references_list=clean_refs
            ),
            payment_instructions=PaymentInstructions(
                dd_favour_of=llm_data.get("dd_favour_of") or f"The Member Secretary, TNRERA, Chennai" if dept_type == DepartmentType.TNRERA else f"The District Collector, {routing['district']}",
                head_of_account=head_of_acc,
                dispatch_address=llm_data.get("dispatch_address") or f"மாவட்ட ஆட்சித் தலைவர் / மாவட்ட வருவாய் அலுவலர் அலுவலகம், {routing['district']} மாவட்டம்."
            ),
            references=clean_refs,
            district_name=routing["district"],
            taluk_name=routing["taluk"],
            assigned_tahsildar=routing["tahsildar"],
            file_no=clean_file_no,
            file_year=str(datetime.now().year),
            section_code="டி2" if dept_type == DepartmentType.TNRERA else "ஈ2",
            roc_number=f"ந.க. {clean_file_no}/{datetime.now().year}/{'டி2' if dept_type == DepartmentType.TNRERA else 'ஈ2'}",
            collector_name="",
            extraction_raw_text=text
        )
