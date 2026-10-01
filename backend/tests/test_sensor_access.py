"""Regression coverage for sensor and device access without an apartment."""

from datetime import datetime, timezone
from uuid import uuid4

import pytest
import pytest_asyncio

from app.core.security import create_access_token
from app.models.apartment import Apartment
from app.models.building import Building
from app.models.device import Device
from app.models.device_type import DeviceType
from app.models.floor import Floor
from app.models.rbac import Permission, Role, RolePermission, UserRole
from app.models.sensor_reading import SensorReading
from app.models.user import User
from tests.conftest import testing_session_factory


@pytest_asyncio.fixture
async def sensor_accounts():
    building = Building(id=uuid4(), name="Sensor access", address="Test", total_floors=1)
    floor = Floor(id=uuid4(), building_id=building.id, floor_number=1)
    apartments = [
        Apartment(id=uuid4(), floor_id=floor.id, unit_number=str(i), area_sqm=60)
        for i in (1, 2)
    ]
    dtype = DeviceType(id=uuid4(), code="sensor_access", name="Meter", unit="kW")
    devices = [
        Device(id=uuid4(), apartment_id=apt.id, device_type_id=dtype.id,
               device_code=f"SENSOR-{i}", name=f"Meter {i}")
        for i, apt in enumerate(apartments)
    ]
    users = {
        name: User(id=uuid4(), email=f"{name}@sensor.test", hashed_password="unused",
                   role=role, apartment_id=apartment)
        for name, role, apartment in (
            ("resident", "resident", apartments[0].id),
            ("unassigned", "resident", None),
            ("accountant", "accountant", apartments[0].id),
            ("technician", "technician", None),
        )
    }
    permission = Permission(id=uuid4(), code="sensor.read", module="sensor")
    tech_role = Role(id=uuid4(), name="technician")
    async with testing_session_factory() as session:
        session.add_all([building, floor, *apartments, dtype, *devices, *users.values(),
                         permission, tech_role])
        await session.flush()
        session.add_all([
            RolePermission(role_id=tech_role.id, permission_id=permission.id),
            UserRole(user_id=users["technician"].id, role_id=tech_role.id),
            *[SensorReading(id=uuid4(), device_id=device.id,
                            timestamp=datetime.now(timezone.utc), metric="electricity",
                            value=1.0, unit="kW") for device in devices],
        ])
        await session.commit()
    headers = {
        name: {"Authorization": "Bearer " + create_access_token({"sub": str(user.id)})}
        for name, user in users.items()
    }
    return devices, headers


@pytest.mark.asyncio
async def test_unassigned_resident_denied_all_sensor_paths(unauthenticated_client, sensor_accounts):
    devices, headers = sensor_accounts
    for path in ("/api/v1/readings", f"/api/v1/readings/device/{devices[0].id}",
                 "/api/v1/devices", f"/api/v1/devices?apartment_id={devices[0].apartment_id}"):
        response = await unauthenticated_client.get(path, headers=headers["unassigned"])
        assert response.status_code == 403, path


@pytest.mark.asyncio
async def test_resident_readings_and_counts_stay_in_own_apartment(unauthenticated_client, sensor_accounts):
    devices, headers = sensor_accounts
    own = await unauthenticated_client.get("/api/v1/readings", headers=headers["resident"])
    assert own.status_code == 200
    assert own.json()["total"] == 1
    assert {item["device_id"] for item in own.json()["items"]} == {str(devices[0].id)}
    other = await unauthenticated_client.get(
        f"/api/v1/readings?device_id={devices[1].id}", headers=headers["resident"])
    assert other.status_code == 200
    assert other.json()["items"] == []
    assert other.json()["total"] == 0
    direct_other = await unauthenticated_client.get(
        f"/api/v1/readings/device/{devices[1].id}", headers=headers["resident"])
    assert direct_other.status_code == 403
    direct_own = await unauthenticated_client.get(
        f"/api/v1/readings/device/{devices[0].id}", headers=headers["resident"])
    assert direct_own.status_code == 200
    assert direct_own.json()["total"] == 1


@pytest.mark.asyncio
async def test_sensor_permission_applies_to_both_reading_routes(unauthenticated_client, sensor_accounts):
    devices, headers = sensor_accounts
    for path in ("/api/v1/readings", f"/api/v1/readings/device/{devices[0].id}"):
        denied = await unauthenticated_client.get(path, headers=headers["accountant"])
        assert denied.status_code == 403
        allowed = await unauthenticated_client.get(path, headers=headers["technician"])
        assert allowed.status_code == 200
        assert allowed.json()["total"] == (2 if path == "/api/v1/readings" else 1)
