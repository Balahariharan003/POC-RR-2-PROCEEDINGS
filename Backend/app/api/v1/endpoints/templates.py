import uuid
from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.domain.models import DocumentTemplate, AuditLedgerEntry
from app.domain.schemas.template import TemplateCreate, TemplateUpdate, TemplateResponse
from app.repositories.template_repository import TemplateRepository
from app.api.dependencies import require_role

router = APIRouter()
template_repo = TemplateRepository()


@router.get("", response_model=List[TemplateResponse], tags=["Templates"])
@router.get("/", response_model=List[TemplateResponse], tags=["Templates"])
async def list_templates(db: AsyncSession = Depends(get_db)):
    return await template_repo.list_all(db)


@router.post("", response_model=TemplateResponse, status_code=status.HTTP_201_CREATED, tags=["Templates"])
@router.post("/", response_model=TemplateResponse, status_code=status.HTTP_201_CREATED, tags=["Templates"])
async def create_template(
    tpl_in: TemplateCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role(["SUPER_ADMIN", "COLLECTOR", "DRO", "admin"]))
):
    existing = await template_repo.get_by_code(db, tpl_in.template_code)
    if existing:
        raise HTTPException(status_code=400, detail=f"Template '{tpl_in.template_code}' already exists.")

    obj = DocumentTemplate(**tpl_in.model_dump())
    created = await template_repo.create(db, obj)

    # Record to audit ledger
    audit_log = AuditLedgerEntry(
        id=str(uuid.uuid4()),
        action="TEMPLATE_CREATED",
        file_id=created.template_code,
        user_id=getattr(current_user, "username", "admin"),
        details={
            "template_code": created.template_code,
            "name": created.name,
            "department_type": created.department_type,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
        signature=f"v2:template_create:{created.template_code}",
    )
    db.add(audit_log)
    await db.commit()
    return created


@router.get("/{code}", response_model=TemplateResponse, tags=["Templates"])
async def get_template(code: str, db: AsyncSession = Depends(get_db)):
    tpl = await template_repo.get_by_code(db, code)
    if not tpl:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Template '{code}' not found.")
    return tpl


from app.services.editor_service import EditorService
editor_service = EditorService()

@router.get("/{code}/layout", tags=["Templates"])
async def get_template_layout(code: str, db: AsyncSession = Depends(get_db)):
    """Returns the real interactive DOCX layout of the template for browser-based editing."""
    tpl = await template_repo.get_by_code(db, code)
    if not tpl:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Template '{code}' not found.")
    
    # If custom layout blocks have been saved, return them so user edits persist across reloads
    if tpl.template_data and isinstance(tpl.template_data, dict) and "blocks" in tpl.template_data:
        return tpl.template_data

    if tpl.file_base64:
        try:
            raw_bytes = base64.b64decode(tpl.file_base64)
            return editor_service.bytes_to_layout(raw_bytes, tpl.file_name or f"{tpl.template_code}.docx")
        except Exception as e:
            logger.warning(f"Could not parse binary docx for template {code}: {e}")
    
    return editor_service.template_model_to_layout(tpl)


@router.put("/{code}", response_model=TemplateResponse, tags=["Templates"])
async def update_template(
    code: str,
    tpl_in: TemplateUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role(["SUPER_ADMIN", "COLLECTOR", "DRO", "admin"]))
):
    tpl = await template_repo.get_by_code(db, code)
    if not tpl:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Template '{code}' not found.")

    update_data = tpl_in.model_dump(exclude_unset=True)
    updated = await template_repo.update(db, tpl.id, **update_data)

    # Record to audit ledger
    audit_log = AuditLedgerEntry(
        id=str(uuid.uuid4()),
        action="TEMPLATE_UPDATED",
        file_id=tpl.template_code,
        user_id=getattr(current_user, "username", "admin"),
        details={
            "template_code": tpl.template_code,
            "name": updated.name if updated else tpl.name,
            "updated_fields": list(update_data.keys()),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
        signature=f"v2:template_update:{tpl.template_code}",
    )
    db.add(audit_log)
    await db.commit()
    return updated


import base64
import io
from fastapi import File, UploadFile, Response

@router.get("/{code}/download", tags=["Templates"])
async def download_template_docx(code: str, db: AsyncSession = Depends(get_db)):
    tpl = await template_repo.get_by_code(db, code)
    if not tpl:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Template '{code}' not found.")
    
    if not tpl.file_base64:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Template '{code}' does not have a binary DOCX file stored.")
    
    binary_data = base64.b64decode(tpl.file_base64)
    file_name = tpl.file_name or f"{tpl.template_code}.docx"
    
    return Response(
        content=binary_data,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{file_name}"'}
    )


@router.post("/{code}/upload", response_model=TemplateResponse, tags=["Templates"])
async def upload_template_docx(
    code: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role(["SUPER_ADMIN", "COLLECTOR", "DRO", "admin"]))
):
    tpl = await template_repo.get_by_code(db, code)
    content = await file.read()
    b64_content = base64.b64encode(content).decode("utf-8")
    
    # Try reading text from docx to update locked_template if desired
    import docx
    try:
        doc = docx.Document(io.BytesIO(content))
        doc_text = "\n".join([p.text for p in doc.paragraphs if p.text.strip()])
    except Exception:
        doc_text = ""

    if not tpl:
        # Auto-create template from uploaded file
        display_name = file.filename.replace('.docx', '').replace('_', ' ').replace('-', ' ').strip()
        tpl = DocumentTemplate(
            template_code=code,
            name=display_name or f"Uploaded Template ({code})",
            department_type="GENERAL_RR",
            category="PROCEEDINGS",
            description=f"Auto-generated template from {file.filename}",
            locked_template=doc_text,
            file_base64=b64_content,
            file_name=file.filename,
            is_active=True,
        )
        updated = await template_repo.create(db, tpl)
        action_type = "TEMPLATE_CREATED_VIA_DOCX"
    else:
        updated = await template_repo.update(
            db,
            tpl.id,
            file_base64=b64_content,
            file_name=file.filename,
            locked_template=doc_text or tpl.locked_template
        )
        action_type = "TEMPLATE_DOCX_UPLOADED"

    # Record to audit ledger
    audit_log = AuditLedgerEntry(
        id=str(uuid.uuid4()),
        action=action_type,
        file_id=code,
        user_id=getattr(current_user, "username", "admin"),
        details={
            "template_code": code,
            "filename": file.filename,
            "size_bytes": len(content),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
        signature=f"v2:template_upload:{code}",
    )
    db.add(audit_log)
    await db.commit()
    return updated


@router.delete("/{code}", tags=["Templates"])
async def delete_template(
    code: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role(["SUPER_ADMIN", "COLLECTOR", "DRO", "admin"]))
):
    tpl = await template_repo.get_by_code(db, code)
    if not tpl:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Template '{code}' not found.")

    await template_repo.delete(db, tpl.id)

    # Record to audit ledger
    audit_log = AuditLedgerEntry(
        id=str(uuid.uuid4()),
        action="TEMPLATE_DELETED",
        file_id=tpl.template_code,
        user_id=getattr(current_user, "username", "admin"),
        details={
            "template_code": tpl.template_code,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
        signature=f"v2:template_delete:{tpl.template_code}",
    )
    db.add(audit_log)
    await db.commit()
    return {"status": "SUCCESS", "message": f"Template '{code}' deleted successfully."}


