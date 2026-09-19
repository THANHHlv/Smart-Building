"""Tests for real-world smart building features: User Management, Device Control, Maintenance, and AI Assistant."""

import pytest
from httpx import AsyncClient
from uuid import uuid4

from app.core.security import hash_password
from app.models.apartment import Apartment
from app.models.building import Building
from app.models.device import Device, DeviceStatus
from app.models.device_type import DeviceType
from app.models.floor import Floor
from app.models.user import User
from tests.conftest import testing_session_factory


@pytest.fixture
async def setup_real_world_data():
    """Create test building, apartments, devices, admin, and residents."""
    async with testing_session_factory() as session:
        building = Building(name="Real World Tower", address="456 Real St", total_floors=3)
        session.add(building)
        await session.flush()

        floor = Floor(building_id=building.id, floor_number=2, name="Floor 2")
        session.add(floor)
        await session.flush()

        apt1 = Apartment(floor_id=floor.id, unit_number="201", area_sqm=80.0, num_rooms=3)
        apt2 = Apartment(floor_id=floor.id, unit_number="202", area_sqm=65.0, num_rooms=2)
        session.add_all([apt1, apt2])
        await session.flush()

        dev_type = DeviceType(code="smart_light", name="Smart LED Light", unit="state")
        session.add(dev_type)
        await session.flush()

        # Device in apt1
        dev_apt1 = Device(
            device_code="light-201-living",
            name="Living Room Light",
            apartment_id=apt1.id,
            device_type_id=dev_type.id,
            status=DeviceStatus.OFFLINE,
            is_active=True,
        )
        # Device in apt2
        dev_apt2 = Device(
            device_code="light-202-bedroom",
            name="Bedroom Light",
            apartment_id=apt2.id,
            device_type_id=dev_type.id,
            status=DeviceStatus.ONLINE,
            is_active=True,
        )
        session.add_all([dev_apt1, dev_apt2])
        await session.flush()

        admin = User(
            id=uuid4(),
            email="rw.admin@example.com",
            hashed_password=hash_password("adminpass"),
            full_name="BQL Admin",
            role="admin",
            is_superuser=True,
        )
        resident_assigned = User(
            id=uuid4(),
            email="rw.resident@example.com",
            hashed_password=hash_password("residentpass"),
            full_name="Cu Dan 201",
            role="resident",
            apartment_id=apt1.id,
        )
        resident_unassigned = User(
            id=uuid4(),
            email="new.resident@example.com",
            hashed_password=hash_password("newpass"),
            full_name="Cu Dan Moi",
            role="resident",
            apartment_id=None,
        )
        session.add_all([admin, resident_assigned, resident_unassigned])
        await session.commit()

        return {
            "admin": admin,
            "resident": resident_assigned,
            "new_resident": resident_unassigned,
            "apt1": apt1,
            "apt2": apt2,
            "dev_apt1": dev_apt1,
            "dev_apt2": dev_apt2,
        }


async def _get_token(client: AsyncClient, email: str, password: str) -> str:
    res = await client.post("/api/v1/auth/login", json={"email": email, "password": password})
    return res.json()["access_token"]


@pytest.mark.asyncio
async def test_admin_list_and_assign_users(client: AsyncClient, setup_real_world_data):
    """Test admin listing users and assigning an unassigned resident to an apartment."""
    data = setup_real_world_data
    admin_token = await _get_token(client, "rw.admin@example.com", "adminpass")
    headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. List users
    res = await client.get("/api/v1/users", headers=headers)
    assert res.status_code == 200
    users = res.json()
    assert len(users) >= 3

    # 2. Filter unassigned users
    res_unassigned = await client.get("/api/v1/users?assigned=false", headers=headers)
    assert res_unassigned.status_code == 200
    unassigned = res_unassigned.json()
    assert any(u["email"] == "new.resident@example.com" for u in unassigned)

    # 3. Assign unassigned user to apt2
    new_user_id = str(data["new_resident"].id)
    apt2_id = str(data["apt2"].id)
    assign_res = await client.put(
        f"/api/v1/users/{new_user_id}/assign-apartment",
        json={"apartment_id": apt2_id},
        headers=headers,
    )
    assert assign_res.status_code == 200
    assigned_user = assign_res.json()
    assert assigned_user["apartment_unit"] == "202"
    assert assigned_user["apartment_id"] == apt2_id


@pytest.mark.asyncio
async def test_device_control_permissions(client: AsyncClient, setup_real_world_data):
    """Test device toggling by authorized resident and rejection when controlling outside apartment."""
    data = setup_real_world_data
    resident_token = await _get_token(client, "rw.resident@example.com", "residentpass")
    headers = {"Authorization": f"Bearer {resident_token}"}

    dev_own = str(data["dev_apt1"].id)
    dev_other = str(data["dev_apt2"].id)

    # 1. Resident controls own device -> Turn ON
    res_on = await client.post(
        f"/api/v1/devices/{dev_own}/control",
        json={"action": "turn_on"},
        headers=headers,
    )
    assert res_on.status_code == 200
    assert res_on.json()["status"] == "online"

    # 2. Resident toggles own device -> Toggles to OFFLINE
    res_toggle = await client.post(
        f"/api/v1/devices/{dev_own}/control",
        json={"action": "toggle"},
        headers=headers,
    )
    assert res_toggle.status_code == 200
    assert res_toggle.json()["status"] == "offline"

    # 3. Resident tries to control device in another apartment -> 403 Forbidden
    res_forbidden = await client.post(
        f"/api/v1/devices/{dev_other}/control",
        json={"action": "turn_on"},
        headers=headers,
    )
    assert res_forbidden.status_code == 403


@pytest.mark.asyncio
async def test_maintenance_ticket_workflow(client: AsyncClient, setup_real_world_data):
    """Test creating a maintenance ticket as resident and updating as admin."""
    res_token = await _get_token(client, "rw.resident@example.com", "residentpass")
    admin_token = await _get_token(client, "rw.admin@example.com", "adminpass")

    # 1. Resident submits ticket
    create_res = await client.post(
        "/api/v1/maintenance",
        json={
            "title": "Bong den phong khach bi chap",
            "description": "Bong den sang chop tat lien tuc khi bat cong tac",
            "category": "electrical",
            "urgency": "medium",
        },
        headers={"Authorization": f"Bearer {res_token}"},
    )
    assert create_res.status_code == 201
    ticket = create_res.json()
    assert ticket["status"] == "open"
    ticket_id = ticket["id"]

    # 2. Resident lists own tickets
    list_res = await client.get("/api/v1/maintenance", headers={"Authorization": f"Bearer {res_token}"})
    assert list_res.status_code == 200
    assert any(t["id"] == ticket_id for t in list_res.json())

    # 3. Admin updates ticket to in_progress with notes
    update_res = await client.put(
        f"/api/v1/maintenance/{ticket_id}",
        json={
            "status": "in_progress",
            "technician_notes": "Ky thuat vien Tran Van B da duoc phan cong, du kien den 14h30",
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert update_res.status_code == 200
    assert update_res.json()["status"] == "in_progress"
    assert "Tran Van B" in update_res.json()["technician_notes"]


@pytest.mark.asyncio
async def test_ai_assistant_endpoint(client: AsyncClient, setup_real_world_data):
    """Test AI assistant queries for both Resident and Admin."""
    res_token = await _get_token(client, "rw.resident@example.com", "residentpass")
    admin_token = await _get_token(client, "rw.admin@example.com", "adminpass")

    # 1. Resident queries about electricity bill
    res_ai = await client.post(
        "/api/v1/ai/chat",
        json={"message": "Thang nay nha toi het bao nhieu tien dien?"},
        headers={"Authorization": f"Bearer {res_token}"},
    )
    assert res_ai.status_code == 200
    data = res_ai.json()
    assert data["role_context"] == "resident"
    assert "VNĐ" in data["reply"] or "kWh" in data["reply"]
    assert len(data["suggested_actions"]) > 0

    # 2. Admin queries about system overview
    admin_ai = await client.post(
        "/api/v1/ai/chat",
        json={"message": "Tong quan tinh trang he thong toa nha hom nay the nao?"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert admin_ai.status_code == 200
    admin_data = admin_ai.json()
    assert admin_data["role_context"] == "admin"
    assert "thiết bị" in admin_data["reply"] or "cảnh báo" in admin_data["reply"]


@pytest.mark.asyncio
async def test_resident_dashboard_has_estimated_cost(client: AsyncClient, setup_real_world_data):
    """Test resident dashboard returns estimated utility cost structure."""
    res_token = await _get_token(client, "rw.resident@example.com", "residentpass")
    dash_res = await client.get(
        "/api/v1/resident/dashboard",
        headers={"Authorization": f"Bearer {res_token}"},
    )
    assert dash_res.status_code == 200
    data = dash_res.json()
    assert "estimated_cost" in data
    assert data["estimated_cost"] is not None
    assert "electricity_cost_vnd" in data["estimated_cost"]
    assert "water_cost_vnd" in data["estimated_cost"]
    assert "total_estimated_vnd" in data["estimated_cost"]


@pytest.mark.asyncio
async def test_assign_apartment_conflict_rejection(client: AsyncClient, setup_real_world_data):
    """Admin cannot assign an occupied apartment to another resident without unassigning first."""
    data = setup_real_world_data
    admin_token = await _get_token(client, "rw.admin@example.com", "adminpass")
    headers = {"Authorization": f"Bearer {admin_token}"}

    # apt1 is already assigned to rw.resident@example.com
    apt1_id = str(data["apt1"].id)
    new_user_id = str(data["new_resident"].id)

    # 1. Attempt to assign occupied apt1 to new_resident -> 400 Bad Request
    conflict_res = await client.put(
        f"/api/v1/users/{new_user_id}/assign-apartment",
        json={"apartment_id": apt1_id},
        headers=headers,
    )
    assert conflict_res.status_code == 400
    detail = conflict_res.json()["detail"]
    assert "hiện đã được gán cho cư dân" in detail or "đã được gán" in detail

    # 2. Unassign rw.resident from apt1
    resident_id = str(data["resident"].id)
    unassign_res = await client.put(
        f"/api/v1/users/{resident_id}/unassign-apartment",
        headers=headers,
    )
    assert unassign_res.status_code == 200
    assert unassign_res.json()["apartment_id"] is None

    # 3. Now assigning apt1 to new_resident succeeds
    assign_res = await client.put(
        f"/api/v1/users/{new_user_id}/assign-apartment",
        json={"apartment_id": apt1_id},
        headers=headers,
    )
    assert assign_res.status_code == 200
    assert assign_res.json()["apartment_id"] == apt1_id
    assert assign_res.json()["apartment_unit"] == "201"


@pytest.mark.asyncio
async def test_duplicate_unit_number_creation_rejection(client: AsyncClient, setup_real_world_data):
    """Creating an apartment with duplicate unit_number on same floor should be rejected."""
    data = setup_real_world_data
    admin_token = await _get_token(client, "rw.admin@example.com", "adminpass")
    headers = {"Authorization": f"Bearer {admin_token}"}

    floor_id = str(data["apt1"].floor_id)

    # apt1 already has unit_number "201" on this floor
    dup_res = await client.post(
        "/api/v1/apartments",
        json={"floor_id": floor_id, "unit_number": "201", "area_sqm": 70.0},
        headers=headers,
    )
    assert dup_res.status_code == 400
    assert "đã tồn tại trên tầng này" in dup_res.json()["detail"]
