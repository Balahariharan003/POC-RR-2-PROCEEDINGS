"""
Extraction Gate: Fail-Closed Validation Firewall.
==================================================
Every extraction MUST pass through run_gate() before ANY document renderer
is invoked. If the gate rejects, the case goes to NEEDS_REVIEW status with
full evidence — never to a rendered official document.

Design principle: "I don't know" is the only safe default. If we can't
verify it, we don't render it.
"""

import re
from enum import Enum
from typing import List, Optional, Dict, Any
from dataclasses import dataclass, field
from datetime import datetime


class GateError(str, Enum):
    """Every reason a case can be blocked from rendering."""
    TOTAL_MISSING = "TOTAL_MISSING"                       # total <= 0
    NEGATIVE_AMOUNT = "NEGATIVE_AMOUNT"                   # refund/reversal class
    NO_NAMED_DEFAULTER = "NO_NAMED_DEFAULTER"             # all names null / placeholder
    AMOUNT_SUM_MISMATCH = "AMOUNT_SUM_MISMATCH"           # |sum(heads) - total| > 1.00
    ANCHOR_NOT_IN_SOURCE = "ANCHOR_NOT_IN_SOURCE"         # amount/case-no not in OCR text
    OCR_PLACEHOLDER_PAGE = "OCR_PLACEHOLDER_PAGE"         # fallback_local placeholder detected
    LLM_FALLBACK_USED = "LLM_FALLBACK_USED"               # LLM parse failed, fallback dict used
    STATUTE_MISSING = "STATUTE_MISSING"                   # no statute_cited
    JURISDICTION_UNRESOLVED = "JURISDICTION_UNRESOLVED"    # taluk not in known list
    TALUK_MISSING = "TALUK_MISSING"                       # no taluk_name at all
    CASE_FILE_NO_MISSING = "CASE_FILE_NO_MISSING"         # no case/file number extracted


# Known placeholder strings that indicate extraction failure
_PLACEHOLDER_NAMES = {
    "எதிர்மனுதாரர்",       # generic "respondent"
    "defaulter",
    "respondent",
    "",
}

# OCR fallback placeholder text pattern
_OCR_PLACEHOLDER_PATTERN = re.compile(
    r"REQUISITION\s*/?\s*ORDER\s+DOCUMENT\s*\(PAGE\s*\d+\)",
    re.IGNORECASE
)

# Known Erode district taluks (canonical set and English transliterations)
ERODE_TALUKS = {
    "ஈரோடு", "மொடக்குறிச்சி", "கொடுமுடி", "பெருந்துறை", "பவானி",
    "அந்தியூர்", "கோபிச்செட்டிபாளையம்", "நம்பியூர்", "சத்தியமங்கலம்", "தாளவாடி",
    # Common aliases and Latin transliterations
    "கோபி", "கோபிசெட்டிபாளையம்",
    "erode", "perundurai", "bhavani", "gobichettipalayam", "gobi", "gobichettypalayam",
    "sathyamangalam", "sathy", "modakkurichi", "kodumudi", "anthiyur",
    "nambiyur", "thalavadi", "talavadi"
}


@dataclass
class GateResult:
    """Result of the extraction gate check."""
    ok: bool
    errors: List[GateError] = field(default_factory=list)
    error_details: Dict[str, str] = field(default_factory=dict)
    checked_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())

    @property
    def status(self) -> str:
        return "PASSED" if self.ok else "NEEDS_REVIEW"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "ok": self.ok,
            "status": self.status,
            "errors": [e.value for e in self.errors],
            "error_details": self.error_details,
            "checked_at": self.checked_at,
        }


def _normalize_amount_string(s: str) -> str:
    """Strip currency symbols, grouping commas, and trailing /- for comparison."""
    s = s.strip()
    s = re.sub(r"[ரூRsRSINR\.]+\s*", "", s)
    s = s.replace(",", "").replace("/-", "").replace("/", "").strip()
    return s


def _extract_amounts_from_text(text: str) -> List[str]:
    """Find all amount-like strings in OCR text for anchor verification."""
    patterns = [
        r"(?:ரூ|Rs|RS|INR)\.?\s*([\d,]+(?:\.\d{1,2})?)\s*/?-?",
        r"([\d,]+(?:\.\d{1,2})?)\s*/?-",
    ]
    found = set()
    for pat in patterns:
        for m in re.finditer(pat, text):
            normalized = _normalize_amount_string(m.group(1))
            if normalized and len(normalized) >= 2:  # at least 2 digits
                found.add(normalized)
    return list(found)


def run_gate(
    case: Dict[str, Any],
    ocr_text: str,
    ocr_pages: Optional[List[Dict[str, Any]]] = None,
) -> GateResult:
    """
    Fail-closed extraction gate. Returns GateResult with ok=False if any
    check fails. The case MUST NOT proceed to rendering if ok=False.

    Args:
        case: The verified CASE JSON from LLM analysis + postprocess.
        ocr_text: The full joined OCR text.
        ocr_pages: Optional list of per-page OCR results with 'mode' and 'text' keys.
    """
    errors: List[GateError] = []
    details: Dict[str, str] = {}

    # --- 1. Check for LLM fallback usage ---
    review_flags = case.get("review_flags") or []
    if "LLM_PARSE_FALLBACK" in review_flags:
        errors.append(GateError.LLM_FALLBACK_USED)
        details["LLM_FALLBACK_USED"] = "LLM returned unparseable output; fallback structure was used"

    # --- 2. Check total recoverable amount ---
    total = 0.0
    try:
        total = float(case.get("total_recoverable_amount") )
    except (ValueError, TypeError):
        total = 0.0

    if total <= 0:
        errors.append(GateError.TOTAL_MISSING)
        details["TOTAL_MISSING"] = f"total_recoverable_amount is {total}; cannot render a ₹0 demand order"

    if total < 0:
        errors.append(GateError.NEGATIVE_AMOUNT)
        details["NEGATIVE_AMOUNT"] = f"Negative amount {total} indicates refund/reversal — not a demand"

    # --- 3. Check for negative sub-amounts ---
    for key in ("principal_amount", "penalty_amount", "interest_amount", "other_charges_amount"):
        try:
            val = float(case.get(key) )
            if val < 0:
                errors.append(GateError.NEGATIVE_AMOUNT)
                details["NEGATIVE_AMOUNT"] = f"{key} is negative ({val})"
                break
        except (ValueError, TypeError):
            pass

    # --- 4. Check for named defaulter ---
    defaulter_name = (case.get("defaulter_name") or "").strip()
    if not defaulter_name or defaulter_name.lower() in _PLACEHOLDER_NAMES or defaulter_name in _PLACEHOLDER_NAMES:
        errors.append(GateError.NO_NAMED_DEFAULTER)
        details["NO_NAMED_DEFAULTER"] = f"Defaulter name is '{defaulter_name}' — placeholder or empty"

    # --- 5. Check amount sum integrity (canonical: principal + penalty + interest + other_charges) ---
    if total > 0:
        principal = float(case.get("principal_amount") or 0.0)
        penalty = float(case.get("penalty_amount") or 0.0)
        interest = float(case.get("interest_amount") or 0.0)
        other_charges = float(case.get("other_charges_amount") or 0.0)

        # If no breakdown provided (all zero), principal is assumed = total (lump sum)
        if principal == 0.0 and penalty == 0.0 and interest == 0.0 and other_charges == 0.0:
            pass  # Lump sum — no mismatch possible
        else:
            computed = round(principal + penalty + interest + other_charges, 2)
            discrepancy = abs(computed - round(total, 2))
            if discrepancy > 1.0:
                errors.append(GateError.AMOUNT_SUM_MISMATCH)
                details["AMOUNT_SUM_MISMATCH"] = (
                    f"Sum of heads ({principal} + {penalty} + {interest} + {other_charges} = {computed}) "
                    f"≠ total ({total}), discrepancy ₹{discrepancy:.2f}"
                )

    # --- 6. Check OCR placeholder pages ---
    if ocr_pages:
        for page in ocr_pages:
            page_mode = page.get("mode", "")
            page_text = page.get("text", "")
            if page_mode == "fallback_local" or _OCR_PLACEHOLDER_PATTERN.search(page_text):
                errors.append(GateError.OCR_PLACEHOLDER_PAGE)
                details["OCR_PLACEHOLDER_PAGE"] = (
                    f"Page {page.get('page', '?')} used fallback_local mode — "
                    f"no real OCR text available for this page"
                )
                break  # One placeholder page fails the whole document

    # Also check the joined text for placeholder patterns
    if _OCR_PLACEHOLDER_PATTERN.search(ocr_text):
        if GateError.OCR_PLACEHOLDER_PAGE not in errors:
            errors.append(GateError.OCR_PLACEHOLDER_PAGE)
            details["OCR_PLACEHOLDER_PAGE"] = "OCR placeholder text found in joined document text"

    # --- 7. Check statute cited ---
    statute = (case.get("statute_cited") or "").strip()
    if not statute:
        errors.append(GateError.STATUTE_MISSING)
        details["STATUTE_MISSING"] = "No statute_cited extracted from the document"

    # --- 8. Check jurisdiction / taluk ---
    taluk = (case.get("taluk_name") or "").strip()
    if not taluk:
        errors.append(GateError.TALUK_MISSING)
        details["TALUK_MISSING"] = "No taluk_name extracted"
    elif taluk not in ERODE_TALUKS:
        errors.append(GateError.JURISDICTION_UNRESOLVED)
        details["JURISDICTION_UNRESOLVED"] = f"Taluk '{taluk}' not in known Erode district taluks"

    # --- 9. Anchor verification: total amount or constituent components must appear in OCR text ---
    if total > 0 and ocr_text:
        total_str = _normalize_amount_string(str(int(total)))
        ocr_amounts = _extract_amounts_from_text(ocr_text)
        ocr_normalized = ocr_text.replace(",", "").replace(" ", "")
        
        # Check if total is directly present
        total_in_source = (
            total_str in ocr_normalized 
            or total_str in " ".join(ocr_amounts)
        )
        
        # Check if constituent heads are present (e.g. principal + penalty)
        principal = float(case.get("principal_amount") or 0.0)
        penalty = float(case.get("penalty_amount") or 0.0)
        interest = float(case.get("interest_amount") or 0.0)
        
        principal_str = _normalize_amount_string(str(int(principal))) if principal > 0 else ""
        penalty_str = _normalize_amount_string(str(int(penalty))) if penalty > 0 else ""
        interest_str = _normalize_amount_string(str(int(interest))) if interest > 0 else ""
        
        components_found = True
        if principal > 0 and (principal_str not in ocr_normalized and principal_str not in " ".join(ocr_amounts)):
            components_found = False
        if penalty > 0 and (penalty_str not in ocr_normalized and penalty_str not in " ".join(ocr_amounts)):
            components_found = False
        if interest > 0 and (interest_str not in ocr_normalized and interest_str not in " ".join(ocr_amounts)):
            components_found = False
            
        has_breakdown = (principal > 0 or penalty > 0)
        
        if not total_in_source and not (has_breakdown and components_found):
            errors.append(GateError.ANCHOR_NOT_IN_SOURCE)
            details["ANCHOR_NOT_IN_SOURCE"] = (
                f"Total ₹{total:,.2f} ({total_str}) and its component amounts not found in OCR text — "
                f"possible hallucinated amount"
            )

    # --- 10. Check case file number ---
    case_file_no = (case.get("case_file_no") or "").strip()
    if not case_file_no:
        errors.append(GateError.CASE_FILE_NO_MISSING)
        details["CASE_FILE_NO_MISSING"] = "No case_file_no extracted from the document"

    # --- Build result ---
    # Deduplicate errors while preserving order
    seen = set()
    unique_errors = []
    for e in errors:
        if e not in seen:
            seen.add(e)
            unique_errors.append(e)

    return GateResult(
        ok=len(unique_errors) == 0,
        errors=unique_errors,
        error_details=details,
    )


def compute_total(case: Dict[str, Any]) -> float:
    """
    Single canonical total computation used by BOTH the gate and the math validator.
    total = principal + penalty + interest + other_charges
    """
    principal = float(case.get("principal_amount") or 0.0)
    penalty = float(case.get("penalty_amount") or 0.0)
    interest = float(case.get("interest_amount") or 0.0)
    other_charges = float(case.get("other_charges_amount") or 0.0)
    return round(principal + penalty + interest + other_charges, 2)
