"""
Audit Trail and Proceedings Ledger module backed strictly by PostgreSQL.
Stores every processed document, verification step, prompt revision, and DRO dispatch.
"""

import json
import uuid
from datetime import datetime
from typing import Dict, Any, List, Optional
from db import execute_query


def save_audit_entry(entry: Dict[str, Any]) -> Dict[str, Any]:
    """Inserts or updates an audit record in PostgreSQL."""
    audit_id = entry.get("id") or f"audit-{int(datetime.now().timestamp() * 1000)}"
    case_number = entry.get("caseNumber") or entry.get("case_number", "")
    roc_number = entry.get("rocNumber") or entry.get("roc_number", "")
    defaulter_name = entry.get("defaulterName") or entry.get("defaulter", {}).get("name", "") if isinstance(entry.get("defaulter"), dict) else str(entry.get("defaulterName", ""))
    amount = str(entry.get("amount") or "")
    taluk = entry.get("taluk", "")
    district = entry.get("district", "ஈரோடு")
    officer_name = entry.get("officerName") or entry.get("officer", "")
    status = entry.get("status", "DRAFT")
    template_code = entry.get("templateCode") or entry.get("template_code", "")
    document_content = entry.get("documentContent") or entry.get("document_content", "")
    file_name = entry.get("fileName") or entry.get("file_name", "")
    file_size = entry.get("fileSize") or entry.get("file_size", "")
    sha256_digest = entry.get("sha256Digest") or entry.get("sha256_digest", "")
    dispatch_receipt = entry.get("dispatchReceipt") or entry.get("dispatch_receipt", "")
    grounding_score = entry.get("groundingScore", 0.98)
    hallucination_score = entry.get("hallucinationScore", 0.02)
    
    prompt_history = entry.get("promptHistory") or entry.get("prompt_history", [])
    if isinstance(prompt_history, str):
        try:
            prompt_history = json.loads(prompt_history)
        except Exception:
            prompt_history = []

    entities_data = entry.get("entities") or entry.get("entities_data", {})
    if isinstance(entities_data, str):
        try:
            entities_data = json.loads(entities_data)
        except Exception:
            entities_data = {}

    sql = """
    INSERT INTO audit_logs (
        id, case_number, roc_number, defaulter_name, amount, taluk, district,
        officer_name, status, template_code, document_content, file_name, file_size,
        sha256_digest, dispatch_receipt, grounding_score, hallucination_score,
        prompt_history, entities_data, created_at, updated_at
    ) VALUES (
        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
    ON CONFLICT (id) DO UPDATE SET
        case_number = EXCLUDED.case_number,
        roc_number = EXCLUDED.roc_number,
        defaulter_name = EXCLUDED.defaulter_name,
        amount = EXCLUDED.amount,
        taluk = EXCLUDED.taluk,
        status = EXCLUDED.status,
        document_content = EXCLUDED.document_content,
        dispatch_receipt = EXCLUDED.dispatch_receipt,
        prompt_history = EXCLUDED.prompt_history,
        entities_data = EXCLUDED.entities_data,
        updated_at = CURRENT_TIMESTAMP
    RETURNING *;
    """
    row = execute_query(
        sql,
        (
            audit_id, case_number, roc_number, defaulter_name, amount, taluk, district,
            officer_name, status, template_code, document_content, file_name, file_size,
            sha256_digest, dispatch_receipt, grounding_score, hallucination_score,
            json.dumps(prompt_history), json.dumps(entities_data)
        ),
        fetch_one=True
    )
    return row


def get_all_audit_logs() -> Dict[str, List[Dict[str, Any]]]:
    """Retrieves all audit logs grouped by Month-Year for the UI."""
    sql = "SELECT * FROM audit_logs ORDER BY created_at DESC"
    rows = execute_query(sql, fetch_all=True)
    
    grouped: Dict[str, List[Dict[str, Any]]] = {}
    for r in rows:
        dt = r.get("created_at") or datetime.now()
        month_label = dt.strftime("%B %Y")
        if month_label not in grouped:
            grouped[month_label] = []
        
        # Format for frontend schema
        entry = {
            "id": r["id"],
            "caseNumber": r.get("case_number"),
            "rocNumber": r.get("roc_number"),
            "defaulterName": r.get("defaulter_name"),
            "amount": r.get("amount"),
            "taluk": r.get("taluk"),
            "district": r.get("district"),
            "officer": r.get("officer_name"),
            "status": r.get("status"),
            "templateCode": r.get("template_code"),
            "documentContent": r.get("document_content"),
            "fileName": r.get("file_name"),
            "fileSize": r.get("file_size"),
            "sha256Digest": r.get("sha256_digest"),
            "dispatchReceipt": r.get("dispatch_receipt"),
            "groundingScore": float(r.get("grounding_score") or 0.98),
            "hallucinationScore": float(r.get("hallucination_score") or 0.02),
            "timestamp": r["created_at"].isoformat() if hasattr(r["created_at"], "isoformat") else str(r["created_at"]),
            "formattedDate": r["created_at"].strftime("%d %b %Y, %I:%M %p") if hasattr(r["created_at"], "strftime") else str(r["created_at"]),
            "promptHistory": r.get("prompt_history") or [],
            "entities": r.get("entities_data") or {}
        }
        grouped[month_label].append(entry)

    return grouped
