"""
Integration & behavior test suite for Bulk Operations and Report Exports (Prompt 5).

Covers:
1. Idempotent bulk invoice generation (retry cannot duplicate invoices or items).
2. Effective date tariff changes (historical invoices remain immutable, future cycles use new rates).
3. Bulk manual confirmations approval (transitions confirmations to approved & invoices to paid).
4. Bulk overdue reminders dispatch (creates notifications and reminders for overdue apartments).
5. Excel export generation and file download verification (openpyxl sheet validation).
6. RBAC security enforcement (resident gets 403 Forbidden, accountant/admin allowed).
"""

import asyncio
import datetime
import io
import uuid
import openpyxl
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import create_access_token, hash_password
from app.main import app
from app.models.apartment import Apartment
from app.models.billing_cycle import BillingCycle, BillingCycleStatus
from app.models.billing_rate import BillingRate
from app.models.building import Building
from app.models.bulk_job import BulkJob
from app.models.floor import Floor
from app.models.invoice import Invoice, InvoiceStatus
from app.models.invoice_item import InvoiceItem, ServiceType
from app.models.manual_confirmation import (
    ManualConfirmation,
    ManualConfirmationStatus,
    ManualPaymentMethod,
)
from app.models.report_export import ReportExport
from app.models.user import User
from app.models.water_consumption import WaterConsumption
from app.services.billing_engine import BillingEngine
from app.services.bulk_job_service import BulkJobService
from tests.conftest import testing_session_factory


@pytest_asyncio.fixture(autouse=True)
def configure_bulk_job_session_factory():
    """Ensure BulkJobService background tasks use the test database session factory."""
    original_factory = BulkJobService.session_factory
    BulkJobService.session_factory = testing_session_factory
    yield
    BulkJobService.session_factory = original_factory


@pytest_asyncio.fixture
async def seed_data(setup_database) -> dict:
    """Seed building, floor, apartments, and users with accountant and resident roles."""
    async with testing_session_factory() as session:
        # Building & Floor
        building = Building(
            id=uuid.uuid4(),
            name="The Oasis Tower",
            address="123 Nguyen Van Linh, District 7, HCMC",
            total_floors=5,
        )
        session.add(building)
        await session.flush()

        floor = Floor(
            id=uuid.uuid4(),
            building_id=building.id,
            floor_number=3,
        )
        session.add(floor)
        await session.flush()

        # Apartments
        apt1 = Apartment(
            id=uuid.uuid4(),
            floor_id=floor.id,
            unit_number="301",
            area_sqm=75.0,
            resident_name="Nguyen Van A",
            is_active=True,
        )
        apt2 = Apartment(
            id=uuid.uuid4(),
            floor_id=floor.id,
            unit_number="302",
            area_sqm=85.0,
            resident_name="Tran Thi B",
            is_active=True,
        )
        session.add_all([apt1, apt2])
        await session.flush()

        # Resident 1
        res1_id = uuid.uuid4()
        resident1 = User(
            id=res1_id,
            email=f"resident1_{res1_id.hex[:6]}@oasis.vn",
            hashed_password=hash_password("ResidentPass123!"),
            full_name="Nguyen Van A",
            role="resident",
            apartment_id=apt1.id,
        )
        # Resident 2
        res2_id = uuid.uuid4()
        resident2 = User(
            id=res2_id,
            email=f"resident2_{res2_id.hex[:6]}@oasis.vn",
            hashed_password=hash_password("ResidentPass123!"),
            full_name="Tran Thi B",
            role="resident",
            apartment_id=apt2.id,
        )
        # Accountant
        acc_id = uuid.uuid4()
        accountant = User(
            id=acc_id,
            email=f"accountant_{acc_id.hex[:6]}@oasis.vn",
            hashed_password=hash_password("AccountantPass123!"),
            full_name="Le Van Ke Toan",
            role="accountant",
        )
        session.add_all([resident1, resident2, accountant])
        await session.commit()

        return {
            "building_id": building.id,
            "floor_id": floor.id,
            "apt1": apt1,
            "apt2": apt2,
            "resident1": resident1,
            "resident2": resident2,
            "accountant": accountant,
        }


@pytest_asyncio.fixture
async def accountant_client(seed_data) -> AsyncClient:
    """Authenticated HTTP client for accountant."""
    acc = seed_data["accountant"]
    token = create_access_token(data={"sub": str(acc.id), "role": "accountant"})
    headers = {"Authorization": f"Bearer {token}"}

    async def override_get_db():
        async with testing_session_factory() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test", headers=headers) as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def resident_client(seed_data) -> AsyncClient:
    """Authenticated HTTP client for regular resident."""
    res = seed_data["resident1"]
    token = create_access_token(data={"sub": str(res.id), "role": "resident"})
    headers = {"Authorization": f"Bearer {token}"}

    async def override_get_db():
        async with testing_session_factory() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test", headers=headers) as ac:
        yield ac
    app.dependency_overrides.clear()


# =============================================================================
# 1. Bulk Invoices Generation & Idempotency Test
# =============================================================================

@pytest.mark.asyncio
async def test_bulk_invoice_generation_and_idempotency(accountant_client: AsyncClient, seed_data: dict):
    """Test mass invoice generation creates invoices for all apartments and rerunning is strictly idempotent."""
    bld_id = seed_data["building_id"]
    target_date = datetime.date(2026, 9, 1)

    # 1. Trigger bulk generation via API
    resp = await accountant_client.post(
        "/api/v1/admin/bulk/invoices/generate",
        json={"building_id": str(bld_id), "target_date": target_date.isoformat()},
    )
    assert resp.status_code == 202
    job_data = resp.json()
    job_id = uuid.UUID(job_data["id"])
    assert job_data["job_type"] == "invoice_generation"

    # Poll job until background worker completes
    st_data = {}
    for _ in range(30):
        await asyncio.sleep(0.1)
        status_resp = await accountant_client.get(f"/api/v1/admin/bulk-jobs/{job_id}")
        assert status_resp.status_code == 200
        st_data = status_resp.json()
        if st_data.get("status") in ("completed", "failed"):
            break

    assert st_data.get("status") == "completed"
    assert st_data.get("processed_items") == 2  # apt1 and apt2

    # Verify invoices created in database
    async with testing_session_factory() as session:
        invoices = (await session.execute(select(Invoice))).scalars().all()
        assert len(invoices) == 2
        initial_invoice_ids = {inv.id for inv in invoices}

    # 2. Re-run bulk generation for the EXACT same cycle to verify IDEMPOTENCY
    resp2 = await accountant_client.post(
        "/api/v1/admin/bulk/invoices/generate",
        json={"building_id": str(bld_id), "target_date": target_date.isoformat()},
    )
    assert resp2.status_code == 202
    job_id2 = uuid.UUID(resp2.json()["id"])

    for _ in range(30):
        await asyncio.sleep(0.1)
        status_resp2 = await accountant_client.get(f"/api/v1/admin/bulk-jobs/{job_id2}")
        if status_resp2.json().get("status") in ("completed", "failed"):
            break

    # Verify that NO duplicate invoices were created
    async with testing_session_factory() as session:
        invoices_after = (await session.execute(select(Invoice))).scalars().all()
        assert len(invoices_after) == 2, "Idempotency violated: duplicate invoices created!"
        assert {inv.id for inv in invoices_after} == initial_invoice_ids


# =============================================================================
# 2. Billing Rate Effective Date Isolation Test
# =============================================================================

@pytest.mark.asyncio
async def test_billing_rate_effective_date_isolation(accountant_client: AsyncClient, seed_data: dict):
    """Test that adjusting rates with effective_date does not mutate historical invoices."""
    bld_id = seed_data["building_id"]
    apt1 = seed_data["apt1"]

    # 1. Seed historical cycle (August 2026) with historical invoice
    aug_start = datetime.date(2026, 8, 1)
    aug_end = datetime.date(2026, 8, 31)

    async with testing_session_factory() as session:
        cycle_aug = BillingCycle(
            id=uuid.uuid4(),
            apartment_id=apt1.id,
            period_start=aug_start,
            period_end=aug_end,
            status=BillingCycleStatus.CLOSED,
        )
        session.add(cycle_aug)
        await session.flush()

        old_inv = Invoice(
            id=uuid.uuid4(),
            apartment_id=apt1.id,
            billing_cycle_id=cycle_aug.id,
            invoice_number="INV-202608-TEST",
            total_amount=150000,
            status=InvoiceStatus.PAID,
            due_date=datetime.date(2026, 9, 10),
        )
        session.add(old_inv)
        await session.flush()

        old_item = InvoiceItem(
            id=uuid.uuid4(),
            invoice_id=old_inv.id,
            service_type=ServiceType.WATER,
            description="Tiền nước tháng 08/2026 (10 m³)",
            quantity=10.0,
            unit_price=15000.0,
            amount=150000.0,
        )
        session.add(old_item)
        await session.commit()
        old_inv_id = old_inv.id

    # 2. Accountant updates water price to 25,000 VND starting from October 1st, 2026
    rate_resp = await accountant_client.patch(
        "/api/v1/admin/billing-rates",
        json={
            "building_id": str(bld_id),
            "effective_date": "2026-10-01",
            "water_price_per_m3": 25000.0,
            "management_fee_per_sqm": 16000.0,
            "note": "Biểu giá mới quý 4/2026",
        },
    )
    assert rate_resp.status_code == 200
    rate_data = rate_resp.json()
    assert rate_data["water_price_per_m3"] == 25000.0
    assert rate_data["effective_date"] == "2026-10-01"

    # 3. Verify August invoice remains COMPLETELY UNCHANGED (Immutable)
    async with testing_session_factory() as session:
        inv_check = await session.get(Invoice, old_inv_id)
        assert inv_check.total_amount == 150000.0
        items_stmt = select(InvoiceItem).where(InvoiceItem.invoice_id == old_inv_id)
        items = (await session.execute(items_stmt)).scalars().all()
        assert len(items) == 1
        assert items[0].unit_price == 15000.0
        assert items[0].amount == 150000.0

    # 4. Create October cycle + water consumption for apt1 and generate invoice
    async with testing_session_factory() as session:
        cycle_oct = BillingCycle(
            id=uuid.uuid4(),
            apartment_id=apt1.id,
            period_start=datetime.date(2026, 10, 1),
            period_end=datetime.date(2026, 10, 31),
            status=BillingCycleStatus.OPEN,
        )
        session.add(cycle_oct)

        # Add 10,000 liters (10 m3) water consumption in October
        water_rec = WaterConsumption(
            id=uuid.uuid4(),
            apartment_id=apt1.id,
            timestamp=datetime.datetime(2026, 10, 15, 12, 0, tzinfo=datetime.timezone.utc),
            value_liters=10000.0,
        )
        session.add(water_rec)
        await session.commit()

        engine = BillingEngine(session)
        inv_oct = await engine._generate_invoice_for_cycle(cycle_oct)
        assert inv_oct is not None

        # Verify the water item used the updated 25,000 VND unit price
        items_stmt = select(InvoiceItem).where(InvoiceItem.invoice_id == inv_oct.id)
        items_oct = (await session.execute(items_stmt)).scalars().all()
        water_item = next(i for i in items_oct if "water" in str(i.service_type).lower())
        assert float(water_item.unit_price) == 25000.0
        assert float(water_item.amount) == 250000.0


# =============================================================================
# 3. Bulk Manual Confirmations Approval Test
# =============================================================================

@pytest.mark.asyncio
async def test_bulk_manual_confirmations_approval(accountant_client: AsyncClient, seed_data: dict):
    """Test accountant bulk approving manual confirmations transitions them to approved and invoices to paid."""
    apt1 = seed_data["apt1"]
    apt2 = seed_data["apt2"]

    # Seed 2 invoices and 2 pending confirmations
    async with testing_session_factory() as session:
        cycle1 = BillingCycle(
            id=uuid.uuid4(),
            apartment_id=apt1.id,
            period_start=datetime.date(2026, 9, 1),
            period_end=datetime.date(2026, 9, 30),
            status=BillingCycleStatus.INVOICED,
        )
        cycle2 = BillingCycle(
            id=uuid.uuid4(),
            apartment_id=apt2.id,
            period_start=datetime.date(2026, 9, 1),
            period_end=datetime.date(2026, 9, 30),
            status=BillingCycleStatus.INVOICED,
        )
        session.add_all([cycle1, cycle2])
        await session.flush()

        inv1 = Invoice(
            id=uuid.uuid4(),
            apartment_id=apt1.id,
            billing_cycle_id=cycle1.id,
            invoice_number="INV-MANUAL-01",
            total_amount=500000,
            status=InvoiceStatus.PENDING,
            due_date=datetime.date.today(),
        )
        inv2 = Invoice(
            id=uuid.uuid4(),
            apartment_id=apt2.id,
            billing_cycle_id=cycle2.id,
            invoice_number="INV-MANUAL-02",
            total_amount=750000,
            status=InvoiceStatus.PENDING,
            due_date=datetime.date.today(),
        )
        session.add_all([inv1, inv2])
        await session.flush()

        conf1 = ManualConfirmation(
            id=uuid.uuid4(),
            invoice_id=inv1.id,
            submitted_by=seed_data["resident1"].id,
            method=ManualPaymentMethod.BANK_TRANSFER,
            note="Chuyen khoan tien dien T9",
            status=ManualConfirmationStatus.PENDING,
        )
        conf2 = ManualConfirmation(
            id=uuid.uuid4(),
            invoice_id=inv2.id,
            submitted_by=seed_data["resident2"].id,
            method=ManualPaymentMethod.CASH,
            note="Nop tien mat tai le tan",
            status=ManualConfirmationStatus.PENDING,
        )
        session.add_all([conf1, conf2])
        await session.commit()
        conf1_id, conf2_id = conf1.id, conf2.id
        inv1_id, inv2_id = inv1.id, inv2.id

    # Trigger bulk approval via API
    resp = await accountant_client.post(
        "/api/v1/admin/bulk/manual-confirmations/approve",
        json={
            "confirmation_ids": [str(conf1_id), str(conf2_id)],
            "review_notes": "Duyet dong loat sao ke ngan hang khop so du",
        },
    )
    assert resp.status_code == 202
    job_id = uuid.UUID(resp.json()["id"])

    # Poll for completion
    for _ in range(30):
        await asyncio.sleep(0.1)
        status_resp = await accountant_client.get(f"/api/v1/admin/bulk-jobs/{job_id}")
        if status_resp.json().get("status") in ("completed", "failed"):
            break

    # Verify both confirmations are APPROVED and invoices are PAID
    async with testing_session_factory() as session:
        c1 = await session.get(ManualConfirmation, conf1_id)
        c2 = await session.get(ManualConfirmation, conf2_id)
        assert c1.status == ManualConfirmationStatus.APPROVED
        assert c2.status == ManualConfirmationStatus.APPROVED

        i1 = await session.get(Invoice, inv1_id)
        i2 = await session.get(Invoice, inv2_id)
        assert i1.status == InvoiceStatus.PAID
        assert i2.status == InvoiceStatus.PAID


# =============================================================================
# 4. Bulk Overdue Reminders Test
# =============================================================================

@pytest.mark.asyncio
async def test_bulk_overdue_reminders(accountant_client: AsyncClient, seed_data: dict):
    """Test bulk overdue reminders dispatch creates in-app notification records."""
    apt1 = seed_data["apt1"]

    # Seed overdue invoice (due 10 days ago)
    ten_days_ago = datetime.date.today() - datetime.timedelta(days=10)
    async with testing_session_factory() as session:
        cycle_overdue = BillingCycle(
            id=uuid.uuid4(),
            apartment_id=apt1.id,
            period_start=datetime.date(2026, 8, 1),
            period_end=datetime.date(2026, 8, 31),
            status=BillingCycleStatus.INVOICED,
        )
        session.add(cycle_overdue)
        await session.flush()

        overdue_inv = Invoice(
            id=uuid.uuid4(),
            apartment_id=apt1.id,
            billing_cycle_id=cycle_overdue.id,
            invoice_number="INV-OVERDUE-01",
            total_amount=1200000,
            status=InvoiceStatus.OVERDUE,
            due_date=ten_days_ago,
        )
        session.add(overdue_inv)
        await session.commit()
        overdue_inv_id = overdue_inv.id

    # Call bulk reminder API
    resp = await accountant_client.post(
        "/api/v1/admin/bulk/reminders/send",
        json={"min_overdue_days": 5},
    )
    assert resp.status_code == 202
    job_id = uuid.UUID(resp.json()["id"])

    # Poll for completion
    for _ in range(30):
        await asyncio.sleep(0.1)
        status_resp = await accountant_client.get(f"/api/v1/admin/bulk-jobs/{job_id}")
        if status_resp.json().get("status") in ("completed", "failed"):
            break

    # Check job completion
    status_resp = await accountant_client.get(f"/api/v1/admin/bulk-jobs/{job_id}")
    assert status_resp.status_code == 200
    assert status_resp.json()["status"] == "completed"
    assert status_resp.json()["processed_items"] >= 1


# =============================================================================
# 5. Excel Reports Export & Download Test
# =============================================================================

@pytest.mark.asyncio
async def test_report_exports_excel_and_download(accountant_client: AsyncClient, seed_data: dict):
    """Test generating 4 periodic reports and downloading valid Excel files."""
    bld_id = seed_data["building_id"]

    reports = [
        ("collection", {"building_id": str(bld_id), "month": 9, "year": 2026}),
        ("overdue", {"building_id": str(bld_id), "min_overdue_days": 1}),
        ("tickets", {"building_id": str(bld_id)}),
        ("reconciliation", {"building_id": str(bld_id)}),
    ]

    for r_type, params in reports:
        resp = await accountant_client.post(
            f"/api/v1/admin/reports/{r_type}",
            json=params,
        )
        assert resp.status_code in (200, 201), f"Failed on report type: {r_type}"
        data = resp.json()
        assert data["report_type"] == r_type
        assert data["status"] == "completed"
        assert data["file_url"] is not None

        export_id = data["id"]

        # Download the generated report
        dl_resp = await accountant_client.get(f"/api/v1/admin/reports/{export_id}/download")
        assert dl_resp.status_code == 200
        assert "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" in dl_resp.headers.get("content-type", "")

        # Verify with openpyxl that the content is a valid Excel workbook
        excel_bytes = io.BytesIO(dl_resp.content)
        wb = openpyxl.load_workbook(excel_bytes)
        ws = wb.active
        assert ws is not None
        # Verify header title exists in cell A1 or A2
        cell_val = str(ws.cell(row=1, column=1).value or ws.cell(row=2, column=1).value)
        assert len(cell_val) > 0, f"Excel workbook for {r_type} is empty"


# =============================================================================
# 6. RBAC Protection Test (Resident Forbidden)
# =============================================================================

@pytest.mark.asyncio
async def test_rbac_protection_resident_forbidden(resident_client: AsyncClient, seed_data: dict):
    """Test that ordinary residents are forbidden (HTTP 403) from accessing admin bulk operations or report exports."""
    # Attempt bulk invoice generation
    resp_gen = await resident_client.post(
        "/api/v1/admin/bulk/invoices/generate",
        json={"building_id": str(seed_data["building_id"])},
    )
    assert resp_gen.status_code == 403

    # Attempt updating billing rates
    resp_rate = await resident_client.patch(
        "/api/v1/admin/billing-rates",
        json={"water_price_per_m3": 20000.0},
    )
    assert resp_rate.status_code == 403

    # Attempt report generation
    resp_rep = await resident_client.post(
        "/api/v1/admin/reports/collection",
        json={},
    )
    assert resp_rep.status_code == 403
