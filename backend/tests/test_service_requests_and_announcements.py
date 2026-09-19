"""Automated test suite for Self-Service Service Requests & Community Bulletin Board.

Verifies:
1. Non-incident service request creation (inheriting Ticket System state machine).
2. Amenity slot availability and booking workflow.
3. Database-level and pessimistic lock double-booking concurrency protection.
4. Amenity booking cancellation releasing time slots.
5. Announcement feed auto-hiding expired notices (`expires_at`).
6. Urgent announcement immediate broadcast via NotificationService.
7. Resident mark-as-read tracking and unread count decrements.
"""

import asyncio
import datetime
from uuid import uuid4

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import select

from app.core.security import create_access_token, hash_password
from app.models.apartment import Apartment
from app.models.building import Building
from app.models.floor import Floor
from app.models.notification import Notification
from app.models.service_request import Amenity, AmenityBooking, ServiceRequest
from app.models.ticket import Ticket
from app.models.user import User
from tests.conftest import testing_session_factory


@pytest_asyncio.fixture
async def service_env():
    """Seed test fixtures: 1 Building, 1 Floor, 2 Apartments, 1 Admin, 2 Residents, 1 Amenity."""
    async with testing_session_factory() as session:
        bldg = Building(name="Oasis Tower", address="100 Green Ave", total_floors=10)
        session.add(bldg)
        await session.flush()

        floor = Floor(building_id=bldg.id, floor_number=4)
        session.add(floor)
        await session.flush()

        apt1 = Apartment(floor_id=floor.id, unit_number="401", area_sqm=80.0, resident_name="Nguyen Van A")
        apt2 = Apartment(floor_id=floor.id, unit_number="402", area_sqm=95.0, resident_name="Tran Thi B")
        session.add_all([apt1, apt2])
        await session.flush()

        # Admin user
        admin = User(
            email="admin@oasis.com",
            hashed_password=hash_password("admin123"),
            full_name="Admin Ban Quan Ly",
            role="admin",
            is_active=True,
            is_superuser=True,
        )
        # Resident 1 (Apt 401)
        res1 = User(
            email="resident1@oasis.com",
            hashed_password=hash_password("res123"),
            full_name="Nguyen Van A",
            role="resident",
            apartment_id=apt1.id,
            is_active=True,
        )
        # Resident 2 (Apt 402)
        res2 = User(
            email="resident2@oasis.com",
            hashed_password=hash_password("res123"),
            full_name="Tran Thi B",
            role="resident",
            apartment_id=apt2.id,
            is_active=True,
        )
        session.add_all([admin, res1, res2])
        await session.flush()

        # Demo Amenity
        amenity = Amenity(
            id=uuid4(),
            building_id=bldg.id,
            name="Phòng Sinh Hoạt Cộng Đồng",
            description="Phòng họp và tổ chức tiệc cư dân",
            capacity=25,
            available_slots=["08:00 - 10:00", "10:00 - 12:00", "14:00 - 16:00", "18:00 - 20:00"],
            requires_approval=False,
            is_active=True,
        )
        session.add(amenity)
        await session.commit()

        return {
            "building": bldg,
            "apt1": apt1,
            "apt2": apt2,
            "admin": admin,
            "res1": res1,
            "res2": res2,
            "amenity": amenity,
            "tokens": {
                "admin": create_access_token({"sub": str(admin.id), "role": "admin"}),
                "res1": create_access_token({"sub": str(res1.id), "role": "resident"}),
                "res2": create_access_token({"sub": str(res2.id), "role": "resident"}),
            },
        }


# -----------------------------------------------------------------------------
# 1. Service Requests Test
# -----------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_create_and_list_service_request(client: AsyncClient, service_env):
    """Verify resident can create a service request, which inherits the Ticket state machine."""
    tokens = service_env["tokens"]
    headers = {"Authorization": f"Bearer {tokens['res1']}"}

    payload = {
        "request_type": "cleaning",
        "title": "Dọn dẹp tổng vệ sinh căn hộ 401",
        "description": "Nhờ BQL điều phối đội làm sạch thảm và cửa kính ban công.",
        "scheduled_slot": "08:00 - 10:00",
        "notes": {"package": "deep_clean", "square_meters": 80},
    }

    resp = await client.post("/api/v1/service-requests", json=payload, headers=headers)
    assert resp.status_code == 201, resp.text
    data = resp.json()

    assert data["request_type"] == "cleaning"
    assert data["ticket_status"] == "open"
    assert data["ticket_priority"] == "medium"
    assert data["ticket_title"] == payload["title"]
    assert data["apartment_unit"] == "401"
    assert data["notes"]["package"] == "deep_clean"

    # List resident's requests
    list_resp = await client.get("/api/v1/me/service-requests", headers=headers)
    assert list_resp.status_code == 200
    list_data = list_resp.json()
    assert len(list_data) >= 1
    assert any(item["id"] == data["id"] for item in list_data)

    # Verify directly in database that Ticket record was created
    async with testing_session_factory() as session:
        t_stmt = select(Ticket).where(Ticket.id == data["ticket_id"])
        ticket = (await session.execute(t_stmt)).scalar_one_or_none()
        assert ticket is not None
        assert ticket.source.value == "resident_report"
        assert ticket.category == "cleaning"


# -----------------------------------------------------------------------------
# 2. Amenity Slots & Double-Booking Concurrency Protection Test
# -----------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_amenity_available_slots_and_booking(client: AsyncClient, service_env):
    """Verify slot availability inquiry and standard booking flow."""
    tokens = service_env["tokens"]
    amenity_id = service_env["amenity"].id
    headers = {"Authorization": f"Bearer {tokens['res1']}"}

    target_date = "2026-10-15"
    slots_resp = await client.get(
        f"/api/v1/amenities/{amenity_id}/available-slots?date={target_date}",
        headers=headers,
    )
    assert slots_resp.status_code == 200
    slots_data = slots_resp.json()
    assert slots_data["amenity_name"] == "Phòng Sinh Hoạt Cộng Đồng"
    assert len(slots_data["slots"]) == 4
    assert all(s["is_available"] is True for s in slots_data["slots"])

    # Book slot "08:00 - 10:00"
    booking_payload = {
        "booking_date": target_date,
        "time_slot": "08:00 - 10:00",
        "notes": "Họp mặt gia đình cuối tuần",
    }
    book_resp = await client.post(
        f"/api/v1/amenities/{amenity_id}/bookings",
        json=booking_payload,
        headers=headers,
    )
    assert book_resp.status_code == 201, book_resp.text
    booking_data = book_resp.json()
    assert booking_data["status"] == "confirmed"
    assert booking_data["time_slot"] == "08:00 - 10:00"
    assert booking_data["apartment_unit"] == "401"

    # Query slots again: "08:00 - 10:00" should now be occupied
    slots_resp2 = await client.get(
        f"/api/v1/amenities/{amenity_id}/available-slots?date={target_date}",
        headers=headers,
    )
    slots_data2 = slots_resp2.json()
    slot_08 = next(s for s in slots_data2["slots"] if s["time_slot"] == "08:00 - 10:00")
    assert slot_08["is_available"] is False
    assert slot_08["is_own_booking"] is True


@pytest.mark.asyncio
async def test_double_booking_prevention_sequential(client: AsyncClient, service_env):
    """Verify that a second resident attempting to book an already occupied slot is rejected with 409."""
    tokens = service_env["tokens"]
    amenity_id = service_env["amenity"].id
    target_date = "2026-10-16"
    slot = "10:00 - 12:00"

    # Resident 1 books first
    r1_resp = await client.post(
        f"/api/v1/amenities/{amenity_id}/bookings",
        json={"booking_date": target_date, "time_slot": slot, "notes": "Căn 401 đặt trước"},
        headers={"Authorization": f"Bearer {tokens['res1']}"},
    )
    assert r1_resp.status_code == 201

    # Resident 2 tries to book the EXACT SAME slot on the SAME date
    r2_resp = await client.post(
        f"/api/v1/amenities/{amenity_id}/bookings",
        json={"booking_date": target_date, "time_slot": slot, "notes": "Căn 402 cố gắng đặt trùng"},
        headers={"Authorization": f"Bearer {tokens['res2']}"},
    )
    # Must be rejected with 409 Conflict
    assert r2_resp.status_code == 409
    assert "đã có người đặt trước" in r2_resp.json()["detail"] or "vừa được đặt" in r2_resp.json()["detail"]


@pytest.mark.asyncio
async def test_double_booking_prevention_concurrent(client: AsyncClient, service_env):
    """Simulate 2 concurrent booking requests for the exact same slot. Exactly one must succeed, one must get 409."""
    tokens = service_env["tokens"]
    amenity_id = service_env["amenity"].id
    target_date = "2026-10-17"
    slot = "14:00 - 16:00"

    async def book_req(token_key, note):
        return await client.post(
            f"/api/v1/amenities/{amenity_id}/bookings",
            json={"booking_date": target_date, "time_slot": slot, "notes": note},
            headers={"Authorization": f"Bearer {tokens[token_key]}"},
        )

    # Launch both requests simultaneously
    resp1, resp2 = await asyncio.gather(
        book_req("res1", "Concurrent Attempt 1"),
        book_req("res2", "Concurrent Attempt 2"),
    )

    statuses = [resp1.status_code, resp2.status_code]
    assert 201 in statuses, f"Expected one 201, got {statuses}"
    assert 409 in statuses, f"Expected one 409 conflict, got {statuses}"


@pytest.mark.asyncio
async def test_cancel_amenity_booking_frees_slot(client: AsyncClient, service_env):
    """Verify that cancelling a booking frees the slot for other residents."""
    tokens = service_env["tokens"]
    amenity_id = service_env["amenity"].id
    target_date = "2026-10-18"
    slot = "18:00 - 20:00"

    # Resident 1 books
    book_resp = await client.post(
        f"/api/v1/amenities/{amenity_id}/bookings",
        json={"booking_date": target_date, "time_slot": slot},
        headers={"Authorization": f"Bearer {tokens['res1']}"},
    )
    assert book_resp.status_code == 201
    booking_id = book_resp.json()["id"]

    # Resident 1 cancels their booking
    cancel_resp = await client.delete(
        f"/api/v1/amenities/bookings/{booking_id}",
        headers={"Authorization": f"Bearer {tokens['res1']}"},
    )
    assert cancel_resp.status_code == 200

    # Resident 2 can now successfully book that freed slot
    book_resp2 = await client.post(
        f"/api/v1/amenities/{amenity_id}/bookings",
        json={"booking_date": target_date, "time_slot": slot},
        headers={"Authorization": f"Bearer {tokens['res2']}"},
    )
    assert book_resp2.status_code == 201


# -----------------------------------------------------------------------------
# 3. Community Announcements & Expiration Test
# -----------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_announcement_expires_at_feed_filtering(client: AsyncClient, service_env):
    """Verify that expired announcements (expires_at in the past) are automatically filtered out."""
    tokens = service_env["tokens"]
    admin_headers = {"Authorization": f"Bearer {tokens['admin']}"}
    res_headers = {"Authorization": f"Bearer {tokens['res1']}"}
    bldg_id = str(service_env["building"].id)

    now = datetime.datetime.now(datetime.timezone.utc)

    # 1. Create expired announcement (expired 1 day ago)
    expired_payload = {
        "building_id": bldg_id,
        "title": "Hội thảo cây xanh đã kết thúc hôm qua",
        "content": "Sự kiện đã diễn ra thành công tốt đẹp.",
        "category": "event",
        "priority": "standard",
        "expires_at": (now - datetime.timedelta(days=1)).isoformat(),
    }
    r_exp = await client.post("/api/v1/admin/announcements", json=expired_payload, headers=admin_headers)
    assert r_exp.status_code == 201

    # 2. Create active announcement (expires in 5 days)
    active_payload = {
        "building_id": bldg_id,
        "title": "Thông báo thu gom pin cũ bảo vệ môi trường",
        "content": "Thùng thu gom đặt tại sảnh chính từ nay đến tuần sau.",
        "category": "general",
        "priority": "standard",
        "expires_at": (now + datetime.timedelta(days=5)).isoformat(),
    }
    r_act = await client.post("/api/v1/admin/announcements", json=active_payload, headers=admin_headers)
    assert r_act.status_code == 201

    # 3. Resident queries feed: expired item MUST NOT appear
    feed_resp = await client.get("/api/v1/announcements", headers=res_headers)
    assert feed_resp.status_code == 200
    feed_data = feed_resp.json()
    titles = [item["title"] for item in feed_data["items"]]

    assert "Thông báo thu gom pin cũ bảo vệ môi trường" in titles
    assert "Hội thảo cây xanh đã kết thúc hôm qua" not in titles


@pytest.mark.asyncio
async def test_urgent_announcement_immediate_broadcast(client: AsyncClient, service_env):
    """Verify that creating an urgent announcement broadcasts an in-app notification immediately."""
    tokens = service_env["tokens"]
    admin_headers = {"Authorization": f"Bearer {tokens['admin']}"}
    bldg_id = str(service_env["building"].id)

    urgent_payload = {
        "building_id": bldg_id,
        "title": "Mất nước đột xuất do vỡ ống cấp Tháp B",
        "content": "Kỹ thuật đang khắc phục sự cố khẩn cấp trong 45 phút tới.",
        "category": "maintenance",
        "priority": "urgent",
        "pin_to_top": True,
    }

    create_resp = await client.post("/api/v1/admin/announcements", json=urgent_payload, headers=admin_headers)
    assert create_resp.status_code == 201
    ann_data = create_resp.json()
    assert ann_data["priority"] == "urgent"
    assert ann_data["pin_to_top"] is True

    # Check notification record created for resident in database
    async with testing_session_factory() as session:
        notif_stmt = select(Notification).where(
            Notification.user_id == service_env["res1"].id,
            Notification.category == "announcement",
        )
        notifs = (await session.execute(notif_stmt)).scalars().all()
        assert len(notifs) >= 1
        assert any("Mất nước đột xuất" in n.title or "KHẨN CẤP" in n.title for n in notifs)


@pytest.mark.asyncio
async def test_mark_announcement_as_read(client: AsyncClient, service_env):
    """Verify marking announcement as read updates unread counter."""
    tokens = service_env["tokens"]
    admin_headers = {"Authorization": f"Bearer {tokens['admin']}"}
    res_headers = {"Authorization": f"Bearer {tokens['res1']}"}
    bldg_id = str(service_env["building"].id)

    # Post an announcement
    post_resp = await client.post(
        "/api/v1/admin/announcements",
        json={
            "building_id": bldg_id,
            "title": "Thông báo kiểm tra hệ thống camera an ninh tầng hầm",
            "content": "BQL tiến hành bảo dưỡng camera từ 23:00 tối nay.",
            "category": "safety",
            "priority": "standard",
        },
        headers=admin_headers,
    )
    assert post_resp.status_code == 201
    ann_id = post_resp.json()["id"]

    # Check feed before reading: should be unread
    f_before = await client.get("/api/v1/announcements", headers=res_headers)
    item_before = next(i for i in f_before.json()["items"] if i["id"] == ann_id)
    assert item_before["is_read"] is False

    # Mark as read
    read_resp = await client.post(f"/api/v1/announcements/{ann_id}/read", headers=res_headers)
    assert read_resp.status_code == 200

    # Check feed after reading: should be read
    f_after = await client.get("/api/v1/announcements", headers=res_headers)
    item_after = next(i for i in f_after.json()["items"] if i["id"] == ann_id)
    assert item_after["is_read"] is True
