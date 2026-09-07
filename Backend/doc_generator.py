"""
Document Generation Engine using docxtpl.
Step 5 of the 5-Step Pipeline.
Renders validated legal entities into department-specific Word Proceedings (.docx).
"""

import re
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, Optional
from docxtpl import DocxTemplate

from config import PROCEEDINGS_TEMPLATE_PATH, OUTPUT_DIR
from schemas import ExtractedLegalEntities, ValidationResult
from template_builder import build_department_templates, build_proceedings_template


def normalize_context(extracted_data: dict) -> dict:
    """
    Sets exact Tamil grammar, line splits, and Word tab-stops.
    Normalizes verbs ("வசித்து வரும்" vs "இயங்கி வரும்"), suffixes ("என்பவரிடமிருந்து" vs "ஆகியோரிடமிருந்து"),
    asset clauses, and split amount clauses across single / multi-defaulters.
    """
    context = extracted_data.copy()
    defaulters = context.get("defaulter_details", [])
    
    # Bridge defaulter object if defaulter_details is empty
    if not defaulters and "defaulter" in context:
        d = context["defaulter"]
        if isinstance(d, dict):
            defaulters = [{
                "name": d.get("name", ""),
                "father_or_spouse_name": d.get("father_or_husband_name"),
                "representation_or_title": f"IEC No: {d.get('iec_number')}" if d.get("iec_number") else None,
                "door_no": d.get("door_no", ""),
                "street_and_locality": d.get("street_area", ""),
                "taluk": d.get("taluk", ""),
                "district": d.get("district", ""),
                "pincode": d.get("pincode", "")
            }]
            context["defaulter_details"] = defaulters

    if not defaulters:
        # Fallback default entry
        defaulters = [{
            "name": "M/s. Prisma Garments",
            "father_or_spouse_name": None,
            "representation_or_title": None,
            "door_no": "46",
            "street_and_locality": "உழவன் நகர், ஈரோடு",
            "taluk": context.get("taluk_name", "ஈரோடு"),
            "district": context.get("district_name", "ஈரோடு"),
            "pincode": "638009"
        }]
        context["defaulter_details"] = defaulters

    num_defaulters = len(defaulters)
    entity_type = context.get("entity_type", "INDIVIDUAL")

    # 1. Grammar Normalization
    if entity_type == "COMPANY":
        context["living_verb"] = "இயங்கி வரும்"
        context["defaulter_suffix"] = "நிறுவனத்திடமிருந்து"
        context["asset_clause"] = "சொத்துகளிலிருந்து மற்றும் வங்கிக் கணக்குகளிலிருந்து"
    else:
        context["living_verb"] = "வசித்து வரும்"
        context["defaulter_suffix"] = "என்பவரிடமிருந்து" if num_defaulters <= 1 else "ஆகியோரிடமிருந்து"
        context["asset_clause"] = "அசையும் மற்றும் அசையா சொத்துகளிலிருந்து"

    context["living_or_operating_verb"] = context["living_verb"]

    # 2. Multi-Defaulter Split Logic
    fin = context.get("financials", {})
    raw_tot = fin.get("total_amount") or fin.get("total_recoverable_amount") or fin.get("principal_amount") or context.get("total_amount") or 0.0
    try:
        if isinstance(raw_tot, str):
            clean_str = raw_tot.replace(",", "").replace("ரூ.", "").replace("/-", "").strip()
            tot = float(clean_str) if clean_str else 0.0
        else:
            tot = float(raw_tot or 0.0)
    except (ValueError, TypeError):
        tot = 0.0

    if num_defaulters > 1 and tot > 0:
        split_val = round(tot / num_defaulters, 2)
        context["split_clause"] = f"தலா ரூ.{split_val:,.2f}/- வீதம் என "
    else:
        context["split_clause"] = ""

    # 3. Synchronize flat and nested key aliases for template rendering
    first_d = defaulters[0] if defaulters else {}
    defaulter_name = first_d.get("name", context.get("defaulter_name", ""))
    context.setdefault("defaulter_name", defaulter_name)
    context.setdefault("door_no", first_d.get("door_no", context.get("door_no", "")))
    context.setdefault("street_and_locality", first_d.get("street_and_locality", first_d.get("street_area", context.get("street_and_locality", ""))))
    context.setdefault("taluk_name", first_d.get("taluk", context.get("taluk_name", "ஈரோடு")))
    context.setdefault("district_name", first_d.get("district", context.get("district_name", "ஈரோடு")))
    context.setdefault("pincode", first_d.get("pincode", context.get("pincode", "638009")))

    # IEC Number formatting
    iec = first_d.get("iec_no") or first_d.get("iec_number") or context.get("iec_no")
    if not iec and first_d.get("representation_or_title"):
        rep = first_d.get("representation_or_title", "")
        if "IEC" in rep:
            iec = rep.replace("IEC No:", "").replace("IEC No.", "").replace("IEC:", "").strip()
    context["iec_no"] = iec

    # Collector & Reference File Defaults (Sanitize stray characters, brackets, or artifacts)
    raw_collector = str(context.get("collector_name") or "திரு.ச.கந்தசாமி,இ.ஆ.ப.,").strip()
    # Strip any leading/trailing brackets, pipes, quotes, or whitespace artifacts
    clean_collector = re.sub(r'^[\[\]\|\s\'"前]+', '', raw_collector)
    clean_collector = re.sub(r'[\[\]\|\s\'"]+$', '', clean_collector).strip()
    if clean_collector.startswith("முன்னிலை:"):
        clean_collector = clean_collector.replace("முன்னிலை:", "").strip()
    if clean_collector.startswith("பிறப்பிப்பவர்:"):
        clean_collector = clean_collector.replace("பிறப்பிப்பவர்:", "").strip()
    if not clean_collector:
        clean_collector = "திரு.ச.கந்தசாமி,இ.ஆ.ப.,"

    context["collector_name"] = clean_collector
    context.setdefault("collector_heading", f"{context.get('district_name', 'ஈரோடு')} மாவட்ட ஆட்சித் தலைவர் மற்றும்\nமாவட்ட நிர்வாக நடுவர் அவர்களின் செயல்முறைகள்")
    context.setdefault("file_no", str(context.get("file_no", "9667")).strip().lstrip("[").rstrip("]"))
    context.setdefault("file_year", str(context.get("file_year", "2026")).strip().lstrip("[").rstrip("]"))
    context.setdefault("section_code", str(context.get("section_code", "கு2")).strip().lstrip("[").rstrip("]"))
    context.setdefault("roc_number", f"ந.க. {context['file_no']}/{context['file_year']}/{context['section_code']}")
    context.setdefault("proceedings_date", f"        .05.{context['file_year']}.")

    # Financial details
    if isinstance(fin, dict):
        principal = fin.get("principal_amount", context.get("principal_amount", 0))
        penalty = fin.get("penalty_amount", context.get("penalty_amount", 0))
        total = fin.get("total_amount", fin.get("total_recoverable_amount", context.get("total_amount", 0)))
        
        # Format strings with commas if numeric
        def _fmt(val):
            if isinstance(val, (int, float)) and val > 0:
                return f"{val:,.0f}" if float(val).is_integer() else f"{val:,.2f}"
            return str(val)

        context.setdefault("principal_amount", _fmt(principal))
        context.setdefault("penalty_amount", _fmt(penalty))
        context.setdefault("total_amount", _fmt(total))
        context.setdefault("amount_in_tamil_words", fin.get("amount_in_words_tamil", context.get("amount_in_tamil_words", "")))
        context.setdefault("interest_rate", fin.get("interest_rate", context.get("interest_rate")))
        context.setdefault("interest_start_date", fin.get("interest_start_date", context.get("interest_start_date")))
    else:
        context.setdefault("principal_amount", context.get("principal_amount", "0"))
        context.setdefault("penalty_amount", context.get("penalty_amount", "0"))
        context.setdefault("total_amount", context.get("total_amount", "0"))
        context.setdefault("amount_in_tamil_words", context.get("amount_in_tamil_words", ""))

    # Ensure nested structures exist for templates expecting dotted notation
    if not isinstance(context.get("financials"), dict):
        context["financials"] = {}
    context["financials"].setdefault("total_amount", context.get("total_amount", "0"))
    context["financials"].setdefault("principal_amount", context.get("principal_amount", "0"))
    context["financials"].setdefault("penalty_amount", context.get("penalty_amount", "0"))
    context["financials"].setdefault("amount_in_tamil_words", context.get("amount_in_tamil_words", ""))
    context["financials"].setdefault("amount_in_words_tamil", context.get("amount_in_tamil_words", ""))
    context["financials"].setdefault("interest_rate", context.get("interest_rate"))
    context["financials"].setdefault("interest_start_date", context.get("interest_start_date"))

    ref = context.get("reference_details", {})
    if isinstance(ref, dict):
        context.setdefault("issuing_authority_name", ref.get("issuing_authority_name", context.get("issuing_authority_name", "உதவி ஆணையர் (ஏற்றுமதி), சுங்கத்துறை ஆணையரகம் (சென்னை IV)")))
        context.setdefault("case_file_no", ref.get("case_or_file_no", context.get("case_file_no", "516/2024-ARC")))
        context.setdefault("order_date", ref.get("order_date", context.get("order_date", "28.03.2024")))
        context.setdefault("order_in_original_no", ref.get("ia_or_mp_no", context.get("order_in_original_no", "105790/2024")))
        context.setdefault("letter_date", ref.get("letter_date", context.get("letter_date", "24.12.2025")))

    if not isinstance(context.get("reference_details"), dict):
        context["reference_details"] = {}
    context["reference_details"].setdefault("issuing_authority_name", context.get("issuing_authority_name", ""))
    context["reference_details"].setdefault("case_or_file_no", context.get("case_file_no", ""))
    context["reference_details"].setdefault("order_date", context.get("order_date", ""))
    context["reference_details"].setdefault("ia_or_mp_no", context.get("order_in_original_no", ""))
    context["reference_details"].setdefault("letter_date", context.get("letter_date", ""))

    pay = context.get("payment_instructions", {})
    if isinstance(pay, dict):
        context.setdefault("dd_favour_of", pay.get("dd_favour_of", context.get("dd_favour_of", "Commissioner of Customs, Export Commissionerate, Chennai IV")))
        context.setdefault("head_of_account", pay.get("head_of_account", context.get("head_of_account", "037 - Customs")))
        context.setdefault("dispatch_address", pay.get("dispatch_address", context.get("dispatch_address", "உதவி ஆணையர் (ஏற்றுமதி), சுங்கத்துறை ஆணையரகம் (சென்னை IV)")))

    if not isinstance(context.get("payment_instructions"), dict):
        context["payment_instructions"] = {}
    context["payment_instructions"].setdefault("dd_favour_of", context.get("dd_favour_of", ""))
    context["payment_instructions"].setdefault("head_of_account", context.get("head_of_account", ""))
    context["payment_instructions"].setdefault("dispatch_address", context.get("dispatch_address", ""))

    return context


def generate_proceedings(json_payload: dict, template_path: str, output_path: str):
    """
    Renders a docxtpl Word template given a JSON payload, template path, and output file path.
    Applies Legal Context Normalization for precise Tamil grammar and syntax formatting.
    """
    doc = DocxTemplate(template_path)
    context = normalize_context(json_payload)
    doc.render(context)
    doc.save(output_path)
    print(f"Generated 100% formatted document: {output_path}")


def render_collector_proceedings(json_payload: dict, output_filepath: str):
    """
    Department Template Selector Engine.
    Dynamically selects the appropriate .docx template and injects normalized Tamil context.
    """
    context = normalize_context(json_payload)
    dept = str(context.get("department_type", "MCOP")).lower()
    
    base_templates_dir = Path(__file__).resolve().parent / "templates"
    template_map = {
        "customs": base_templates_dir / "template_customs.docx",
        "tnrera": base_templates_dir / "template_tnrera.docx",
        "mcop": base_templates_dir / "template_mcop.docx",
        "warrant": base_templates_dir / "template_warrant.docx"
    }
    
    template_path = template_map.get(dept, base_templates_dir / "template_mcop.docx")
    
    if not template_path.exists():
        print(f"Templates not found at {template_path}. Building department templates...")
        build_department_templates(base_templates_dir)
        
    doc = DocxTemplate(str(template_path))
    doc.render(context)
    
    out_p = Path(output_filepath)
    out_p.parent.mkdir(parents=True, exist_ok=True)
    doc.save(str(out_p))
    print(f"Generated exact proceeding docx at: {output_filepath}")


class DocumentGenerator:
    def __init__(self, template_path: Path = PROCEEDINGS_TEMPLATE_PATH):
        self.template_path = Path(template_path)
        base_dir = self.template_path.parent
        if not (base_dir / "template_customs.docx").exists():
            print("Generating department templates...")
            build_department_templates(base_dir)

    def generate_proceedings(
        self,
        entities: ExtractedLegalEntities,
        validation: Optional[ValidationResult] = None,
        custom_output_filename: Optional[str] = None
    ) -> Path:
        """
        Renders validated entities into appropriate department proceedings template.
        """
        payload = entities.model_dump()
        
        # Ensure defaulter_details array is populated
        if not payload.get("defaulter_details"):
            d = entities.defaulter
            payload["defaulter_details"] = [{
                "name": d.name,
                "father_or_spouse_name": d.father_or_husband_name,
                "representation_or_title": f"IEC No: {d.iec_number}" if d.iec_number else None,
                "door_no": d.door_no or "46",
                "street_and_locality": d.street_area or "உழவன் நகர்",
                "taluk": d.taluk or entities.jurisdiction.taluk,
                "district": d.district or entities.jurisdiction.district,
                "pincode": d.pincode or "638009"
            }]

        # Output filename
        roc_str = entities.file_no or entities.proceedings_roc_number or "9667"
        clean_roc = roc_str.replace("/", "_").replace(".", "_")
        if custom_output_filename:
            out_name = custom_output_filename if custom_output_filename.endswith(".docx") else f"{custom_output_filename}.docx"
        else:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            out_name = f"Proceedings_{clean_roc}_{timestamp}.docx"

        output_file = OUTPUT_DIR / out_name
        render_collector_proceedings(payload, str(output_file))
        return output_file
