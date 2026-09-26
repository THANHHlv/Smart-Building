"""Comprehensive test suite for User Profiles, Avatar upload, and Resident Management."""

import io
from uuid import uuid4

import pytest
from httpx import AsyncClient
from PIL import Image
from sqlalchemy import select

from app.core.security import create_access_token, hash_password
from app.models.apartment import Apartment
from app.models.building import Building
from app.models.floor import Floor
from app.models.profile import ApartmentResident, Profile, ResidentRelationship, ResidentStatus
from app.models.user import User


@pytest.fixture
async def sample_building_and_apartment(client: AsyncClient):
    """Create a sample building, floor, and apartment in test database."""
    from tests.conftest import testing_session_factory

    async with testing_session_factory() as session:
        bld = Building(name="Oasis Tower A", address="123 Mai Chi Tho, Q2")
        session.add(bld)
        await session.flush()

        flr = Floor(building_id=bld.id, floor_number=5, name="Tầng 5")
        session.add(flr)
        await session.flush()

        apt = Apartment(floor_id=flr.id, unit_number="A-502", num_rooms=2)
        session.add(apt)
        await session.commit()

        return {"building_id": bld.id, "floor_id": flr.id, "apartment_id": apt.id}


@pytest.fixture
async def resident_client(client: AsyncClient):
    """Create a resident user and an authenticated client."""
    from tests.conftest import testing_session_factory

    user_id = uuid4()
    email = f"resident_{user_id.hex[:6]}@example.com"
    async with testing_session_factory() as session:
        user = User(
            id=user_id,
            email=email,
            phone="0912345678",
            hashed_password=hash_password("ResidentPass123"),
            full_name="Nguyễn Văn An",
            role="resident",
        )
        session.add(user)
        await session.commit()

    token = create_access_token(data={"sub": str(user_id), "role": "resident"})
    return {"user_id": user_id, "email": email, "token": token, "headers": {"Authorization": f"Bearer {token}"}}


def create_dummy_image_bytes(format="PNG", size=(100, 100), color="blue") -> bytes:
    """Generate in-memory image bytes for avatar testing."""
    buf = io.BytesIO()
    img = Image.new("RGB", size, color=color)
    img.save(buf, format=format)
    return buf.getvalue()


# -----------------------------------------------------------------------------
# 1. Profile Retrieval & Updates
# -----------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_and_update_my_profile(unauthenticated_client: AsyncClient, resident_client: dict):
    """Test retrieving and updating current user's profile."""
    headers = resident_client["headers"]

    # 1. GET /me/profile
    res = await unauthenticated_client.get("/api/v1/me/profile", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["email"] == resident_client["email"]
    assert data["full_name"] == "Nguyễn Văn An"
    assert data["phone"] == "0912345678"

    # 2. PUT /me/profile with valid details
    payload = {
        "full_name": "Nguyễn Văn Bình",
        "phone": "0987654321",
        "date_of_birth": "1992-05-15",
        "gender": "male",
        "emergency_contact_name": "Trần Thị Cúc",
        "emergency_contact_phone": "0901234567",
    }
    update_res = await unauthenticated_client.put("/api/v1/me/profile", json=payload, headers=headers)
    assert update_res.status_code == 200
    updated_data = update_res.json()
    assert updated_data["full_name"] == "Nguyễn Văn Bình"
    assert updated_data["phone"] == "0987654321"
    assert updated_data["date_of_birth"] == "1992-05-15"
    assert updated_data["gender"] == "male"
    assert updated_data["emergency_contact_name"] == "Trần Thị Cúc"
    assert updated_data["emergency_contact_phone"] == "0901234567"


@pytest.mark.asyncio
async def test_profile_validation_rules(unauthenticated_client: AsyncClient, resident_client: dict):
    """Test validation on phone format and date of birth."""
    headers = resident_client["headers"]

    # Invalid VN phone number
    res_phone = await unauthenticated_client.put(
        "/api/v1/me/profile",
        json={"phone": "123456"},
        headers=headers,
    )
    assert res_phone.status_code == 422

    # Future date of birth
    res_dob_future = await unauthenticated_client.put(
        "/api/v1/me/profile",
        json={"date_of_birth": "2099-01-01"},
        headers=headers,
    )
    assert res_dob_future.status_code == 422

    # Unreasonable age (> 120 years)
    res_dob_old = await unauthenticated_client.put(
        "/api/v1/me/profile",
        json={"date_of_birth": "1850-01-01"},
        headers=headers,
    )
    assert res_dob_old.status_code == 422


@pytest.mark.asyncio
async def test_national_id_masking(unauthenticated_client: AsyncClient, resident_client: dict):
    """Test that national ID (CCCD) is masked before being saved."""
    headers = resident_client["headers"]

    res = await unauthenticated_client.put(
        "/api/v1/me/profile",
        json={"national_id": "037198001234"},
        headers=headers,
    )
    assert res.status_code == 200
    data = res.json()
    # Masked format: 037***1234
    assert data["national_id_masked"] == "037***1234"
    assert "037198001234" not in str(data)


# -----------------------------------------------------------------------------
# 2. Avatar Upload & Processing
# -----------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_avatar_upload_success_and_invalid(unauthenticated_client: AsyncClient, resident_client: dict):
    """Test uploading valid image vs invalid non-image and oversized image."""
    headers = resident_client["headers"]

    # 1. Valid image upload
    img_bytes = create_dummy_image_bytes(format="PNG", size=(200, 200), color="green")
    files = {"file": ("avatar.png", img_bytes, "image/png")}
    res = await unauthenticated_client.post("/api/v1/me/profile/avatar", files=files, headers=headers)
    assert res.status_code == 200
    avatar_data = res.json()
    assert "avatar_url" in avatar_data
    assert avatar_data["avatar_url"].endswith(".webp")

    # Verify profile now reflects the avatar_url
    get_res = await unauthenticated_client.get("/api/v1/me/profile", headers=headers)
    assert get_res.json()["avatar_url"] == avatar_data["avatar_url"]

    # 2. Invalid MIME type (text file)
    txt_file = {"file": ("readme.txt", b"This is not an image", "text/plain")}
    res_invalid = await unauthenticated_client.post("/api/v1/me/profile/avatar", files=txt_file, headers=headers)
    assert res_invalid.status_code == 400

    # 3. Oversized file (> 5MB)
    huge_bytes = b"0" * (5 * 1024 * 1024 + 100)
    res_huge = await unauthenticated_client.post(
        "/api/v1/me/profile/avatar",
        files={"file": ("huge.png", huge_bytes, "image/png")},
        headers=headers,
    )
    assert res_huge.status_code == 400


# -----------------------------------------------------------------------------
# 3. Linked Apartments & Primary Contact
# -----------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_me_apartments_and_primary_contact(
    unauthenticated_client: AsyncClient, resident_client: dict, sample_building_and_apartment: dict
):
    """Test listing linked apartments and toggling primary contact."""
    from tests.conftest import testing_session_factory

    apt_id = sample_building_and_apartment["apartment_id"]
    user_id = resident_client["user_id"]
    headers = resident_client["headers"]

    # Link user to apartment in DB
    async with testing_session_factory() as session:
        residency = ApartmentResident(
            apartment_id=apt_id,
            user_id=user_id,
            relationship=ResidentRelationship.OWNER,
            is_primary_contact=False,
            status=ResidentStatus.ACTIVE,
        )
        session.add(residency)
        await session.commit()

    # 1. GET /me/apartments
    res = await unauthenticated_client.get("/api/v1/me/apartments", headers=headers)
    assert res.status_code == 200
    apts = res.json()
    assert len(apts) >= 1
    target = next((a for a in apts if a["apartment_id"] == str(apt_id)), None)
    assert target is not None
    assert target["unit_number"] == "A-502"
    assert target["relationship"] == "owner"
    assert target["is_primary_contact"] is False

    # 2. POST /me/apartments/{id}/set-primary-contact
    set_res = await unauthenticated_client.post(
        f"/api/v1/me/apartments/{apt_id}/set-primary-contact",
        headers=headers,
    )
    assert set_res.status_code == 200

    # Verify primary contact is now true
    res2 = await unauthenticated_client.get("/api/v1/me/apartments", headers=headers)
    target2 = next(a for a in res2.json() if a["apartment_id"] == str(apt_id))
    assert target2["is_primary_contact"] is True


# -----------------------------------------------------------------------------
# 4. Admin Resident Management & Soft Delete
# -----------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_admin_resident_crud_and_soft_delete(
    client: AsyncClient, sample_building_and_apartment: dict
):
    """Admin tests registering new resident, updating details, and marking moved out."""
    apt_id = sample_building_and_apartment["apartment_id"]

    # 1. POST /admin/residents (add new resident)
    create_payload = {
        "apartment_id": str(apt_id),
        "email": "resident_new_move_in@example.com",
        "full_name": "Lê Hoàng Nam",
        "phone": "0933123456",
        "relationship": "tenant",
        "is_primary_contact": True,
    }
    create_res = await client.post("/api/v1/admin/residents", json=create_payload)
    assert create_res.status_code == 201
    created_item = create_res.json()
    resident_id = created_item["id"]
    assert created_item["resident_name"] == "Lê Hoàng Nam"
    assert created_item["relationship"] == "tenant"
    assert created_item["is_primary_contact"] is True
    assert created_item["status"] == "active"

    # 2. GET /admin/residents with filter
    list_res = await client.get(f"/api/v1/admin/residents?apartment_id={apt_id}")
    assert list_res.status_code == 200
    assert any(r["id"] == resident_id for r in list_res.json())

    # 3. PATCH /admin/residents/{id}
    patch_res = await client.patch(
        f"/api/v1/admin/residents/{resident_id}",
        json={"relationship": "owner"},
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["relationship"] == "owner"

    # 4. DELETE /admin/residents/{id} (soft delete - moved out)
    del_res = await client.delete(f"/api/v1/admin/residents/{resident_id}")
    assert del_res.status_code == 200
    assert "chuyển đi" in del_res.json()["message"]

    # Verify record still exists with status 'moved_out' and has moved_out_at timestamp
    list_all = await client.get(f"/api/v1/admin/residents?apartment_id={apt_id}&status=all")
    item = next(r for r in list_all.json() if r["id"] == resident_id)
    assert item["status"] == "moved_out"
    assert item["moved_out_at"] is not None
    assert item["is_primary_contact"] is False


# -----------------------------------------------------------------------------
# 5. Security & RBAC Enforcement
# -----------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_resident_forbidden_on_admin_residents(
    unauthenticated_client: AsyncClient, resident_client: dict
):
    """Verify that regular residents cannot access admin resident management endpoints."""
    headers = resident_client["headers"]

    res = await unauthenticated_client.get("/api/v1/admin/residents", headers=headers)
    assert res.status_code == 403
    assert "không có quyền" in res.json()["detail"]


@pytest.mark.asyncio
async def test_admin_technicians_directory(client: AsyncClient):
    """Test listing and updating technicians."""
    from tests.conftest import testing_session_factory

    # Create a technician user
    tech_id = uuid4()
    async with testing_session_factory() as session:
        tech_user = User(
            id=tech_id,
            email="tech_test_expert@example.com",
            phone="0944555666",
            hashed_password=hash_password("TechPass123"),
            full_name="Kỹ Thuật Viên Tuấn",
            role="technician",
        )
        session.add(tech_user)
        await session.commit()

    # GET /admin/technicians
    res = await client.get("/api/v1/admin/technicians")
    assert res.status_code == 200
    techs = res.json()
    assert any(t["email"] == "tech_test_expert@example.com" for t in techs)

    # PUT /admin/technicians/{id}
    tech_entry = next(t for t in techs if t["email"] == "tech_test_expert@example.com")
    update_res = await client.put(
        f"/api/v1/admin/technicians/{tech_entry['id']}",
        json={
            "specialties": ["electrical", "hvac"],
            "certification_info": "Chứng chỉ An toàn điện Cấp 4",
        },
    )
    assert update_res.status_code == 200
    updated_tech = update_res.json()
    assert "electrical" in updated_tech["specialties"]
    assert "hvac" in updated_tech["specialties"]
    assert updated_tech["certification_info"] == "Chứng chỉ An toàn điện Cấp 4"


@pytest.mark.asyncio
async def test_change_password_flow(client: AsyncClient, resident_client):
    """Test change password validation and successful execution."""
    # 1. Wrong current password -> 400
    res = await client.post(
        "/api/v1/auth/change-password",
        headers=resident_client["headers"],
        json={
            "current_password": "WrongPassword999",
            "new_password": "newpassword123",
            "confirm_password": "newpassword123",
        },
    )
    assert res.status_code == 400
    assert "không chính xác" in res.json()["detail"]

    # 2. Mismatched confirmation -> 400
    res = await client.post(
        "/api/v1/auth/change-password",
        headers=resident_client["headers"],
        json={
            "current_password": "ResidentPass123",
            "new_password": "newpassword123",
            "confirm_password": "different123",
        },
    )
    assert res.status_code == 400
    assert "không trùng khớp" in res.json()["detail"]

    # 3. Successful change
    res = await client.post(
        "/api/v1/auth/change-password",
        headers=resident_client["headers"],
        json={
            "current_password": "ResidentPass123",
            "new_password": "newpassword123",
            "confirm_password": "newpassword123",
        },
    )
    assert res.status_code == 200
    assert res.json()["message"] == "Đổi mật khẩu thành công"

    # 4. Login with new password succeeds
    login_res = await client.post(
        "/api/v1/auth/login",
        json={"email": resident_client["email"], "password": "newpassword123"},
    )
    assert login_res.status_code == 200
    assert "access_token" in login_res.json()

