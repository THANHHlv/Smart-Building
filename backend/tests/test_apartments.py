"""Tests for apartment API endpoints."""

import pytest
from httpx import AsyncClient


async def _create_building_and_floor(client: AsyncClient) -> tuple[str, str]:
    """Helper: create a building and floor, return (building_id, floor_id)."""
    building_resp = await client.post(
        "/api/v1/buildings",
        json={"name": "Tower A", "address": "123 Main St", "total_floors": 5},
    )
    building_id = building_resp.json()["id"]

    floor_resp = await client.post(
        f"/api/v1/buildings/{building_id}/floors",
        json={"floor_number": 1, "name": "Ground Floor"},
    )
    floor_id = floor_resp.json()["id"]

    return building_id, floor_id


@pytest.mark.asyncio
async def test_create_apartment(client: AsyncClient):
    """POST /api/v1/apartments should create an apartment."""
    _, floor_id = await _create_building_and_floor(client)

    response = await client.post(
        "/api/v1/apartments",
        json={
            "floor_id": floor_id,
            "unit_number": "101",
            "area_sqm": 65.5,
            "num_rooms": 2,
            "resident_name": "John Doe",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["unit_number"] == "101"
    assert data["area_sqm"] == 65.5
    assert data["floor_id"] == floor_id


@pytest.mark.asyncio
async def test_list_apartments(client: AsyncClient):
    """GET /api/v1/apartments should return paginated list."""
    _, floor_id = await _create_building_and_floor(client)

    await client.post(
        "/api/v1/apartments",
        json={"floor_id": floor_id, "unit_number": "101"},
    )
    await client.post(
        "/api/v1/apartments",
        json={"floor_id": floor_id, "unit_number": "102"},
    )

    response = await client.get("/api/v1/apartments")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 2


@pytest.mark.asyncio
async def test_get_apartment_not_found(client: AsyncClient):
    """GET /api/v1/apartments/{id} with unknown ID should return 404."""
    response = await client.get(
        "/api/v1/apartments/00000000-0000-0000-0000-000000000000"
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_delete_apartment(client: AsyncClient):
    """DELETE /api/v1/apartments/{id} should soft-delete."""
    _, floor_id = await _create_building_and_floor(client)

    create_resp = await client.post(
        "/api/v1/apartments",
        json={"floor_id": floor_id, "unit_number": "101"},
    )
    apt_id = create_resp.json()["id"]

    response = await client.delete(f"/api/v1/apartments/{apt_id}")
    assert response.status_code == 200

    list_resp = await client.get("/api/v1/apartments")
    assert list_resp.json()["total"] == 0
