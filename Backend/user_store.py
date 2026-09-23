"""
User Management and RBAC Store module backed by PostgreSQL.
Ensures that Administrators can manage and edit all user details,
while regular users can view and edit their own profiles.
"""

import uuid
from typing import Dict, Any, List, Optional
from db import execute_query


def list_users(query: Optional[str] = None, role: Optional[str] = None, status: Optional[str] = None) -> List[Dict[str, Any]]:
    """Lists users with optional filtering."""
    sql = "SELECT id, name, email, role, status, taluk, department, mobile_number, created_at, updated_at FROM app_users WHERE 1=1"
    params = []
    
    if role and role != "all":
        sql += " AND role = %s"
        params.append(role.lower())
    if status and status != "all":
        sql += " AND status = %s"
        params.append(status.lower())
    if query and query.strip():
        sql += " AND (LOWER(name) LIKE %s OR LOWER(email) LIKE %s OR LOWER(taluk) LIKE %s)"
        pattern = f"%{query.strip().lower()}%"
        params.extend([pattern, pattern, pattern])
        
    sql += " ORDER BY role ASC, name ASC"
    return execute_query(sql, tuple(params), fetch_all=True)


def get_user_by_id(user_id: str) -> Optional[Dict[str, Any]]:
    """Gets a user by ID."""
    sql = "SELECT id, name, email, role, status, taluk, department, mobile_number, created_at, updated_at FROM app_users WHERE id = %s"
    return execute_query(sql, (user_id,), fetch_one=True)


def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    """Gets a user by email."""
    sql = "SELECT id, name, email, role, status, taluk, department, mobile_number, created_at, updated_at FROM app_users WHERE LOWER(email) = LOWER(%s)"
    return execute_query(sql, (email,), fetch_one=True)


def create_user(data: Dict[str, Any]) -> Dict[str, Any]:
    """Creates a new user record in PostgreSQL (Admin Only)."""
    user_id = data.get("id") or f"usr-{uuid.uuid4().hex[:8]}"
    name = data.get("name", "").strip()
    email = data.get("email", "").strip().lower()
    role = data.get("role", "user").lower()
    status = data.get("status", "active").lower()
    taluk = data.get("taluk", "").strip()
    department = data.get("department", "Revenue Recovery").strip()
    mobile_number = data.get("mobileNumber") or data.get("mobile_number", "")

    if not name or not email:
        raise ValueError("Name and Email are required.")

    # Check duplicate email
    existing = get_user_by_email(email)
    if existing:
        raise ValueError(f"User with email '{email}' already exists.")

    sql = """
    INSERT INTO app_users (id, name, email, role, status, taluk, department, mobile_number)
    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
    RETURNING id, name, email, role, status, taluk, department, mobile_number, created_at, updated_at;
    """
    return execute_query(sql, (user_id, name, email, role, status, taluk, department, mobile_number), fetch_one=True)


def update_user(user_id: str, data: Dict[str, Any], requester_role: str = "admin", requester_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Updates user details in PostgreSQL.
    Admin can edit ALL information of ALL users.
    Regular users can only edit their own contact details (name, mobileNumber, taluk).
    """
    current = get_user_by_id(user_id)
    if not current:
        raise ValueError(f"User with ID '{user_id}' not found.")

    is_admin = requester_role == "admin"
    is_self = requester_id and requester_id == user_id

    if not is_admin and not is_self:
        raise PermissionError("Access denied: You can only edit your own user profile.")

    name = data.get("name", current["name"]).strip()
    mobile_number = (data.get("mobileNumber") or data.get("mobile_number", current.get("mobile_number", ""))).strip()
    taluk = data.get("taluk", current.get("taluk", "")).strip()

    if is_admin:
        email = data.get("email", current["email"]).strip().lower()
        role = data.get("role", current["role"]).lower()
        status = data.get("status", current["status"]).lower()
        department = data.get("department", current.get("department", "Revenue Recovery")).strip()

        # Check unique email conflict
        if email != current["email"].lower():
            dup = get_user_by_email(email)
            if dup and dup["id"] != user_id:
                raise ValueError(f"Email '{email}' is already taken by another user.")

        # Ensure at least one active administrator remains
        if current["role"] == "admin" and (role != "admin" or status != "active"):
            admin_count = execute_query(
                "SELECT count(*) as c FROM app_users WHERE role = 'admin' AND status = 'active' AND id != %s",
                (user_id,),
                fetch_one=True
            )["c"]
            if admin_count == 0:
                raise ValueError("Cannot remove or deactivate the last active administrator.")
    else:
        # Non-admin cannot elevate role or change status/email
        email = current["email"]
        role = current["role"]
        status = current["status"]
        department = current.get("department", "Revenue Recovery")

    sql = """
    UPDATE app_users SET
        name = %s, email = %s, role = %s, status = %s, taluk = %s,
        department = %s, mobile_number = %s, updated_at = CURRENT_TIMESTAMP
    WHERE id = %s
    RETURNING id, name, email, role, status, taluk, department, mobile_number, created_at, updated_at;
    """
    return execute_query(sql, (name, email, role, status, taluk, department, mobile_number, user_id), fetch_one=True)


def delete_user(user_id: str, requester_role: str = "admin") -> bool:
    """Deletes a user from PostgreSQL (Admin Only)."""
    if requester_role != "admin":
        raise PermissionError("Only administrators can delete user accounts.")

    current = get_user_by_id(user_id)
    if not current:
        return False

    if current["role"] == "admin":
        admin_count = execute_query(
            "SELECT count(*) as c FROM app_users WHERE role = 'admin' AND status = 'active' AND id != %s",
            (user_id,),
            fetch_one=True
        )["c"]
        if admin_count == 0:
            raise ValueError("Cannot delete the last active administrator.")

    execute_query("DELETE FROM app_users WHERE id = %s", (user_id,))
    return True
