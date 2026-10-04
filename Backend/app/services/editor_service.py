"""
Editor Service: Parse DOCX documents into layout structures for TemplateDocumentEditor and apply modifications.
"""

from pathlib import Path
from typing import Dict, Any, List, Optional
import docx
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Pt, Inches

from app.core.config import settings
from app.core.logging import logger
from app.infrastructure.storage.local_storage import LocalStorageProvider


class EditorService:
    def __init__(self, storage_provider: Optional[LocalStorageProvider] = None):
        self.storage = storage_provider or LocalStorageProvider()

    def _parse_doc_to_layout(self, doc: docx.Document, filename: str) -> Dict[str, Any]:
        """Core parser: Iterates over doc.element.body in sequential order for authentic Word document layout."""
        from docx.text.paragraph import Paragraph
        from docx.table import Table

        page = {
            "page_width": 595.3,
            "page_height": 841.9,
            "top_margin": 54.0,
            "right_margin": 54.0,
            "bottom_margin": 54.0,
            "left_margin": 54.0,
        }

        if doc.sections:
            sec = doc.sections[0]
            if sec.page_width:
                page["page_width"] = round(sec.page_width.pt, 1)
            if sec.page_height:
                page["page_height"] = round(sec.page_height.pt, 1)
            if sec.top_margin:
                page["top_margin"] = round(sec.top_margin.pt, 1)
            if sec.right_margin:
                page["right_margin"] = round(sec.right_margin.pt, 1)
            if sec.bottom_margin:
                page["bottom_margin"] = round(sec.bottom_margin.pt, 1)
            if sec.left_margin:
                page["left_margin"] = round(sec.left_margin.pt, 1)

        def get_text_align(alignment) -> str:
            if alignment == WD_ALIGN_PARAGRAPH.CENTER:
                return "center"
            elif alignment == WD_ALIGN_PARAGRAPH.RIGHT:
                return "right"
            elif alignment == WD_ALIGN_PARAGRAPH.JUSTIFY:
                return "justify"
            return "left"

        def parse_paragraph(p, pid: str) -> Dict[str, Any]:
            align = get_text_align(p.alignment)
            runs_data = []
            for r in p.runs:
                if not r.text:
                    continue
                r_style: Dict[str, Any] = {}
                if r.bold:
                    r_style["fontWeight"] = "bold"
                if r.italic:
                    r_style["fontStyle"] = "italic"
                if r.underline:
                    r_style["textDecoration"] = "underline"
                if r.font and r.font.size:
                    r_style["fontSize"] = f"{r.font.size.pt}pt"
                runs_data.append({
                    "text": r.text,
                    "style": r_style
                })

            if not runs_data:
                runs_data = [{"text": p.text or "", "style": {}}]

            p_style: Dict[str, Any] = {
                "textAlign": align,
                "fontFamily": "'TAU-Marutham', 'Noto Sans Tamil', 'Plus Jakarta Sans', sans-serif",
                "lineHeight": "1.6",
                "margin": "0 0 0.5rem 0",
                "color": "#102C57"
            }

            return {
                "id": pid,
                "type": "paragraph",
                "text": p.text,
                "runs": runs_data,
                "style": p_style
            }

        blocks: List[Dict[str, Any]] = []
        p_count = 0
        t_count = 0

        # Sequential iteration over document body elements in exact order
        for elem in doc.element.body:
            if elem.tag.endswith("p"):
                p = Paragraph(elem, doc)
                p_count += 1
                blocks.append(parse_paragraph(p, f"p_{p_count}"))
            elif elem.tag.endswith("tbl"):
                t_count += 1
                table = Table(elem, doc)
                table_rows = []
                for r_idx, row in enumerate(table.rows):
                    row_cells = []
                    for c_idx, cell in enumerate(row.cells):
                        cell_blocks = []
                        for cp_idx, cp in enumerate(cell.paragraphs):
                            p_count += 1
                            cell_blocks.append(parse_paragraph(cp, f"p_t{t_count}_r{r_idx}_c{c_idx}_{cp_idx+1}"))
                        row_cells.append({
                            "colSpan": 1,
                            "width": f"{round(100.0 / max(1, len(row.cells)), 1)}%",
                            "blocks": cell_blocks
                        })
                    table_rows.append(row_cells)
                blocks.append({
                    "id": f"table_{t_count}",
                    "type": "table",
                    "rows": table_rows
                })

        return {
            "filename": filename,
            "revision": 1,
            "page": page,
            "blocks": blocks
        }

    def docx_to_layout(self, file_path: Path, filename: str) -> Dict[str, Any]:
        """Parses a Word (.docx) document into a block-based JSON layout for interactive editing."""
        doc = docx.Document(str(file_path))
        return self._parse_doc_to_layout(doc, filename)

    def bytes_to_layout(self, raw_bytes: bytes, filename: str) -> Dict[str, Any]:
        """Parses in-memory DOCX binary bytes into an interactive block layout."""
        import io
        stream = io.BytesIO(raw_bytes)
        doc = docx.Document(stream)
        return self._parse_doc_to_layout(doc, filename)

    def template_model_to_layout(self, tpl) -> Dict[str, Any]:
        """Converts a DocumentTemplate database model into an interactive block layout."""
        blocks = []
        # Heading
        heading = getattr(tpl, "heading_prefix", None) or "ஈரோடு மாவட்ட ஆட்சித் தலைவர் மற்றும்\nமாவட்ட நிர்வாக நடுவர் அவர்களின் செயல்முறைகள், ஈரோடு"
        blocks.append({
            "id": "p_heading",
            "type": "paragraph",
            "text": heading,
            "runs": [{"text": heading, "style": {"fontWeight": "bold"}}],
            "style": {"textAlign": "center", "fontSize": "12pt", "fontFamily": "'TAU-Marutham', serif", "margin": "0 0 0.5rem 0"}
        })

        # Roc Number
        blocks.append({
            "id": "p_roc",
            "type": "paragraph",
            "text": "ந.க. 9666/2026/ஈ2                                                    நாள்: 03.10.2026",
            "runs": [{"text": "ந.க. 9666/2026/ஈ2                                                    நாள்: 03.10.2026", "style": {"fontWeight": "bold"}}],
            "style": {"textAlign": "justify", "fontSize": "11pt", "fontFamily": "'TAU-Marutham', serif"}
        })

        # Subject & Reference Table
        subj = getattr(tpl, "subject_template", None) or "வருவாய் வசூல் சட்டம் 1864 – உத்திரவிடுதல்."
        ref = getattr(tpl, "reference_template", None) or "1. தீர்ப்பாய உத்தரவு.\n2. வருவாய் நிலை ஆணை எண் 41 மற்றும் வருவாய் வசூல் சட்டம் 1864 பிரிவு 5."

        blocks.append({
            "id": "table_subj_ref",
            "type": "table",
            "rows": [
                [
                    {"colSpan": 1, "width": "15%", "blocks": [{"id": "p_subj_lbl", "type": "paragraph", "text": "பொருள்:", "runs": [{"text": "பொருள்:", "style": {"fontWeight": "bold"}}], "style": {"textAlign": "left", "fontSize": "11pt"}}]},
                    {"colSpan": 1, "width": "85%", "blocks": [{"id": "p_subj_val", "type": "paragraph", "text": subj, "runs": [{"text": subj}], "style": {"textAlign": "left", "fontSize": "11pt"}}]}
                ],
                [
                    {"colSpan": 1, "width": "15%", "blocks": [{"id": "p_ref_lbl", "type": "paragraph", "text": "பார்வை:", "runs": [{"text": "பார்வை:", "style": {"fontWeight": "bold"}}], "style": {"textAlign": "left", "fontSize": "11pt"}}]},
                    {"colSpan": 1, "width": "85%", "blocks": [{"id": "p_ref_val", "type": "paragraph", "text": ref, "runs": [{"text": ref}], "style": {"textAlign": "left", "fontSize": "11pt"}}]}
                ]
            ]
        })

        # Order Heading
        blocks.append({
            "id": "p_order_lbl",
            "type": "paragraph",
            "text": "உத்தரவு:",
            "runs": [{"text": "உத்தரவு:", "style": {"fontWeight": "bold"}}],
            "style": {"textAlign": "left", "fontSize": "11pt", "margin": "0.5rem 0"}
        })

        # Order Paragraph 1
        p1 = getattr(tpl, "order_para1_template", None) or getattr(tpl, "order_para1", None) or "பார்வையில் கண்டுள்ள கடிதத்தில் தெரிவிக்கப்பட்டுள்ளபடி நடவடிக்கை மேற்கொள்ள உத்தரவிடப்படுகிறது."
        blocks.append({
            "id": "p_order_para1",
            "type": "paragraph",
            "text": p1,
            "runs": [{"text": p1}],
            "style": {"textAlign": "justify", "fontSize": "11pt", "textIndent": "2rem", "margin": "0 0 0.5rem 0"}
        })

        # Order Paragraph 2
        p2 = getattr(tpl, "order_para2_template", None) or getattr(tpl, "order_para2", None) or "மேற்படி தொகையினை வருவாய் நிலை ஆணை எண் 41 மற்றும் வருவாய் வசூல் சட்டம் 1864 பிரிவு 5-ன் கீழ் வசூல் செய்ய வட்டாட்சியருக்கு அதிகாரம் வழங்கி உத்திரவிடப்படுகிறது."
        blocks.append({
            "id": "p_order_para2",
            "type": "paragraph",
            "text": p2,
            "runs": [{"text": p2}],
            "style": {"textAlign": "justify", "fontSize": "11pt", "textIndent": "2rem", "margin": "0 0 0.5rem 0"}
        })

        # Order Paragraph 3
        p3 = getattr(tpl, "order_para3_template", None) or getattr(tpl, "order_para3", None) or ""
        if p3:
            blocks.append({
                "id": "p_order_para3",
                "type": "paragraph",
                "text": p3,
                "runs": [{"text": p3}],
                "style": {"textAlign": "justify", "fontSize": "11pt", "textIndent": "2rem", "margin": "0 0 0.5rem 0"}
            })

        # Enclosure
        enclosure = getattr(tpl, "enclosure_text", None) or "கடித நகல்"
        blocks.append({
            "id": "p_enclosure",
            "type": "paragraph",
            "text": f"இணைப்பு: {enclosure}",
            "runs": [{"text": f"இணைப்பு: {enclosure}", "style": {"fontWeight": "bold"}}],
            "style": {"textAlign": "left", "fontSize": "11pt", "margin": "0.8rem 0"}
        })

        # Signatory
        signatory = getattr(tpl, "signatory_text", None) or "மாவட்ட ஆட்சித் தலைவர்,\nஈரோடு."
        blocks.append({
            "id": "p_signatory",
            "type": "paragraph",
            "text": signatory,
            "runs": [{"text": signatory, "style": {"fontWeight": "bold"}}],
            "style": {"textAlign": "right", "fontSize": "11pt", "margin": "1.5rem 0 0 0"}
        })

        return {
            "filename": getattr(tpl, "file_name", None) or f"{getattr(tpl, 'template_code', 'template')}.docx",
            "revision": 1,
            "page": {"page_width": 595.3, "page_height": 841.9, "top_margin": 54.0, "right_margin": 54.0, "bottom_margin": 54.0, "left_margin": 54.0},
            "blocks": blocks
        }

    def get_layout(self, filename: str) -> Dict[str, Any]:
        """Locates the file in outputs, templates, or uploads and parses layout."""
        file_path = self.storage.find_file(filename)
        return self.docx_to_layout(file_path, filename)
