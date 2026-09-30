"""
Template Management Schemas.
"""

from typing import Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict


class TemplateBase(BaseModel):
    template_code: str = Field(..., description="Unique template identifier e.g. customs_proceedings")
    name: str = Field(..., description="Human readable name")
    department_type: str = Field(default="CUSTOMS", description="CUSTOMS | TNRERA | MCOP | GENERAL_RR")
    subject_template: str
    reference_template: str
    order_para1_template: str
    order_para2_template: str
    order_para3_template: str
    enclosure_text: Optional[str] = "கடித நகல்"
    template_data: Optional[Dict[str, Any]] = Field(default=None, description="Native PostgreSQL JSONB template payload")
    is_active: bool = True


class TemplateCreate(TemplateBase):
    pass


class TemplateUpdate(BaseModel):
    name: Optional[str] = None
    subject_template: Optional[str] = None
    reference_template: Optional[str] = None
    order_para1_template: Optional[str] = None
    order_para2_template: Optional[str] = None
    order_para3_template: Optional[str] = None
    enclosure_text: Optional[str] = None
    template_data: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None


class TemplateResponse(TemplateBase):
    id: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
