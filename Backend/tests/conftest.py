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





from app.core.database import engine, Base, AsyncSessionLocal
from app.core.seed import seed_default_accounts, seed_default_templates


@pytest.fixture(autouse=True)
async def init_test_db():
    """Ensures database schema and default seed accounts exist."""
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        async with AsyncSessionLocal() as session:
            await seed_default_accounts(session)
            await seed_default_templates(session)
    except Exception:
        pass
    yield


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

