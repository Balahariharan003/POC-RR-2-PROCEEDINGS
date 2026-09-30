"""
Safe Path Traversal Protection Utility.
"""

from pathlib import Path
from app.core.exceptions import AppException


def resolve_safe_path(base_dir: Path, requested_filename: str) -> Path:
    """
    Validates that requested_filename cannot escape base_dir.
    Guards against directory traversal (../, ..\\).
    """
    clean_name = Path(requested_filename).name  # Strips all leading directory components
    resolved = (base_dir / clean_name).resolve()
    
    if not str(resolved).startswith(str(base_dir.resolve())):
        raise AppException(message="Access Denied: Path traversal detected.", status_code=403)
        
    return resolved
