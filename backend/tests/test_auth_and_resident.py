"""Tests for Authentication, RBAC, and Resident Dashboard."""

import pytest
from httpx import AsyncClient
from uuid import uuid4

from app.core.security import hash_password
from app.models.apartment import Apartment
from app.models.building import Building
from app.models.floor import Floor
from app.models.user import User
from tests.conftest import testing_session_factory


@pytest.fixture
async def setup_auth_data():
    """Create test building, floor, apartment, admin, and resident."""
    async with testing_session_factory() as session:
        building = Building(name="Test Auth Tower", address="123 Test St", total_floors=2)
        session.add(building)
        await session.flush()

        floor = Floor(building_id=building.id, floor_number=1, name="Floor 1")
        session.add(floor)
        await session.flush()

        apartment = Apartment(
            floor_id=floor.id,
            unit_number="101",
            area_sqm=75.0,
            num_rooms=2,
            resident_name="Test Resident",
        )
        session.add(apartment)
        await session.flush()

        admin = User(
            id=uuid4(),
            email="test.admin@example.com",
            hashed_password=hash_password("adminpass"),
            full_name="Admin Test",
            role="admin",
            is_superuser=True,
        )
        resident = User(
            id=uuid4(),
            email="test.resident@example.com",
            hashed_password=hash_password("residentpass"),
            full_name="Resident Test",
            role="resident",
            apartment_id=apartment.id,
        )
        session.add_all([admin, resident])
        await session.commit()

        return {
            "admin": admin,
            "resident": resident,
            "apartment": apartment,
        }


@pytest.mark.asyncio
async def test_login_admin_success(client: AsyncClient, setup_auth_data):
    """Test successful admin login."""
    response = await client.post(
        "/api/v1/auth/login",
        json={"email": "test.admin@example.com", "password": "adminpass"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["role"] == "admin"
    assert data["user"]["email"] == "test.admin@example.com"


@pytest.mark.asyncio
async def test_login_resident_success(client: AsyncClient, setup_auth_data):
    """Test successful resident login."""
    response = await client.post(
        "/api/v1/auth/login",
        json={"email": "test.resident@example.com", "password": "residentpass"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["user"]["role"] == "resident"
    assert data["user"]["apartment_unit"] == "101"


@pytest.mark.asyncio
async def test_login_invalid_password(client: AsyncClient, setup_auth_data):
    """Test login with wrong password."""
    response = await client.post(
        "/api/v1/auth/login",
        json={"email": "test.admin@example.com", "password": "wrongpassword"},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_get_me(client: AsyncClient, setup_auth_data):
    """Test retrieving /auth/me with Bearer token."""
    login_res = await client.post(
        "/api/v1/auth/login",
        json={"email": "test.resident@example.com", "password": "residentpass"},
    )
    token = login_res.json()["access_token"]

    response = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    user_data = response.json()
    assert user_data["email"] == "test.resident@example.com"
    assert user_data["apartment_unit"] == "101"


@pytest.mark.asyncio
async def test_get_demo_accounts(client: AsyncClient, setup_auth_data):
    """Test listing available demo accounts."""
    response = await client.get("/api/v1/auth/demo-accounts")
    assert response.status_code == 200
    accounts = response.json()
    assert len(accounts) >= 2
    roles = [a["role"] for a in accounts]
    assert "admin" in roles
    assert "resident" in roles


@pytest.mark.asyncio
async def test_resident_dashboard_scoped(client: AsyncClient, setup_auth_data):
    """Test resident dashboard returns only resident's apartment."""
    login_res = await client.post(
        "/api/v1/auth/login",
        json={"email": "test.resident@example.com", "password": "residentpass"},
    )
    token = login_res.json()["access_token"]

    response = await client.get(
        "/api/v1/resident/dashboard",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["apartment"]["unit_number"] == "101"
    assert "climate" in data
    assert "energy" in data
    assert "water" in data
    assert "devices" in data
    assert "alerts" in data


@pytest.mark.asyncio
async def test_register_resident_success(client: AsyncClient):
    """POST /api/v1/auth/register should create a new resident account and return token."""
    response = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "new.resident@example.com",
            "password": "securepassword123",
            "full_name": "New Resident",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert "access_token" in data
    assert data["user"]["email"] == "new.resident@example.com"
    assert data["user"]["role"] == "resident"
    assert data["user"]["full_name"] == "New Resident"


@pytest.mark.asyncio
async def test_register_duplicate_email(client: AsyncClient, setup_auth_data):
    """POST /api/v1/auth/register with already registered email should return 400."""
    response = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "test.resident@example.com",
            "password": "anotherpassword",
            "full_name": "Duplicate User",
        },
    )
    assert response.status_code == 409
    assert "already exists" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_unauthenticated_request_rejected(unauthenticated_client: AsyncClient):
    """Unauthenticated request to protected endpoint should return 401."""
    response = await unauthenticated_client.get("/api/v1/buildings")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_resident_forbidden_on_admin_endpoint(client: AsyncClient, setup_auth_data):
    """Resident user attempting admin-only write operations should return 403 Forbidden."""
    login_res = await client.post(
        "/api/v1/auth/login",
        json={"email": "test.resident@example.com", "password": "residentpass"},
    )
    resident_token = login_res.json()["access_token"]
    resident_headers = {"Authorization": f"Bearer {resident_token}"}

    # Try creating a building as resident
    response = await client.post(
        "/api/v1/buildings",
        json={"name": "Forbidden Tower", "address": "999 Hack Way"},
        headers=resident_headers,
    )
    assert response.status_code == 403
    assert "administrative privileges required" in response.json()["detail"].lower()

    # Try accessing admin dashboard as resident
    dash_resp = await client.get(
        "/api/v1/dashboard/overview",
        headers=resident_headers,
    )
    assert dash_resp.status_code == 403

