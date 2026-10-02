"""
Editor Endpoints: Layout extraction, interactive revisions, word import, and document export.
"""

from pathlib import Path
from typing import Dict, Any, Optional
from fastapi import APIRouter, HTTPException, UploadFile, File, Body, status
from fastapi.responses import FileResponse, JSONResponse
import docx
import uuid
import shutil

from app.core.config import settings
from app.core.logging import logger
from app.services.editor_service import EditorService
from app.services.pdf_service import PDFService
from app.services.llm_service import LLMService
from app.infrastructure.storage.local_storage import LocalStorageProvider

router = APIRouter()
editor_service = EditorService()
pdf_service = PDFService()
storage_provider = LocalStorageProvider()
llm_service = LLMService()


@router.get("/{filename:path}", tags=["Editor"])
async def get_layout(filename: str):
    """Returns block-based JSON layout for interactive in-browser editing of proceedings DOCX."""
    try:
        layout = editor_service.get_layout(filename)
        return layout
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Document layout not found for '{filename}'.")
    except Exception as e:
        logger.error(f"Error extracting layout for {filename}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to parse document layout: {str(e)}")


@router.post("/revise", tags=["Editor"])
async def revise_document(
    payload: Dict[str, Any] = Body(...)
):
    """Applies AI or manual revision instructions to document layout blocks."""
    filename = payload.get("filename", "")
    revision = payload.get("revision", 1)
    edits = payload.get("edits", {}) or {}
    instruction = payload.get("instruction", "").strip()

    if not instruction:
        return {"filename": filename, "revision": revision + 1, "edits": edits}

    try:
        layout = editor_service.get_layout(filename)
        # Collect all text
        full_text = "\n".join([b.get("text", "") for b in layout.get("blocks", []) if b.get("type") == "paragraph"])
        
        # Use LLM to suggest paragraph modifications
        prompt = (
            f"Instruction: {instruction}\n\n"
            f"Current Document Text:\n{full_text}\n\n"
            f"Please output the modified or revised paragraph text based on the instruction."
        )
        ai_response = await llm_service.chat_completion(
            prompt=prompt,
            system_instruction="You are an official Revenue Recovery legal clerk. Provide the revised text accurately while preserving legal phrasing."
        )

        # Apply to main order/subject paragraph if targeted or update prompt history
        return {
            "filename": filename,
            "revision": revision + 1,
            "edits": edits,
            "ai_revision": ai_response.strip() if ai_response else None
        }
    except Exception as e:
        logger.warning(f"Revision error: {e}")
        return {"filename": filename, "revision": revision + 1, "edits": edits}


@router.post("/import", tags=["Editor"])
async def import_word_document(
    file: UploadFile = File(...)
):
    """Imports an external Word (.docx) file and returns its editable layout."""
    clean_filename = f"imported_{uuid.uuid4().hex[:8]}_{Path(file.filename).name}"
    saved_path = storage_provider.save_upload(file.file, clean_filename)
    try:
        layout = editor_service.docx_to_layout(saved_path, clean_filename)
        return layout
    except Exception as e:
        logger.error(f"Error importing Word document: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to import Word document: {str(e)}")


@router.post("/export", tags=["Editor"])
async def export_edited_document(
    payload: Dict[str, Any] = Body(...)
):
    """Exports edited document with applied paragraph updates to DOCX or PDF."""
    filename = payload.get("filename", "Proceedings.docx")
    edits = payload.get("edits", {}) or {}
    export_format = payload.get("format", "docx").lower()

    try:
        source_path = storage_provider.find_file(filename)
        doc = docx.Document(str(source_path))

        # Apply paragraph edits
        p_count = 0
        for p in doc.paragraphs:
            p_count += 1
            pid = f"p_{p_count}"
            if pid in edits and edits[pid] is not None:
                p.text = edits[pid]

        for t_idx, table in enumerate(doc.tables):
            for r_idx, row in enumerate(table.rows):
                for c_idx, cell in enumerate(row.cells):
                    for cp_idx, cp in enumerate(cell.paragraphs):
                        p_count += 1
                        c_pid = f"p_t{t_idx}_r{r_idx}_c{c_idx}_{cp_idx+1}"
                        if c_pid in edits and edits[c_pid] is not None:
                            cp.text = edits[c_pid]

        out_name = f"Edited_{Path(filename).stem}_{uuid.uuid4().hex[:6]}.docx"
        out_path = settings.OUTPUT_DIR / out_name
        doc.save(str(out_path))

        if export_format == "pdf":
            pdf_path = pdf_service.convert_docx_to_pdf(out_path)
            return FileResponse(
                path=str(pdf_path),
                filename=pdf_path.name,
                media_type="application/pdf"
            )

        return FileResponse(
            path=str(out_path),
            filename=out_name,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        )
    except Exception as e:
        logger.error(f"Error exporting document: {e}")
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")
