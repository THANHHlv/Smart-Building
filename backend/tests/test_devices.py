"""Tests for device API endpoints."""

import pytest
from httpx import AsyncClient


async def _setup_hierarchy(client: AsyncClient) -> tuple[str, str, str]:
    """Create building → floor → apartment, return (building_id, floor_id, apartment_id)."""
    building_resp = await client.post(
        "/api/v1/buildings",
        json={"name": "Tower A", "address": "123 Main St"},
    )
    building_id = building_resp.json()["id"]

    floor_resp = await client.post(
        f"/api/v1/buildings/{building_id}/floors",
        json={"floor_number": 1},
    )
    floor_id = floor_resp.json()["id"]

    apt_resp = await client.post(
        "/api/v1/apartments",
        json={"floor_id": floor_id, "unit_number": "101"},
    )
    apartment_id = apt_resp.json()["id"]

    return building_id, floor_id, apartment_id


from app.models.device_type import DeviceType
from tests.conftest import testing_session_factory


async def _create_device_type() -> str:
    """Create a device type in database for FK reference."""
    async with testing_session_factory() as session:
        dt = DeviceType(
            code="elec_meter",
            name="Electricity Meter",
            unit="kW",
        )
        session.add(dt)
        await session.commit()
        return str(dt.id)


@pytest.mark.asyncio
async def test_create_device(client: AsyncClient):
    """POST /api/v1/devices should register a device."""
    _, _, apartment_id = await _setup_hierarchy(client)
    device_type_id = await _create_device_type()

    response = await client.post(
        "/api/v1/devices",
        json={
            "device_code": "elec-101-01",
            "name": "Electricity Meter #1",
            "apartment_id": apartment_id,
            "device_type_id": device_type_id,
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["device_code"] == "elec-101-01"
    assert data["apartment_id"] == apartment_id
    assert data["device_type_id"] == device_type_id


@pytest.mark.asyncio
async def test_list_devices_empty(client: AsyncClient):
    """GET /api/v1/devices should return empty list when no devices exist."""
    response = await client.get("/api/v1/devices")
    assert response.status_code == 200
    assert response.json()["total"] == 0


@pytest.mark.asyncio
async def test_get_device_not_found(client: AsyncClient):
    """GET /api/v1/devices/{id} with unknown ID should return 404."""
    response = await client.get(
        "/api/v1/devices/00000000-0000-0000-0000-000000000000"
    )
    assert response.status_code == 404
