"""
High-Fidelity Document Generation Daemons:
Bound explicitly to TAU-Marutham using direct OpenXML run overrides.
Generates:
1. Office Note (office_note.docx) - // அலுவலகக் குறிப்பு //
2. Proceedings (proceedings.docx) - மாவட்ட ஆட்சித் தலைவர் செயல்முறைகள்
3. Memorandum (memorandum.docx) - // குறிப்பாணை //
4. Judicial Welfare Warrant (warrant.docx) - // ஜப்தி மற்றும் கைது வாரண்ட் ஆணை //
"""

import asyncio
from pathlib import Path
from typing import Optional
from docx import Document
from docx.shared import Pt, Inches, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

from app.core.config import settings
from app.core.logging import logger
from app.services.llm_service import LLMService

llm_service = LLMService()
OUTPUT_DIR = settings.OUTPUT_DIR
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def force_tau_marutham_typography(run, size_pt: int = 12, bold: bool = False):
    """
    Programmatically hooks into OpenXML run nodes to bind text tightly
    to the TAU-Marutham target font stack across ASCII, Complex Script, and EastAsian declarations.
    """
    run.font.name = settings.PRIMARY_FONT_TAMIL
    run.font.size = Pt(size_pt)
    run.bold = bold
    run.font.color.rgb = RGBColor(0, 0, 0)

    rPr = run._r.get_or_add_rPr()
    rFonts = OxmlElement('w:rFonts')
    rFonts.set(qn('w:ascii'), settings.PRIMARY_FONT_TAMIL)
    rFonts.set(qn('w:hAnsi'), settings.PRIMARY_FONT_TAMIL)
    rFonts.set(qn('w:cs'), settings.PRIMARY_FONT_TAMIL)
    rFonts.set(qn('w:eastAsia'), settings.PRIMARY_FONT_TAMIL)
    rPr.append(rFonts)


async def render_text_stream_to_docx(generated_text: str, file_path: Path) -> str:
    """Renders formatted administrative Tamil text to DOCX with native A4 styling and TAU-Marutham typography."""
    doc = Document()

    # Configure standard Tamil Nadu Government A4 layout
    for section in doc.sections:
        section.top_margin = Inches(0.8)
        section.bottom_margin = Inches(0.8)
        section.left_margin = Inches(1.0)
        section.right_margin = Inches(1.0)
        section.page_width = Inches(8.27)
        section.page_height = Inches(11.69)

    lines = generated_text.split('\n')
    for raw_line in lines:
        clean_line = raw_line.strip()
        if not clean_line or any(tag in clean_line for tag in ["[DOCUMENT_START]", "[DOCUMENT_END]", "```"]):
            continue

        p = doc.add_paragraph()
        p.paragraph_format.space_after = Pt(4)
        p.paragraph_format.line_spacing = 1.15

        # Headings centered and bold
        if clean_line.startswith("//") and clean_line.endswith("//"):
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            run = p.add_run(clean_line)
            force_tau_marutham_typography(run, size_pt=14, bold=True)
        elif clean_line.startswith("தமிழ்நாடு அரசு") or "செயல்முறைகள்" in clean_line or "வாரண்ட் ஆணை" in clean_line:
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            run = p.add_run(clean_line)
            force_tau_marutham_typography(run, size_pt=13, bold=True)
        elif clean_line.startswith("பொருள்:") or clean_line.startswith("பார்வை:") or clean_line.startswith("ஆணை:") or clean_line.startswith("அதிகாரம்:") or clean_line.startswith("முன்னிலை:"):
            run = p.add_run(clean_line)
            force_tau_marutham_typography(run, size_pt=12, bold=True)
        else:
            run = p.add_run(clean_line)
            force_tau_marutham_typography(run, size_pt=12, bold=False)

    doc.save(str(file_path))
    return str(file_path)


# ==========================================
# 🧠 WORKER 1: OFFICE NOTE ENGINE (அலுவலகக் குறிப்பு)
# ==========================================
async def process_office_note(ocr_text: str, job_id: int, *args) -> str:
    """Drafts internal high-confidential Office Note (office_note.docx)."""
    prompt = f"""
    You are an expert Legal Drafter for Tamil Nadu Revenue Administration (ஈரோடு மாவட்ட வருவாய்த் துறை).
    Task: Draft an internal, high-confidential Office Note (அலுவலகக் குறிப்பு) based strictly on the source document text.
    
    PROMPT CONSTRAINTS:
    - NO HALLUCINATIONS: Maintain 100% data fidelity. Do not invent files, amounts, dates, or names.
    - NO STRUCTURAL JSON: Output clean, natural administrative paragraphs in official Tamil (ஆட்சிமொழித் தமிழ்).
    
    REQUIRED STRUCTURE:
    // அலுவலகக் குறிப்பு //
    பொருள்: வருவாய் வசூல் சட்டம் 1864 - [Extract Department] நிலுவைத் தொகை - [Extract Taluk] வட்டம் - [Extract Debtor Entity] என்ற நிறுவனத்திடமிருந்து/நபரிடமிருந்து அரசுக்குச் சேர வேண்டிய நிலுவைத் தொகையினை வருவாய் வசூல் சட்டப்படி வசூல் செய்யக் கோருதல் - தொடர்பாக.
    பார்வை: 1. [Extract Sending Authority] கடித எண் [Extract Ref] நாள் [Extract Date].
    பணிந்தனுப்பப்படுகிறது: [Generate a precise brief paragraph breaking down the principal, interest, and penalty amounts both in figures and formal Tamil words].
    அதிகாரப் பகிர்வு: எனவே, மேற்படி தொகையை வருவாய் வசூல் சட்டம் 1864 பிரிவு 5-ன் கீழ் வசூல் செய்ய சம்பந்தப்பட்ட வருவாய் வட்டாட்சியருக்கு அதிகாரம் வழங்கி உத்திரவிடலாம் எனப் பரிந்துரைக்கப்படுகிறது.
    ஒப்புதல் வேண்டுதல்: உத்திரவினை எதிர்நோக்கி செயல்முறை வரைவு ஒப்புதலுக்காக மாவட்ட ஆட்சித்தலைவர் அவர்களுக்கு பணிவுடன் சமர்ப்பிக்கப்படுகிறது.

    [SOURCE INPUT TEXT]:
    {ocr_text[:3000]}
    """
    response = await llm_service.chat_completion(
        prompt=prompt,
        system_instruction="Draft official Tamil Nadu administration office note (அலுவலகக் குறிப்பு). Strictly grounded, zero hallucination."
    )
    out_file = OUTPUT_DIR / f"Office_Note_{job_id}.docx"
    return await render_text_stream_to_docx(response, out_file)


# ==========================================
# 📜 WORKER 2: PROCEEDINGS ENGINE (செயல்முறைகள்)
# ==========================================
async def process_proceedings(ocr_text: str, job_id: int, *args) -> str:
    """Drafts formal District Collector Proceedings Order (proceedings.docx)."""
    prompt = f"""
    You are the District Collector & District Magistrate (மாவட்ட ஆட்சித் தலைவர் மற்றும் மாவட்ட நிர்வாக நடுவர்).
    Task: Draft a formal, legally binding administrative operational order called 'செயல்முறைகள்' (Proceedings) under Tamil Nadu Revenue Recovery Act 1864.
    
    PROMPT CONSTRAINTS:
    - NO HALLUCINATIONS: Maintain exact amounts, party names, and file numbers from source text.
    - FORMALITY: Pure, dignified administrative Tamil.
    
    REQUIRED STRUCTURE:
    தமிழ்நாடு அரசு
    ஈரோடு மாவட்ட ஆட்சித் தலைவர் மற்றும் மாவட்ட நிர்வாக நடுவர் அவர்களின் செயல்முறைகள்
    முன்னிலை: மாவட்ட ஆட்சித் தலைவர், இ.ஆ.ப.
    ந.க. எண்: [Extract ROC/File No] நாள்: [Date]
    பொருள்: வருவாய் வசூல் சட்டம் 1864 - [Department] நிலுவைத் தொகை வசூலித்தல் - ஆணை பிறப்பித்தல்.
    பார்வை: 1. [Extract reference letters and dates]
    ஆணை:
    மேற்படி குறிப்பில் கண்டுள்ளவாறு, அரசுக்குச் செலுத்த வேண்டிய நிலுவைத் தொகையினை வருவாய் நிலை ஆணை எண் 41 மற்றும் தமிழ்நாடு வருவாய் வசூல் சட்டம் 1864 பிரிவு 5-ன் கீழ் வசூலிக்க சம்பந்தப்பட்ட வருவாய் வட்டாட்சியருக்கு முழு அதிகாரம் வழங்கி இதன் மூலம் ஆணை பிறப்பிக்கப்படுகிறது.
    எனவே, எதிர்தரப்பினரின் அசையும் மற்றும் அசையா சொத்துக்களிலிருந்து மேற்படி தொகையினை வசூல் செய்து உரிய கணக்குத் தலைப்பில் வரவு வைத்து அல்லது வங்கி வரைவோலையாக பெற்று இவ்வலுவலகத்திற்கு சமர்ப்பிக்குமாறு வட்டாட்சியருக்கு உத்தரவிடப்படுகிறது.

    [SOURCE INPUT TEXT]:
    {ocr_text[:3000]}
    """
    response = await llm_service.chat_completion(
        prompt=prompt,
        system_instruction="Draft official Tamil Nadu Revenue Recovery proceedings order (செயல்முறைகள்)."
    )
    out_file = OUTPUT_DIR / f"proceedings_{job_id}.docx"
    return await render_text_stream_to_docx(response, out_file)


# ==========================================
# 📑 WORKER 3: MEMORANDUM ENGINE (குறிப்பாணை)
# ==========================================
async def process_memorandum(ocr_text: str, job_id: int, linked_old_ref: str = "") -> str:
    """Drafts Collectorate Memorandum cross-linking to baseline records (memorandum.docx)."""
    ref_instruction = f"பழைய மாவட்ட ஆட்சித் தலைவரின் செயல்முறை ஆணை குறிப்பு எண்: {linked_old_ref}" if linked_old_ref else "முந்தைய கோரிக்கை மற்றும் கேட்புக் கடிதங்கள்."

    prompt = f"""
    You are the Personal Assistant (General) to the District Collector (மாவட்ட ஆட்சியரின் நேர்முக உதவியாளர் (பொது)).
    Task: Create a formal administrative //குறிப்பாணை// (Office Memorandum) that cross-links the recovery demand.
    
    PROMPT CONSTRAINTS:
    - INTEGRATE BASELINE: {ref_instruction}
    - 100% data fidelity. Zero fabricated facts.
    
    REQUIRED STRUCTURE:
    // குறிப்பாணை //
    ந.க. எண்: [Extract File No]                    மாவட்ட ஆட்சியர் அலுவலகம், ஈரோடு.
    நாள்: [Date]
    பொருள்: வருவாய் வசூல் சட்டம் 1864 - கோரிக்கையினை பழைய கோப்புடன் இணைத்து தொடர் நடவடிக்கை மேற்கொள்ளுதல் - தொடர்பாக.
    பார்வை:
      1. {ref_instruction}
      2. தற்பொழுது வரப்பெற்றுள்ள புதிய கேட்புக் கடிதம்.
    விளக்கப் பகுதி & கட்டளை:
    பார்வையில் காணும் கடிதங்களின்படி, நிலுவைத் தொகையினை துரிதமாக வசூலித்து அரசு கணக்கில் செலுத்தி அறிக்கை சமர்ப்பிக்குமாறு சம்பந்தப்பட்ட வருவாய் வட்டாட்சியருக்கு தெரிவிக்கப்படுகிறது.
    மாவட்ட ஆட்சித் தலைவருக்காக / நேர்முக உதவியாளர் (பொது)

    [SOURCE INPUT TEXT]:
    {ocr_text[:3000]}
    """
    response = await llm_service.chat_completion(
        prompt=prompt,
        system_instruction="Draft official Tamil Nadu Collectorate memorandum (குறிப்பாணை)."
    )
    out_file = OUTPUT_DIR / f"memorandum_{job_id}.docx"
    return await render_text_stream_to_docx(response, out_file)


# ==========================================
# ⚖️ WORKER 4: JUDICIAL WARRANT DAEMON (கைது / ஜப்தி வாரண்ட்)
# ==========================================
async def process_warrant(ocr_text: str, job_id: int, *args) -> str:
    """Drafts Judicial Distraint & Arrest Warrant for Family Maintenance / Human Welfare defaults (warrant.docx)."""
    prompt = f"""
    You are the Lead Judicial Compliance Counsel for District Revenue Administration.
    Task: Draft a non-negotiable Distraint and Execution Warrant Order (ஜப்தி மற்றும் கைது வாரண்ட் ஆணை) for a specialized Human Welfare / Family Maintenance Arrears Case (BNSS 144 / CrPC 125).
    
    PROMPT CONSTRAINTS:
    - STATUTORY GROUNDING: Powers of Tamil Nadu Revenue Recovery Act 1864 with Family Court Directives.
    - WELFARE ACCURACY: Accurately capture dependent family members' maintenance arrears.
    
    REQUIRED STRUCTURE:
    // ஜப்தி மற்றும் கைது வாரண்ட் ஆணை //
    (Execution Warrant for Maintenance Arrears)
    சட்டப்பிரிவு & அதிகாரம்: குடும்ப நல நீதிமன்ற உத்தரவு / பாரதிய நகரிக் சுரக்ஷா சன்ஹிதா பிரிவு 144 மற்றும் தமிழ்நாடு வருவாய் வசூல் சட்டம் 1864.
    பராமரிப்புத் தொகை விவரம்: [Extract beneficiary names, period of arrears, and total outstanding maintenance amount in figures and words].
    அமலாக்கக் கட்டளை:
    மேற்படி பராமரிப்புத் தொகை நிலுவையினை உடனடியாக செலுத்தத் தவறினால், எதிர்தரப்பினரின் அசையும் சொத்துக்களை உடனடியாக ஜப்தி செய்யவும் அல்லது சட்டப்படி அவரைக் கைது செய்து நடவடிக்கை மேற்கொள்ளவும் வருவாய் ஆய்வாளர் மற்றும் காவல் துறை அதிகாரிகளுக்கு இதன் மூலம் உத்தரவிடப்படுகிறது.

    [SOURCE INPUT TEXT]:
    {ocr_text[:3000]}
    """
    response = await llm_service.chat_completion(
        prompt=prompt,
        system_instruction="Draft judicial execution warrant in official legal Tamil."
    )
    out_file = OUTPUT_DIR / f"warrant_{job_id}.docx"
    return await render_text_stream_to_docx(response, out_file)
