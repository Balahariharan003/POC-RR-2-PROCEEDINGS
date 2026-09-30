import sys
from pathlib import Path
import pytest
import asyncio
from httpx import AsyncClient, ASGITransport
from typing import AsyncGenerator

# Ensure Backend root is in sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.main import app
from app.core.config import settings
from app.core.security import create_access_token





from app.core.database import engine


@pytest.fixture(autouse=True)
async def cleanup_db_connections():
    """Disposes engine connections after each test to prevent asyncpg cross-loop socket errors."""
    yield
    await engine.dispose()


@pytest.fixture
async def async_client() -> AsyncGenerator[AsyncClient, None]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client



@pytest.fixture
def admin_token() -> str:
    """Generates a valid signed JWT access token with admin privileges."""
    return create_access_token(data={"sub": "admin", "role": "admin", "email": "admin@erode.tn.gov.in"})


@pytest.fixture
async def admin_client(admin_token: str) -> AsyncGenerator[AsyncClient, None]:
    """Provides an authenticated AsyncClient with Bearer token for admin operations."""
    transport = ASGITransport(app=app)
    headers = {"Authorization": f"Bearer {admin_token}"}
    async with AsyncClient(transport=transport, base_url="http://testserver", headers=headers) as client:
        yield client

