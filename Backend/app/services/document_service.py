"""
Document Service: Enterprise Word (.docx) Generation Engine.
Strictly renders legal entities into Tamil Nadu Government Proceedings templates with:
- Pure TAU-Marutham font enforcement across Latin, Complex-Script, and EastAsian XML declarations.
- Dynamic Jinja2 context mapping via DocxTemplate.
- Automatic living verb ("இயங்கி வரும்" vs "வசித்து வரும்") and suffix selection.
"""

from pathlib import Path
from datetime import datetime
from typing import Dict, Any, Optional
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.oxml import parse_xml
from docx.oxml.ns import nsdecls, qn
from docxtpl import DocxTemplate

from app.core.config import settings
from app.core.logging import logger
from app.domain.schemas.legal_entities import ExtractedLegalEntities


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


class DocumentService:
    def __init__(self, templates_dir: Optional[Path] = None, output_dir: Optional[Path] = None):
        self.templates_dir = templates_dir or settings.TEMPLATE_DIR
        self.output_dir = output_dir or settings.OUTPUT_DIR
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def prepare_context(self, entities: ExtractedLegalEntities) -> Dict[str, Any]:
        """Normalizes and prepares full Jinja2 context payload from extracted entities."""
        data = entities.model_dump()
        defaulters = data.get("defaulter_details", [])
        first_d = defaulters[0] if defaulters else {}
        fin = data.get("financials", {})
        ref = data.get("reference_details", {})
        pay = data.get("payment_instructions", {})

        is_company = data.get("entity_type") == "COMPANY"
        living_verb = "இயங்கி வரும்" if is_company else "வசித்து வரும்"
        defaulter_suffix = "நிறுவனத்திடமிருந்து" if is_company else "என்பவரிடமிருந்து"
        asset_clause = "அசையும் மற்றும் அசையா சொத்துகளிலிருந்து மற்றும் வங்கிக் கணக்குகளிலிருந்து" if is_company else "அசையும் மற்றும் அசையா சொத்துகளிலிருந்து"

        principal = fin.get("principal_amount", 0.0)
        penalty = fin.get("penalty_amount", 0.0)
        total = fin.get("total_recoverable_amount", 0.0)

        # Dynamic multi-reference resolution
        raw_refs = ref.get("references_list") or data.get("references") or []
        references_list = []
        if isinstance(raw_refs, list) and len(raw_refs) > 0:
            import re
            for r_item in raw_refs:
                cleaned = re.sub(r'^\d+[\.\)]\s*', '', str(r_item).strip())
                if cleaned:
                    references_list.append(cleaned)

        if not references_list:
            issuing_auth = ref.get("issuing_authority_name", "")
            case_no = ref.get("case_or_file_no", "")
            oio_no = ref.get("ia_or_mp_no", "")
            o_date = ref.get("order_date", "")
            l_date = ref.get("letter_date", "") or o_date
            dept_type = data.get("department_type", "CUSTOMS")

            if dept_type == "CUSTOMS":
                if issuing_auth or case_no:
                    references_list.append(f"{issuing_auth or 'உதவி ஆணையர் (ஏற்றுமதி), சுங்கத்துறை ஆணையரகம் (சென்னை IV)'}, கடித F.NO. {case_no}, நாள் {l_date}.")
                if oio_no:
                    references_list.append(f"Order in Original No. {oio_no}, நாள் {o_date}.")
                references_list.append("வருவாய் நிலை ஆணை எண் 41 மற்றும் தமிழ்நாடு வருவாய் வசூல் சட்டம் 1864 பிரிவு 5.")
            elif dept_type == "TNRERA":
                if issuing_auth or case_no:
                    references_list.append(f"{issuing_auth or 'தமிழ்நாடு ரியல் எஸ்டேட் ஒழுங்குமுறை ஆணையம் (TNRERA)'}, கடித எண். {case_no}, நாள் {l_date}.")
                if oio_no:
                    references_list.append(f"TNRERA ஆணை எண். {oio_no}, நாள் {o_date}.")
                references_list.append("தமிழ்நாடு வருவாய் வசூல் சட்டம் 1864 பிரிவு 5.")
            elif dept_type == "MCOP":
                if issuing_auth or case_no:
                    references_list.append(f"{issuing_auth or 'மோட்டார் வாகன விபத்து இழப்பீட்டு தீர்ப்பாயம்'}, {case_no}, உத்தரவு, நாள் {o_date}.")
                references_list.append("வருவாய் நிலை ஆணை எண் 41 (RSO 41).")
            else:
                if issuing_auth or case_no:
                    references_list.append(f"{issuing_auth}, கடித ந.க. எண் {case_no}, நாள் {l_date}.")
                references_list.append("தமிழ்நாடு வருவாய் வசூல் சட்டம் 1864 பிரிவு 5.")

        formatted_numbered_refs = [f"{i + 1}. {item}" for i, item in enumerate(references_list)]
        reference_text = "\n".join(formatted_numbered_refs) if formatted_numbered_refs else "—"

        district = data.get("district_name", "ஈரோடு")
        taluk = data.get("taluk_name", "ஈரோடு")
        d_name = first_d.get("name", "M/s Prisma Garments")
        door_no = first_d.get("door_no", "46")
        street_loc = first_d.get("street_and_locality", "")
        iec = first_d.get("iec_number") or ""
        amt_words = fin.get("amount_in_words_tamil", "")

        dept = str(data.get("department_type", "CUSTOMS"))
        if dept == "CUSTOMS":
            subject_text = f"வருவாய் வசூல் சட்டம் 1864 – சுங்கச் சட்டம் 1962 பிரிவு 142(1)(c)(i) – {district} மாவட்டம் – {taluk} வட்டம் - {d_name}, {'(IEC No: ' + iec + ')' if iec else ''} {door_no}, {street_loc}, {taluk} – அரசுக்குச் செலுத்த வேண்டிய நிலுவைத் தொகை வசூல் செய்யக் கோருதல் - உத்திரவிடுதல்."
            order_p1 = f"{district} மாவட்டம், {taluk} வட்டம், {street_loc}, {door_no}, என்ற முகவரியில் {living_verb} {d_name} {'(IEC No: ' + iec + ')' if iec else ''} {defaulter_suffix} சுங்கச் சட்டம் 1962-ன்படி அரசுக்குச் செலுத்த வேண்டிய நிலுவைத் தொகை ரூ.{total:,.0f}/- (அசல் ரூ.{principal:,.0f}/- + அபராதம் ரூ.{penalty:,.0f}/-) மற்றும் வட்டியினை தமிழ்நாடு வருவாய் வசூல் சட்டத்தின் கீழ் வசூல் செய்யுமாறு பார்வையில் காணும் உத்தரவின் வாயிலாக தெரிவிக்கப்பட்டுள்ளது."
            order_p2 = f"மேற்படி {d_name} {defaulter_suffix} தொகை ரூ.{total:,.0f}/- ஐ வருவாய் நிலை ஆணை எண் 41 மற்றும் தமிழ்நாடு வருவாய் வசூல் சட்டம் 1864 பிரிவு 5-ன் கீழ் வசூல் செய்ய {taluk} வருவாய் வட்டாட்சியருக்கு அதிகாரம் வழங்கி இதன் மூலம் உத்திரவிடப்படுகிறது."
            order_p3 = f"எனவே, மேற்படி முகவரியில் {living_verb} {d_name} என்பாரின் {asset_clause} மொத்தம் தொகை ரூ.{total:,.0f}/- ({amt_words}) மற்றும் உரிய வட்டியினை வசூல் செய்து “{pay.get('dd_favour_of', 'Commissioner of Customs')}“ என்ற பெயரில் வங்கி வரைவோலையாக எடுத்து இவ்வலுவலகத்திற்கு அனுப்பி வைக்குமாறு {taluk} வருவாய் வட்டாட்சியருக்கு தெரிவிக்கப்படுகிறது."
        else:
            subject_text = f"தமிழ்நாடு வருவாய் வசூல் சட்டம் 1864 பிரிவு 5 – {district} மாவட்டம் – {taluk} வட்டம் - {d_name} – நிலுவைத் தொகை ரூ.{total:,.0f}/- வசூல் செய்யக் கோருதல் - உத்திரவிடுதல்."
            order_p1 = f"{district} மாவட்டம், {taluk} வட்டம், {street_loc}, {door_no}, என்ற முகவரியில் {living_verb} {d_name} {defaulter_suffix} அரசுக்குச் செலுத்த வேண்டிய நிலுவைத் தொகை ரூ.{total:,.0f}/- ஐ தமிழ்நாடு வருவாய் வசூல் சட்டத்தின் கீழ் வசூல் செய்யுமாறு பார்வையில் காணும் உத்தரவின் வாயிலாக தெரிவிக்கப்பட்டுள்ளது."
            order_p2 = f"மேற்படி {d_name} {defaulter_suffix} தொகை ரூ.{total:,.0f}/- ஐ வருவாய் நிலை ஆணை எண் 41 மற்றும் வருவாய் வசூல் சட்டம் 1864 பிரிவு 5-ன் கீழ் வசூல் செய்ய {taluk} வருவாய் வட்டாட்சியருக்கு அதிகாரம் வழங்கி இதன் மூலம் உத்திரவிடப்படுகிறது."
            order_p3 = f"எனவே, எதிர்தரப்பினரின் {asset_clause} மேற்படி தொகையினை உடனடியாக வசூல் செய்து அரசு கணக்கில் செலுத்தி விவரத்தினை இவ்வலுவலகத்திற்கு அனுப்பி வைக்குமாறு {taluk} வருவாய் வட்டாட்சியருக்கு தெரிவிக்கப்படுகிறது."

        context = {
            "department_type": dept,
            "collector_name": data.get("collector_name", "திரு.ச.கந்தசாமி, இ.ஆ.ப."),
            "collector_heading": f"{district} மாவட்ட ஆட்சித் தலைவர் மற்றும்\nமாவட்ட நிர்வாக நடுவர் அவர்களின் செயல்முறைகள்",
            "file_no": data.get("file_no", "1248"),
            "file_year": data.get("file_year", "2026"),
            "section_code": data.get("section_code", "ஈ2"),
            "roc_number": data.get("roc_number") or f"ந.க. {data.get('file_no', '1248')}/{data.get('file_year', '2026')}/{data.get('section_code', 'ஈ2')}",
            "proceedings_date": data.get("proceedings_date") or datetime.now().strftime("%d.%m.%Y"),
            "district_name": district,
            "taluk_name": taluk,
            "tahsildar_recipient": data.get("assigned_tahsildar") or f"வருவாய் வட்டாட்சியர், {taluk}.",
            "rdo_recipient": f"வருவாய் கோட்டாட்சியர், {district}.",
            "defaulter_name": d_name,
            "iec_no": iec,
            "door_no": door_no,
            "street_and_locality": street_loc,
            "pincode": first_d.get("pincode", "638009"),
            "living_verb": living_verb,
            "defaulter_suffix": defaulter_suffix,
            "asset_clause": asset_clause,
            "principal_amount": f"{principal:,.0f}",
            "penalty_amount": f"{penalty:,.0f}",
            "total_amount": f"{total:,.0f}",
            "amount_in_tamil_words": amt_words,
            "issuing_authority_name": ref.get("issuing_authority_name", ""),
            "case_file_no": ref.get("case_or_file_no", ""),
            "order_in_original_no": ref.get("ia_or_mp_no", ""),
            "order_date": ref.get("order_date", ""),
            "letter_date": ref.get("letter_date", ""),
            "dd_favour_of": pay.get("dd_favour_of", "Commissioner of Customs, Export Commissionerate (Chennai IV)"),
            "head_of_account": pay.get("head_of_account", "037 – Customs"),
            "dispatch_address": pay.get("dispatch_address", "Custom House, 60, Rajaji Salai, Chennai- 600 001."),
            "references": references_list,
            "references_list": references_list,
            "reference_text": reference_text,
            "subject_text": subject_text,
            "order_para1": order_p1,
            "order_para2": order_p2,
            "order_para3": order_p3,
            "enclosure_text": "கடித நகல்",
            "defaulter_details": defaulters,
            "financials": fin,
            "reference_details": ref,
            "payment_instructions": pay,
        }
        return context


    def generate_docx(self, entities: ExtractedLegalEntities, custom_filename: Optional[str] = None) -> Path:
        """Renders validated entities into a production Word .docx file with TAU-Marutham font."""
        context = self.prepare_context(entities)
        
        dept = str(entities.department_type.value).lower()
        template_name = f"template_{dept}.docx" if (self.templates_dir / f"template_{dept}.docx").exists() else "template_customs.docx"
        template_path = self.templates_dir / template_name

        if not template_path.exists():
            # Fall back to master proceedings template
            template_path = self.templates_dir / "proceedings_template.docx"

        doc = DocxTemplate(str(template_path))
        doc.render(context)
        enforce_document_font(doc.docx)

        filename = custom_filename or f"Proceedings_{context['department_type']}_{context['file_no']}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.docx"
        target_path = self.output_dir / filename
        doc.save(str(target_path))
        logger.info(f"DOCX Proceedings successfully synthesized at: {target_path}")
        return target_path
