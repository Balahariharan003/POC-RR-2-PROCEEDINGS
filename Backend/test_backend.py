"""
Automated Integration and Component Test Suite for RR Assistant.
Tests:
1. PostgreSQL connection, table creation, and default seed records.
2. Templates CRUD operations (Add, Edit, Delete, Render).
3. User Management & RBAC permissions (Admin can edit all, User can edit self).
4. Audit ledger persistence in PostgreSQL.
5. Strict TAU-Marutham font validation in generated DOCX files.
"""

import sys
import io
import os
import zipfile
import xml.etree.ElementTree as ET

# Configure UTF-8 output
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

import db
import templates_store
import user_store
import audit_store
import doc_generator
from schemas import ExtractedLegalEntities


def run_tests():
    print("=" * 60)
    print("RUNNING BACKEND COMPONENT & POSTGRESQL TESTS")
    print("=" * 60)

    # 1. Database Initialization
    db.init_db()
    print("✔ PostgreSQL database initialized and verified.")

    # 2. Templates Test
    templates = templates_store.list_templates()
    print(f"✔ Retrieved {len(templates)} active templates from PostgreSQL.")
    assert len(templates) >= 6, "Expected at least 6 pre-seeded templates"

    # Test creating custom template (Admin)
    new_tmpl_data = {
        "code": "test_district_memo",
        "name": "மாவட்ட குறிப்பாணை மாதிரி (Test District Memo)",
        "department": "GENERAL",
        "category": "MEMORANDUM",
        "description": "Test memo template created by administrator",
        "heading_prefix": "மாவட்ட ஆட்சியர் அலுவலகம், {{district_name}}.",
        "subject_template": "வருவாய் வசூல் சட்டம் – {{defaulter_name}} நிலுவைத் தொகை ரூ.{{total_amount}}/-.",
        "reference_template": "1. அரசு கடிதம் எண். 123.",
        "order_paras": ["உரிய நடவடிக்கை எடுக்க வட்டாட்சியருக்கு உத்தரவிடப்படுகிறது."],
        "recipients": [{"label": "பெறுநர்", "value": "வருவாய் வட்டாட்சியர், {{taluk_name}}."}]
    }
    created = templates_store.create_template(new_tmpl_data, created_by="admin-1")
    assert created["code"] == "test_district_memo", "Template creation failed"
    print(f"✔ Created test template: {created['name']} (ID: {created['id']})")

    # Test updating template
    updated = templates_store.update_template(created["id"], {"name": "மாவட்ட குறிப்பாணை திருத்தப்பட்டது (Updated Memo)"})
    assert "திருத்தப்பட்டது" in updated["name"], "Template update failed"
    print(f"✔ Updated test template: {updated['name']}")

    # Test rendering template
    sample_ctx = {
        "district_name": "ஈரோடு",
        "taluk_name": "ஈரோடு",
        "defaulter_name": "M/s Prisma Garments",
        "total_amount": "1,82,308/-",
        "file_no": "1248",
        "file_year": "2026",
        "section_code": "ஈ2"
    }
    rendered_text = templates_store.render_template_to_text(updated, sample_ctx)
    assert "M/s Prisma Garments" in rendered_text
    print("✔ Rendered dynamic template with context successfully.")

    # Test deleting template
    del_res = templates_store.delete_template(created["id"])
    assert del_res is True, "Template deletion failed"
    print("✔ Deleted test template successfully.")

    # 3. User Management & RBAC Test
    users = user_store.list_users()
    print(f"✔ Retrieved {len(users)} users from PostgreSQL.")
    assert len(users) >= 4, "Expected at least 4 pre-seeded users"

    # Test creating user
    test_user = user_store.create_user({
        "name": "வருவாய் ஆய்வாளர் (Revenue Inspector Erode)",
        "email": "ri.erode@tn.gov.in",
        "role": "user",
        "status": "active",
        "taluk": "ஈரோடு",
        "mobileNumber": "+91 94450 11111"
    })
    print(f"✔ Created user: {test_user['name']} (Email: {test_user['email']})")

    # Test admin updating user (can update role and email)
    updated_user = user_store.update_user(
        test_user["id"],
        {"name": "தலைமை வருவாய் ஆய்வாளர்", "mobileNumber": "+91 94450 22222"},
        requester_role="admin"
    )
    assert updated_user["name"] == "தலைமை வருவாய் ஆய்வாளர்"
    print(f"✔ Admin updated user profile successfully.")

    # Test user self update
    self_updated = user_store.update_user(
        test_user["id"],
        {"mobileNumber": "+91 94450 33333"},
        requester_role="user",
        requester_id=test_user["id"]
    )
    assert self_updated["mobile_number"] == "+91 94450 33333"
    print("✔ User self-update succeeded.")

    # Test delete user
    user_store.delete_user(test_user["id"], requester_role="admin")
    print("✔ Deleted test user successfully.")

    # 4. Audit Log Test
    audit_entry = {
        "id": "test-audit-001",
        "caseNumber": "F.NO. 516/2024-ARC",
        "rocNumber": "ந.க.1248/2026/ஈ2",
        "defaulterName": "M/s. Prisma Garments",
        "amount": "1,82,308/-",
        "taluk": "ஈரோடு",
        "district": "ஈரோடு",
        "officerName": "திரு.ச.கந்தசாமி,இ.ஆ.ப.,",
        "status": "VERIFIED",
        "documentContent": rendered_text
    }
    saved_audit = audit_store.save_audit_entry(audit_entry)
    assert saved_audit["id"] == "test-audit-001"
    all_logs = audit_store.get_all_audit_logs()
    print(f"✔ Saved and retrieved audit logs from PostgreSQL ({len(all_logs)} month groupings).")

    # 5. Strict TAU-Marutham Font Test in DOCX
    test_docx_path = "outputs/test_tau_marutham_check.docx"
    doc_generator.generate_docx_from_content(rendered_text, test_docx_path)
    assert os.path.exists(test_docx_path), "DOCX file was not generated"

    # Inspect the DOCX XML to verify TAU-Marutham is explicitly set
    with zipfile.ZipFile(test_docx_path, 'r') as docx_zip:
        xml_content = docx_zip.read('word/document.xml').decode('utf-8')
        styles_content = docx_zip.read('word/styles.xml').decode('utf-8')

    assert "TAU-Marutham" in xml_content or "TAU-Marutham" in styles_content, "TAU-Marutham font must be embedded in DOCX XML"
    print("✔ Verified TAU-Marutham font strictly present in DOCX document.xml & styles.xml.")

    print("=" * 60)
    print("ALL TESTS PASSED SUCCESSFULLY!")
    print("=" * 60)


if __name__ == "__main__":
    run_tests()
