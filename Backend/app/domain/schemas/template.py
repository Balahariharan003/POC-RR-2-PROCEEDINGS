"""
Template Management Schemas.
"""

from typing import Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict


class TemplateBase(BaseModel):
    template_code: str = Field(..., description="Unique template identifier e.g. customs_proceedings")
    name: str = Field(..., description="Human readable name")
    department_type: str = Field(default="GENERAL_RR", description="CUSTOMS | TNRERA | MCOP | COMMERCIAL_TAX | EXCISE | MAINTENANCE | GENERAL_RR")
    category: Optional[str] = "REVENUE_RECOVERY"
    description: Optional[str] = None
    heading_prefix: Optional[str] = None
    subject_template: Optional[str] = None
    reference_template: Optional[str] = None
    order_para1_template: Optional[str] = None
    order_para2_template: Optional[str] = None
    order_para3_template: Optional[str] = None
    enclosure_text: Optional[str] = "கடித நகல்"
    signatory_text: Optional[str] = None
    locked_template: Optional[str] = Field(default=None, description="Locked official template text with «SLOTS» and <<KEYS>>")
    slot_instructions: Optional[str] = Field(default=None, description="LLM prompt instructions for variable red slots")
    template_data: Optional[Dict[str, Any]] = Field(default=None, description="Native PostgreSQL JSONB template payload")
    file_name: Optional[str] = Field(default=None, description="Name of original or uploaded docx template")
    file_base64: Optional[str] = Field(default=None, description="Base64 encoded DOCX file binary")
    is_active: bool = True


class TemplateCreate(TemplateBase):
    pass


class TemplateUpdate(BaseModel):
    name: Optional[str] = None
    department_type: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    heading_prefix: Optional[str] = None
    subject_template: Optional[str] = None
    reference_template: Optional[str] = None
    order_para1_template: Optional[str] = None
    order_para2_template: Optional[str] = None
    order_para3_template: Optional[str] = None
    enclosure_text: Optional[str] = None
    signatory_text: Optional[str] = None
    locked_template: Optional[str] = None
    slot_instructions: Optional[str] = None
    template_data: Optional[Dict[str, Any]] = None
    file_name: Optional[str] = None
    file_base64: Optional[str] = None
    is_active: Optional[bool] = None


class TemplateResponse(TemplateBase):
    id: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


