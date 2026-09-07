"""Tests for reading API endpoints."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_query_readings_empty(client: AsyncClient):
    """GET /api/v1/readings should return empty list."""
    response = await client.get("/api/v1/readings")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 0
    assert data["items"] == []


@pytest.mark.asyncio
async def test_create_reading_validation(client: AsyncClient):
    """POST /api/v1/readings with missing fields should return 422."""
    response = await client.post(
        "/api/v1/readings",
        json={"metric": "temperature"},  # missing required fields
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_dashboard_overview(client: AsyncClient):
    """GET /api/v1/dashboard/overview should return summary stats."""
    response = await client.get("/api/v1/dashboard/overview")
    assert response.status_code == 200
    data = response.json()
    assert "total_buildings" in data
    assert "total_devices" in data
    assert "devices_online" in data
    assert "total_readings_today" in data


@pytest.mark.asyncio
async def test_dashboard_energy(client: AsyncClient):
    """GET /api/v1/dashboard/energy should return energy data."""
    response = await client.get("/api/v1/dashboard/energy")
    assert response.status_code == 200
    data = response.json()
    assert "total_kwh_today" in data


@pytest.mark.asyncio
async def test_dashboard_water(client: AsyncClient):
    """GET /api/v1/dashboard/water should return water data."""
    response = await client.get("/api/v1/dashboard/water")
    assert response.status_code == 200
    data = response.json()
    assert "total_liters_today" in data
