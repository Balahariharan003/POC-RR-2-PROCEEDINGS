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

    def docx_to_layout(self, file_path: Path, filename: str) -> Dict[str, Any]:
        """Parses a Word (.docx) document into a block-based JSON layout for interactive editing."""
        doc = docx.Document(str(file_path))
        
        # Default page dimensions (A4) in points
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

        blocks: List[Dict[str, Any]] = []
        p_count = 0

        # Helper to convert alignment
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
                "margin": "0 0 0.65rem 0",
                "color": "#102C57"
            }

            return {
                "id": pid,
                "type": "paragraph",
                "text": p.text,
                "runs": runs_data,
                "style": p_style
            }

        # Walk document elements in body
        # python-docx has doc.paragraphs and doc.tables.
        # We can sequentially process paragraphs and tables.
        for p in doc.paragraphs:
            p_count += 1
            pid = f"p_{p_count}"
            blocks.append(parse_paragraph(p, pid))

        for t_idx, table in enumerate(doc.tables):
            table_rows = []
            for r_idx, row in enumerate(table.rows):
                row_cells = []
                for c_idx, cell in enumerate(row.cells):
                    cell_blocks = []
                    for cp_idx, cp in enumerate(cell.paragraphs):
                        p_count += 1
                        c_pid = f"p_t{t_idx}_r{r_idx}_c{c_idx}_{cp_idx+1}"
                        cell_blocks.append(parse_paragraph(cp, c_pid))
                    row_cells.append({
                        "colSpan": 1,
                        "width": f"{round(100.0 / max(1, len(row.cells)), 1)}%",
                        "blocks": cell_blocks
                    })
                table_rows.append(row_cells)

            blocks.append({
                "id": f"table_{t_idx+1}",
                "type": "table",
                "rows": table_rows
            })

        return {
            "filename": filename,
            "revision": 1,
            "page": page,
            "blocks": blocks
        }

    def get_layout(self, filename: str) -> Dict[str, Any]:
        """Locates the file in outputs, templates, or uploads and parses layout."""
        file_path = self.storage.find_file(filename)
        return self.docx_to_layout(file_path, filename)
