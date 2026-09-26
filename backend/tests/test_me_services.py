import pytest
import uuid
from httpx import AsyncClient
from app.models.invoice import Invoice, InvoiceStatus
from app.models.manual_confirmation import ManualConfirmation, ManualConfirmationStatus
from sqlalchemy.ext.asyncio import AsyncSession
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from app.main import app
from app.core.database import get_db
from app.core.security import create_access_token, hash_password
from app.models.user import User
from app.models.apartment import Apartment
from app.models.building import Building
from app.models.floor import Floor
from app.models.billing_cycle import BillingCycle, BillingCycleStatus

from tests.conftest import testing_session_factory

@pytest_asyncio.fixture
async def db_session() -> AsyncSession:
    async with testing_session_factory() as session:
        yield session

@pytest_asyncio.fixture
async def test_apartment(db_session: AsyncSession) -> dict:
    building = Building(id=uuid.uuid4(), name="Test Building", address="123 Test St")
    floor = Floor(id=uuid.uuid4(), building_id=building.id, floor_number=1)
    apt = Apartment(id=uuid.uuid4(), floor_id=floor.id, unit_number="101")
    db_session.add_all([building, floor, apt])
    await db_session.commit()
    return {"id": apt.id}

@pytest_asyncio.fixture
async def resident_client(test_apartment: dict) -> AsyncClient:
    async def override_get_db():
        async with testing_session_factory() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    app.dependency_overrides[get_db] = override_get_db

    resident_id = uuid.uuid4()
    async with testing_session_factory() as session:
        resident = User(
            id=resident_id,
            email=f"resident_{resident_id.hex[:6]}@example.com",
            hashed_password=hash_password("residentpass"),
            full_name="Test Resident",
            role="resident",
            apartment_id=test_apartment["id"],
        )
        session.add(resident)
        await session.commit()

    token = create_access_token(data={"sub": str(resident_id), "role": "resident"})
    headers = {"Authorization": f"Bearer {token}"}

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test", headers=headers) as ac:
        yield ac

    app.dependency_overrides.clear()

@pytest_asyncio.fixture
async def test_billing_cycle(db_session: AsyncSession, test_apartment: dict) -> dict:
    import datetime
    bc = BillingCycle(
        id=uuid.uuid4(),
        apartment_id=test_apartment["id"],
        period_start=datetime.date(2026, 10, 1),
        period_end=datetime.date(2026, 10, 31),
        status=BillingCycleStatus.OPEN
    )
    db_session.add(bc)
    await db_session.commit()
    return {"id": bc.id}

@pytest.mark.asyncio
async def test_get_my_services(resident_client: AsyncClient, test_apartment: dict):
    response = await resident_client.get("/api/v1/me/services")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


@pytest.mark.asyncio
async def test_confirm_manual_payment(
    resident_client: AsyncClient,
    db_session: AsyncSession,
    test_apartment: dict,
    test_billing_cycle: dict
):
    # Setup test invoice
    invoice_id = uuid.uuid4()
    import datetime
    invoice = Invoice(
        id=invoice_id,
        apartment_id=test_apartment["id"],
        billing_cycle_id=test_billing_cycle["id"],
        invoice_number="INV-TEST-001",
        total_amount=500000.0,
        currency="VND",
        status=InvoiceStatus.PENDING,
        due_date=datetime.date(2026, 10, 1)
    )
    db_session.add(invoice)
    await db_session.commit()

    # Test missing payload
    resp = await resident_client.post(f"/api/v1/me/invoices/{invoice_id}/confirm-manual")
    assert resp.status_code == 422

    # Test valid submission
    payload = {
        "method": "bank_transfer",
        "note": "Transaction ref 12345"
    }
    resp = await resident_client.post(
        f"/api/v1/me/invoices/{invoice_id}/confirm-manual",
        json=payload
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "Awaiting BQL verification" in data["message"]

    # Verify DB state
    from sqlalchemy import select
    stmt = select(ManualConfirmation).where(ManualConfirmation.invoice_id == invoice_id)
    res = await db_session.execute(stmt)
    confirmation = res.scalar_one_or_none()
    assert confirmation is not None
    assert confirmation.status == ManualConfirmationStatus.PENDING
    assert confirmation.method.value == "bank_transfer"
    assert confirmation.note == "Transaction ref 12345"

    # Test submitting again for same invoice should fail
    resp2 = await resident_client.post(
        f"/api/v1/me/invoices/{invoice_id}/confirm-manual",
        json=payload
    )
    assert resp2.status_code == 400
    detail = resp2.json()["detail"].lower()
    assert "already pending" in detail or "đang chờ" in detail


@pytest.mark.asyncio
async def test_mock_gateway_cannot_start_payment(
    resident_client: AsyncClient,
    db_session: AsyncSession,
    test_apartment: dict,
    test_billing_cycle: dict,
    monkeypatch,
):
    from datetime import date
    from app.core.config import get_settings
    from app.models.transaction import Transaction
    from sqlalchemy import select

    monkeypatch.setattr(get_settings(), "payment_gateway_mock", True)
    invoice = Invoice(
        id=uuid.uuid4(), apartment_id=test_apartment["id"],
        billing_cycle_id=test_billing_cycle["id"], invoice_number="INV-MOCK-BLOCKED",
        total_amount=100000, status=InvoiceStatus.PENDING, due_date=date(2026, 10, 15),
    )
    db_session.add(invoice)
    await db_session.commit()

    options = await resident_client.get("/api/v1/invoices/payment-options")
    assert options.status_code == 200
    assert options.json()["online_enabled"] is False
    pending_reviews = await resident_client.get("/api/v1/admin/manual-confirmations")
    assert pending_reviews.status_code == 403
    unsigned_callback = await resident_client.get(
        "/api/v1/webhooks/payment/vnpay",
        params={"vnp_TxnRef": str(uuid.uuid4()), "vnp_ResponseCode": "00"},
    )
    assert unsigned_callback.json()["RspCode"] == "97"

    response = await resident_client.post(
        f"/api/v1/invoices/{invoice.id}/pay",
        headers={"Idempotency-Key": str(uuid.uuid4())},
        json={"return_url": "http://localhost:5173/payment/return"},
    )
    assert response.status_code == 400
    assert "chưa được cấu hình" in response.json()["detail"]
    transactions = (await db_session.execute(select(Transaction).where(Transaction.invoice_id == invoice.id))).scalars().all()
    assert transactions == []


@pytest.mark.asyncio
async def test_admin_can_review_pending_manual_confirmation(
    client: AsyncClient,
    db_session: AsyncSession,
    test_apartment: dict,
    test_billing_cycle: dict,
    monkeypatch,
):
    from datetime import date

    invoice = Invoice(
        id=uuid.uuid4(), apartment_id=test_apartment["id"],
        billing_cycle_id=test_billing_cycle["id"], invoice_number="INV-REVIEW-001",
        total_amount=250000, status=InvoiceStatus.PENDING, due_date=date(2026, 10, 15),
    )
    from app.models.manual_confirmation import ManualPaymentMethod
    confirmation = ManualConfirmation(
        id=uuid.uuid4(), invoice_id=invoice.id,
        method=ManualPaymentMethod.BANK_TRANSFER,
        status=ManualConfirmationStatus.PENDING, note="FT12345",
    )
    db_session.add_all([invoice, confirmation])
    await db_session.commit()

    response = await client.get("/api/v1/admin/manual-confirmations")
    assert response.status_code == 200
    assert any(item["id"] == str(confirmation.id) and item["amount"] == 250000 for item in response.json())

    import asyncio
    from app.services.bulk_job_service import BulkJobService
    monkeypatch.setattr(BulkJobService, "session_factory", testing_session_factory)
    job_response = await client.post(
        "/api/v1/admin/bulk/manual-confirmations/approve",
        json={"confirmation_ids": [str(confirmation.id)]},
    )
    assert job_response.status_code == 202
    job_id = job_response.json()["id"]
    for _ in range(20):
        await asyncio.sleep(0.2)
        progress = await client.get(f"/api/v1/admin/bulk-jobs/{job_id}")
        assert progress.status_code == 200
        if progress.json()["status"] in ("completed", "failed"):
            break
    assert progress.json()["status"] == "completed", progress.json()
    assert progress.json()["processed_items"] == 1
    await db_session.refresh(invoice)
    await db_session.refresh(confirmation)
    assert invoice.status == InvoiceStatus.PAID
    assert confirmation.status == ManualConfirmationStatus.APPROVED


@pytest.mark.asyncio
async def test_resident_payment_requires_signed_gateway_confirmation(
    resident_client: AsyncClient,
    db_session: AsyncSession,
    test_apartment: dict,
    test_billing_cycle: dict,
    monkeypatch,
):
    from datetime import date
    import hashlib
    import hmac
    import urllib.parse
    from app.core.config import get_settings

    settings = get_settings()
    monkeypatch.setattr(settings, "payment_gateway_mock", False)
    monkeypatch.setattr(settings, "vnpay_tmn_code", "test-merchant")
    monkeypatch.setattr(settings, "vnpay_hash_secret", "test-only-signing-secret")

    invoice = Invoice(
        id=uuid.uuid4(), apartment_id=test_apartment["id"],
        billing_cycle_id=test_billing_cycle["id"], invoice_number="INV-ONLINE-001",
        total_amount=320000, status=InvoiceStatus.PENDING, due_date=date(2026, 10, 15),
    )
    db_session.add(invoice)
    await db_session.commit()

    start = await resident_client.post(
        f"/api/v1/invoices/{invoice.id}/pay",
        headers={"Idempotency-Key": str(uuid.uuid4())},
        json={"return_url": "http://localhost:5173/payment/return"},
    )
    assert start.status_code == 200, start.text
    transaction_id = start.json()["transaction_id"]
    assert start.json()["payment_url"].startswith(settings.vnpay_payment_url)
    await db_session.refresh(invoice)
    assert invoice.status == InvoiceStatus.PENDING

    payload = {
        "vnp_TxnRef": transaction_id,
        "vnp_Amount": "32000000",
        "vnp_ResponseCode": "00",
        "vnp_TransactionNo": f"VNP-{transaction_id[:8]}",
        "vnp_OrderInfo": "Payment",
        "vnp_TmnCode": settings.vnpay_tmn_code,
        "vnp_TransactionStatus": "00",
    }
    signed_query = urllib.parse.urlencode(sorted(payload.items()))
    payload["vnp_SecureHash"] = hmac.new(
        settings.vnpay_hash_secret.encode(), signed_query.encode(), hashlib.sha512
    ).hexdigest()
    callback = await resident_client.get("/api/v1/webhooks/payment/vnpay", params=payload)
    assert callback.status_code == 200, callback.text
    await db_session.refresh(invoice)
    assert invoice.status == InvoiceStatus.PAID
    assert invoice.paid_at is not None
