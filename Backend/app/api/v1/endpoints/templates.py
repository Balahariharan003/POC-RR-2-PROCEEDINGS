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


