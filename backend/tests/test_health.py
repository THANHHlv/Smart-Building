"""Tests for health and readiness endpoints."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health_check(client: AsyncClient):
    """GET /health should return 200 with healthy status."""
    response = await client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "smart-building-backend"


@pytest.mark.asyncio
async def test_readiness_check(client: AsyncClient):
    """GET /ready should return 200 with database status."""
    response = await client.get("/ready")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ready"
    assert data["database"] == "connected"


@pytest.mark.asyncio
async def test_readiness_unavailable_returns_503(client: AsyncClient, monkeypatch):
    """GET /ready must fail the deployment gate when the database is down."""
    from sqlalchemy.ext.asyncio import AsyncSession

    async def fail_execute(self, *args, **kwargs):
        raise ConnectionError("database unavailable")

    monkeypatch.setattr(AsyncSession, "execute", fail_execute)
    response = await client.get("/ready")
    assert response.status_code == 503
    assert response.json()["status"] == "not_ready"
    assert response.json()["database"] == "unavailable"
