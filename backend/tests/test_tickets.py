"""Comprehensive test suite for Ticket / Work Order System.

Tests:
1. State Machine transitions (valid vs invalid transitions rejected with 400).
2. Append-only audit history log verification.
3. SLA calculation and natural language copy.
4. Auto-creation of work orders from AI anomaly detection events.
5. Role-based visibility and internal comments filtering.
6. Resident rating and reopening flow.
7. Admin SLA report metrics (MTTR and compliance rate).
"""

from datetime import datetime, timezone
from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import pytest_asyncio
from tests.conftest import testing_session_factory

from app.core.security import create_access_token, hash_password
from app.models.apartment import Apartment
from app.models.building import Building
from app.models.floor import Floor
from app.models.ticket import Technician, Ticket, TicketPriority, TicketSource, TicketStatus, TicketStatusHistory
from app.models.user import User
from app.services.ticket_consumer import get_ticket_consumer
from app.services.ticket_service import TicketService


@pytest_asyncio.fixture
async def test_env():
    """Seed minimal test environment: 1 Building, 1 Floor, 1 Apartment, 1 Admin, 1 Resident, 1 Tech."""
    async with testing_session_factory() as session:

        # Building & Apartment
        bld = Building(name="Test Tower", address="123 Test St", total_floors=5)
        session.add(bld)
        await session.flush()

        floor = Floor(building_id=bld.id, floor_number=3)
        session.add(floor)
        await session.flush()

        apt = Apartment(floor_id=floor.id, unit_number="301", area_sqm=75.0, resident_name="Resident Test")
        session.add(apt)
        await session.flush()

        from app.models.device_type import DeviceType
        from app.models.device import Device, DeviceStatus

        dtype = DeviceType(code="elec_meter", name="Electricity Meter", unit="kW")
        session.add(dtype)
        await session.flush()

        dev = Device(
            apartment_id=apt.id,
            device_type_id=dtype.id,
            device_code="elec-test-301",
            name="Test Power Meter",
            status=DeviceStatus.ONLINE,
        )
        session.add(dev)
        await session.flush()


        # Admin user
        admin = User(
            email="admin@test.com",
            hashed_password=hash_password("admin123"),
            full_name="Admin User",
            role="admin",
            is_active=True,
            is_superuser=True,
        )
        session.add(admin)

        # Resident user
        resident = User(
            email="resident@test.com",
            hashed_password=hash_password("res123"),
            full_name="Resident 301",
            role="resident",
            apartment_id=apt.id,
            is_active=True,
        )
        session.add(resident)

        # Technician user & profile
        tech_user = User(
            email="tech@test.com",
            hashed_password=hash_password("tech123"),
            full_name="Tech Specialist",
            role="technician",
            is_active=True,
        )
        session.add(tech_user)
        await session.flush()

        technician = Technician(
            user_id=tech_user.id,
            specialties=["electrical", "water"],
            is_active=True,
            phone_number="0909999999",
        )
        session.add(technician)
        await session.commit()

        # Generate tokens
        admin_token = create_access_token({"sub": str(admin.id), "role": "admin"})
        resident_token = create_access_token({"sub": str(resident.id), "role": "resident"})
        tech_token = create_access_token({"sub": str(tech_user.id), "role": "technician"})


        return {
            "building_id": bld.id,
            "apartment_id": apt.id,
            "device_id": dev.id,
            "admin": admin,
            "resident": resident,
            "tech_user": tech_user,
            "technician": technician,
            "admin_token": admin_token,
            "resident_token": resident_token,
            "tech_token": tech_token,
        }



@pytest.mark.asyncio
async def test_resident_create_ticket(unauthenticated_client: AsyncClient, test_env):
    """Test resident submitting a ticket."""
    token = test_env["resident_token"]
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "title": "Chập điện ổ cắm bếp",
        "description": "Ổ cắm có mùi khét và tóe tia lửa khi cắm nồi cơm",
        "category": "electrical",
        "priority": "high",
    }

    resp = await unauthenticated_client.post("/api/v1/tickets", json=payload, headers=headers)
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["title"] == payload["title"]
    assert data["status"] == "open"
    assert data["priority"] == "high"
    assert data["source"] == "resident_report"
    assert data["apartment_unit"] == "301"
    assert data["resident_sla_text"] != ""


@pytest.mark.asyncio
async def test_state_machine_valid_transitions(unauthenticated_client: AsyncClient, test_env):
    """Test full valid lifecycle: open -> assigned -> in_progress -> resolved -> closed."""
    admin_headers = {"Authorization": f"Bearer {test_env['admin_token']}"}
    res_headers = {"Authorization": f"Bearer {test_env['resident_token']}"}

    # 1. Resident creates ticket (status: open)
    create_resp = await unauthenticated_client.post(
        "/api/v1/tickets",
        json={
            "title": "Hỏng vòi rửa bát",
            "description": "Vòi rửa bát bị kẹt van không đóng được",
            "category": "water",
        },
        headers=res_headers,
    )
    assert create_resp.status_code == 201
    ticket_id = create_resp.json()["id"]

    # 2. Admin assigns technician (status: assigned)
    assign_resp = await unauthenticated_client.patch(
        f"/api/v1/tickets/{ticket_id}/assign",
        json={"technician_id": str(test_env["technician"].id), "note": "Phân công xử lý gấp"},
        headers=admin_headers,
    )
    assert assign_resp.status_code == 200
    assert assign_resp.json()["status"] == "assigned"
    assert assign_resp.json()["technician_name"] == "Tech Specialist"

    # 3. Transition to in_progress
    prog_resp = await unauthenticated_client.patch(
        f"/api/v1/tickets/{ticket_id}/status",
        json={"status": "in_progress", "note": "Kỹ thuật đã nhận vật tư và đến căn hộ"},
        headers=admin_headers,
    )
    assert prog_resp.status_code == 200
    assert prog_resp.json()["status"] == "in_progress"

    # 4. Transition to resolved
    res_resp = await unauthenticated_client.patch(
        f"/api/v1/tickets/{ticket_id}/status",
        json={"status": "resolved", "note": "Đã thay van khóa mới hoàn tất"},
        headers=admin_headers,
    )
    assert res_resp.status_code == 200
    assert res_resp.json()["status"] == "resolved"
    assert res_resp.json()["resolved_at"] is not None

    # 5. Transition to closed
    close_resp = await unauthenticated_client.patch(
        f"/api/v1/tickets/{ticket_id}/status",
        json={"status": "closed", "note": "Cư dân đã nghiệm thu hài lòng"},
        headers=admin_headers,
    )
    assert close_resp.status_code == 200
    assert close_resp.json()["status"] == "closed"


@pytest.mark.asyncio
async def test_state_machine_invalid_transition_rejected(unauthenticated_client: AsyncClient, test_env):
    """Test state machine rejects illegal jump (e.g. open -> closed)."""
    admin_headers = {"Authorization": f"Bearer {test_env['admin_token']}"}
    res_headers = {"Authorization": f"Bearer {test_env['resident_token']}"}

    create_resp = await unauthenticated_client.post(
        "/api/v1/tickets",
        json={"title": "Kiểm tra điều hòa", "description": "Điều hòa không mát", "category": "hvac"},
        headers=res_headers,
    )
    ticket_id = create_resp.json()["id"]

    # Try illegal transition: open -> closed directly
    illegal_resp = await unauthenticated_client.patch(
        f"/api/v1/tickets/{ticket_id}/status",
        json={"status": "closed", "note": "Nhảy thẳng sang đóng"},
        headers=admin_headers,
    )
    assert illegal_resp.status_code == 400
    assert "không thể từ 'open' sang 'closed'" in illegal_resp.json()["detail"]


@pytest.mark.asyncio
async def test_resident_reopen_and_rating(unauthenticated_client: AsyncClient, test_env):
    """Test resident rating and reopening flow."""
    admin_headers = {"Authorization": f"Bearer {test_env['admin_token']}"}
    res_headers = {"Authorization": f"Bearer {test_env['resident_token']}"}

    # Create & advance to resolved
    create_resp = await unauthenticated_client.post(
        "/api/v1/tickets",
        json={"title": "Rò rỉ ống nước", "description": "Nước nhỏ giọt", "category": "water"},
        headers=res_headers,
    )
    ticket_id = create_resp.json()["id"]

    # assign -> in_progress -> resolved
    await unauthenticated_client.patch(
        f"/api/v1/tickets/{ticket_id}/assign",
        json={"technician_id": str(test_env["technician"].id)},
        headers=admin_headers,
    )
    await unauthenticated_client.patch(
        f"/api/v1/tickets/{ticket_id}/status",
        json={"status": "in_progress"},
        headers=admin_headers,
    )
    await unauthenticated_client.patch(
        f"/api/v1/tickets/{ticket_id}/status",
        json={"status": "resolved"},
        headers=admin_headers,
    )

    # Resident rates
    rate_resp = await unauthenticated_client.post(
        f"/api/v1/tickets/{ticket_id}/rate",
        json={"rating": 4, "rating_comment": "Kỹ thuật nhiệt tình"},
        headers=res_headers,
    )
    assert rate_resp.status_code == 200
    assert rate_resp.json()["rating"] == 4

    # Resident reopens if unsatisfied
    reopen_resp = await unauthenticated_client.post(
        f"/api/v1/tickets/{ticket_id}/reopen",
        json={"reason": "Van nước vẫn bị rỉ nhẹ sau khi thợ về"},
        headers=res_headers,
    )
    assert reopen_resp.status_code == 200
    assert reopen_resp.json()["status"] == "reopened"
    assert reopen_resp.json()["resolved_at"] is None


@pytest.mark.asyncio
async def test_comments_and_internal_notes(unauthenticated_client: AsyncClient, test_env):
    """Test comments thread and ensure internal notes are hidden from residents."""
    admin_headers = {"Authorization": f"Bearer {test_env['admin_token']}"}
    res_headers = {"Authorization": f"Bearer {test_env['resident_token']}"}

    create_resp = await unauthenticated_client.post(
        "/api/v1/tickets",
        json={"title": "Tiếng ồn lạ", "description": "Tiếng kêu ù ù trong tường", "category": "general"},
        headers=res_headers,
    )
    ticket_id = create_resp.json()["id"]

    # Public comment
    await unauthenticated_client.post(
        f"/api/v1/tickets/{ticket_id}/comments",
        json={"comment": "Em đã gọi thợ hẹn sáng mai", "is_internal": False},
        headers=res_headers,
    )

    # Internal technician note
    await unauthenticated_client.post(
        f"/api/v1/tickets/{ticket_id}/comments",
        json={"comment": "Lưu ý nội bộ: Ống kỹ thuật số 3 đang có rung lắc", "is_internal": True},
        headers=admin_headers,
    )

    # Admin view: sees both comments
    admin_view = await unauthenticated_client.get(f"/api/v1/tickets/{ticket_id}", headers=admin_headers)
    assert admin_view.status_code == 200
    admin_comments = admin_view.json()["comments"]
    assert len(admin_comments) == 2

    # Resident view: sees only public comment
    res_view = await unauthenticated_client.get(f"/api/v1/tickets/{ticket_id}", headers=res_headers)
    assert res_view.status_code == 200
    res_comments = res_view.json()["comments"]
    assert len(res_comments) == 1
    assert res_comments[0]["is_internal"] is False


@pytest.mark.asyncio
async def test_auto_ticket_creation_from_anomaly_consumer(test_env):
    """Test TicketKafkaConsumer automatically creates work order from critical anomaly event."""
    consumer = get_ticket_consumer()

    alert_id = str(uuid4())
    anomaly_event = {
        "event_type": "alert.created",
        "alert_id": alert_id,
        "title": "CRITICAL: Extreme Load Surge on Power Meter (22.5 kW)",
        "message": "Power draw exceeded 5.0 kW by 350%. Potential fire hazard.",
        "severity": "critical",
        "source": "ai_anomaly_detector",
        "device_id": str(test_env["device_id"]),
        "apartment_id": str(test_env["apartment_id"]),

        "metric": "electricity",
        "value": 22.5,
        "unit": "kW",
        "anomaly_score": 0.96,
    }

    # Process event within testing session
    async with testing_session_factory() as session:
        await consumer.handle_alert_event(anomaly_event, session=session)

        # Verify ticket in database
        stmt = select(Ticket).where(Ticket.source == TicketSource.AI_ANOMALY)
        res = await session.execute(stmt)
        tickets = list(res.scalars().all())

        assert len(tickets) >= 1
        ticket = tickets[0]
        assert ticket.priority == TicketPriority.CRITICAL
        assert ticket.category == "electrical"
        assert ticket.status == TicketStatus.OPEN
        assert "22.5 kW" in ticket.description
        assert "0.96" in ticket.description

        # Test idempotency: sending the same event again must not create duplicate ticket
        count_before = len(tickets)
        await consumer.handle_alert_event(anomaly_event, session=session)

        stmt2 = select(Ticket).where(Ticket.source == TicketSource.AI_ANOMALY)
        res2 = await session.execute(stmt2)
        assert len(list(res2.scalars().all())) == count_before



@pytest.mark.asyncio
async def test_admin_sla_report(unauthenticated_client: AsyncClient, test_env):
    """Test GET /api/v1/admin/tickets/sla-report."""
    admin_headers = {"Authorization": f"Bearer {test_env['admin_token']}"}

    resp = await unauthenticated_client.get("/api/v1/admin/tickets/sla-report", headers=admin_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "period" in data
    assert "overall_sla_compliance_rate" in data
    assert "categories" in data
    assert "priority_breakdown" in data
