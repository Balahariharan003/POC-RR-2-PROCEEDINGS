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


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
async def async_client() -> AsyncGenerator[AsyncClient, None]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client
