"""Tests for building API endpoints."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_building(client: AsyncClient):
    """POST /api/v1/buildings should create a building."""
    response = await client.post(
        "/api/v1/buildings",
        json={
            "name": "Tower A",
            "address": "123 Main Street",
            "description": "Main residential tower",
            "total_floors": 10,
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Tower A"
    assert data["address"] == "123 Main Street"
    assert data["total_floors"] == 10
    assert data["is_active"] is True
    assert "id" in data
    assert "created_at" in data


@pytest.mark.asyncio
async def test_create_building_validation_error(client: AsyncClient):
    """POST /api/v1/buildings with missing required fields should return 422."""
    response = await client.post(
        "/api/v1/buildings",
        json={"name": "Tower A"},  # missing address
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_list_buildings(client: AsyncClient):
    """GET /api/v1/buildings should return paginated list."""
    # Create two buildings
    await client.post(
        "/api/v1/buildings",
        json={"name": "Tower A", "address": "123 Main St"},
    )
    await client.post(
        "/api/v1/buildings",
        json={"name": "Tower B", "address": "456 Oak Ave"},
    )

    response = await client.get("/api/v1/buildings")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 2
    assert len(data["items"]) == 2
    assert data["page"] == 1


@pytest.mark.asyncio
async def test_get_building(client: AsyncClient):
    """GET /api/v1/buildings/{id} should return building details."""
    create_resp = await client.post(
        "/api/v1/buildings",
        json={"name": "Tower A", "address": "123 Main St"},
    )
    building_id = create_resp.json()["id"]

    response = await client.get(f"/api/v1/buildings/{building_id}")
    assert response.status_code == 200
    assert response.json()["name"] == "Tower A"


@pytest.mark.asyncio
async def test_get_building_not_found(client: AsyncClient):
    """GET /api/v1/buildings/{id} with unknown ID should return 404."""
    response = await client.get(
        "/api/v1/buildings/00000000-0000-0000-0000-000000000000"
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_update_building(client: AsyncClient):
    """PUT /api/v1/buildings/{id} should update building fields."""
    create_resp = await client.post(
        "/api/v1/buildings",
        json={"name": "Tower A", "address": "123 Main St"},
    )
    building_id = create_resp.json()["id"]

    response = await client.put(
        f"/api/v1/buildings/{building_id}",
        json={"name": "Tower A (Renamed)"},
    )
    assert response.status_code == 200
    assert response.json()["name"] == "Tower A (Renamed)"


@pytest.mark.asyncio
async def test_delete_building(client: AsyncClient):
    """DELETE /api/v1/buildings/{id} should soft-delete."""
    create_resp = await client.post(
        "/api/v1/buildings",
        json={"name": "Tower A", "address": "123 Main St"},
    )
    building_id = create_resp.json()["id"]

    response = await client.delete(f"/api/v1/buildings/{building_id}")
    assert response.status_code == 200
    assert response.json()["message"] == "Building deleted"

    # Should not appear in list (filtered by is_active)
    list_resp = await client.get("/api/v1/buildings")
    assert list_resp.json()["total"] == 0
