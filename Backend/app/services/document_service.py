"""
Document Service: Enterprise Word (.docx) Generation Engine.
Strictly renders legal entities into Tamil Nadu Government Proceedings templates with:
- Pure TAU-Marutham font enforcement across Latin, Complex-Script, and EastAsian XML declarations.
- Dynamic Jinja2 context mapping via DocxTemplate.
- Official Dual-Form Generation:
  1. செயல்முறைகள் (Collector & District Magistrate Proceedings / Order)
  2. குறிப்பாணை (Collectorate Memorandum / Office Note)
- Pure official Tamil terminology, verb agreements, and layout formatting.
"""

import re
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, Optional, List
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.oxml import parse_xml
from docx.oxml.ns import nsdecls, qn
from docxtpl import DocxTemplate

from app.core.config import settings
from app.core.logging import logger
from app.domain.schemas.legal_entities import ExtractedLegalEntities, DepartmentType, EntityType
from app.domain.rules.tamil_numerals import number_to_tamil_currency_words
from app.domain.rules.department_registry import DepartmentRegistry
from app.domain.rules.jurisdiction import route_to_jurisdiction, SUPPORTED_DISTRICTS


def enforce_document_font(document: docx.Document, font_name: str = settings.PRIMARY_FONT_TAMIL) -> None:
    """Sets TAU-Marutham font family strictly across all paragraphs, runs, tables, and styles."""
    for style in document.styles:
        if not hasattr(style, "font"):
            continue
        style.font.name = font_name
        style_rpr = style._element.get_or_add_rPr()
        style_fonts = style_rpr.get_or_add_rFonts()
        for attr in ("ascii", "hAnsi", "cs", "eastAsia"):
            style_fonts.set(qn(f"w:{attr}"), font_name)

    # Walk body, tables, headers, footers
    for paragraph in document.paragraphs:
        for run in paragraph.runs:
            run.font.name = font_name
            run_rpr = run._element.get_or_add_rPr()
            run_fonts = run_rpr.get_or_add_rFonts()
            for attr in ("ascii", "hAnsi", "cs", "eastAsia"):
                run_fonts.set(qn(f"w:{attr}"), font_name)

    for table in document.tables:
        for row in table.rows:
            for cell in row.cells:
                for paragraph in cell.paragraphs:
                    for run in paragraph.runs:
                        run.font.name = font_name
                        run_rpr = run._element.get_or_add_rPr()
                        run_fonts = run_rpr.get_or_add_rFonts()
                        for attr in ("ascii", "hAnsi", "cs", "eastAsia"):
                            run_fonts.set(qn(f"w:{attr}"), font_name)

    # Normalize XML root rFonts
    for root in [document.element, document.styles.element]:
        for fonts in root.xpath(".//w:rFonts"):
            for attr in ("ascii", "hAnsi", "cs", "eastAsia"):
                fonts.set(qn(f"w:{attr}"), font_name)


def format_defaulter_address(
    door_no: Optional[str] = None,
    street_and_locality: Optional[str] = None,
    village: Optional[str] = None,
    pincode: Optional[str] = None,
) -> Dict[str, str]:
    """
    Cleans and structures address parts to eliminate duplicates (e.g. 'Door No. 1, ... 1').
    Returns a dict with 'door_no', 'street_and_locality', and 'full_address_line'.
    """
    street = (street_and_locality or "").strip().rstrip(",")
    raw_door = (door_no or "").strip().rstrip(",")

    door_already_present = False
    clean_door = raw_door
    if raw_door:
        pattern = r'(?i)\b(?:கதவு\s*எண்\.?|door\s*no\.?|d\.?no\.?|no\.?)\s*' + re.escape(raw_door) + r'\b'
        if re.search(pattern, street) or street.startswith(raw_door):
            door_already_present = True
            clean_door = ""

    parts = []
    if clean_door and not door_already_present:
        parts.append(f"கதவு எண். {clean_door}")
    if street:
        parts.append(street)
    if village and village.strip() and village.strip() not in street:
        parts.append(f"{village.strip()} கிராமம்")

    full_addr = ", ".join(parts)
    return {
        "door_no": clean_door,
        "street_and_locality": street,
        "full_address_line": full_addr
    }


class DocumentService:
    def __init__(self, templates_dir: Optional[Path] = None, output_dir: Optional[Path] = None):
        self.templates_dir = templates_dir or settings.TEMPLATE_DIR
        self.output_dir = output_dir or settings.OUTPUT_DIR
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def prepare_context(self, entities: ExtractedLegalEntities) -> Dict[str, Any]:
        """Normalizes and prepares full Jinja2 context payload from extracted entities dynamically."""
        data = entities.model_dump()
        defaulters = data.get("defaulter_details", []) or []
        sureties = data.get("sureties", []) or []
        first_d = defaulters[0] if defaulters else {}
        fin = data.get("financials", {}) or {}
        ref = data.get("reference_details", {}) or {}
        pay = data.get("payment_instructions", {}) or {}

        # Determine department specification dynamically
        raw_dept = data.get("department_type", "CUSTOMS")
        dept_str = raw_dept.value if hasattr(raw_dept, "value") else str(raw_dept).split(".")[-1].upper()
        try:
            dept_enum = DepartmentType(dept_str)
        except ValueError:
            dept_enum = DepartmentType.GENERAL_RR
        spec = DepartmentRegistry.get_spec(dept_enum)

        # Determine entity type
        raw_ent = data.get("entity_type", "INDIVIDUAL")
        ent_str = raw_ent.value if hasattr(raw_ent, "value") else str(raw_ent).split(".")[-1].upper()

        is_company = ent_str in {"COMPANY", "PARTNERSHIP"}
        is_multiple = ent_str == "MULTIPLE_PROMOTERS" or len(defaulters) > 1
        is_govt_servant = ent_str == "GOVERNMENT_SERVANT"

        if is_company:
            living_verb = "இயங்கி வரும்"
            defaulter_suffix = "நிறுவனத்திடமிருந்து"
            asset_clause = "அசையும் மற்றும் அசையா சொத்துகளிலிருந்து மற்றும் வங்கிக் கணக்குகளிலிருந்து"
        elif is_multiple:
            living_verb = "வசித்து வரும்"
            defaulter_suffix = "ஆகியோரிடமிருந்து"
            asset_clause = "அசையும் மற்றும் அசையா சொத்துகளிலிருந்து"
        elif is_govt_servant:
            living_verb = "பணிபுரிந்து வந்த/வசித்து வரும்"
            defaulter_suffix = "மற்றும் பிணையாளர்களிடமிருந்து" if sureties else "என்பவரிடமிருந்து"
            asset_clause = "அசையும் மற்றும் அசையா சொத்துகள் மற்றும் சம்பளப் பிடித்தத்திலிருந்தும்"
        else:
            living_verb = "வசித்து வரும்"
            defaulter_suffix = "என்பவரிடமிருந்து"
            asset_clause = "அசையும் மற்றும் அசையா சொத்துகளிலிருந்து"

        # Financial Calculations
        principal = float(fin.get("principal_amount") or 0.0)
        penalty = float(fin.get("penalty_amount") or 0.0)
        interest = float(fin.get("interest_amount") or 0.0)
        total = float(fin.get("total_recoverable_amount") or (principal + penalty + interest))

        # Multi-Reference Dynamic Resolution
        raw_refs = ref.get("references_list") or data.get("references") or []
        references_list = []
        narrative_banned = [
            "FORWARDING HEREWITH", "DIRECTED TO RECOVER", "EXECUTION PETITION", "IS RESPONSIBLE FOR",
            "NAME OF THE PROJECT", "WHEREAS THE ABOVE", "FOR NECESSARY ACTION", "TRUE COPY", "P.T.O",
            "CHAIRPERSON", "ADDITIONAL DIRECTOR", "UNDER SECTION", "YOU ARE HEREBY", "HAS FAILED TO",
            "REPRESENTED BY", "IN FAVOUR OF", "REPORT COMPLIANCE"
        ]
        if isinstance(raw_refs, list) and len(raw_refs) > 0:
            for r_item in raw_refs:
                cleaned = re.sub(r'^\d+[\.\)]\s*', '', str(r_item).strip())
                if 8 <= len(cleaned) <= 220 and not any(ban in cleaned.upper() for ban in narrative_banned):
                    references_list.append(cleaned)

        if not references_list:
            issuing_auth = ref.get("issuing_authority_name", "")
            case_no = ref.get("case_or_file_no", "")
            order_no = ref.get("ia_or_mp_no", "")
            l_date = ref.get("letter_date", "") or ref.get("order_date", "")
            o_date = ref.get("order_date", "") or l_date
            references_list = DepartmentRegistry.build_default_references(
                spec=spec,
                issuing_auth=issuing_auth,
                case_no=case_no,
                order_no=order_no,
                letter_date=l_date,
                order_date=o_date,
            )

        formatted_numbered_refs = [f"{i + 1}. {item}" for i, item in enumerate(references_list)]
        reference_text = "\n".join(formatted_numbered_refs) if formatted_numbered_refs else "—"

        # Jurisdiction Dynamic Routing
        explicit_dist = data.get("district_name")
        explicit_taluk = data.get("taluk_name")
        raw_addr = " ".join(filter(None, [
            first_d.get("door_no"),
            first_d.get("street_and_locality"),
            first_d.get("village"),
            first_d.get("taluk"),
            first_d.get("district"),
            first_d.get("pincode")
        ]))
        routed = route_to_jurisdiction(
            raw_address=raw_addr,
            pincode=first_d.get("pincode"),
            explicit_taluk=explicit_taluk,
            explicit_district=explicit_dist
        )

        district = explicit_dist or routed["district"]
        taluk = explicit_taluk or routed["taluk"]
        tahsildar_title = data.get("assigned_tahsildar") or routed["tahsildar"]
        rdo_title = routed["rdo"]

        # Composite Defaulter Names & Address Formatting
        if is_multiple:
            d_name = ", ".join([d.get("name", "").strip() for d in defaulters if d.get("name")])
        else:
            d_name = (first_d.get("name") or "").strip()
        if not d_name:
            d_name = "எதிர்மனுதாரர்"

        addr_info = format_defaulter_address(
            door_no=first_d.get("door_no"),
            street_and_locality=first_d.get("street_and_locality"),
            village=first_d.get("village"),
            pincode=first_d.get("pincode")
        )
        door_no = addr_info["door_no"]
        street_loc = addr_info["street_and_locality"]
        full_addr_line = addr_info["full_address_line"]
        pincode = (first_d.get("pincode") or "").strip()
        iec = (first_d.get("iec_number") or "").strip()
        iec_suffix = f" (IEC No: {iec})" if iec else ""

        amt_words = fin.get("amount_in_words_tamil") or number_to_tamil_currency_words(total)

        # Address clause for body paragraphs
        addr_clause = f", {full_addr_line}" if full_addr_line else ""

        # Dynamic Subject & Order Paragraphs synthesis (Comprehensive 5-6 lines per paragraph)
        if dept_str == "CUSTOMS":
            subject_text = (
                f"வருவாய் வசூல் சட்டம் 1864 – சுங்கச் சட்டம் 1962 பிரிவு 142(1)(c)(ii) – {district} மாவட்டம் – {taluk} வட்டம் – "
                f"{d_name}{iec_suffix} – அரசுக்குச் செலுத்த வேண்டிய சுங்கவரி மற்றும் அபராத நிலுவைத் தொகை ரூ.{total:,.0f}/- ஐ "
                f"தமிழ்நாடு வருவாய் வசூல் சட்டத்தின் கீழ் வசூல் செய்ய உத்தரவிடுதல் – தொடர்பாக."
            )
            order_p1 = (
                f"{district} மாவட்டம், {taluk} வட்டம்{addr_clause} என்ற முகவரியில் {living_verb} {d_name}{iec_suffix} {defaulter_suffix} "
                f"மத்திய அரசின் சுங்கச் சட்டம் 1962 (Customs Act, 1962) பிரிவு 142(1)(c)(ii)-ன்படி அரசுக்குச் செலுத்த வேண்டிய சுங்கவரி நிலுவைத் தொகை "
                f"மற்றும் அபராதத் தொகை ரூ.{total:,.0f}/- (அசல் சுங்கவரித் தொகை ரூ.{principal:,.0f}/- + அபராதத் தொகை ரூ.{penalty:,.0f}/- + வட்டித் தொகை ரூ.{interest:,.0f}/- "
                f"– {amt_words}) மற்றும் அதற்கான உரிய வட்டியினை அரசுக்குச் செலுத்தாமல் நிலுவை வைத்துள்ளதால், மேற்படி தொகையினை தமிழ்நாடு வருவாய் வசூல் "
                f"சட்டம் 1864-ன் கீழ் நிலவரி நிலுவையைப் போல் (Arrears of Land Revenue) கருதி நிலுவையாளரிடமிருந்து முழுமையாக வசூல் செய்து ஒப்படைக்குமாறு "
                f"பார்வை 1-ல் காணும் சுங்கத்துறை அலுவலரின் கோரிக்கைக் கடிதத்தின் வாயிலாக மாவட்ட ஆட்சித் தலைவர் அலுவலகத்திற்கு தெரிவிக்கப்பட்டுள்ளது."
            )
            order_p2 = (
                f"எனவே, பார்வை 1-ல் காணும் கோரிக்கைக் கடிதம் மற்றும் பார்வை 2-ல் காணும் தீர்ப்பு ஆணையின் அடிப்படையில், மேற்படி {d_name} {defaulter_suffix} "
                f"அரசுக்குச் செலுத்த வேண்டிய மொத்த நிலுவைத் தொகை ரூ.{total:,.0f}/- ({amt_words}) மற்றும் நாளது தேதி வரையிலான உரிய வட்டியினை, "
                f"தமிழ்நாடு வருவாய் நிலை ஆணை எண் 41 (Revenue Standing Order 41) மற்றும் தமிழ்நாடு வருவாய் வசூல் சட்டம் 1864 பிரிவு 5-ன் கீழ் "
                f"நிலவரி நிலுவையைப் போல் வசூல் செய்வதற்குத் தேவையான அனைத்து சட்டபூர்வ நடவடிக்கைகளையும் உடனடியாக மேற்கொள்ள {taluk} வருவாய் "
                f"வட்டாட்சியருக்கு முழுமையான நிர்வாக மற்றும் சட்ட அதிகாரம் வழங்கி இதன் மூலம் ஆணையிடப்படுகிறது."
            )
            order_p3 = (
                f"ஆகவே, மேற்படி முகவரியில் {living_verb} {d_name} என்பாரின் {asset_clause} அரசுக்குச் சேரவேண்டிய மொத்தத் தொகை ரூ.{total:,.0f}/- "
                f"({amt_words}) மற்றும் வசூலாகும் நாள் வரையிலான உரிய வட்டி மற்றும் வசூல் கட்டணங்களை உடனடியாகப் பறிமுதல் மற்றும் ஜப்தி நடவடிக்கைகள் "
                f"மூலம் வசூல் செய்து, “சுங்கத்துறை ஆணையர் (Commissioner of Customs)“ என்ற பெயரில் தேசியமயமாக்கப்பட்ட வங்கியில் வரைவோலையாக (Demand Draft) "
                f"பெற்று இவ்வலுவலகத்திற்கு உடனடியாக அனுப்பி வைக்குமாறும், மேற்கொள்ளப்பட்ட மேல்நடவடிக்கை குறித்த முழுமையான விவர அறிக்கையினை இவ்வலுவலகத்திற்கு "
                f"தாமதமின்றி சமர்ப்பிக்குமாறும் {taluk} வருவாய் வட்டாட்சியருக்கு உத்தரவிடப்படுகிறது."
            )
        elif dept_str == "TNRERA":
            subject_text = (
                f"வருவாய் வசூல் சட்டம் 1864 – தமிழ்நாடு ரியல் எஸ்டேட் ஒழுங்குமுறை மற்றும் மேம்பாட்டுச் சட்டம் 2016 பிரிவு 40(1) – "
                f"{district} மாவட்டம் – {taluk} வட்டம் – {d_name} – நிறைவேற்று மனு உத்தரவுப்படி செலுத்த வேண்டிய அபராதத் தொகை ரூ.{total:,.0f}/- ஐ "
                f"தமிழ்நாடு வருவாய் வசூல் சட்டத்தின் கீழ் வசூல் செய்ய உத்தரவிடுதல் – தொடர்பாக."
            )
            order_p1 = (
                f"{district} மாவட்டம், {taluk} வட்டம்{addr_clause} என்ற முகவரியில் {living_verb} {d_name} {defaulter_suffix} "
                f"தமிழ்நாடு ரியல் எஸ்டேட் ஒழுங்குமுறை ஆணையத்தின் (TNRERA) சட்டபூர்வ உத்தரவு மற்றும் ரியல் எஸ்டேட் ஒழுங்குமுறை மற்றும் "
                f"மேம்பாட்டுச் சட்டம் 2016 பிரிவு 40(1)-ன் படி மனுதாரருக்குச் செலுத்த வேண்டிய இழப்பீடு மற்றும் அபராதத் தொகை ரூ.{total:,.0f}/- "
                f"({amt_words}) மற்றும் உரிய வட்டியினைச் செலுத்தத் தவறியதால், மேற்படி தொகையினை தமிழ்நாடு வருவாய் வசூல் சட்டம் 1864-ன் கீழ் "
                f"நிலவரி நிலுவையைப் போல் நிலுவையாளரிடமிருந்து உடனடியாக வசூல் செய்து ஒப்படைக்குமாறு பார்வை 1-ல் காணும் தமிழ்நாடு ரியல் எஸ்டேட் "
                f"ஒழுங்குமுறை ஆணையத்தின் நிறைவேற்று மனு உத்தரவு மற்றும் மீட்புச் சான்றிதழின் (Recovery Certificate) வாயிலாகக் கோரப்பட்டுள்ளது."
            )
            order_p2 = (
                f"மேற்படி TNRERA மீட்புச் சான்றிதழ் உத்தரவின் அடிப்படையில், நிலுவையாளர் {d_name} {defaulter_suffix} சேரவேண்டிய மொத்தத் தொகை "
                f"ரூ.{total:,.0f}/- ஐ தமிழ்நாடு வருவாய் நிலை ஆணை எண் 41 (RSO 41) மற்றும் தமிழ்நாடு வருவாய் வசூல் சட்டம் 1864 பிரிவு 5-ன் கீழ் "
                f"அரசு நிலவரி நிலுவையைப் போல் பாவித்து முழுமையாக வசூல் செய்யத் தேவையான தீவிர நடவடிக்கைகளை முன்னெடுக்க {taluk} வருவாய் "
                f"வட்டாட்சியருக்கு முழு சட்டப்பூர்வ அதிகாரம் வழங்கி இதன் மூலம் உத்தரவிடப்படுகிறது."
            )
            order_p3 = (
                f"எனவே, மேற்படி முகவரியில் {living_verb} {d_name} என்பாரின் {asset_clause} மற்றும் ரியல் எஸ்டேட் திட்ட சொத்துகளிலிருந்து மொத்தம் தொகை "
                f"ரூ.{total:,.0f}/- ({amt_words}) மற்றும் நாளது தேதி வரையிலான வட்டியினை உடனடியாக வசூல் செய்து, “மாவட்ட ஆட்சித் தலைவர், {district}“ "
                f"என்ற பெயரில் வங்கி வரைவோலையாக எடுத்து மாவட்ட ஆட்சியர் அலுவலகத்திற்கு அனுப்பி வைக்குமாறும், நிலுவை வசூலிக்கப்பட்டது குறித்த விரிவான "
                f"நடவடிக்கை அறிக்கையினை இவ்வலுவலகத்திற்குப் பதிவேற்றம் செய்யுமாறும் {taluk} வருவாய் வட்டாட்சியருக்குத் தெரிவிக்கப்படுகிறது."
            )
        elif dept_str == "MCOP":
            subject_text = (
                f"வருவாய் வசூல் சட்டம் 1864 – மோட்டார் வாகனச் சட்டம் 1988 பிரிவு 174 & படிவம் 24 – {district} மாவட்டம் – {taluk} வட்டம் – "
                f"{d_name} – விபத்து இழப்பீட்டுத் தொகை ரூ.{total:,.0f}/- மற்றும் வட்டியினை வருவாய் வசூல் சட்டத்தின் கீழ் வசூலித்து "
                f"நீதிமன்றத்தில் ஒப்படைக்க உத்தரவிடுதல் – தொடர்பாக."
            )
            order_p1 = (
                f"{district} மாவட்டம், {taluk} வட்டம்{addr_clause} என்ற முகவரியில் {living_verb} {d_name} {defaulter_suffix} "
                f"மோட்டார் வாகன விபத்து இழப்பீட்டுத் தீர்ப்பாயம் / சார்பு நீதிமன்ற வழக்கின் உத்தரவு மற்றும் மோட்டார் வாகனச் சட்டம் 1988 "
                f"பிரிவு 174 மற்றும் தமிழ்நாடு வருவாய் வசூல் சட்டம் பிரிவு 69(2) படிவம் எண் 24-ன் கீழ் வழங்கப்பட்ட மீட்புச் சான்றிதழின்படி "
                f"செலுத்த வேண்டிய விபத்து இழப்பீட்டுத் தொகை ரூ.{total:,.0f}/- (அசல் தொகை ரூ.{principal:,.0f}/- + வட்டித் தொகை ரூ.{interest:,.0f}/- "
                f"– {amt_words}) மற்றும் விபத்து நடந்த நாளிலிருந்து நாளது தேதி வரையிலான 7.5% வட்டியினைச் செலுத்தத் தவறியுள்ளதால், மேற்படி தொகையினை "
                f"வருவாய் வசூல் சட்டத்தின் கீழ் வசூலிக்க நீதிமன்றத்தால் உத்தரவிடப்பட்டுள்ளது."
            )
            order_p2 = (
                f"மேற்படி சார்பு நீதிமன்ற மீட்புக் கட்டளையின்படி, எதிர்தரப்பினர் {d_name} {defaulter_suffix} வர வேண்டிய இழப்பீட்டுத் தொகை ரூ.{total:,.0f}/- ஐ "
                f"தமிழ்நாடு வருவாய் நிலை ஆணை எண் 41 (RSO 41) மற்றும் தமிழ்நாடு வருவாய் வசூல் சட்டம் 1864 பிரிவு 5-ன் கீழ் அரசு நிலவரி நிலுவையாகக் "
                f"கருதி வசூல் செய்யத் தேவையான சட்டப்பூர்வ அதிகாரத்தினை {taluk} வருவாய் வட்டாட்சியருக்கு வழங்கி இதன் மூலம் ஆணையிடப்படுகிறது."
            )
            order_p3 = (
                f"ஆகவே, எதிர்தரப்பினருக்குச் சொந்தமான குற்ற நிகழ்வு வாகனங்கள், அசையும் மற்றும் அசையா சொத்துகளைத் தமிழ்நாடு வருவாய் வசூல் சட்ட விதிகளின்படி "
                f"உடனடியாக ஜப்தி (Attachment & Distraint) செய்து, மொத்தத் தொகை ரூ.{total:,.0f}/- ({amt_words}) மற்றும் உரிய வட்டியினை வசூலித்து, "
                f"சார்பு நீதிமன்றத்தில் ஒப்படைத்து அதற்கான ரசீது மற்றும் நடவடிக்கை அறிக்கையினை இவ்வலுவலகத்திற்கு அனுப்பி வைக்குமாறு {taluk} "
                f"வருவாய் வட்டாட்சியர் கேட்டுக்கொள்ளப்படுகிறார்."
            )
        elif dept_str == "COMMERCIAL_TAX":
            subject_text = (
                f"வருவாய் வசூல் சட்டம் 1864 – வணிகவரி மற்றும் ஜி.எஸ்.டி நிலுவை – {district} மாவட்டம் – {taluk} வட்டம் – "
                f"{d_name} – அரசுக்குச் செலுத்த வேண்டிய வணிகவரி நிலுவைத் தொகை ரூ.{total:,.0f}/- ஐ தமிழ்நாடு வருவாய் வசூல் சட்டத்தின் கீழ் "
                f"வசூல் செய்ய உத்தரவிடுதல் – தொடர்பாக."
            )
            order_p1 = (
                f"{district} மாவட்டம், {taluk} வட்டம்{addr_clause} என்ற முகவரியில் {living_verb} {d_name} {defaulter_suffix} "
                f"வணிகவரி மற்றும் சரக்கு சேவை வரி (GST) சட்ட விதிகளின்படி வணிகவரித் துறைக்குச் செலுத்த வேண்டிய வரி நிலுவை, அபராதம் "
                f"மற்றும் வட்டித் தொகை ரூ.{total:,.0f}/- (அசல் வரி ரூ.{principal:,.0f}/- + அபராதம் ரூ.{penalty:,.0f}/- – {amt_words}) "
                f"அரசுக்குச் செலுத்தப்படாமல் நீண்டகாலமாக நிலுவையில் உள்ளதால், மேற்படி தொகையினை தமிழ்நாடு வருவாய் வசூல் சட்டம் 1864-ன் கீழ் "
                f"உடனடியாக வசூல் செய்து தருமாறு வணிகவரி உதவி ஆணையரால் கோரிக்கை விடுக்கப்பட்டுள்ளது."
            )
            order_p2 = (
                f"மேற்படி வணிகவரி கோரிக்கையினை ஏற்று, நிலுவையாளர் {d_name} என்பாரிடமிருந்து நிலுவைத் தொகை ரூ.{total:,.0f}/- ஐ வருவாய் நிலை "
                f"ஆணை எண் 41 மற்றும் தமிழ்நாடு வருவாய் வசூல் சட்டம் 1864 பிரிவு 5-ன் கீழ் நிலவரி நிலுவையைப் போல் வசூலிக்க {taluk} "
                f"வருவாய் வட்டாட்சியருக்கு நிர்வாக மற்றும் சட்டப்பூர்வ அதிகாரம் வழங்கி உத்தரவிடப்படுகிறது."
            )
            order_p3 = (
                f"எனவே, நிலுவையாளரின் {asset_clause} மற்றும் வணிக வளாகச் சொத்துகளிலிருந்து மொத்தம் தொகை ரூ.{total:,.0f}/- ({amt_words}) "
                f"மற்றும் அதற்கான வட்டியினை உடனடியாக வசூல் செய்து அரசு கணக்குத் தலைப்பில் (Head of Account) செலுத்தி, செலுத்துச் சீட்டு (Challan) "
                f"மற்றும் விரிவான நடவடிக்கை விவர அறிக்கையினை இவ்வலுவலகத்திற்கு அனுப்பி வைக்குமாறு {taluk} வருவாய் வட்டாட்சியருக்கு உத்தரவிடப்படுகிறது."
            )
        elif dept_str == "EXCISE":
            subject_text = (
                f"வருவாய் வசூல் சட்டம் 1864 – தமிழ்நாடு மதுவிலக்கு மற்றும் கலால் சட்டம் 1937 – {district} மாவட்டம் – {taluk} வட்டம் – "
                f"{d_name} – கலால் தீர்வை மற்றும் அபராத நிலுவைத் தொகை ரூ.{total:,.0f}/- ஐ வருவாய் வசூல் சட்டத்தின் கீழ் வசூலிக்க "
                f"உத்தரவிடுதல் – தொடர்பாக."
            )
            order_p1 = (
                f"{district} மாவட்டம், {taluk} வட்டம்{addr_clause} என்ற முகவரியில் {living_verb} {d_name} {defaulter_suffix} "
                f"தமிழ்நாடு மதுவிலக்கு மற்றும் கலால் சட்டம் 1937-ன்படி கலால் துறைக்குச் செலுத்த வேண்டிய தீர்வைக் கட்டணம் மற்றும் அபராதத் தொகை "
                f"ரூ.{total:,.0f}/- ({amt_words}) அரசுக்குச் செலுத்தப்படாமல் நிலுவையில் உள்ளதால், அத்தொகையினை தமிழ்நாடு வருவாய் வசூல் சட்டம் "
                f"1864-ன் கீழ் வசூலிக்குமாறு உதவி ஆணையர் (கலால்) அலுவலகத்தால் கோரிக்கை விடுக்கப்பட்டுள்ளது."
            )
            order_p2 = (
                f"மேற்படி கோரிக்கையின்படி, நிலுவையாளர் {d_name} {defaulter_suffix} தொகை ரூ.{total:,.0f}/- ஐ வருவாய் நிலை ஆணை எண் 41 "
                f"மற்றும் வருவாய் வசூல் சட்டம் 1864 பிரிவு 5-ன் கீழ் வசூல் செய்வதற்குத் தேவையான அனைத்து நடவடிக்கைகளையும் முன்னெடுக்க {taluk} "
                f"வருவாய் வட்டாட்சியருக்கு முழு அதிகாரம் வழங்கி ஆணையிடப்படுகிறது."
            )
            order_p3 = (
                f"எனவே, நிலுவையாளரின் {asset_clause} அரசுக்குச் சேரவேண்டிய மொத்த நிலுவைத் தொகை ரூ.{total:,.0f}/- ({amt_words}) ஐ "
                f"உடனடியாக வசூல் செய்து கலால் துறை அரசு கணக்கில் செலுத்தி விவரத்தினை இவ்வலுவலகத்திற்கு அனுப்பி வைக்குமாறு {taluk} "
                f"வருவாய் வட்டாட்சியருக்கு உத்தரவிடப்படுகிறது."
            )
        else:
            subject_text = (
                f"தமிழ்நாடு வருவாய் வசூல் சட்டம் 1864 பிரிவு 5 – {district} மாவட்டம் – {taluk} வட்டம் – {d_name} – "
                f"அரசுக்குச் செலுத்த வேண்டிய நிலுவைத் தொகை ரூ.{total:,.0f}/- ஐ நிலவரி நிலுவையைப் போல் வசூல் செய்ய உத்தரவிடுதல் – தொடர்பாக."
            )
            order_p1 = (
                f"{district} மாவட்டம், {taluk} வட்டம்{addr_clause} என்ற முகவரியில் {living_verb} {d_name} {defaulter_suffix} "
                f"அரசுக்குச் செலுத்த வேண்டிய சட்டபூர்வ நிலுவைத் தொகை ரூ.{total:,.0f}/- (அசல் தொகை ரூ.{principal:,.0f}/- + அபராதம் ரூ.{penalty:,.0f}/- "
                f"– {amt_words}) மற்றும் உரிய வட்டியினை அரசுக்குச் செலுத்தாமல் நிலுவை வைத்துள்ளதால், மேற்படி தொகையினை தமிழ்நாடு வருவாய் வசூல் "
                f"சட்டம் 1864-ன் கீழ் நிலவரி நிலுவையைப் போல் வசூல் செய்து ஒப்படைக்குமாறு கோரப்பட்டுள்ளது."
            )
            order_p2 = (
                f"மேற்படி கோரிக்கையின் அடிப்படையில், {d_name} {defaulter_suffix} வர வேண்டிய மொத்தத் தொகை ரூ.{total:,.0f}/- ஐ "
                f"தமிழ்நாடு வருவாய் நிலை ஆணை எண் 41 (RSO 41) மற்றும் தமிழ்நாடு வருவாய் வசூல் சட்டம் 1864 பிரிவு 5-ன் கீழ் வசூல் செய்ய "
                f"{taluk} வருவாய் வட்டாட்சியருக்கு முழு நிர்வாக அதிகாரம் வழங்கி இதன் மூலம் ஆணையிடப்படுகிறது."
            )
            order_p3 = (
                f"எனவே, நிலுவையாளரின் {asset_clause} மேற்படி தொகையினை ரூ.{total:,.0f}/- ({amt_words}) உடனடியாக வசூல் செய்து "
                f"அரசு கணக்கில் செலுத்தி, மேற்கொள்ளப்பட்ட நடவடிக்கை குறித்த விரிவான அறிக்கையினை இவ்வலுவலகத்திற்குத் தாமதமின்றி சமர்ப்பிக்குமாறு "
                f"{taluk} வருவாய் வட்டாட்சியருக்கு உத்தரவிடப்படுகிறது."
            )

        # Defaulter complete recipient address block
        addr_lines = [f"{d_name},"]
        if door_no and street_loc:
            addr_lines.append(f"கதவு எண். {door_no}, {street_loc},")
        elif street_loc:
            addr_lines.append(f"{street_loc},")
        elif door_no:
            addr_lines.append(f"கதவு எண். {door_no},")

        pin_suffix = f" – {pincode}" if pincode else ""
        addr_lines.append(f"{taluk} வட்டம்,")
        addr_lines.append(f"{district} மாவட்டம்{pin_suffix}.")
        defaulter_address_block = "\n".join(addr_lines)

        # Dynamic Issuing Authority / Dispatch Recipient
        issuing_auth_recipient = (pay.get("dispatch_address") or "").strip()
        if not issuing_auth_recipient or len(issuing_auth_recipient) < 5:
            auth_name = ref.get("issuing_authority_name") or spec.issuing_authority_default
            if dept_str == "CUSTOMS":
                issuing_auth_recipient = (
                    "உதவி சுங்க ஆணையர் (ARC),\n"
                    "சுங்கத்துறை ஆணையரகம் (சென்னை IV),\n"
                    "கஸ்டம் ஹவுஸ், எண். 60, ராஜாஜி சாலை,\n"
                    "சென்னை - 600 001."
                )
            elif dept_str == "TNRERA":
                issuing_auth_recipient = (
                    "சட்ட அலுவலர் / அதிகாரமளிக்கப்பட்ட அலுவலர்,\n"
                    "தமிழ்நாடு ரியல் எஸ்டேட் ஒழுங்குமுறை ஆணையம் (TNRERA),\n"
                    "எண்.1A, 1-வது தளம், காந்தி இர்வின் பாலம் ரோடு, எழும்பூர்,\n"
                    "சென்னை - 600 008."
                )
            elif auth_name:
                issuing_auth_recipient = f"{auth_name},\n{district}."
            else:
                issuing_auth_recipient = f"{spec.title_ta},\n{district}."

        # Tracking and File Numbers
        current_year = str(datetime.now().year)
        file_no = str(data.get("file_no") or ref.get("case_or_file_no") or current_year)
        file_year = str(data.get("file_year") or current_year)
        section_code = str(data.get("section_code") or spec.section_code_default)
        roc_number = data.get("roc_number") or f"ந.க. {file_no}/{file_year}/{section_code}"
        proceedings_date = data.get("proceedings_date") or datetime.now().strftime(".%m.%Y")

        dist_info = SUPPORTED_DISTRICTS.get(district, {})
        collector_heading = dist_info.get("collector_heading") or f"{district} மாவட்ட ஆட்சித் தலைவர் மற்றும்\nமாவட்ட நிர்வாக நடுவர் அவர்களின் செயல்முறைகள்"
        collector_name = data.get("collector_name") or "முனைவர் ராஜ கோபால் சுன்கரா, இ.ஆ.ப."

        # Payment defaults
        dd_favour = pay.get("dd_favour_of") or spec.issuing_authority_default
        head_of_acc = pay.get("head_of_account") or spec.head_of_account_default
        dispatch_addr = pay.get("dispatch_address") or issuing_auth_recipient

        context = {
            "department_type": dept_str,
            "entity_type": ent_str,
            "collector_name": collector_name,
            "collector_heading": collector_heading,
            "file_no": file_no,
            "file_year": file_year,
            "section_code": section_code,
            "roc_number": roc_number,
            "proceedings_date": proceedings_date,
            "district_name": district,
            "taluk_name": taluk,
            "tahsildar_recipient": tahsildar_title,
            "rdo_recipient": rdo_title,
            "issuing_authority_recipient": issuing_auth_recipient,
            "defaulter_name": d_name,
            "defaulter_address_block": defaulter_address_block,
            "iec_no": iec,
            "door_no": door_no,
            "street_and_locality": street_loc,
            "pincode": pincode,
            "living_verb": living_verb,
            "defaulter_suffix": defaulter_suffix,
            "asset_clause": asset_clause,
            "principal_amount": f"{principal:,.0f}",
            "penalty_amount": f"{penalty:,.0f}",
            "interest_amount": f"{interest:,.0f}",
            "total_amount": f"{total:,.0f}",
            "amount_in_tamil_words": amt_words,
            "issuing_authority_name": ref.get("issuing_authority_name", ""),
            "case_file_no": ref.get("case_or_file_no", ""),
            "order_in_original_no": ref.get("ia_or_mp_no", ""),
            "order_date": ref.get("order_date", ""),
            "letter_date": ref.get("letter_date", ""),
            "dd_favour_of": dd_favour,
            "head_of_account": head_of_acc,
            "dispatch_address": dispatch_addr,
            "references": references_list,
            "references_list": references_list,
            "reference_text": reference_text,
            "subject_text": subject_text,
            "order_para1": order_p1,
            "order_para2": order_p2,
            "order_para3": order_p3,
            "enclosure_text": spec.default_enclosure,
            "defaulter_details": defaulters,
            "sureties": sureties,
            "financials": fin,
            "reference_details": ref,
            "payment_instructions": pay,
        }
        return context

    def generate_docx(
        self,
        entities: ExtractedLegalEntities,
        custom_filename: Optional[str] = None,
        doc_type: str = "PROCEEDINGS"
    ) -> Path:
        """
        Renders validated entities into an official Word .docx file with TAU-Marutham font.
        Supports:
        - 'PROCEEDINGS' (செயல்முறைகள் - Collector & District Magistrate Proceedings)
        - 'MEMORANDUM' (குறிப்பாணை - Collectorate Memorandum)
        - 'NOTE' (அலுவலகக் குறிப்பு - Office Note)
        - 'WARRANT' (ஜப்தி மற்றும் கைது வாரண்ட் ஆணை - Judicial Welfare Warrant)
        """
        context = self.prepare_context(entities)
        dept = str(context["department_type"]).lower()
        doc_type_upper = doc_type.upper()

        if doc_type_upper in ["PROCEEDINGS", "ORDER"]:
            candidates = [
                f"template_{dept}_proceedings.docx",
                "template_proceedings.docx",
                "proceedings_template.docx"
            ]
        elif doc_type_upper in ["NOTE"]:
            candidates = ["template_note.docx", "template_memorandum.docx"]
        elif doc_type_upper in ["WARRANT"]:
            candidates = ["template_warrant.docx", "template_memorandum.docx"]
        else:  # MEMORANDUM / DEFAULT
            candidates = [
                f"template_{dept}_memorandum.docx",
                "template_memorandum.docx",
                f"template_{dept}.docx",
                "template_customs.docx"
            ]

        template_path = None
        for c in candidates:
            p = self.templates_dir / c
            if p.exists():
                template_path = p
                break

        if not template_path:
            template_path = self.templates_dir / "template_proceedings.docx"
            if not template_path.exists():
                template_path = self.templates_dir / "proceedings_template.docx"

        doc = DocxTemplate(str(template_path))
        doc.render(context)
        enforce_document_font(doc.docx)

        if doc_type_upper in ["PROCEEDINGS", "ORDER"]:
            doc_prefix = "Proceedings"
        elif doc_type_upper in ["NOTE"]:
            doc_prefix = "Note"
        elif doc_type_upper in ["WARRANT"]:
            doc_prefix = "Warrant"
        else:
            doc_prefix = "Memorandum"

        filename = custom_filename or f"{doc_prefix}_{context['department_type']}_{context['file_no']}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.docx"
        target_path = self.output_dir / filename
        doc.save(str(target_path))
        logger.info(f"DOCX {doc_prefix} successfully synthesized at: {target_path}")
        return target_path

    def generate_proceedings_docx(self, entities: ExtractedLegalEntities, custom_filename: Optional[str] = None) -> Path:
        """Explicitly generates the செயல்முறைகள் (Proceedings) DOCX."""
        return self.generate_docx(entities, custom_filename=custom_filename, doc_type="PROCEEDINGS")

    def generate_memorandum_docx(self, entities: ExtractedLegalEntities, custom_filename: Optional[str] = None) -> Path:
        """Explicitly generates the குறிப்பாணை (Memorandum) DOCX."""
        return self.generate_docx(entities, custom_filename=custom_filename, doc_type="MEMORANDUM")

    def generate_note_docx(self, entities: ExtractedLegalEntities, custom_filename: Optional[str] = None) -> Path:
        """Explicitly generates the அலுவலகக் குறிப்பு (Office Note) DOCX."""
        return self.generate_docx(entities, custom_filename=custom_filename, doc_type="NOTE")

    def generate_warrant_docx(self, entities: ExtractedLegalEntities, custom_filename: Optional[str] = None) -> Path:
        """Explicitly generates the ஜப்தி மற்றும் கைது வாரண்ட் ஆணை (Warrant) DOCX."""
        return self.generate_docx(entities, custom_filename=custom_filename, doc_type="WARRANT")

    def generate_three_files(self, entities: ExtractedLegalEntities) -> Dict[str, Path]:
        """Generates the three official administrative files in sequence: Proceedings, Memorandum, and Office Note."""
        return {
            "proceedings": self.generate_proceedings_docx(entities),
            "memorandum": self.generate_memorandum_docx(entities),
            "note": self.generate_note_docx(entities),
        }

    def generate_all_four_files(self, entities: ExtractedLegalEntities) -> Dict[str, Path]:
        """Generates all four official administrative and judicial files in sequence."""
        return {
            "proceedings": self.generate_proceedings_docx(entities),
            "memorandum": self.generate_memorandum_docx(entities),
            "note": self.generate_note_docx(entities),
            "warrant": self.generate_warrant_docx(entities),
        }
