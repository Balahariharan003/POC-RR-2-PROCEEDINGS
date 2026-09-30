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

        context = {
            "department_type": data.get("department_type", "CUSTOMS"),
            "collector_name": data.get("collector_name", "திரு.ச.கந்தசாமி, இ.ஆ.ப."),
            "collector_heading": f"{data.get('district_name', 'ஈரோடு')} மாவட்ட ஆட்சித் தலைவர் மற்றும்\nமாவட்ட நிர்வாக நடுவர் அவர்களின் செயல்முறைகள்",
            "file_no": data.get("file_no", "1248"),
            "file_year": data.get("file_year", "2026"),
            "section_code": data.get("section_code", "ஈ2"),
            "roc_number": data.get("roc_number") or f"ந.க. {data.get('file_no', '1248')}/{data.get('file_year', '2026')}/{data.get('section_code', 'ஈ2')}",
            "proceedings_date": data.get("proceedings_date") or datetime.now().strftime("%d.%m.%Y"),
            "district_name": data.get("district_name", "ஈரோடு"),
            "taluk_name": data.get("taluk_name", "ஈரோடு"),
            "tahsildar_recipient": data.get("assigned_tahsildar") or f"வருவாய் வட்டாட்சியர், {data.get('taluk_name', 'ஈரோடு')}.",
            "rdo_recipient": f"வருவாய் கோட்டாட்சியர், {data.get('district_name', 'ஈரோடு')}.",
            "defaulter_name": first_d.get("name", "M/s Prisma Garments"),
            "iec_no": first_d.get("iec_number") or "",
            "door_no": first_d.get("door_no", "46"),
            "street_and_locality": first_d.get("street_and_locality", ""),
            "pincode": first_d.get("pincode", "638009"),
            "living_verb": living_verb,
            "defaulter_suffix": defaulter_suffix,
            "asset_clause": asset_clause,
            "principal_amount": f"{principal:,.0f}",
            "penalty_amount": f"{penalty:,.0f}",
            "total_amount": f"{total:,.0f}",
            "amount_in_tamil_words": fin.get("amount_in_words_tamil", ""),
            "issuing_authority_name": ref.get("issuing_authority_name", ""),
            "case_file_no": ref.get("case_or_file_no", ""),
            "order_in_original_no": ref.get("ia_or_mp_no", ""),
            "order_date": ref.get("order_date", ""),
            "letter_date": ref.get("letter_date", ""),
            "dd_favour_of": pay.get("dd_favour_of", "Commissioner of Customs, Export Commissionerate (Chennai IV)"),
            "head_of_account": pay.get("head_of_account", "037 – Customs"),
            "dispatch_address": pay.get("dispatch_address", "Custom House, 60, Rajaji Salai, Chennai- 600 001."),
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
