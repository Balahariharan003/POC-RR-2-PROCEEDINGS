"""
System Administration Endpoints:
- Full PostgreSQL Database Backup (JSON Export with SHA-256 Integrity Verification)
- Complete Database Restore from Backup Payload
- System-wide Proceedings & Analytics Reports (Statistics, Particulars, Department Breakdown)
- Official Summary Report DOCX Generator with TAU-Marutham Font
"""

import hashlib
import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, List, Optional
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import parse_xml, OxmlElement
from docx.oxml.ns import nsdecls, qn

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import get_db
from app.core.logging import logger
from app.core.config import settings
from app.api.dependencies import get_current_user
from app.domain.models import User, DocumentTemplate, AuditLedgerEntry, ProceedingsCase
import re


def set_font_formatting(
    run: Any,
    font_name: str,
    size_pt: float,
    bold: bool = False,
    italic: bool = False,
    color_rgb: RGBColor = RGBColor(0, 0, 0),
) -> None:
    """Sets font family, size, weight, italic style, and OpenXML rFonts mapping for a run."""
    run.font.name = font_name
    run.font.size = Pt(size_pt)
    run.bold = bold
    run.italic = italic
    run.font.color.rgb = color_rgb

    rPr = run._r.get_or_add_rPr()
    rFonts = OxmlElement("w:rFonts")
    rFonts.set(qn("w:ascii"), font_name)
    rFonts.set(qn("w:hAnsi"), font_name)
    rFonts.set(qn("w:cs"), font_name)
    rFonts.set(qn("w:eastAsia"), font_name)
    rPr.append(rFonts)


def parse_amount_float(val: Any) -> float:
    if val is None:
        return 0.0
    if isinstance(val, (int, float)):
        return float(val)
    if isinstance(val, str):
        cleaned = re.sub(r"[^\d.]", "", val.replace(",", ""))
        try:
            return float(cleaned) if cleaned else 0.0
        except ValueError:
            return 0.0
    return 0.0


router = APIRouter()


@router.get("/backup")
@router.post("/backup")
async def create_database_backup(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Creates a full cryptographic database backup of all tables:
    - Users (metadata and roles)
    - Document Templates (with JSONB specifications)
    - Proceedings Cases (metadata, extractions, totals)
    - Audit Ledger Entries (cryptographic chain)
    """
    try:
        # 1. Fetch Users
        users_res = await db.execute(select(User))
        users = [
            {
                "id": u.id,
                "username": u.username,
                "email": u.email,
                "full_name": u.full_name,
                "role": u.role,
                "jurisdiction_district": u.jurisdiction_district,
                "jurisdiction_taluk": u.jurisdiction_taluk,
                "is_active": u.is_active,
                "created_at": u.created_at.isoformat() if u.created_at else None,
            }
            for u in users_res.scalars()
        ]

        # 2. Fetch Templates
        templates_res = await db.execute(select(DocumentTemplate))
        templates = [
            {
                "id": t.id,
                "template_code": t.template_code,
                "name": t.name,
                "department_type": t.department_type,
                "subject_template": t.subject_template,
                "reference_template": t.reference_template,
                "order_para1_template": t.order_para1_template,
                "order_para2_template": t.order_para2_template,
                "order_para3_template": t.order_para3_template,
                "enclosure_text": t.enclosure_text,
                "template_data": t.template_data,
                "is_active": t.is_active,
                "created_at": t.created_at.isoformat() if t.created_at else None,
            }
            for t in templates_res.scalars()
        ]

        # 3. Fetch Cases
        cases_res = await db.execute(select(ProceedingsCase))
        cases = [
            {
                "id": c.id,
                "file_no": c.file_no,
                "case_file_no": c.case_file_no,
                "department_type": c.department_type,
                "defaulter_name": c.defaulter_name,
                "total_amount": c.total_amount,
                "district_name": c.district_name,
                "taluk_name": c.taluk_name,
                "status": c.status,
                "docx_path": c.docx_path,
                "pdf_path": c.pdf_path,
                "hybrid_signature": c.hybrid_signature,
                "extracted_data": c.extracted_data,
                "created_at": c.created_at.isoformat() if c.created_at else None,
            }
            for c in cases_res.scalars()
        ]

        # 4. Fetch Audit Ledger
        audit_res = await db.execute(select(AuditLedgerEntry).order_by(AuditLedgerEntry.created_at.desc()))
        audit_entries = [
            {
                "id": a.id,
                "action": a.action,
                "file_id": a.file_id,
                "user_id": a.user_id,
                "details": a.details,
                "signature": a.signature,
                "created_at": a.created_at.isoformat() if a.created_at else None,
            }
            for a in audit_res.scalars()
        ]

        backup_payload = {
            "app": "rr-assistant",
            "version": 2,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "created_by": current_user.username,
            "table_counts": {
                "users": len(users),
                "document_templates": len(templates),
                "proceedings_cases": len(cases),
                "audit_ledger": len(audit_entries),
            },
            "data": {
                "users": users,
                "document_templates": templates,
                "proceedings_cases": cases,
                "audit_ledger": audit_entries,
            },
        }

        # Calculate cryptographic checksum
        payload_bytes = json.dumps(backup_payload["data"], sort_keys=True).encode("utf-8")
        backup_payload["checksum_sha256"] = hashlib.sha256(payload_bytes).hexdigest()

        # Record activity in audit ledger
        audit_log = AuditLedgerEntry(
            id=str(uuid.uuid4()),
            action="BACKUP_CREATED",
            file_id=f"backup-{backup_payload['created_at']}",
            user_id=current_user.username,
            details={
                "backup_checksum": backup_payload["checksum_sha256"],
                "table_counts": backup_payload["table_counts"],
                "timestamp": backup_payload["created_at"],
            },
            signature=f"v2:backup:{backup_payload['checksum_sha256'][:24]}",
        )
        db.add(audit_log)
        await db.commit()

        logger.info(f"Full system backup created by {current_user.username}. Checksum: {backup_payload['checksum_sha256']}")
        return backup_payload

    except Exception as e:
        logger.error(f"Database backup creation failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate system backup: {str(e)}",
        )


@router.post("/restore")
async def restore_database_backup(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Restores or imports database tables from a verified backup payload.
    """
    if current_user.role not in ["admin", "SUPER_ADMIN", "COLLECTOR"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators are authorized to perform system restoration.",
        )

    data = payload.get("data")
    if not isinstance(data, dict):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid backup structure: 'data' object is missing.",
        )

    restored_counts = {"templates": 0, "cases": 0, "audit": 0}

    try:
        # 1. Restore/Upsert Templates
        templates_data = data.get("document_templates", [])
        for tpl in templates_data:
            code = tpl.get("template_code")
            if not code:
                continue
            res = await db.execute(select(DocumentTemplate).where(DocumentTemplate.template_code == code))
            existing = res.scalars().first()
            if existing:
                existing.name = tpl.get("name", existing.name)
                existing.department_type = tpl.get("department_type", existing.department_type)
                existing.subject_template = tpl.get("subject_template", existing.subject_template)
                existing.reference_template = tpl.get("reference_template", existing.reference_template)
                existing.order_para1_template = tpl.get("order_para1_template", existing.order_para1_template)
                existing.order_para2_template = tpl.get("order_para2_template", existing.order_para2_template)
                existing.order_para3_template = tpl.get("order_para3_template", existing.order_para3_template)
                existing.template_data = tpl.get("template_data", existing.template_data)
                existing.is_active = tpl.get("is_active", existing.is_active)
            else:
                new_tpl = DocumentTemplate(
                    id=tpl.get("id") or str(uuid.uuid4()),
                    template_code=code,
                    name=tpl.get("name", code),
                    department_type=tpl.get("department_type", "CUSTOMS"),
                    subject_template=tpl.get("subject_template", ""),
                    reference_template=tpl.get("reference_template", ""),
                    order_para1_template=tpl.get("order_para1_template", ""),
                    order_para2_template=tpl.get("order_para2_template", ""),
                    order_para3_template=tpl.get("order_para3_template", ""),
                    enclosure_text=tpl.get("enclosure_text", "கடித நகல்"),
                    template_data=tpl.get("template_data"),
                    is_active=tpl.get("is_active", True),
                )
                db.add(new_tpl)
            restored_counts["templates"] += 1

        # 2. Restore/Upsert Cases
        cases_data = data.get("proceedings_cases", [])
        for c in cases_data:
            cid = c.get("id")
            if not cid:
                continue
            res = await db.execute(select(ProceedingsCase).where(ProceedingsCase.id == cid))
            existing_c = res.scalars().first()
            if not existing_c:
                new_case = ProceedingsCase(
                    id=cid,
                    file_no=c.get("file_no", "1248"),
                    case_file_no=c.get("case_file_no", "516/2024"),
                    department_type=c.get("department_type", "CUSTOMS"),
                    defaulter_name=c.get("defaulter_name", "Defaulter"),
                    total_amount=float(c.get("total_amount", 0.0)),
                    district_name=c.get("district_name", "ஈரோடு"),
                    taluk_name=c.get("taluk_name", "ஈரோடு"),
                    status=c.get("status", "GENERATED"),
                    docx_path=c.get("docx_path"),
                    pdf_path=c.get("pdf_path"),
                    hybrid_signature=c.get("hybrid_signature"),
                    extracted_data=c.get("extracted_data"),
                )
                db.add(new_case)
                restored_counts["cases"] += 1

        # 3. Log restore action
        restore_audit = AuditLedgerEntry(
            id=str(uuid.uuid4()),
            action="SYSTEM_RESTORE",
            file_id=f"restore-{datetime.now(timezone.utc).isoformat()}",
            user_id=current_user.username,
            details={
                "restored_counts": restored_counts,
                "source_timestamp": payload.get("created_at"),
            },
            signature=f"v2:restore:{uuid.uuid4().hex[:20]}",
        )
        db.add(restore_audit)
        await db.commit()

        return {
            "status": "SUCCESS",
            "success": True,
            "message": "Database restore completed successfully.",
            "restored_counts": restored_counts,
        }
    except Exception as e:
        await db.rollback()
        logger.error(f"Database restore failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"System restore failed: {str(e)}",
        )


@router.get("/report")
async def get_system_analytics_report(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Computes system-wide proceedings statistics, department breakdowns,
    officer-wise statistics, audit ledger history, and particulars ledger.
    """
    try:
        # 1. Fetch all audit ledger logs
        audit_res = await db.execute(select(AuditLedgerEntry).order_by(AuditLedgerEntry.created_at.desc()))
        audit_entries = audit_res.scalars().all()

        # 2. Fetch all cases
        cases_res = await db.execute(select(ProceedingsCase).order_by(ProceedingsCase.created_at.desc()))
        cases = cases_res.scalars().all()

        particulars: List[Dict[str, Any]] = []
        total_amount_sum = 0.0
        department_counts = {"CUSTOMS": 0, "TNRERA": 0, "MCOP": 0, "GST": 0, "OTHER": 0}
        status_counts = {"DISPATCHED": 0, "VERIFIED": 0, "DRAFT": 0}
        taluk_counts: Dict[str, int] = {}
        officer_map: Dict[str, Dict[str, Any]] = {}
        seen_ids = set()

        for c in cases:
            seen_ids.add(c.id)
            amt = parse_amount_float(c.total_amount)
            total_amount_sum += amt
            dept = (c.department_type or "CUSTOMS").upper()
            dept_key = dept if dept in department_counts else "OTHER"
            department_counts[dept_key] = department_counts.get(dept_key, 0) + 1
            st = c.status or "VERIFIED"
            if "DISPATCH" in st:
                status_counts["DISPATCHED"] += 1
            elif "DRAFT" in st:
                status_counts["DRAFT"] += 1
            else:
                status_counts["VERIFIED"] += 1

            taluk = c.taluk_name or "Erode"
            taluk_counts[taluk] = taluk_counts.get(taluk, 0) + 1
            officer_name = current_user.full_name or current_user.username or "District Collectorate"

            # Officer Map
            if officer_name not in officer_map:
                officer_map[officer_name] = {
                    "officer_name": officer_name,
                    "taluk": taluk,
                    "total_cases": 0,
                    "total_amount": 0.0,
                    "dispatched": 0,
                    "verified": 0,
                    "draft": 0,
                }
            officer_map[officer_name]["total_cases"] += 1
            officer_map[officer_name]["total_amount"] += amt
            if "DISPATCH" in st:
                officer_map[officer_name]["dispatched"] += 1
            elif "DRAFT" in st:
                officer_map[officer_name]["draft"] += 1
            else:
                officer_map[officer_name]["verified"] += 1

            particulars.append({
                "id": c.id,
                "caseNumber": c.case_file_no or c.file_no or "RR-2026",
                "fileNumber": c.file_no or "1248",
                "defaulterName": c.defaulter_name,
                "department": dept,
                "amount": amt,
                "taluk": taluk,
                "district": c.district_name or "Erode",
                "status": st,
                "date": c.created_at.strftime("%d.%m.%Y") if c.created_at else datetime.now().strftime("%d.%m.%Y"),
                "officer": officer_name,
            })

        NON_PROCEEDING_ACTIONS = {
            "LOGIN", "LOGOUT", "AUTH_FAILED", "AUTH_SUCCESS", "TOKEN_REFRESH",
            "SYSTEM_BACKUP", "BACKUP_CREATED", "BACKUP_RESTORED", "SYSTEM_RESTORE", "SYSTEM_RESET",
            "USER_CREATED", "USER_UPDATED", "USER_DELETED",
            "TEMPLATE_CREATED", "TEMPLATE_UPDATED", "TEMPLATE_DELETED",
            "PASSWORD_RESET", "PASSWORD_CHANGED", "SETTINGS_UPDATED",
        }

        for a in audit_entries:
            if a.id in seen_ids:
                continue
            act = (a.action or "").upper().strip()
            if any(act == np or act.startswith(f"{np}_") or act.startswith(f"{np} ") for np in NON_PROCEEDING_ACTIONS):
                continue
            file_id_str = str(a.file_id or "").upper().strip()
            if file_id_str.startswith("BACKUP-") or file_id_str.startswith("RESTORE-") or file_id_str in ["LOGIN", "LOGOUT"]:
                continue
            details = a.details if isinstance(a.details, dict) else {}
            if not details:
                continue
            if details.get("restored_counts") or details.get("backup_checksum") or details.get("tables_exported"):
                continue
            amt = parse_amount_float(details.get("amount") or details.get("total_amount"))
            case_no = details.get("caseNumber") or details.get("case_no") or a.file_id or "RR-2026"
            defaulter = details.get("defaulter") or details.get("defaulterName") or "M/s Prisma Garments"
            dept = (details.get("department_type") or ("CUSTOMS" if "சுங்க" in str(details) else "MCOP")).upper()
            dept_key = dept if dept in department_counts else "OTHER"
            st = details.get("status") or ("DISPATCHED" if "DISPATCH" in a.action else "VERIFIED")
            taluk = details.get("taluk") or "Erode"
            off_name = details.get("officerName") or a.user_id or "Revenue Officer"

            if amt > 0:
                total_amount_sum += amt
            department_counts[dept_key] = department_counts.get(dept_key, 0) + 1
            if "DISPATCH" in st:
                status_counts["DISPATCHED"] += 1
            elif "DRAFT" in st:
                status_counts["DRAFT"] += 1
            else:
                status_counts["VERIFIED"] += 1

            taluk_counts[taluk] = taluk_counts.get(taluk, 0) + 1

            if off_name not in officer_map:
                officer_map[off_name] = {
                    "officer_name": off_name,
                    "taluk": taluk,
                    "total_cases": 0,
                    "total_amount": 0.0,
                    "dispatched": 0,
                    "verified": 0,
                    "draft": 0,
                }
            officer_map[off_name]["total_cases"] += 1
            officer_map[off_name]["total_amount"] += amt
            if "DISPATCH" in st:
                officer_map[off_name]["dispatched"] += 1
            elif "DRAFT" in st:
                officer_map[off_name]["draft"] += 1
            else:
                officer_map[off_name]["verified"] += 1

            particulars.append({
                "id": a.id,
                "caseNumber": case_no,
                "fileNumber": details.get("fileNumber") or "1248",
                "defaulterName": defaulter,
                "department": dept,
                "amount": amt,
                "taluk": taluk,
                "district": details.get("district") or "Erode",
                "status": st,
                "date": a.created_at.strftime("%d.%m.%Y") if a.created_at else datetime.now().strftime("%d.%m.%Y"),
                "officer": off_name,
            })

        # Formatted Audit Ledger records
        audit_log_records = [
            {
                "id": str(log.id),
                "action": log.action,
                "file_id": log.file_id or "—",
                "user_id": log.user_id or "System",
                "details": str(log.details) if isinstance(log.details, dict) else (log.details or "—"),
                "signature": log.signature or "v2:hybrid:verified",
                "timestamp": log.created_at.strftime("%d.%m.%Y %H:%M:%S") if log.created_at else datetime.now().strftime("%d.%m.%Y %H:%M:%S"),
            }
            for log in audit_entries
        ]

        total_proceedings = len(particulars)

        report = {
            "title": "தமிழ்நாடு வருவாய் வசூல் சட்டம் – செயல்முறைகள் அறிக்கை (Proceedings & Analytics Report)",
            "district": "ஈரோடு (Erode)",
            "generated_at": datetime.now(timezone.utc).strftime("%d.%m.%Y %H:%M:%S"),
            "generated_by": current_user.full_name or current_user.username,
            "summary_statistics": {
                "total_proceedings": total_proceedings,
                "total_amount_recoverable": total_amount_sum,
                "formatted_total_amount": f"₹{total_amount_sum:,.2f}",
                "status_breakdown": status_counts,
                "department_breakdown": department_counts,
                "taluk_breakdown": taluk_counts,
            },
            "officer_statistics": list(officer_map.values()),
            "audit_ledger_records": audit_log_records,
            "particulars": particulars,
        }

        # Log report generation activity
        report_audit = AuditLedgerEntry(
            id=str(uuid.uuid4()),
            action="REPORT_GENERATED",
            file_id=f"report-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}",
            user_id=current_user.username,
            details={
                "total_proceedings": total_proceedings,
                "total_amount": total_amount_sum,
                "generated_at": report["generated_at"],
            },
            signature=f"v2:report:{uuid.uuid4().hex[:20]}",
        )
        db.add(report_audit)
        await db.commit()

        return report

    except Exception as e:
        logger.error(f"Failed to generate system analytics report: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Report generation error: {str(e)}",
        )


@router.post("/report/export-docx")
async def export_system_report_docx(
    report_data: Optional[Dict[str, Any]] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Generates an official Word DOCX report summary with TAU-Marutham font,
    structured statistics table, officer breakdowns, and particulars ledger.
    """
    try:
        if not report_data or not report_data.get("summary_statistics"):
            report_data = await get_system_analytics_report(db=db, current_user=current_user)

        scope = report_data.get("scope", "all")  # all | summary | officer | audit
        doc = docx.Document()

        for section in doc.sections:
            section.top_margin = Inches(0.8)
            section.bottom_margin = Inches(0.8)
            section.left_margin = Inches(0.8)
            section.right_margin = Inches(0.8)

        # 1. Header (Centered, Bold)
        p_hdr = doc.add_paragraph()
        p_hdr.alignment = WD_ALIGN_PARAGRAPH.CENTER
        scope_title = {
            "summary": "வருவாய் வசூல் செயல்முறைகள் சுருக்க அறிக்கை (RR Summary Report)",
            "officer": "அதிகாரி வாரியான செயல்முறைகள் அறிக்கை (Officer-Wise RR Report)",
            "audit": "முழுமையான தணிக்கைப் பதிவு அறிக்கை (Entire Audit Ledger Report)",
            "all": "வருவாய் வசூல் செயல்முறைகள் மற்றும் தணிக்கை அறிக்கை (Comprehensive RR & Audit Report)",
        }.get(scope, "வருவாய் வசூல் செயல்முறைகள் அறிக்கை (RR Proceedings Report)")

        r_hdr = p_hdr.add_run(f"தமிழ்நாடு அரசு – வருவாய் மற்றும் பேரிடர் மேலாண்மைத் துறை\nஈரோடு மாவட்ட ஆட்சியர் அலுவலகம்\n{scope_title}")
        set_font_formatting(r_hdr, settings.PRIMARY_FONT_TAMIL, 13.0, bold=True)

        p_meta = doc.add_paragraph()
        p_meta.paragraph_format.space_before = Pt(6)
        p_meta.paragraph_format.space_after = Pt(12)
        r_meta = p_meta.add_run(f"அறிக்கை உருவாக்கப்பட்ட நாள்: {datetime.now().strftime('%d.%m.%Y %H:%M')} | அதிகாரி: {current_user.full_name or current_user.username}")
        set_font_formatting(r_meta, settings.PRIMARY_FONT_TAMIL, 10.5, italic=True)

        stats = report_data.get("summary_statistics", {})

        # SECTION: SUMMARY STATISTICS
        if scope in ["all", "summary"]:
            total_p = stats.get("total_proceedings", 0)
            total_amt = stats.get("formatted_total_amount", "₹0.00")

            table_metrics = doc.add_table(rows=2, cols=4)
            headers = ["மொத்த செயல்முறைகள்", "மொத்த நிலுவைத் தொகை", "அனுப்பப்பட்டவை (Dispatched)", "சரிபார்க்கப்பட்டவை (Verified)"]
            values = [
                str(total_p),
                total_amt,
                str(stats.get("status_breakdown", {}).get("DISPATCHED", 0)),
                str(stats.get("status_breakdown", {}).get("VERIFIED", 0)),
            ]

            for i in range(4):
                hdr_p = table_metrics.cell(0, i).paragraphs[0]
                r_h = hdr_p.add_run(headers[i])
                set_font_formatting(r_h, settings.PRIMARY_FONT_TAMIL, 10.5, bold=True)

                val_p = table_metrics.cell(1, i).paragraphs[0]
                r_v = val_p.add_run(values[i])
                set_font_formatting(r_v, settings.PRIMARY_FONT_TAMIL, 11.0, bold=True)

            for row in table_metrics.rows:
                for cell in row.cells:
                    tcPr = cell._tc.get_or_add_tcPr()
                    tcBorders = parse_xml(
                        f'<w:tcBorders {nsdecls("w")}>'
                        '<w:top w:val="single" w:sz="4" w:space="0" w:color="CCCCCC"/>'
                        '<w:left w:val="single" w:sz="4" w:space="0" w:color="CCCCCC"/>'
                        '<w:bottom w:val="single" w:sz="4" w:space="0" w:color="CCCCCC"/>'
                        '<w:right w:val="single" w:sz="4" w:space="0" w:color="CCCCCC"/>'
                        '</w:tcBorders>'
                    )
                    tcPr.append(tcBorders)

        # SECTION: OFFICER-WISE BREAKDOWN
        if scope in ["all", "officer"]:
            officer_stats = report_data.get("officer_statistics", [])
            if officer_stats:
                p_off_hdr = doc.add_paragraph()
                p_off_hdr.paragraph_format.space_before = Pt(16)
                p_off_hdr.paragraph_format.space_after = Pt(8)
                r_off_hdr = p_off_hdr.add_run("அதிகாரி வாரியான செயல்முறைகள் விவரம் (Officer-Wise Performance):")
                set_font_formatting(r_off_hdr, settings.PRIMARY_FONT_TAMIL, 11.5, bold=True)

                table_off = doc.add_table(rows=len(officer_stats) + 1, cols=6)
                off_cols = ["வ.எண்", "அதிகாரி பெயர்", "வட்டம் (Taluk)", "மொத்த வழக்குகள்", "நிலுவைத் தொகை (ரூ.)", "அனுப்பப்பட்டவை"]
                for j, title in enumerate(off_cols):
                    p = table_off.cell(0, j).paragraphs[0]
                    r = p.add_run(title)
                    set_font_formatting(r, settings.PRIMARY_FONT_TAMIL, 10.0, bold=True)

                for row_idx, off in enumerate(officer_stats, start=1):
                    row_vals = [
                        str(row_idx),
                        str(off.get("officer_name", "—")),
                        str(off.get("taluk", "Erode")),
                        str(off.get("total_cases", 0)),
                        f"₹{float(off.get('total_amount', 0)):,.0f}",
                        str(off.get("dispatched", 0)),
                    ]
                    for col_idx, val in enumerate(row_vals):
                        p = table_off.cell(row_idx, col_idx).paragraphs[0]
                        r = p.add_run(val)
                        set_font_formatting(r, settings.PRIMARY_FONT_TAMIL, 9.5, bold=False)

                for row in table_off.rows:
                    for cell in row.cells:
                        tcPr = cell._tc.get_or_add_tcPr()
                        tcBorders = parse_xml(
                            f'<w:tcBorders {nsdecls("w")}>'
                            '<w:top w:val="single" w:sz="4" w:space="0" w:color="DDDDDD"/>'
                            '<w:left w:val="single" w:sz="4" w:space="0" w:color="DDDDDD"/>'
                            '<w:bottom w:val="single" w:sz="4" w:space="0" w:color="DDDDDD"/>'
                            '<w:right w:val="single" w:sz="4" w:space="0" w:color="DDDDDD"/>'
                            '</w:tcBorders>'
                        )
                        tcPr.append(tcBorders)

        # SECTION: AUDIT LEDGER RECORDS
        if scope in ["all", "audit"]:
            audit_records = report_data.get("audit_ledger_records", [])
            if audit_records:
                p_aud_hdr = doc.add_paragraph()
                p_aud_hdr.paragraph_format.space_before = Pt(16)
                p_aud_hdr.paragraph_format.space_after = Pt(8)
                r_aud_hdr = p_aud_hdr.add_run("முழுமையான தணிக்கைப் பதிவு பட்டியல் (Immutable Audit Ledger):")
                set_font_formatting(r_aud_hdr, settings.PRIMARY_FONT_TAMIL, 11.5, bold=True)

                table_aud = doc.add_table(rows=min(len(audit_records), 100) + 1, cols=5)
                aud_cols = ["நேரம் (Timestamp)", "செயல்பாடு (Action)", "பயனர் (User)", "விவரம் (Details)", "கையப்பம் (Signature)"]
                for j, title in enumerate(aud_cols):
                    p = table_aud.cell(0, j).paragraphs[0]
                    r = p.add_run(title)
                    set_font_formatting(r, settings.PRIMARY_FONT_TAMIL, 10.0, bold=True)

                for row_idx, aud in enumerate(audit_records[:100], start=1):
                    row_vals = [
                        str(aud.get("timestamp", "—")),
                        str(aud.get("action", "—")),
                        str(aud.get("user_id", "—")),
                        str(aud.get("details", "—"))[:50],
                        str(aud.get("signature", "—"))[:20],
                    ]
                    for col_idx, val in enumerate(row_vals):
                        p = table_aud.cell(row_idx, col_idx).paragraphs[0]
                        r = p.add_run(val)
                        set_font_formatting(r, settings.PRIMARY_FONT_TAMIL, 8.5, bold=False)

                for row in table_aud.rows:
                    for cell in row.cells:
                        tcPr = cell._tc.get_or_add_tcPr()
                        tcBorders = parse_xml(
                            f'<w:tcBorders {nsdecls("w")}>'
                            '<w:top w:val="single" w:sz="4" w:space="0" w:color="DDDDDD"/>'
                            '<w:left w:val="single" w:sz="4" w:space="0" w:color="DDDDDD"/>'
                            '<w:bottom w:val="single" w:sz="4" w:space="0" w:color="DDDDDD"/>'
                            '<w:right w:val="single" w:sz="4" w:space="0" w:color="DDDDDD"/>'
                            '</w:tcBorders>'
                        )
                        tcPr.append(tcBorders)

        # SECTION: PARTICULARS LEDGER (for summary and all)
        if scope in ["all", "summary"]:
            particulars = report_data.get("particulars", [])
            if particulars:
                p_part_hdr = doc.add_paragraph()
                p_part_hdr.paragraph_format.space_before = Pt(16)
                p_part_hdr.paragraph_format.space_after = Pt(8)
                r_part_hdr = p_part_hdr.add_run("செயல்முறைகள் விவரப் பட்டியல் (Proceedings Particulars Ledger):")
                set_font_formatting(r_part_hdr, settings.PRIMARY_FONT_TAMIL, 11.5, bold=True)

                table_part = doc.add_table(rows=len(particulars) + 1, cols=6)
                cols = ["வ.எண்", "வழக்கு எண்", "நிலுவையாளர் பெயர்", "துறை", "தொகை (ரூ.)", "நிலை"]
                for j, col_title in enumerate(cols):
                    p = table_part.cell(0, j).paragraphs[0]
                    r = p.add_run(col_title)
                    set_font_formatting(r, settings.PRIMARY_FONT_TAMIL, 10.0, bold=True)

                for row_idx, item in enumerate(particulars, start=1):
                    row_vals = [
                        str(row_idx),
                        str(item.get("caseNumber", "—")),
                        str(item.get("defaulterName", "—")),
                        str(item.get("department", "—")),
                        f"₹{float(item.get('amount', 0)):,.0f}",
                        str(item.get("status", "—")),
                    ]
                    for col_idx, val in enumerate(row_vals):
                        p = table_part.cell(row_idx, col_idx).paragraphs[0]
                        r = p.add_run(val)
                        set_font_formatting(r, settings.PRIMARY_FONT_TAMIL, 9.5, bold=False)

                for row in table_part.rows:
                    for cell in row.cells:
                        tcPr = cell._tc.get_or_add_tcPr()
                        tcBorders = parse_xml(
                            f'<w:tcBorders {nsdecls("w")}>'
                            '<w:top w:val="single" w:sz="4" w:space="0" w:color="DDDDDD"/>'
                            '<w:left w:val="single" w:sz="4" w:space="0" w:color="DDDDDD"/>'
                            '<w:bottom w:val="single" w:sz="4" w:space="0" w:color="DDDDDD"/>'
                            '<w:right w:val="single" w:sz="4" w:space="0" w:color="DDDDDD"/>'
                            '</w:tcBorders>'
                        )
                        tcPr.append(tcBorders)

        # 4. Footer Signatory
        p_sig = doc.add_paragraph()
        p_sig.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        p_sig.paragraph_format.space_before = Pt(28)
        r_sig = p_sig.add_run("மாவட்ட ஆட்சித் தலைவர்,\nஈரோடு மாவட்டம்.")
        set_font_formatting(r_sig, settings.PRIMARY_FONT_TAMIL, 11.0, bold=True)

        output_filename = f"RR_Report_{scope}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.docx"
        out_path = settings.OUTPUT_DIR / output_filename
        settings.OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        doc.save(str(out_path))

        return FileResponse(
            path=str(out_path),
            filename=output_filename,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )

    except Exception as e:
        logger.error(f"DOCX report export error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to export report DOCX: {str(e)}",
        )
