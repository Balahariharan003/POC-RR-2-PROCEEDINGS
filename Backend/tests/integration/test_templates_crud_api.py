"""
Integration Tests for Document Templates CRUD API:
- List templates
- Create template
- Get template by code
- Update template
- Delete template
- 400 on duplicate code
- 404 on non-existent template
"""

import pytest
import uuid
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_templates_full_crud_lifecycle(admin_client: AsyncClient, async_client: AsyncClient):
    unique_suffix = uuid.uuid4().hex[:6]
    code = f"tnrera_test_{unique_suffix}"

    payload = {
        "template_code": code,
        "name": f"TNRERA Section 40 Template {unique_suffix}",
        "department_type": "TNRERA",
        "subject_template": "தமிழ்நாடு ரியல் எஸ்டேட் ஒழுங்குமுறை ஆணையம் {case_no}",
        "reference_template": "1. தீர்ப்பு நகல் {order_date}",
        "order_para1_template": "பார்வை (1)-ல் கண்டுள்ள ஆணைப்படி...",
        "order_para2_template": "எதிர்மனுதாரர் தொகையினை செலுத்த தவறினார்.",
        "order_para3_template": "எனவே வருவாய் வசூல் சட்டப்படி ஜப்தி செய்ய உத்தரவிடப்படுகிறது.",
        "enclosure_text": "ஆணை நகல்",
        "is_active": True
    }

    # 0. Unauthenticated check (should return 401 Unauthorized or 403 Forbidden)
    unauth_resp = await async_client.post("/api/v1/templates/", json=payload)
    assert unauth_resp.status_code in (401, 403)

    # 1. CREATE Template (as admin)
    create_resp = await admin_client.post("/api/v1/templates/", json=payload)
    assert create_resp.status_code == 201
    created_data = create_resp.json()
    assert created_data["template_code"] == code
    assert created_data["department_type"] == "TNRERA"

    # 2. DUPLICATE CREATE check
    dup_resp = await admin_client.post("/api/v1/templates/", json=payload)
    assert dup_resp.status_code == 400

    # 3. GET Template by Code (public/all authenticated)
    get_resp = await async_client.get(f"/api/v1/templates/{code}")
    assert get_resp.status_code == 200
    tpl_data = get_resp.json()
    assert tpl_data["template_code"] == code
    assert tpl_data["name"] == payload["name"]

    # 4. LIST Templates (public/all authenticated)
    list_resp = await async_client.get("/api/v1/templates/")
    assert list_resp.status_code == 200
    all_tpls = list_resp.json()
    assert isinstance(all_tpls, list)
    assert any(t["template_code"] == code for t in all_tpls)

    # 5. UPDATE Template (as admin)
    update_payload = {
        "name": f"TNRERA Updated Template {unique_suffix}",
        "enclosure_text": "படிவம் 5 நகல்"
    }
    update_resp = await admin_client.put(f"/api/v1/templates/{code}", json=update_payload)
    assert update_resp.status_code == 200
    updated_data = update_resp.json()
    assert updated_data["name"] == f"TNRERA Updated Template {unique_suffix}"
    assert updated_data["enclosure_text"] == "படிவம் 5 நகல்"

    # 6. DELETE Template (as admin)
    delete_resp = await admin_client.delete(f"/api/v1/templates/{code}")
    assert delete_resp.status_code == 200
    assert delete_resp.json()["status"] == "SUCCESS"

    # 7. VERIFY DELETED (404)
    get_after_del = await async_client.get(f"/api/v1/templates/{code}")
    assert get_after_del.status_code == 404

