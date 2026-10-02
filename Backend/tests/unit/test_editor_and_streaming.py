"""
Unit and Integration tests for Document Editor & Original Document Streaming endpoints.
"""

import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.mark.asyncio
async def test_editor_layout_and_original_streaming():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Test get layout for a generated docx
        response = await client.get("/api/v1/editor/Proceedings_TNRERA_5735_20261001_114135.docx")
        assert response.status_code == 200
        data = response.json()
        assert "blocks" in data
        assert "page" in data
        assert len(data["blocks"]) > 0

        # 2. Test get layout via legacy /api/editor/
        legacy_res = await client.get("/api/editor/Proceedings_TNRERA_5735_20261001_114135.docx")
        assert legacy_res.status_code == 200
        assert len(legacy_res.json()["blocks"]) > 0

        # 3. Test original document streaming endpoint
        stream_res = await client.get("/api/v1/documents/original/Proceedings_TNRERA_5735_20261001_114135.pdf")
        assert stream_res.status_code == 200
        assert stream_res.headers.get("content-type") == "application/pdf"
