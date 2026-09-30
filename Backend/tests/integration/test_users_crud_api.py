"""
Integration Tests for Users CRUD API:
- List users
- Create user
- Get user by ID
- Update user
- Delete user
- Duplicate username/email error handling
- 404 on non-existent user
"""

import pytest
import uuid
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_users_full_crud_lifecycle(admin_client: AsyncClient, async_client: AsyncClient):
    unique_suffix = uuid.uuid4().hex[:6]
    username = f"officer_{unique_suffix}"
    email = f"officer_{unique_suffix}@erode.tn.gov.in"

    create_payload = {
        "username": username,
        "email": email,
        "password": "SecurePassword@123",
        "full_name": "Test Tahsildar Officer",
        "role": "TAHSILDAR",
        "jurisdiction_district": "Erode",
        "jurisdiction_taluk": "Perundurai",
        "is_active": True
    }

    # 0. Unauthenticated check (should return 401 Unauthorized or 403 Forbidden)
    unauth_resp = await async_client.post("/api/v1/users/", json=create_payload)
    assert unauth_resp.status_code in (401, 403)

    # 1. CREATE User (as admin)
    create_resp = await admin_client.post("/api/v1/users/", json=create_payload)
    assert create_resp.status_code == 201
    created_data = create_resp.json()
    assert created_data["username"] == username
    assert created_data["email"] == email
    assert created_data["role"] == "TAHSILDAR"
    user_id = created_data["id"]
    assert user_id is not None

    # 2. DUPLICATE USER check (should fail with 400)
    dup_resp = await admin_client.post("/api/v1/users/", json=create_payload)
    assert dup_resp.status_code == 400

    # 3. GET User by ID
    get_resp = await admin_client.get(f"/api/v1/users/{user_id}")
    assert get_resp.status_code == 200
    user_data = get_resp.json()
    assert user_data["id"] == user_id
    assert user_data["full_name"] == "Test Tahsildar Officer"

    # 4. LIST Users
    list_resp = await admin_client.get("/api/v1/users/")
    assert list_resp.status_code == 200
    users_list = list_resp.json()
    assert isinstance(users_list, list)
    assert any(u["id"] == user_id for u in users_list)

    # 5. UPDATE User
    update_payload = {
        "full_name": "Senior Tahsildar Officer Updated",
        "jurisdiction_taluk": "Bhavani"
    }
    update_resp = await admin_client.put(f"/api/v1/users/{user_id}", json=update_payload)
    assert update_resp.status_code == 200
    updated_data = update_resp.json()
    assert updated_data["full_name"] == "Senior Tahsildar Officer Updated"
    assert updated_data["jurisdiction_taluk"] == "Bhavani"

    # 6. DELETE User
    delete_resp = await admin_client.delete(f"/api/v1/users/{user_id}")
    assert delete_resp.status_code == 200
    assert delete_resp.json()["status"] == "SUCCESS"

    # 7. VERIFY DELETED (404)
    get_after_del = await admin_client.get(f"/api/v1/users/{user_id}")
    assert get_after_del.status_code == 404

