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
            yield session

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
    assert "already pending" in resp2.json()["detail"]
