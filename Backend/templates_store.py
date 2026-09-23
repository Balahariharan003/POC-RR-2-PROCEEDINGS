"""
Template Store module backed by PostgreSQL.
Handles dynamic CRUD operations for proceedings templates, allowing Admin to add, edit, and delete templates.
Renders templates into official Tamil Nadu Revenue Recovery formats using TAU-Marutham font.
"""

import json
import uuid
from typing import Dict, Any, List, Optional
from jinja2 import Template

from db import execute_query
from config import PRIMARY_FONT_TAMIL


def list_templates(department: Optional[str] = None, category: Optional[str] = None) -> List[Dict[str, Any]]:
    """Returns all active templates from PostgreSQL, optionally filtered."""
    query = "SELECT * FROM proceedings_templates WHERE is_active = TRUE"
    params = []
    if department:
        query += " AND department = %s"
        params.append(department.upper())
    if category:
        query += " AND category = %s"
        params.append(category.upper())
    query += " ORDER BY is_system DESC, name ASC"
    
    rows = execute_query(query, tuple(params), fetch_all=True)
    # Parse JSON fields
    for r in rows:
        _deserialize_template_fields(r)
    return rows


def get_template(identifier: str) -> Optional[Dict[str, Any]]:
    """Retrieves a single template by ID or unique code."""
    query = "SELECT * FROM proceedings_templates WHERE (id = %s OR code = %s) AND is_active = TRUE"
    row = execute_query(query, (identifier, identifier), fetch_one=True)
    if row:
        _deserialize_template_fields(row)
    return row


def create_template(data: Dict[str, Any], created_by: Optional[str] = None) -> Dict[str, Any]:
    """Creates a new template in PostgreSQL (Admin Only)."""
    t_id = data.get("id") or f"tpl-{uuid.uuid4().hex[:8]}"
    code = data.get("code") or f"custom_{uuid.uuid4().hex[:6]}"
    name = data.get("name", "New Template")
    department = data.get("department", "GENERAL").upper()
    category = data.get("category", "CUSTOM").upper()
    description = data.get("description", "")
    heading_prefix = data.get("heading_prefix", "பிறப்பிப்பவர்: திரு.ச.கந்தசாமி, இ.ஆ.ப.,")
    subject_template = data.get("subject_template", "")
    reference_template = data.get("reference_template", "")
    
    order_paras = data.get("order_paras", [])
    if isinstance(order_paras, str):
        try:
            order_paras = json.loads(order_paras)
        except Exception:
            order_paras = [p.strip() for p in order_paras.split("\n\n") if p.strip()]

    enclosure_text = data.get("enclosure_text", "கடித நகல்")
    signatory_text = data.get("signatory_text", "மாவட்ட ஆட்சித் தலைவர்,\n{{district_name}}.")
    
    recipients = data.get("recipients", [])
    if isinstance(recipients, str):
        try:
            recipients = json.loads(recipients)
        except Exception:
            recipients = []

    submission_paras = data.get("submission_paras", [])
    if isinstance(submission_paras, str):
        try:
            submission_paras = json.loads(submission_paras)
        except Exception:
            submission_paras = []

    font_name = PRIMARY_FONT_TAMIL  # Always TAU-Marutham

    insert_sql = """
    INSERT INTO proceedings_templates (
        id, code, name, department, category, description, heading_prefix,
        subject_template, reference_template, order_paras, enclosure_text,
        signatory_text, recipients, submission_paras, font_name, is_system, is_active, created_by
    ) VALUES (
        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, FALSE, TRUE, %s
    ) RETURNING *;
    """
    row = execute_query(
        insert_sql,
        (
            t_id, code, name, department, category, description, heading_prefix,
            subject_template, reference_template, json.dumps(order_paras), enclosure_text,
            signatory_text, json.dumps(recipients), json.dumps(submission_paras), font_name, created_by
        ),
        fetch_one=True
    )
    _deserialize_template_fields(row)
    return row


def update_template(identifier: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Updates an existing template in PostgreSQL (Admin Only)."""
    current = get_template(identifier)
    if not current:
        return None

    name = data.get("name", current["name"])
    department = data.get("department", current["department"]).upper()
    category = data.get("category", current["category"]).upper()
    description = data.get("description", current.get("description", ""))
    heading_prefix = data.get("heading_prefix", current.get("heading_prefix", ""))
    subject_template = data.get("subject_template", current.get("subject_template", ""))
    reference_template = data.get("reference_template", current.get("reference_template", ""))
    
    order_paras = data.get("order_paras", current.get("order_paras", []))
    if isinstance(order_paras, str):
        try:
            order_paras = json.loads(order_paras)
        except Exception:
            order_paras = [p.strip() for p in order_paras.split("\n\n") if p.strip()]

    enclosure_text = data.get("enclosure_text", current.get("enclosure_text", "கடித நகல்"))
    signatory_text = data.get("signatory_text", current.get("signatory_text", "மாவட்ட ஆட்சித் தலைவர்,\n{{district_name}}."))
    
    recipients = data.get("recipients", current.get("recipients", []))
    if isinstance(recipients, str):
        try:
            recipients = json.loads(recipients)
        except Exception:
            recipients = []

    submission_paras = data.get("submission_paras", current.get("submission_paras", []))
    if isinstance(submission_paras, str):
        try:
            submission_paras = json.loads(submission_paras)
        except Exception:
            submission_paras = []

    update_sql = """
    UPDATE proceedings_templates SET
        name = %s, department = %s, category = %s, description = %s, heading_prefix = %s,
        subject_template = %s, reference_template = %s, order_paras = %s, enclosure_text = %s,
        signatory_text = %s, recipients = %s, submission_paras = %s, font_name = %s,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = %s
    RETURNING *;
    """
    row = execute_query(
        update_sql,
        (
            name, department, category, description, heading_prefix,
            subject_template, reference_template, json.dumps(order_paras), enclosure_text,
            signatory_text, json.dumps(recipients), json.dumps(submission_paras), PRIMARY_FONT_TAMIL,
            current["id"]
        ),
        fetch_one=True
    )
    if row:
        _deserialize_template_fields(row)
    return row


def delete_template(identifier: str) -> bool:
    """Deletes or deactivates a template in PostgreSQL (Admin Only)."""
    current = get_template(identifier)
    if not current:
        return False
    if current.get("is_system"):
        # Soft delete system templates to preserve historical integrity
        execute_query("UPDATE proceedings_templates SET is_active = FALSE WHERE id = %s", (current["id"],))
    else:
        execute_query("DELETE FROM proceedings_templates WHERE id = %s", (current["id"],))
    return True


def render_template_to_text(template_data: Dict[str, Any], context: Dict[str, Any]) -> str:
    """Renders the template into full Tamil document sheet text."""
    def _render_j(tmpl_str: str) -> str:
        if not tmpl_str:
            return ""
        try:
            return Template(tmpl_str).render(**context)
        except Exception:
            return tmpl_str

    category = template_data.get("category", "PROCEEDINGS")
    heading_prefix = _render_j(template_data.get("heading_prefix", ""))
    roc = context.get("roc_number") or f"ந.க. {context.get('file_no', '1248')}/{context.get('file_year', '2026')}/{context.get('section_code', 'ஈ2')}"
    date_val = context.get("proceedings_date") or f"        .05.{context.get('file_year', '2026')}."
    
    subject = _render_j(template_data.get("subject_template", ""))
    reference = _render_j(template_data.get("reference_template", ""))
    order_paras = [_render_j(p) for p in template_data.get("order_paras", [])]
    enclosure = _render_j(template_data.get("enclosure_text", "கடித நகல்"))
    signatory = _render_j(template_data.get("signatory_text", f"மாவட்ட ஆட்சித் தலைவர்,\n{context.get('district_name', 'ஈரோடு')}."))
    recipients = template_data.get("recipients", [])
    submission_paras = [_render_j(p) for p in template_data.get("submission_paras", [])]

    lines = []
    district = context.get("district_name", "ஈரோடு")

    if category == "OFFICE_NOTE":
        lines.append(f"{roc}")
        lines.append("//அலுவலகக் குறிப்பு//")
        lines.append(f"பொருள்: {subject}")
        lines.append(f"பார்வை: {reference}")
        lines.append("-------")
        lines.append("பணிந்தனுப்பப்படுகிறது:")
        for sp in submission_paras:
            lines.append(f"   {sp}")
        lines.append("")
        lines.append(signatory)
    elif category == "MEMORANDUM":
        lines.append("//குறிப்பாணை//")
        lines.append(f"மு.மு.{roc.replace('ந.க.', '').strip()} \t {date_val}")
        lines.append(f"{district} மாவட்ட ஆட்சியர் அலுவலகம்.")
        lines.append(f"பொருள்: {subject}")
        lines.append(f"பார்வை: {reference}")
        lines.append("-------")
        for op in order_paras:
            lines.append(f"   {op}")
        lines.append("")
        lines.append(signatory)
        lines.append("")
        for r in recipients:
            lbl = r.get("label", "பெறுநர்")
            val = _render_j(r.get("value", ""))
            lines.append(f"{lbl}: {val}")
    else:  # PROCEEDINGS
        lines.append(f"{district} மாவட்ட ஆட்சித் தலைவர் மற்றும்")
        lines.append("மாவட்ட நிர்வாக நடுவர் அவர்களின் செயல்முறைகள்")
        if heading_prefix:
            lines.append(heading_prefix)
        lines.append(f"{roc} \t நாள்: {date_val}")
        lines.append(f"பொருள்: {subject}")
        lines.append(f"பார்வை: {reference}")
        lines.append("-------")
        lines.append("உத்தரவு:")
        for op in order_paras:
            lines.append(f"   {op}")
        lines.append("")
        if enclosure:
            lines.append(f"இணைப்பு: {enclosure}")
        lines.append("")
        lines.append(signatory)
        lines.append("")
        for r in recipients:
            lbl = r.get("label", "பெறுநர்")
            val = _render_j(r.get("value", ""))
            lines.append(f"{lbl}: {val}")

    return "\n".join(lines)


def _deserialize_template_fields(t: Dict[str, Any]):
    """Helper to parse JSON string fields into Python lists/dicts."""
    for field in ["order_paras", "recipients", "submission_paras"]:
        if field in t and isinstance(t[field], str):
            try:
                t[field] = json.loads(t[field])
            except Exception:
                t[field] = []
