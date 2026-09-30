"""
Template Management Endpoints.
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.domain.models import DocumentTemplate
from app.domain.schemas.template import TemplateCreate, TemplateUpdate, TemplateResponse
from app.repositories.template_repository import TemplateRepository
from app.api.dependencies import require_role

router = APIRouter()
template_repo = TemplateRepository()


@router.get("/", response_model=List[TemplateResponse], tags=["Templates"])
async def list_templates(db: AsyncSession = Depends(get_db)):
    return await template_repo.list_all(db)


@router.post("/", response_model=TemplateResponse, status_code=status.HTTP_201_CREATED, tags=["Templates"])
async def create_template(
    tpl_in: TemplateCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role(["SUPER_ADMIN", "COLLECTOR", "DRO"]))
):
    existing = await template_repo.get_by_code(db, tpl_in.template_code)
    if existing:
        raise HTTPException(status_code=400, detail=f"Template '{tpl_in.template_code}' already exists.")

    obj = DocumentTemplate(**tpl_in.model_dump())
    return await template_repo.create(db, obj)


@router.get("/{code}", response_model=TemplateResponse, tags=["Templates"])
async def get_template(code: str, db: AsyncSession = Depends(get_db)):
    tpl = await template_repo.get_by_code(db, code)
    if not tpl:
        raise HTTPException(status_code=404, detail="Template not found")
    return tpl
