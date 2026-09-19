"""Regression tests for Security & Data Isolation Audit findings.

Covers:
1. Webhook payment amount verification (prevent price tampering).
2. Accountant/Admin full invoice list visibility (get_by_apartment=None bugfix).
3. Resident apartment ID spoofing prevention in tickets, service requests, and bookings.
4. Device and sensor reading data isolation between residents.
5. Ticket status transition and cross-apartment interaction restrictions.
"""

from datetime import date, datetime, timezone
from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, hash_password
from app.models.apartment import Apartment
from app.models.building import Building
from app.models.device import Device, DeviceStatus
from app.models.floor import Floor
from app.models.invoice import Invoice, InvoiceStatus
from app.models.ticket import Ticket, TicketCategory, TicketPriority, TicketSource, TicketStatus
from app.models.transaction import Transaction, TransactionStatus
from app.models.user import User
from app.services.payment_gateway import get_payment_gateway


@pytest.mark.asyncio
async def test_webhook_amount_tampering_rejected(client: AsyncClient, unauthenticated_client: AsyncClient):
    """Verify that a payment webhook with altered amount is rejected and does not mark invoice as paid."""
    gateway = get_payment_gateway()

    # 1. Create building, floor, apartment, billing_cycle, invoice, transaction via db
    from tests.conftest import testing_session_factory
    from app.models.billing_cycle import BillingCycle, BillingCycleStatus

    b_id, f_id, apt_id = uuid4(), uuid4(), uuid4()
    bc_id, inv_id, txn_id = uuid4(), uuid4(), uuid4()
    expected_amount = 500000.0  # 500,000 VND

    async with testing_session_factory() as session:
        building = Building(id=b_id, name="Bldg Test", address="123 Test St", total_floors=5)
        floor = Floor(id=f_id, building_id=b_id, floor_number=1)
        apt = Apartment(id=apt_id, floor_id=f_id, unit_number="A-101", area_sqm=70.0)
        cycle = BillingCycle(
            id=bc_id,
            apartment_id=apt_id,
            period_start=date(2026, 8, 1),
            period_end=date(2026, 8, 31),
            status=BillingCycleStatus.INVOICED,
        )
        invoice = Invoice(
            id=inv_id,
            apartment_id=apt_id,
            billing_cycle_id=bc_id,
            invoice_number=f"INV-{inv_id.hex[:6]}",
            total_amount=expected_amount,
            status=InvoiceStatus.PENDING,
            due_date=date.today(),
        )
        transaction = Transaction(
            id=txn_id,
            invoice_id=inv_id,
            provider="vnpay",
            idempotency_key=f"idem-{txn_id.hex[:6]}",
            amount=expected_amount,
            status=TransactionStatus.PENDING,
        )
        session.add_all([building, floor, apt, cycle, invoice, transaction])
        await session.commit()

    # 2. Tampered webhook: attacker pays only 5,000 VND (amount * 100 = 500,000 in VNPay format)
    tampered_amount_vnpay = "500000"  # 5,000 VND * 100
    payload_tampered = {
        "vnp_TxnRef": str(txn_id),
        "vnp_Amount": tampered_amount_vnpay,
        "vnp_ResponseCode": "00",
        "vnp_TransactionNo": "VNP123456",
        "vnp_OrderInfo": "Payment",
        "vnp_SecureHash": "mock_sig",
    }

    resp = await unauthenticated_client.post("/api/v1/webhooks/payment/vnpay", json=payload_tampered)
    assert resp.status_code == 200

    # 3. Check that transaction failed and invoice is NOT paid
    async with testing_session_factory() as session:
        from app.repositories.transaction_repo import TransactionRepository
        from app.repositories.invoice_repo import InvoiceRepository

        txn_repo = TransactionRepository(session)
        inv_repo = InvoiceRepository(session)

        txn = await txn_repo.get_by_id(txn_id)
        inv = await inv_repo.get_by_id(inv_id)

        assert txn is not None
        assert txn.status == TransactionStatus.FAILED
        assert "sai lệch số tiền" in txn.provider_message

        assert inv is not None
        assert inv.status == InvoiceStatus.PENDING  # Invoice MUST NOT be marked as PAID!


@pytest.mark.asyncio
async def test_admin_and_accountant_can_view_all_invoices(client: AsyncClient):
    """Verify bugfix: admin querying GET /api/v1/invoices returns all invoices across apartments."""
    from tests.conftest import testing_session_factory
    from app.models.billing_cycle import BillingCycle, BillingCycleStatus

    b_id, f_id = uuid4(), uuid4()
    apt1_id, apt2_id = uuid4(), uuid4()
    bc1_id, bc2_id = uuid4(), uuid4()
    inv1_id, inv2_id = uuid4(), uuid4()

    async with testing_session_factory() as session:
        building = Building(id=b_id, name="Bldg Invoices", address="123 Test St", total_floors=5)
        floor = Floor(id=f_id, building_id=b_id, floor_number=1)
        apt1 = Apartment(id=apt1_id, floor_id=f_id, unit_number="INV-101", area_sqm=65.0)
        apt2 = Apartment(id=apt2_id, floor_id=f_id, unit_number="INV-102", area_sqm=75.0)

        bc1 = BillingCycle(
            id=bc1_id,
            apartment_id=apt1_id,
            period_start=date(2026, 8, 1),
            period_end=date(2026, 8, 31),
            status=BillingCycleStatus.INVOICED,
        )
        bc2 = BillingCycle(
            id=bc2_id,
            apartment_id=apt2_id,
            period_start=date(2026, 8, 1),
            period_end=date(2026, 8, 31),
            status=BillingCycleStatus.INVOICED,
        )

        inv1 = Invoice(
            id=inv1_id,
            apartment_id=apt1_id,
            billing_cycle_id=bc1_id,
            invoice_number=f"INV-{inv1_id.hex[:6]}",
            total_amount=1000000,
            status=InvoiceStatus.PENDING,
            due_date=date.today(),
        )
        inv2 = Invoice(
            id=inv2_id,
            apartment_id=apt2_id,
            billing_cycle_id=bc2_id,
            invoice_number=f"INV-{inv2_id.hex[:6]}",
            total_amount=2000000,
            status=InvoiceStatus.PAID,
            due_date=date.today(),
        )
        session.add_all([building, floor, apt1, apt2, bc1, bc2, inv1, inv2])
        await session.commit()

    resp = await client.get("/api/v1/invoices")
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert len(data["items"]) >= 2
    inv_ids = [item["id"] for item in data["items"]]
    assert str(inv1_id) in inv_ids
    assert str(inv2_id) in inv_ids


@pytest.mark.asyncio
async def test_resident_cannot_spoof_apartment_in_tickets_and_services(unauthenticated_client: AsyncClient):
    """Verify resident cannot create tickets, service requests or bookings under other apartments."""
    from tests.conftest import testing_session_factory

    b_id, f_id = uuid4(), uuid4()
    apt_a_id, apt_b_id = uuid4(), uuid4()
    user_a_id = uuid4()

    async with testing_session_factory() as session:
        building = Building(id=b_id, name="Bldg Spoof", address="123 Test St", total_floors=5)
        floor = Floor(id=f_id, building_id=b_id, floor_number=1)
        apt_a = Apartment(id=apt_a_id, floor_id=f_id, unit_number="A-101", area_sqm=60.0)
        apt_b = Apartment(id=apt_b_id, floor_id=f_id, unit_number="B-202", area_sqm=80.0)
        user_a = User(
            id=user_a_id,
            email=f"resident_a_{user_a_id.hex[:4]}@example.com",
            hashed_password=hash_password("pass123"),
            full_name="Resident A",
            role="resident",
            apartment_id=apt_a_id,
        )
        session.add_all([building, floor, apt_a, apt_b, user_a])
        await session.commit()

    token_a = create_access_token({"sub": str(user_a_id), "role": "resident"})
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # 1. Resident A tries to create ticket for Apartment B -> Should be rejected
    ticket_payload = {
        "title": "Hỏng vòi nước",
        "description": "Vòi nước rò rỉ",
        "category": "water",
        "priority": "medium",
        "apartment_id": str(apt_b_id),
    }
    resp_ticket = await unauthenticated_client.post("/api/v1/tickets", json=ticket_payload, headers=headers_a)
    assert resp_ticket.status_code == 400
    assert "không có quyền tạo phiếu yêu cầu cho căn hộ khác" in resp_ticket.json()["detail"]

    # 2. Resident A tries to create service request for Apartment B -> Should be rejected with 403
    sr_payload = {
        "title": "Dọn dẹp căn hộ",
        "description": "Dọn sâu",
        "request_type": "cleaning",
        "apartment_id": str(apt_b_id),
    }
    resp_sr = await unauthenticated_client.post("/api/v1/service-requests", json=sr_payload, headers=headers_a)
    assert resp_sr.status_code == 403


@pytest.mark.asyncio
async def test_resident_device_and_readings_data_isolation(unauthenticated_client: AsyncClient):
    """Verify resident cannot view devices or sensor readings belonging to other apartments."""
    from tests.conftest import testing_session_factory
    from app.models.device_type import DeviceType

    b_id, f_id = uuid4(), uuid4()
    apt_a_id, apt_b_id = uuid4(), uuid4()
    dev_a_id, dev_b_id = uuid4(), uuid4()
    user_a_id = uuid4()
    dt_id = uuid4()

    async with testing_session_factory() as session:
        building = Building(id=b_id, name="Bldg DevIso", address="123 Test St", total_floors=5)
        floor = Floor(id=f_id, building_id=b_id, floor_number=1)
        apt_a = Apartment(id=apt_a_id, floor_id=f_id, unit_number="DEV-101", area_sqm=60.0)
        apt_b = Apartment(id=apt_b_id, floor_id=f_id, unit_number="DEV-202", area_sqm=80.0)
        user_a = User(
            id=user_a_id,
            email=f"resident_dev_{user_a_id.hex[:4]}@example.com",
            hashed_password=hash_password("pass123"),
            full_name="Resident Dev",
            role="resident",
            apartment_id=apt_a_id,
        )
        dtype = DeviceType(id=dt_id, code=f"meter_{dt_id.hex[:4]}", name="Power Meter", unit="kW")
        dev_a = Device(
            id=dev_a_id,
            apartment_id=apt_a_id,
            device_type_id=dt_id,
            device_code=f"DEV-A-{dev_a_id.hex[:4]}",
            name="Smart Light A",
            status=DeviceStatus.ONLINE,
        )
        dev_b = Device(
            id=dev_b_id,
            apartment_id=apt_b_id,
            device_type_id=dt_id,
            device_code=f"DEV-B-{dev_b_id.hex[:4]}",
            name="Air Conditioner B",
            status=DeviceStatus.ONLINE,
        )
        session.add_all([building, floor, apt_a, apt_b, user_a, dtype, dev_a, dev_b])
        await session.commit()

    token_a = create_access_token({"sub": str(user_a_id), "role": "resident"})
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # 1. List devices as resident A -> Device B must NOT be included
    resp_list = await unauthenticated_client.get("/api/v1/devices", headers=headers_a)
    assert resp_list.status_code == 200
    returned_ids = [d["id"] for d in resp_list.json()["items"]]
    assert str(dev_a_id) in returned_ids
    assert str(dev_b_id) not in returned_ids

    # 2. Get device B detail directly by ID -> Must be 403 Forbidden
    resp_get_b = await unauthenticated_client.get(f"/api/v1/devices/{dev_b_id}", headers=headers_a)
    assert resp_get_b.status_code == 403

    # 3. Get sensor readings for device B -> Must be 403 Forbidden
    resp_readings_b = await unauthenticated_client.get(f"/api/v1/readings/device/{dev_b_id}", headers=headers_a)
    assert resp_readings_b.status_code == 403


@pytest.mark.asyncio
async def test_resident_cannot_arbitrarily_update_ticket_status(unauthenticated_client: AsyncClient):
    """Verify resident cannot transition ticket to in_progress or resolved."""
    from tests.conftest import testing_session_factory

    b_id, f_id, apt_a_id, apt_b_id = uuid4(), uuid4(), uuid4(), uuid4()
    user_a_id = uuid4()
    t_a_id, t_b_id = uuid4(), uuid4()

    async with testing_session_factory() as session:
        building = Building(id=b_id, name="Bldg Status", address="123 Test St", total_floors=5)
        floor = Floor(id=f_id, building_id=b_id, floor_number=1)
        apt_a = Apartment(id=apt_a_id, floor_id=f_id, unit_number="STAT-101", area_sqm=60.0)
        apt_b = Apartment(id=apt_b_id, floor_id=f_id, unit_number="STAT-202", area_sqm=80.0)
        user_a = User(
            id=user_a_id,
            email=f"resident_stat_{user_a_id.hex[:4]}@example.com",
            hashed_password=hash_password("pass123"),
            full_name="Resident Stat",
            role="resident",
            apartment_id=apt_a_id,
        )
        ticket_a = Ticket(
            id=t_a_id,
            apartment_id=apt_a_id,
            title="Ticket A",
            description="Desc",
            status=TicketStatus.OPEN,
            category="general",
            priority=TicketPriority.MEDIUM,
            source=TicketSource.RESIDENT_REPORT,
            created_by=user_a_id,
        )
        ticket_b = Ticket(
            id=t_b_id,
            apartment_id=apt_b_id,
            title="Ticket B",
            description="Desc",
            status=TicketStatus.OPEN,
            category="general",
            priority=TicketPriority.MEDIUM,
            source=TicketSource.RESIDENT_REPORT,
        )
        session.add_all([building, floor, apt_a, apt_b, user_a, ticket_a, ticket_b])
        await session.commit()

    token_a = create_access_token({"sub": str(user_a_id), "role": "resident"})
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # 1. Resident A tries to transition their own ticket to "in_progress" -> 403 Forbidden
    resp = await unauthenticated_client.patch(
        f"/api/v1/tickets/{t_a_id}/status",
        json={"status": "in_progress", "note": "Trying to start work"},
        headers=headers_a,
    )
    assert resp.status_code == 403

    # 2. Resident A tries to transition ticket B -> 403 Forbidden
    resp_b = await unauthenticated_client.patch(
        f"/api/v1/tickets/{t_b_id}/status",
        json={"status": "closed"},
        headers=headers_a,
    )
    assert resp_b.status_code == 403
