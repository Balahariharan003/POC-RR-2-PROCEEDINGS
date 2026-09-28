"""
Document Generation Engine using docxtpl and python-docx.
Step 5 of the 5-Step Pipeline.
Renders validated legal entities into official Tamil Nadu Revenue Recovery Proceedings (.docx)
with EXCLUSIVE enforcement of TAU-Marutham font across all paragraphs, headings, tables, and runs.
Supports dynamic templates from PostgreSQL database.
"""

import os
import re
import subprocess
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, Optional, List
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import parse_xml
from docx.oxml.ns import nsdecls, qn
from docxtpl import DocxTemplate

from config import (
    PROCEEDINGS_TEMPLATE_PATH,
    FINAL_CUSTOMS_TEMPLATE_PATH,
    OUTPUT_DIR,
    PRIMARY_FONT_TAMIL,
)
from schemas import ExtractedLegalEntities, ValidationResult
from template_builder import build_department_templates
import templates_store


def apply_tau_marutham_font(run, size_pt: float = 11.5, bold: bool = False, italic: bool = False, color_rgb: Optional[RGBColor] = None):
    """
    Enforces TAU-Marutham font alone across Latin, Complex Script, and EastAsian XML nodes.
    """
    font_name = PRIMARY_FONT_TAMIL  # "TAU-Marutham"
    run.font.name = font_name
    run.font.size = Pt(size_pt)
    run.bold = bold
    run.italic = italic
    if color_rgb:
        run.font.color.rgb = color_rgb

    # Enforce rFonts complex-script and eastAsia for Tamil Unicode glyph integrity
    rPr = run._r.get_or_add_rPr()
    rFonts = parse_xml(
        f'<w:rFonts {nsdecls("w")} w:ascii="{font_name}" w:hAnsi="{font_name}" w:cs="{font_name}" w:eastAsia="{font_name}"/>'
    )
    rPr.append(rFonts)


def normalize_context(extracted_data: dict) -> dict:
    """Normalizes Tamil grammar, living verbs, suffixes, and address fields."""
    context = extracted_data.copy()
    defaulters = context.get("defaulter_details", [])
    
    if not defaulters and "defaulter" in context:
        d = context["defaulter"]
        if isinstance(d, dict):
            defaulters = [{
                "name": d.get("name", ""),
                "father_or_spouse_name": d.get("father_or_husband_name"),
                "representation_or_title": f"IEC No: {d.get('iec_number')}" if d.get("iec_number") else None,
                "door_no": d.get("door_no", ""),
                "street_and_locality": d.get("street_area", ""),
                "taluk": d.get("taluk", context.get("taluk_name", "")),
                "district": d.get("district", context.get("district_name", "")),
                "pincode": d.get("pincode", "")
            }]
            context["defaulter_details"] = defaulters

    if not defaulters:
        defaulters = [{
            "name": context.get("defaulter_name", ""),
            "father_or_spouse_name": None,
            "representation_or_title": f"IEC No: {context.get('iec_no')}" if context.get("iec_no") else None,
            "door_no": context.get("door_no", ""),
            "street_and_locality": context.get("street_and_locality", ""),
            "taluk": context.get("taluk_name", ""),
            "district": context.get("district_name", ""),
            "pincode": context.get("pincode", "")
        }]
        context["defaulter_details"] = defaulters

    num_defaulters = len(defaulters)
    entity_type = context.get("entity_type", "INDIVIDUAL")

    if entity_type == "COMPANY":
        context["living_verb"] = "இயங்கி வரும்"
        context["defaulter_suffix"] = "நிறுவனத்திடமிருந்து"
        context["asset_clause"] = "அசையும் மற்றும் அசையா சொத்துகளிலிருந்து மற்றும் வங்கிக் கணக்குகளிலிருந்து"
    else:
        context["living_verb"] = "வசித்து வரும்"
        context["defaulter_suffix"] = "என்பவரிடமிருந்து" if num_defaulters <= 1 else "ஆகியோரிடமிருந்து"
        context["asset_clause"] = "அசையும் மற்றும் அசையா சொத்துகளிலிருந்து"

    first_d = defaulters[0] if defaulters else {}
    context.setdefault("defaulter_name", first_d.get("name", context.get("defaulter_name", "")))
    context.setdefault("door_no", first_d.get("door_no", context.get("door_no", "")))
    context.setdefault("street_and_locality", first_d.get("street_and_locality", context.get("street_and_locality", "")))
    context.setdefault("taluk_name", first_d.get("taluk", context.get("taluk_name", "")))
    context.setdefault("district_name", first_d.get("district", context.get("district_name", "")))
    context.setdefault("pincode", first_d.get("pincode", context.get("pincode", "")))

    iec = first_d.get("iec_no") or first_d.get("iec_number") or context.get("iec_no")
    if not iec and first_d.get("representation_or_title") and "IEC" in first_d.get("representation_or_title", ""):
        iec = first_d["representation_or_title"].replace("IEC No:", "").strip()
    context["iec_no"] = iec or ""

    context.setdefault("file_no", str(context.get("file_no", "")).strip("[]"))
    context.setdefault("file_year", str(context.get("file_year", "")).strip("[]"))
    context.setdefault("section_code", str(context.get("section_code", "")).strip("[]"))
    context.setdefault("roc_number", f"ந.க. {context['file_no']}/{context['file_year']}/{context['section_code']}")
    context.setdefault("proceedings_date", "")
    context.setdefault("collector_name", context.get("collector_name", ""))

    fin = context.get("financials", {})
    if isinstance(fin, dict):
        p_amt = fin.get("principal_amount", 0)
        pen_amt = fin.get("penalty_amount", 0)
        tot_amt = fin.get("total_amount", fin.get("total_recoverable_amount", 0))
        context.setdefault("principal_amount", f"{float(p_amt):,.0f}")
        context.setdefault("penalty_amount", f"{float(pen_amt):,.0f}")
        context.setdefault("total_amount", f"{float(tot_amt):,.0f}")
        context.setdefault("amount_in_tamil_words", fin.get("amount_in_words_tamil", ""))

    pay = context.get("payment_instructions", {})
    if isinstance(pay, dict):
        context.setdefault("dd_favour_of", pay.get("dd_favour_of", ""))
        context.setdefault("head_of_account", pay.get("head_of_account", ""))
        context.setdefault("dispatch_address", pay.get("dispatch_address", ""))

    ref = context.get("reference_details", {})
    if isinstance(ref, dict):
        context.setdefault("issuing_authority_name", ref.get("issuing_authority_name", ""))
        context.setdefault("case_file_no", ref.get("case_or_file_no", ""))
        context.setdefault("order_in_original_no", ref.get("ia_or_mp_no", ""))
        context.setdefault("order_date", ref.get("order_date", ""))
        context.setdefault("letter_date", ref.get("letter_date", ""))

    return context


def _repair_mojibake(value: Any) -> str:
    """Repairs UTF-8 Tamil text that was accidentally decoded as Latin-1."""
    text = "" if value is None else str(value)
    if "à" not in text:
        return text
    try:
        return text.encode("latin1").decode("utf-8")
    except (UnicodeEncodeError, UnicodeDecodeError):
        return text


def _iter_document_paragraphs(document: docx.Document):
    """Yields body, table, header, and footer paragraphs once."""
    seen = set()

    def emit(paragraphs):
        for paragraph in paragraphs:
            key = paragraph._p
            if key not in seen:
                seen.add(key)
                yield paragraph

    yield from emit(document.paragraphs)
    for table in document.tables:
        for row in table.rows:
            for cell in row.cells:
                yield from emit(cell.paragraphs)
    for section in document.sections:
        yield from emit(section.header.paragraphs)
        yield from emit(section.footer.paragraphs)


def _replace_across_runs(paragraph, old: str, new: str) -> None:
    """Replaces text even when Word split it across styled runs."""
    if not old or old == new or old not in paragraph.text:
        return

    search_end = len("".join(run.text for run in paragraph.runs))
    while search_end > 0:
        runs = paragraph.runs
        combined = "".join(run.text for run in runs)
        start = combined.rfind(old, 0, search_end)
        if start < 0:
            return
        end = start + len(old)

        positions = []
        cursor = 0
        for index, run in enumerate(runs):
            positions.append((index, cursor, cursor + len(run.text)))
            cursor += len(run.text)

        affected = [(i, lo, hi) for i, lo, hi in positions if hi > start and lo < end]
        if not affected:
            return

        first_i, first_lo, _ = affected[0]
        last_i, last_lo, _ = affected[-1]
        prefix = runs[first_i].text[:start - first_lo]
        suffix = runs[last_i].text[end - last_lo:]
        runs[first_i].text = prefix + new + (suffix if first_i == last_i else "")

        for run_i, _, _ in affected[1:-1]:
            runs[run_i].text = ""
        if last_i != first_i:
            runs[last_i].text = suffix
        search_end = start


def _format_rupees(value: Any) -> str:
    try:
        number = int(round(float(value or 0)))
    except (TypeError, ValueError):
        return "0"
    sign = "-" if number < 0 else ""
    digits = str(abs(number))
    if len(digits) <= 3:
        return sign + digits
    last_three = digits[-3:]
    leading = digits[:-3]
    groups = []
    while leading:
        groups.insert(0, leading[-2:])
        leading = leading[:-2]
    return sign + ",".join(groups + [last_three])


def enforce_document_font(document: docx.Document, font_name: str = PRIMARY_FONT_TAMIL) -> None:
    """Sets one font family everywhere without changing size or emphasis."""
    for style in document.styles:
        if not hasattr(style, "font"):
            continue
        style.font.name = font_name
        style_rpr = style._element.get_or_add_rPr()
        style_fonts = style_rpr.get_or_add_rFonts()
        for attribute in ("ascii", "hAnsi", "cs", "eastAsia"):
            style_fonts.set(qn(f"w:{attribute}"), font_name)

    for paragraph in _iter_document_paragraphs(document):
        for run in paragraph.runs:
            run.font.name = font_name
            run_rpr = run._element.get_or_add_rPr()
            run_fonts = run_rpr.get_or_add_rFonts()
            for attribute in ("ascii", "hAnsi", "cs", "eastAsia"):
                run_fonts.set(qn(f"w:{attribute}"), font_name)

    # Word can also store fonts on paragraph marks and inherited XML nodes
    # that are not exposed as python-docx runs. Normalize those declarations
    # so blank lines and Latin text cannot fall back to another font.
    xml_roots = [document.element, document.styles.element]
    for section in document.sections:
        xml_roots.extend([section.header._element, section.footer._element])
    try:
        xml_roots.append(document.part.numbering_part.element)
    except (AttributeError, NotImplementedError):
        pass

    for root in xml_roots:
        for fonts in root.xpath(".//w:rFonts"):
            for attribute in ("ascii", "hAnsi", "cs", "eastAsia"):
                fonts.set(qn(f"w:{attribute}"), font_name)
            for theme_attribute in ("asciiTheme", "hAnsiTheme", "csTheme", "eastAsiaTheme"):
                fonts.attrib.pop(qn(f"w:{theme_attribute}"), None)


def render_final_customs_template(payload: Dict[str, Any], output_path: Path) -> Path:
    """Renders extracted Customs fields into the user-approved final template."""
    if not FINAL_CUSTOMS_TEMPLATE_PATH.exists():
        raise FileNotFoundError(f"Final Customs template not found: {FINAL_CUSTOMS_TEMPLATE_PATH}")

    document = docx.Document(str(FINAL_CUSTOMS_TEMPLATE_PATH))
    defaulters = payload.get("defaulter_details") or [{}]
    defaulter = defaulters[0] or {}
    financials = payload.get("financials") or {}
    reference = payload.get("reference_details") or {}
    payment = payload.get("payment_instructions") or {}

    name = _repair_mojibake(defaulter.get("name") or payload.get("defaulter_name") or "")
    district = _repair_mojibake(payload.get("district_name") or defaulter.get("district") or "")
    taluk = _repair_mojibake(payload.get("taluk_name") or defaulter.get("taluk") or district)
    door_no = _repair_mojibake(defaulter.get("door_no") or "")
    pincode = _repair_mojibake(defaulter.get("pincode") or "")
    address = _repair_mojibake(defaulter.get("street_and_locality") or "")
    address_parts = [part.strip() for part in address.split(",") if part.strip()]
    locality = address_parts[0] if len(address_parts) > 0 else ""
    street = address_parts[1] if len(address_parts) > 1 else ""
    area = address_parts[2] if len(address_parts) > 2 else ""

    principal = financials.get("principal_amount", financials.get("duty_amount", 0))
    penalty = financials.get("penalty_amount", 0)
    total = financials.get("total_recoverable_amount", financials.get("total_amount", 0))
    amount_words = _repair_mojibake(
        financials.get("amount_in_words_tamil")
        or financials.get("amount_in_tamil_words")
        or payload.get("amount_in_tamil_words")
        or ""
    ).strip()
    if amount_words.startswith("ரூபாய் "):
        amount_words = amount_words[len("ரூபாய் "):]
    if amount_words.endswith(" மட்டும்"):
        amount_words = amount_words[:-len(" மட்டும்")]

    representation = _repair_mojibake(defaulter.get("representation_or_title") or "")
    iec_no = payload.get("iec_no") or ""
    if not iec_no and "IEC" in representation:
        iec_no = re.sub(r"^.*?IEC\s*(?:No)?\s*[:.]?\s*", "", representation, flags=re.IGNORECASE).strip()

    file_no = _repair_mojibake(payload.get("file_no") or "")
    file_year = _repair_mojibake(payload.get("file_year") or "")
    section_code = _repair_mojibake(payload.get("section_code") or "")
    roc = f"{file_no}/{file_year}/{section_code}".strip("/")

    replacements = [
        ("The Commissioner of Customs, Export commissionerate (Chennai IV)", _repair_mojibake(payment.get("dd_favour_of") or "The Commissioner of Customs, Export commissionerate (Chennai IV)")),
        ("The Assistant Commissioner of Customs (ARC), Office Of The Commissioner Of Customs, Export Commissionerate (Chennai IV), Custom House, 60, Rajaji Salai, Chennai-600001", _repair_mojibake(payment.get("dispatch_address") or "The Assistant Commissioner of Customs (ARC), Office Of The Commissioner Of Customs, Export Commissionerate (Chennai IV), Custom House, 60, Rajaji Salai, Chennai-600001")),
        ("ரூபாய் ஒரு இலட்சத்து எண்பத்தி இரண்டாயிரத்து முந்நூற்றி எட்டு மட்டும்", f"ரூபாய் {amount_words} மட்டும்" if amount_words else ""),
        ("பெருமாள் கவுண்டர் தோட்டம்", area or "பெருமாள் கவுண்டர் தோட்டம்"),
        ("6வது உழவர் வீதி", street or "6வது உழவர் வீதி"),
        ("உழவன் நகர்", locality or "உழவன் நகர்"),
        ("கதவு எண்.46", f"கதவு எண்.{door_no}" if door_no else "கதவு எண்.46"),
        ("M/s. Prisma Garments", name or "M/s. Prisma Garments"),
        ("3205015860", str(iec_no or "3205015860")),
        ("1,82,308", _format_rupees(total)),
        ("1,73,308", _format_rupees(principal)),
        ("9,000", _format_rupees(penalty)),
        ("516/2024-ARC", _repair_mojibake(reference.get("case_or_file_no") or "516/2024-ARC")),
        ("26.12.2025", _repair_mojibake(reference.get("letter_date") or reference.get("order_date") or "26.12.2025")),
        ("1248/2026/ஈ2", roc or "1248/2026/ஈ2"),
        ("ஈரோடு வட்டம்", f"{taluk} வட்டம்" if taluk else "ஈரோடு வட்டம்"),
        ("ஈரோடு மாவட்டம்", f"{district} மாவட்டம்" if district else "ஈரோடு மாவட்டம்"),
        ("வருவாய் வட்டாட்சியர், ஈரோடு", f"வருவாய் வட்டாட்சியர், {taluk}" if taluk else "வருவாய் வட்டாட்சியர், ஈரோடு"),
        ("வருவாய் கோட்டாட்சியர், ஈரோடு", f"வருவாய் கோட்டாட்சியர், {district}" if district else "வருவாய் கோட்டாட்சியர், ஈரோடு"),
        ("638009", pincode or "638009"),
    ]

    for paragraph in _iter_document_paragraphs(document):
        for old, new in replacements:
            _replace_across_runs(paragraph, old, new)

    enforce_document_font(document)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    document.save(str(output_path))
    return output_path


def convert_docx_to_pdf(docx_path: Path, pdf_path: Optional[Path] = None) -> Path:
    """Converts the rendered DOCX with Microsoft Word to preserve exact layout."""
    source = Path(docx_path).resolve()
    target = Path(pdf_path or source.with_suffix(".pdf")).resolve()
    script = Path(__file__).resolve().parent / "convert_docx_to_pdf.ps1"
    if not source.exists():
        raise FileNotFoundError(f"DOCX file not found: {source}")
    if not script.exists():
        raise FileNotFoundError(f"PDF conversion script not found: {script}")

    result = subprocess.run(
        [
            "powershell.exe",
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            str(script),
            str(source),
            str(target),
        ],
        capture_output=True,
        text=True,
        timeout=120,
        check=False,
    )
    if result.returncode != 0 or not target.exists():
        detail = (result.stderr or result.stdout or "Microsoft Word PDF conversion failed").strip()
        raise RuntimeError(detail)
    return target


def generate_docx_from_content(content: str, output_path: str, filename: str = "Official_Proceedings.docx") -> str:
    """
    Constructs a complete Word document (.docx) directly from text lines,
    strictly styling every heading, paragraph, and table cell in TAU-Marutham font.
    """
    doc = docx.Document()
    
    # 0.9 inch standard government margins
    for s in doc.sections:
        s.top_margin = Inches(0.9)
        s.bottom_margin = Inches(0.9)
        s.left_margin = Inches(0.9)
        s.right_margin = Inches(0.9)

    # Set document-level Normal style to TAU-Marutham
    style = doc.styles['Normal']
    font = style.font
    font.name = PRIMARY_FONT_TAMIL
    font.size = Pt(11.5)
    rPr = style._element.get_or_add_rPr()
    rFonts = parse_xml(
        f'<w:rFonts {nsdecls("w")} w:ascii="{PRIMARY_FONT_TAMIL}" w:hAnsi="{PRIMARY_FONT_TAMIL}" w:cs="{PRIMARY_FONT_TAMIL}" w:eastAsia="{PRIMARY_FONT_TAMIL}"/>'
    )
    rPr.append(rFonts)

    lines = content.split("\n")
    office_notes_break_added = False

    for i, raw_line in enumerate(lines):
        stripped = raw_line.strip()
        if not stripped:
            continue

        # Page break before Office Notes if both exist in same document
        if ("//அலுவலகக் குறிப்பு//" in stripped or (stripped.startswith("ந.க.") and any("//அலுவலகக் குறிப்பு//" in l for l in lines[i:i+4]))):
            if not office_notes_break_added and i > 5:
                doc.add_page_break()
                office_notes_break_added = True

        p = doc.add_paragraph()
        p.paragraph_format.line_spacing = 1.2
        p.paragraph_format.space_after = Pt(4)

        if "செயல்முறைகள்" in stripped or "பிறப்பிப்பவர்:" in stripped or "//அலுவலகக் குறிப்பு//" in stripped or "//குறிப்பாணை//" in stripped:
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            run = p.add_run(stripped)
            apply_tau_marutham_font(run, size_pt=12.0 if ("செயல்முறைகள்" in stripped or "//" in stripped) else 11.5, bold=True)
        elif stripped in ["-------", "------", "----------"]:
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            p.paragraph_format.space_after = Pt(6)
            run = p.add_run("-------")
            apply_tau_marutham_font(run, size_pt=11.0, bold=True)
        elif "மாவட்ட ஆட்சித் தலைவர்" in stripped or "மாவட்ட ஆட்சித் தலைவருக்காக" in stripped:
            p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
            run = p.add_run(stripped)
            apply_tau_marutham_font(run, size_pt=11.5, bold=True)
        elif "\t" in raw_line and ("ந.க." in stripped or "மு.மு." in stripped or "நாள்" in stripped):
            # Split into borderless 2-column layout or tabbed run
            parts = [pt.strip() for pt in raw_line.split("\t") if pt.strip()]
            if len(parts) >= 2:
                p.paragraph_format.space_after = Pt(6)
                r_l = p.add_run(parts[0])
                apply_tau_marutham_font(r_l, size_pt=11.5, bold=True)
                r_space = p.add_run("                    ")
                apply_tau_marutham_font(r_space, size_pt=11.5)
                r_r = p.add_run(parts[1])
                apply_tau_marutham_font(r_r, size_pt=11.5, bold=True)
            else:
                run = p.add_run(stripped)
                apply_tau_marutham_font(run, size_pt=11.5, bold=True)
        elif stripped.startswith("பொருள்:"):
            p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
            p.paragraph_format.space_before = Pt(6)
            p.paragraph_format.space_after = Pt(6)
            r_lbl = p.add_run("பொருள்: ")
            apply_tau_marutham_font(r_lbl, size_pt=11.5, bold=True)
            val = stripped[len("பொருள்:"):].strip()
            r_val = p.add_run(val)
            apply_tau_marutham_font(r_val, size_pt=11.5, bold=False)
        elif stripped.startswith("பார்வை:"):
            p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
            p.paragraph_format.space_before = Pt(4)
            p.paragraph_format.space_after = Pt(6)
            r_lbl = p.add_run("பார்வை: ")
            apply_tau_marutham_font(r_lbl, size_pt=11.5, bold=True)
            val = stripped[len("பார்வை:"):].strip()
            r_val = p.add_run(val)
            apply_tau_marutham_font(r_val, size_pt=11.5, bold=False)
        elif stripped.startswith("உத்தரவு:"):
            p.paragraph_format.space_before = Pt(6)
            p.paragraph_format.space_after = Pt(6)
            r_lbl = p.add_run("உத்தரவு:")
            apply_tau_marutham_font(r_lbl, size_pt=12.0, bold=True)
            val = stripped[len("உத்தரவு:"):].strip()
            if val:
                p2 = doc.add_paragraph()
                p2.paragraph_format.first_line_indent = Inches(0.4)
                p2.paragraph_format.space_after = Pt(6)
                p2.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
                r_val = p2.add_run(val)
                apply_tau_marutham_font(r_val, size_pt=11.5, bold=False)
        elif stripped.startswith("பணிந்தனுப்பப்படுகிறது:"):
            p.paragraph_format.space_before = Pt(6)
            p.paragraph_format.space_after = Pt(6)
            r_lbl = p.add_run("பணிந்தனுப்பப்படுகிறது:")
            apply_tau_marutham_font(r_lbl, size_pt=12.0, bold=True)
        elif stripped.startswith("இணைப்பு:"):
            p.paragraph_format.space_before = Pt(6)
            p.paragraph_format.space_after = Pt(12)
            r_lbl = p.add_run(stripped)
            apply_tau_marutham_font(r_lbl, size_pt=11.5, bold=True)
        elif stripped.startswith("பெறுநர்:") or stripped.startswith("நகல் :") or stripped.startswith("நகல்:"):
            p.paragraph_format.space_after = Pt(3)
            prefix = "பெறுநர்:" if stripped.startswith("பெறுநர்:") else "நகல்:"
            r_lbl = p.add_run(f"{prefix} ")
            apply_tau_marutham_font(r_lbl, size_pt=11.5, bold=True)
            val = stripped[len(prefix):].strip()
            if val:
                r_val = p.add_run(val)
                apply_tau_marutham_font(r_val, size_pt=11.0, bold=False)
        elif raw_line.startswith("   ") or raw_line.startswith("\t") or stripped.startswith("ஈரோடு மாவட்டம்") or stripped.startswith("மேற்படி") or stripped.startswith("எனவே") or stripped.startswith("உத்திரவினை"):
            p.paragraph_format.first_line_indent = Inches(0.4)
            p.paragraph_format.space_after = Pt(8)
            p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
            run = p.add_run(stripped)
            apply_tau_marutham_font(run, size_pt=11.5, bold=False)
        else:
            p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
            run = p.add_run(stripped)
            apply_tau_marutham_font(run, size_pt=11.5, bold=False)

    out_file = Path(output_path)
    out_file.parent.mkdir(parents=True, exist_ok=True)
    doc.save(str(out_file))
    return str(out_file)


class DocumentGenerator:
    def __init__(self, template_path: Path = PROCEEDINGS_TEMPLATE_PATH):
        self.template_path = Path(template_path)
        base_dir = self.template_path.parent
        if not (base_dir / "template_customs.docx").exists():
            build_department_templates(base_dir)

    def generate_proceedings(
        self,
        entities: ExtractedLegalEntities,
        validation: Optional[ValidationResult] = None,
        custom_output_filename: Optional[str] = None,
        template_code: Optional[str] = None
    ) -> Path:
        """
        Renders validated entities into DOCX using dynamic PostgreSQL template or default department template.
        Strictly applies TAU-Marutham font.
        """
        payload = normalize_context(entities.model_dump())

        # The supplied final Customs document is the authoritative output
        # layout. Both DOCX and PDF exports originate from this rendered file.
        if payload.get("department_type") == "CUSTOMS" and FINAL_CUSTOMS_TEMPLATE_PATH.exists():
            out_name = custom_output_filename or f"Proceedings_Customs_{payload.get('file_no', '1248')}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.docx"
            out_path = OUTPUT_DIR / out_name
            return render_final_customs_template(payload, out_path)
        
        # Check if dynamic template requested
        if template_code:
            tmpl = templates_store.get_template(template_code)
            if tmpl:
                rendered_text = templates_store.render_template_to_text(tmpl, payload)
                out_name = custom_output_filename or f"Proceedings_{payload.get('file_no', '1248')}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.docx"
                out_path = OUTPUT_DIR / out_name
                generate_docx_from_content(rendered_text, str(out_path), out_name)
                return out_path

        # If department is Customs, check PostgreSQL customs_proceedings template
        if payload.get("department_type") == "CUSTOMS":
            tmpl = templates_store.get_template("customs_proceedings")
            if tmpl:
                rendered_text = templates_store.render_template_to_text(tmpl, payload)
                out_name = custom_output_filename or f"Proceedings_Customs_{payload.get('file_no', '1248')}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.docx"
                out_path = OUTPUT_DIR / out_name
                generate_docx_from_content(rendered_text, str(out_path), out_name)
                return out_path

        # Standard docxtpl render
        dept = str(payload.get("department_type", "CUSTOMS")).lower()
        base_templates_dir = self.template_path.parent
        template_map = {
            "customs": base_templates_dir / "template_customs.docx",
            "tnrera": base_templates_dir / "template_tnrera.docx",
            "mcop": base_templates_dir / "template_mcop.docx",
            "warrant": base_templates_dir / "template_warrant.docx"
        }
        t_path = template_map.get(dept, base_templates_dir / "template_customs.docx")
        if not t_path.exists():
            build_department_templates(base_templates_dir)

        doc = DocxTemplate(str(t_path))
        doc.render(payload)

        out_name = custom_output_filename or f"Proceedings_{payload.get('file_no', '1248')}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.docx"
        out_file = OUTPUT_DIR / out_name
        doc.save(str(out_file))
        return out_file
