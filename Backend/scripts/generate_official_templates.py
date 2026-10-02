"""
Generate Production Official Tamil Nadu Revenue Recovery DOCX Templates
Matching Exact Government Secretariat Layout with 2-Column Table, TAU-Marutham Font,
and Standard Heading/Signatory/Recipient Formats for:
1. செயல்முறைகள் (Collectorate Proceedings / Order)
2. குறிப்பாணை (Office Memorandum / Memo)
"""

from pathlib import Path
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import qn, nsdecls

FONT_NAME = "TAU-Marutham"


def set_cell_margins(cell, top=80, bottom=80, left=120, right=120):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = OxmlElement('w:tcMar')
    for m, val in [('top', top), ('bottom', bottom), ('left', left), ('right', right)]:
        node = OxmlElement(f'w:{m}')
        node.set(qn('w:w'), str(val))
        node.set(qn('w:type'), 'dxa')
        tcMar.append(node)
    tcPr.append(tcMar)


def set_table_borders_none(table):
    tblPr = table._tbl.tblPr
    tblBorders = parse_xml(
        f'<w:tblBorders {nsdecls("w")}>\n'
        f'  <w:top w:val="none"/>\n'
        f'  <w:left w:val="none"/>\n'
        f'  <w:bottom w:val="none"/>\n'
        f'  <w:right w:val="none"/>\n'
        f'  <w:insideH w:val="none"/>\n'
        f'  <w:insideV w:val="none"/>\n'
        f'</w:tblBorders>'
    )
    tblPr.append(tblBorders)


def apply_font_to_p(p, font_name=FONT_NAME, size=Pt(10.5), bold=False, italic=False, align=WD_ALIGN_PARAGRAPH.LEFT):
    p.alignment = align
    p.paragraph_format.line_spacing = 1.15
    p.paragraph_format.space_after = Pt(3)
    p.paragraph_format.space_before = Pt(1)
    for r in p.runs:
        r.font.name = font_name
        r.font.size = size
        r.font.bold = bold
        r.font.italic = italic
        r.font.color.rgb = RGBColor(0, 0, 0)
        rpr = r._element.get_or_add_rPr()
        fonts = rpr.get_or_add_rFonts()
        for attr in ("ascii", "hAnsi", "cs", "eastAsia"):
            fonts.set(qn(f"w:{attr}"), font_name)


def create_proceedings_template(output_path: Path):
    """
    Creates the official செயல்முறைகள் (Proceedings) template:
    - Header: தமிழ்நாடு அரசு, மாவட்ட ஆட்சித் தலைவர் மற்றும் மாவட்ட நிர்வாக நடுவர் அவர்களின் செயல்முறைகள்
    - முன்னிலை: திரு/திருமதி. {{ collector_name }}
    - ந.க. எண் & நாள்
    - // செயல்முறைகள் //
    - பொருள் & பார்வை Table
    - ஆணை:
    - Body Paragraphs
    - Signatory: மாவட்ட ஆட்சித் தலைவர் மற்றும் மாவட்ட நிர்வாக நடுவர்
    - பெறுநர் / நகல்
    """
    doc = docx.Document()

    # Section Margins (Standard A4, 0.6 in margins for clean 1-page fit)
    section = doc.sections[0]
    section.page_width = Inches(8.27)
    section.page_height = Inches(11.69)
    section.top_margin = Inches(0.5)
    section.bottom_margin = Inches(0.5)
    section.left_margin = Inches(0.7)
    section.right_margin = Inches(0.7)

    # 1. State & Office Headings (Centered)
    p_govt = doc.add_paragraph()
    p_govt.add_run("தமிழ்நாடு அரசு")
    apply_font_to_p(p_govt, size=Pt(11), bold=True, align=WD_ALIGN_PARAGRAPH.CENTER)
    p_govt.paragraph_format.space_after = Pt(1)

    p_heading = doc.add_paragraph()
    p_heading.add_run("{{ district_name }} மாவட்ட ஆட்சித் தலைவர் மற்றும் மாவட்ட நிர்வாக நடுவர் அவர்களின் செயல்முறைகள்")
    apply_font_to_p(p_heading, size=Pt(11), bold=True, align=WD_ALIGN_PARAGRAPH.CENTER)
    p_heading.paragraph_format.space_after = Pt(1)

    p_collector = doc.add_paragraph()
    p_collector.add_run("முன்னிலை: {{ collector_name }}")
    apply_font_to_p(p_collector, size=Pt(10.5), bold=True, align=WD_ALIGN_PARAGRAPH.CENTER)
    p_collector.paragraph_format.space_after = Pt(4)

    # 2. Reference & Date Table (Left: ROC, Right: Date)
    header_table = doc.add_table(rows=1, cols=2)
    header_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders_none(header_table)
    header_table.columns[0].width = Inches(3.5)
    header_table.columns[1].width = Inches(3.3)

    left_p = header_table.rows[0].cells[0].paragraphs[0]
    left_p.add_run("{{ roc_number }}")
    apply_font_to_p(left_p, size=Pt(10.5), bold=True, align=WD_ALIGN_PARAGRAPH.LEFT)

    right_p = header_table.rows[0].cells[1].paragraphs[0]
    right_p.add_run("நாள்: {{ proceedings_date }}")
    apply_font_to_p(right_p, size=Pt(10.5), bold=False, align=WD_ALIGN_PARAGRAPH.RIGHT)

    # 3. Document Title (Centered)
    title_p = doc.add_paragraph()
    title_p.add_run("// செயல்முறைகள் //")
    apply_font_to_p(title_p, size=Pt(11.5), bold=True, align=WD_ALIGN_PARAGRAPH.CENTER)
    title_p.paragraph_format.space_before = Pt(2)
    title_p.paragraph_format.space_after = Pt(3)

    # 4. Subject & References 2-Column Table
    sub_table = doc.add_table(rows=2, cols=2)
    sub_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders_none(sub_table)
    sub_table.columns[0].width = Inches(1.0)
    sub_table.columns[1].width = Inches(5.8)

    # Row 0: பொருள்
    cell_p0 = sub_table.rows[0].cells[0].paragraphs[0]
    cell_p0.add_run("பொருள்:")
    apply_font_to_p(cell_p0, size=Pt(10), bold=True, align=WD_ALIGN_PARAGRAPH.LEFT)

    cell_t0 = sub_table.rows[0].cells[1].paragraphs[0]
    cell_t0.add_run("{{ subject_text }}")
    apply_font_to_p(cell_t0, size=Pt(10), bold=False, align=WD_ALIGN_PARAGRAPH.JUSTIFY)

    # Row 1: பார்வை
    cell_p1 = sub_table.rows[1].cells[0].paragraphs[0]
    cell_p1.add_run("பார்வை:")
    apply_font_to_p(cell_p1, size=Pt(10), bold=True, align=WD_ALIGN_PARAGRAPH.LEFT)

    cell_t1 = sub_table.rows[1].cells[1].paragraphs[0]
    cell_t1.add_run("{{ reference_text }}")
    apply_font_to_p(cell_t1, size=Pt(10), bold=False, align=WD_ALIGN_PARAGRAPH.LEFT)

    # Separator line
    p_sep = doc.add_paragraph()
    p_sep.add_run("-------------------------------------------------------------------------------------------------")
    apply_font_to_p(p_sep, size=Pt(8), align=WD_ALIGN_PARAGRAPH.CENTER)
    p_sep.paragraph_format.space_before = Pt(1)
    p_sep.paragraph_format.space_after = Pt(2)

    # 5. Order Heading & Body Paragraphs
    p_order = doc.add_paragraph()
    p_order.add_run("ஆணை:")
    apply_font_to_p(p_order, size=Pt(10.5), bold=True, align=WD_ALIGN_PARAGRAPH.LEFT)
    p_order.paragraph_format.space_after = Pt(2)

    p1 = doc.add_paragraph()
    p1.add_run("{{ order_para1 }}")
    apply_font_to_p(p1, size=Pt(10), align=WD_ALIGN_PARAGRAPH.JUSTIFY)
    p1.paragraph_format.first_line_indent = Inches(0.3)
    p1.paragraph_format.space_after = Pt(3)

    p2 = doc.add_paragraph()
    p2.add_run("{{ order_para2 }}")
    apply_font_to_p(p2, size=Pt(10), align=WD_ALIGN_PARAGRAPH.JUSTIFY)
    p2.paragraph_format.first_line_indent = Inches(0.3)
    p2.paragraph_format.space_after = Pt(3)

    p3 = doc.add_paragraph()
    p3.add_run("{{ order_para3 }}")
    apply_font_to_p(p3, size=Pt(10), align=WD_ALIGN_PARAGRAPH.JUSTIFY)
    p3.paragraph_format.first_line_indent = Inches(0.3)
    p3.paragraph_format.space_after = Pt(5)

    # 6. Signatory Block (Right Aligned)
    sig_p = doc.add_paragraph()
    sig_p.add_run("(ஒப்பம்)\nமாவட்ட ஆட்சித் தலைவர் மற்றும்\nமாவட்ட நிர்வாக நடுவர்,\n{{ district_name }}.")
    apply_font_to_p(sig_p, size=Pt(10), bold=True, align=WD_ALIGN_PARAGRAPH.RIGHT)
    sig_p.paragraph_format.space_after = Pt(5)

    # 7. Recipients Section (பெறுநர் / நகல்)
    recip_p1 = doc.add_paragraph()
    recip_p1.add_run("பெறுநர்:")
    apply_font_to_p(recip_p1, size=Pt(10), bold=True, align=WD_ALIGN_PARAGRAPH.LEFT)
    recip_p1.paragraph_format.space_after = Pt(1)

    recip_p1_val = doc.add_paragraph()
    recip_p1_val.add_run("{{ tahsildar_recipient }}")
    apply_font_to_p(recip_p1_val, size=Pt(10), align=WD_ALIGN_PARAGRAPH.LEFT)
    recip_p1_val.paragraph_format.space_after = Pt(2)

    recip_p2 = doc.add_paragraph()
    recip_p2.add_run("நகல்:")
    apply_font_to_p(recip_p2, size=Pt(10), bold=True, align=WD_ALIGN_PARAGRAPH.LEFT)
    recip_p2.paragraph_format.space_after = Pt(1)

    recip_p2_val = doc.add_paragraph()
    recip_p2_val.add_run("{{ rdo_recipient }}")
    apply_font_to_p(recip_p2_val, size=Pt(10), align=WD_ALIGN_PARAGRAPH.LEFT)
    recip_p2_val.paragraph_format.space_after = Pt(2)

    recip_p3 = doc.add_paragraph()
    recip_p3.add_run("நகல்:")
    apply_font_to_p(recip_p3, size=Pt(10), bold=True, align=WD_ALIGN_PARAGRAPH.LEFT)
    recip_p3.paragraph_format.space_after = Pt(1)

    recip_p3_val = doc.add_paragraph()
    recip_p3_val.add_run("{{ issuing_authority_recipient }}")
    apply_font_to_p(recip_p3_val, size=Pt(10), align=WD_ALIGN_PARAGRAPH.LEFT)
    recip_p3_val.paragraph_format.space_after = Pt(2)

    recip_p4 = doc.add_paragraph()
    recip_p4.add_run("நகல்:")
    apply_font_to_p(recip_p4, size=Pt(10), bold=True, align=WD_ALIGN_PARAGRAPH.LEFT)
    recip_p4.paragraph_format.space_after = Pt(1)

    recip_p4_val = doc.add_paragraph()
    recip_p4_val.add_run("{{ defaulter_address_block }}")
    apply_font_to_p(recip_p4_val, size=Pt(10), align=WD_ALIGN_PARAGRAPH.LEFT)

    doc.save(str(output_path))
    print(f"Generated official proceedings template: {output_path}")


def create_memorandum_template(output_path: Path, doc_type: str = "MEMORANDUM"):
    """
    Creates the official குறிப்பாணை (Memorandum / Office Note) template:
    - Header: ந.க. எண் (Left) & மாவட்ட ஆட்சியர் அலுவலகம், நாள் (Right)
    - // குறிப்பாணை //
    - பொருள் & பார்வை Table
    - Body Paragraphs
    - Signatory: மாவட்ட ஆட்சித் தலைவருக்காக / மாவட்ட ஆட்சியரின் நேர்முக உதவியாளர்(பொது)
    - பெறுநர் / நகல்
    """
    doc = docx.Document()

    # Section Margins (Standard A4, 0.5 in top/bottom, 0.7 in left/right)
    section = doc.sections[0]
    section.page_width = Inches(8.27)
    section.page_height = Inches(11.69)
    section.top_margin = Inches(0.5)
    section.bottom_margin = Inches(0.5)
    section.left_margin = Inches(0.7)
    section.right_margin = Inches(0.7)

    # 1. Header Table (Left: ROC No, Right: District Office & Date)
    header_table = doc.add_table(rows=1, cols=2)
    header_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders_none(header_table)
    header_table.columns[0].width = Inches(3.4)
    header_table.columns[1].width = Inches(3.4)

    # Left: ROC Number
    left_p = header_table.rows[0].cells[0].paragraphs[0]
    left_p.add_run("{{ roc_number }}")
    apply_font_to_p(left_p, size=Pt(10.5), bold=True, align=WD_ALIGN_PARAGRAPH.LEFT)

    # Right: Office and Date
    right_p = header_table.rows[0].cells[1].paragraphs[0]
    right_p.add_run("மாவட்ட ஆட்சியர் அலுவலகம்,\n{{ district_name }},\nநாள். {{ proceedings_date }}.")
    apply_font_to_p(right_p, size=Pt(10.5), align=WD_ALIGN_PARAGRAPH.RIGHT)

    # 2. Document Title Heading (Centered)
    title_p = doc.add_paragraph()
    if doc_type == "NOTE":
        title_p.add_run("//அலுவலகக் குறிப்பு//")
    else:
        title_p.add_run("//குறிப்பாணை//")
    apply_font_to_p(title_p, size=Pt(11.5), bold=True, align=WD_ALIGN_PARAGRAPH.CENTER)
    title_p.paragraph_format.space_before = Pt(2)
    title_p.paragraph_format.space_after = Pt(2)

    # 3. Subject & References 2-Column Table
    sub_table = doc.add_table(rows=2, cols=2)
    sub_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders_none(sub_table)
    sub_table.columns[0].width = Inches(1.0)
    sub_table.columns[1].width = Inches(5.8)

    # Row 0: பொருள்
    cell_p0 = sub_table.rows[0].cells[0].paragraphs[0]
    cell_p0.add_run("பொருள்:")
    apply_font_to_p(cell_p0, size=Pt(10), bold=True, align=WD_ALIGN_PARAGRAPH.LEFT)

    cell_t0 = sub_table.rows[0].cells[1].paragraphs[0]
    cell_t0.add_run("{{ subject_text }}")
    apply_font_to_p(cell_t0, size=Pt(10), bold=False, align=WD_ALIGN_PARAGRAPH.JUSTIFY)

    # Row 1: பார்வை
    cell_p1 = sub_table.rows[1].cells[0].paragraphs[0]
    cell_p1.add_run("பார்வை:")
    apply_font_to_p(cell_p1, size=Pt(10), bold=True, align=WD_ALIGN_PARAGRAPH.LEFT)

    cell_t1 = sub_table.rows[1].cells[1].paragraphs[0]
    cell_t1.add_run("{{ reference_text }}")
    apply_font_to_p(cell_t1, size=Pt(10), bold=False, align=WD_ALIGN_PARAGRAPH.LEFT)

    # Separator line
    p_sep = doc.add_paragraph()
    p_sep.add_run("-------------------------------------------------------------------------------------------------")
    apply_font_to_p(p_sep, size=Pt(8), align=WD_ALIGN_PARAGRAPH.CENTER)
    p_sep.paragraph_format.space_before = Pt(1)
    p_sep.paragraph_format.space_after = Pt(3)

    # 4. Body Paragraphs
    if doc_type == "NOTE":
        p_sub = doc.add_paragraph()
        p_sub.add_run("பணிந்தனுப்பப்படுகிறது:")
        apply_font_to_p(p_sub, size=Pt(10), bold=True, align=WD_ALIGN_PARAGRAPH.LEFT)

    p1 = doc.add_paragraph()
    p1.add_run("{{ order_para1 }}")
    apply_font_to_p(p1, size=Pt(10), align=WD_ALIGN_PARAGRAPH.JUSTIFY)
    p1.paragraph_format.first_line_indent = Inches(0.3)
    p1.paragraph_format.space_after = Pt(3)

    p2 = doc.add_paragraph()
    p2.add_run("{{ order_para2 }}")
    apply_font_to_p(p2, size=Pt(10), align=WD_ALIGN_PARAGRAPH.JUSTIFY)
    p2.paragraph_format.first_line_indent = Inches(0.3)
    p2.paragraph_format.space_after = Pt(3)

    p3 = doc.add_paragraph()
    p3.add_run("{{ order_para3 }}")
    apply_font_to_p(p3, size=Pt(10), align=WD_ALIGN_PARAGRAPH.JUSTIFY)
    p3.paragraph_format.first_line_indent = Inches(0.3)
    p3.paragraph_format.space_after = Pt(5)

    # 5. Signatory Block (Right Aligned)
    sig_p = doc.add_paragraph()
    sig_p.add_run("மாவட்ட ஆட்சித் தலைவருக்காக/\nமாவட்ட ஆட்சியரின் நேர்முக உதவியாளர்(பொது),\n{{ district_name }}.")
    apply_font_to_p(sig_p, size=Pt(10), bold=True, align=WD_ALIGN_PARAGRAPH.RIGHT)
    sig_p.paragraph_format.space_after = Pt(5)

    # 6. Recipients Section (பெறுநர் / நகல்)
    recip_p1 = doc.add_paragraph()
    recip_p1.add_run("பெறுநர்:")
    apply_font_to_p(recip_p1, size=Pt(10), bold=True, align=WD_ALIGN_PARAGRAPH.LEFT)
    recip_p1.paragraph_format.space_after = Pt(1)

    recip_p1_val = doc.add_paragraph()
    recip_p1_val.add_run("{{ tahsildar_recipient }}")
    apply_font_to_p(recip_p1_val, size=Pt(10), align=WD_ALIGN_PARAGRAPH.LEFT)
    recip_p1_val.paragraph_format.space_after = Pt(2)

    recip_p2 = doc.add_paragraph()
    recip_p2.add_run("நகல்:")
    apply_font_to_p(recip_p2, size=Pt(10), bold=True, align=WD_ALIGN_PARAGRAPH.LEFT)
    recip_p2.paragraph_format.space_after = Pt(1)

    recip_p2_val = doc.add_paragraph()
    recip_p2_val.add_run("{{ rdo_recipient }}")
    apply_font_to_p(recip_p2_val, size=Pt(10), align=WD_ALIGN_PARAGRAPH.LEFT)
    recip_p2_val.paragraph_format.space_after = Pt(2)

    recip_p3 = doc.add_paragraph()
    recip_p3.add_run("நகல்:")
    apply_font_to_p(recip_p3, size=Pt(10), bold=True, align=WD_ALIGN_PARAGRAPH.LEFT)
    recip_p3.paragraph_format.space_after = Pt(1)

    recip_p3_val = doc.add_paragraph()
    recip_p3_val.add_run("{{ issuing_authority_recipient }}")
    apply_font_to_p(recip_p3_val, size=Pt(10), align=WD_ALIGN_PARAGRAPH.LEFT)
    recip_p3_val.paragraph_format.space_after = Pt(2)

    recip_p4 = doc.add_paragraph()
    recip_p4.add_run("நகல்:")
    apply_font_to_p(recip_p4, size=Pt(10), bold=True, align=WD_ALIGN_PARAGRAPH.LEFT)
    recip_p4.paragraph_format.space_after = Pt(1)

    recip_p4_val = doc.add_paragraph()
    recip_p4_val.add_run("{{ defaulter_address_block }}")
    apply_font_to_p(recip_p4_val, size=Pt(10), align=WD_ALIGN_PARAGRAPH.LEFT)

    doc.save(str(output_path))
    print(f"Generated official memorandum template: {output_path}")


if __name__ == "__main__":
    t_dir = Path("templates")
    t_dir.mkdir(exist_ok=True)

    # 1. Official Proceedings Templates (செயல்முறைகள்)
    create_proceedings_template(t_dir / "template_proceedings.docx")
    create_proceedings_template(t_dir / "template_customs_proceedings.docx")
    create_proceedings_template(t_dir / "template_tnrera_proceedings.docx")
    create_proceedings_template(t_dir / "template_mcop_proceedings.docx")
    create_proceedings_template(t_dir / "proceedings_template.docx")

    # 2. Official Memorandum Templates (குறிப்பாணை)
    create_memorandum_template(t_dir / "template_memorandum.docx", "MEMORANDUM")
    create_memorandum_template(t_dir / "template_customs.docx", "MEMORANDUM")
    create_memorandum_template(t_dir / "template_tnrera.docx", "MEMORANDUM")
    create_memorandum_template(t_dir / "template_mcop.docx", "MEMORANDUM")
    create_memorandum_template(t_dir / "template_warrant.docx", "MEMORANDUM")
    create_memorandum_template(t_dir / "template_note.docx", "NOTE")
