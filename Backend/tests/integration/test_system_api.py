"""
Integration tests for System Endpoints: Backup, Restore, Report Analytics, and DOCX Generation.
"""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_system_report_and_backup_flow(admin_client: AsyncClient):
    # 1. Fetch System Analytics Report
    report_resp = await admin_client.get("/api/v1/system/report")
    assert report_resp.status_code == 200
    report_data = report_resp.json()
    assert "summary_statistics" in report_data
    assert "particulars" in report_data
    assert "generated_at" in report_data
    assert report_data["district"] == "ஈரோடு (Erode)"

    # 2. Create System Full Backup
    backup_resp = await admin_client.post("/api/v1/system/backup")
    assert backup_resp.status_code == 200
    backup_data = backup_resp.json()
    assert backup_data.get("app") == "rr-assistant"
    assert backup_data.get("version") == 2
    assert "table_counts" in backup_data
    assert "data" in backup_data
    assert "users" in backup_data["data"]
    assert "document_templates" in backup_data["data"]
    assert "audit_ledger" in backup_data["data"]
    assert "checksum_sha256" in backup_data
    assert len(backup_data["checksum_sha256"]) == 64

    # 3. Restore / Validate Backup
    restore_resp = await admin_client.post("/api/v1/system/restore", json=backup_data)
    assert restore_resp.status_code == 200
    restore_res = restore_resp.json()
    assert restore_res["status"] == "SUCCESS"
    assert "restored_counts" in restore_res

    # 4. Export System Report DOCX
    docx_resp = await admin_client.post(
        "/api/v1/system/report/export-docx",
        json={"title": "Proceedings Summary Test Report"}
    )
    assert docx_resp.status_code == 200
    assert docx_resp.headers["content-type"] == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    assert len(docx_resp.content) > 1000
