"""
Security and RBAC test suite for Smart Building Cloud Platform.

Validates:
1. Least-privilege role matrix (Technician, Accountant, Resident, Admin, Super Admin).
2. Negative access tests (Technician cannot view invoices, Accountant cannot view sensor readings).
3. IDOR protection: Resident A cannot view Resident B's invoice (HTTP 403).
4. Dynamic role assignment & revocation via /api/v1/admin/users.
5. Admin Operations Dashboard metrics (/api/v1/admin/dashboard/*).
"""

import uuid
from datetime import datetime, timezone, timedelta
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.main import app
from app.core.database import get_db
from app.core.security import create_access_token, hash_password
from app.models.user import User
from app.models.building import Building
from app.models.floor import Floor
from app.models.apartment import Apartment
from app.models.device import Device, DeviceStatus
from app.models.device_type import DeviceType
from app.models.invoice import Invoice, InvoiceStatus
from app.models.invoice_item import InvoiceItem, ServiceType
from app.models.billing_cycle import BillingCycle, BillingCycleStatus
from app.models.rbac import Role, Permission, RolePermission, UserRole
from tests.conftest import testing_session_factory


@pytest_asyncio.fixture
async def seed_rbac(setup_database) -> dict:
    """Seed base roles, permissions, and matrix for RBAC tests."""
    async with testing_session_factory() as session:
        # Define permissions
        perms_data = [
            ("invoice.read", "Xem danh sách và chi tiết hóa đơn"),
            ("invoice.manage", "Tạo, sửa, hủy và xác nhận thanh toán hóa đơn"),
            ("sensor.read", "Xem dữ liệu telemetric cảm biến thời gian thực"),
            ("ticket.read", "Xem phiếu yêu cầu sửa chữa bảo trì"),
            ("ticket.create_own", "Cư dân tạo phiếu sự cố cho căn hộ"),
            ("ticket.assign", "Phân công kỹ thuật viên xử lý sự cố"),
            ("ticket.status_update", "Kỹ thuật viên cập nhật tiến độ xử lý"),
            ("device.read", "Xem danh sách và trạng thái thiết bị"),
            ("device.write", "Cấu hình, khởi động lại thiết bị"),
            ("admin.dashboard.read", "Truy cập dashboard chỉ số vận hành BQL"),
            ("user.manage", "Quản trị phân quyền người dùng"),
            ("resident.read_own", "Cư dân xem thông tin căn hộ cá nhân"),
        ]
        perm_objs = {code: Permission(id=uuid.uuid4(), code=code, description=desc) for code, desc in perms_data}
        session.add_all(perm_objs.values())

        # Define roles
        role_super = Role(id=uuid.uuid4(), name="super_admin", description="Quản trị viên toàn hệ thống", is_system=True)
        role_bql = Role(id=uuid.uuid4(), name="building_admin", description="Ban quản lý tòa nhà", is_system=True)
        role_acc = Role(id=uuid.uuid4(), name="accountant", description="Kế toán ban quản lý", is_system=True)
        role_tech = Role(id=uuid.uuid4(), name="technician", description="Kỹ thuật viên vận hành", is_system=True)
        role_res = Role(id=uuid.uuid4(), name="resident", description="Cư dân căn hộ", is_system=True)
        session.add_all([role_super, role_bql, role_acc, role_tech, role_res])
        await session.flush()

        # Bind role_permissions
        def link(role, codes):
            for c in codes:
                session.add(RolePermission(role_id=role.id, permission_id=perm_objs[c].id))

        link(role_super, list(perm_objs.keys()))
        link(role_bql, ["invoice.read", "invoice.manage", "ticket.read", "ticket.assign", "device.read", "device.write", "admin.dashboard.read", "user.manage"])
        link(role_acc, ["invoice.read", "invoice.manage", "admin.dashboard.read"])
        link(role_tech, ["ticket.read", "ticket.status_update", "device.read"])
        link(role_res, ["resident.read_own", "ticket.create_own"])

        # Create Building, Floor, Apartments
        bldg = Building(id=uuid.uuid4(), name="The Oasis Tower A", address="100 Thao Dien, D2, HCMC")
        session.add(bldg)
        f1 = Floor(id=uuid.uuid4(), building_id=bldg.id, floor_number=1)
        f2 = Floor(id=uuid.uuid4(), building_id=bldg.id, floor_number=2)
        session.add_all([f1, f2])

        apt_a = Apartment(id=uuid.uuid4(), floor_id=f1.id, unit_number="101")
        apt_b = Apartment(id=uuid.uuid4(), floor_id=f2.id, unit_number="201")
        session.add_all([apt_a, apt_b])
        await session.flush()

        # Device Type
        dtype_elec = DeviceType(id=uuid.uuid4(), code="electricity_meter", name="Công tơ điện", unit="kW")
        dtype_water = DeviceType(id=uuid.uuid4(), code="water_meter", name="Đồng hồ nước", unit="L/min")
        session.add_all([dtype_elec, dtype_water])
        await session.flush()

        # Billing cycle & Invoices
        today = datetime.now(timezone.utc).date()
        cycle_a = BillingCycle(
            id=uuid.uuid4(),
            apartment_id=apt_a.id,
            period_start=today - timedelta(days=30),
            period_end=today,
            status=BillingCycleStatus.INVOICED,
        )
        cycle_b = BillingCycle(
            id=uuid.uuid4(),
            apartment_id=apt_b.id,
            period_start=today - timedelta(days=30),
            period_end=today,
            status=BillingCycleStatus.INVOICED,
        )
        session.add_all([cycle_a, cycle_b])
        await session.flush()

        inv_a = Invoice(
            id=uuid.uuid4(),
            apartment_id=apt_a.id,
            billing_cycle_id=cycle_a.id,
            invoice_number="INV-TEST-A101",
            total_amount=1650000.0,
            status=InvoiceStatus.PAID,
            due_date=today + timedelta(days=5),
            paid_at=datetime.now(timezone.utc),
        )
        inv_b = Invoice(
            id=uuid.uuid4(),
            apartment_id=apt_b.id,
            billing_cycle_id=cycle_b.id,
            invoice_number="INV-TEST-B201",
            total_amount=2420000.0,
            status=InvoiceStatus.OVERDUE,
            due_date=today - timedelta(days=10),
        )
        session.add_all([inv_a, inv_b])
        await session.flush()

        item_a = InvoiceItem(
            id=uuid.uuid4(),
            invoice_id=inv_a.id,
            service_type=ServiceType.ELECTRICITY,
            description="Tiền điện T09",
            amount=1650000.0,
        )
        item_b = InvoiceItem(
            id=uuid.uuid4(),
            invoice_id=inv_b.id,
            service_type=ServiceType.WATER,
            description="Tiền nước T09",
            amount=2420000.0,
        )
        session.add_all([item_a, item_b])

        # Devices
        dev_online = Device(
            id=uuid.uuid4(),
            device_code="DEV-ELEC-101",
            apartment_id=apt_a.id,
            device_type_id=dtype_elec.id,
            name="Cảm biến điện Căn 101",
            status=DeviceStatus.ONLINE,
        )
        dev_offline = Device(
            id=uuid.uuid4(),
            device_code="DEV-WATER-201",
            apartment_id=apt_b.id,
            device_type_id=dtype_water.id,
            name="Cảm biến nước Căn 201",
            status=DeviceStatus.OFFLINE,
        )
        session.add_all([dev_online, dev_offline])

        # Users
        u_super = User(id=uuid.uuid4(), email="super@oasis.vn", hashed_password=hash_password("pw"), full_name="Super Admin", role="admin", is_superuser=True)
        u_bql = User(id=uuid.uuid4(), email="bql@oasis.vn", hashed_password=hash_password("pw"), full_name="BQL Admin", role="manager")
        u_acc = User(id=uuid.uuid4(), email="acc@oasis.vn", hashed_password=hash_password("pw"), full_name="Ke Toan", role="staff")
        u_tech = User(id=uuid.uuid4(), email="tech@oasis.vn", hashed_password=hash_password("pw"), full_name="Ky Thuat", role="technician")
        u_res_a = User(id=uuid.uuid4(), email="res_a@oasis.vn", hashed_password=hash_password("pw"), full_name="Cu Dan A", role="resident", apartment_id=apt_a.id)
        u_res_b = User(id=uuid.uuid4(), email="res_b@oasis.vn", hashed_password=hash_password("pw"), full_name="Cu Dan B", role="resident", apartment_id=apt_b.id)

        session.add_all([u_super, u_bql, u_acc, u_tech, u_res_a, u_res_b])
        await session.flush()

        # Bind user_roles
        session.add(UserRole(user_id=u_super.id, role_id=role_super.id))
        session.add(UserRole(user_id=u_bql.id, role_id=role_bql.id, building_id=bldg.id))
        session.add(UserRole(user_id=u_acc.id, role_id=role_acc.id, building_id=bldg.id))
        session.add(UserRole(user_id=u_tech.id, role_id=role_tech.id, building_id=bldg.id))
        session.add(UserRole(user_id=u_res_a.id, role_id=role_res.id, building_id=bldg.id))
        session.add(UserRole(user_id=u_res_b.id, role_id=role_res.id, building_id=bldg.id))

        await session.commit()

        return {
            "building_id": bldg.id,
            "roles": {
                "super": role_super,
                "bql": role_bql,
                "acc": role_acc,
                "tech": role_tech,
                "res": role_res,
            },
            "users": {
                "super": u_super,
                "bql": u_bql,
                "acc": u_acc,
                "tech": u_tech,
                "res_a": u_res_a,
                "res_b": u_res_b,
            },
            "invoices": {
                "inv_a": inv_a,
                "inv_b": inv_b,
            },
            "apartments": {
                "apt_a": apt_a,
                "apt_b": apt_b,
            }
        }


def make_client(user: User, role: str) -> AsyncClient:
    async def override_get_db():
        async with testing_session_factory() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    app.dependency_overrides[get_db] = override_get_db
    token = create_access_token(data={"sub": str(user.id), "role": role})
    headers = {"Authorization": f"Bearer {token}"}
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test", headers=headers)


@pytest.mark.asyncio
async def test_least_privilege_technician_cannot_view_invoices(seed_rbac):
    """Technician has no invoice.read permission -> must return 403 Forbidden."""
    tech_user = seed_rbac["users"]["tech"]
    async with make_client(tech_user, "technician") as ac:
        resp = await ac.get("/api/v1/invoices")
        assert resp.status_code == 403
        data = resp.json()
        assert "không có quyền" in data.get("detail", "").lower()


@pytest.mark.asyncio
async def test_least_privilege_accountant_cannot_view_sensor_readings(seed_rbac):
    """Accountant has no sensor.read permission -> must return 403 Forbidden on /readings."""
    acc_user = seed_rbac["users"]["acc"]
    async with make_client(acc_user, "staff") as ac:
        resp = await ac.get("/api/v1/readings")
        assert resp.status_code == 403
        data = resp.json()
        assert "không có quyền" in data.get("detail", "").lower()


@pytest.mark.asyncio
async def test_least_privilege_accountant_can_view_invoices_and_collection_rate(seed_rbac):
    """Accountant has invoice.read and admin.dashboard.read -> can access both."""
    acc_user = seed_rbac["users"]["acc"]
    async with make_client(acc_user, "staff") as ac:
        # Invoices
        resp_inv = await ac.get("/api/v1/invoices")
        assert resp_inv.status_code == 200
        # Collection rate
        resp_rate = await ac.get("/api/v1/admin/dashboard/collection-rate")
        assert resp_rate.status_code == 200
        assert "current_month" in resp_rate.json()
        assert resp_rate.json()["current_month"]["collection_rate_percent"] >= 0


@pytest.mark.asyncio
async def test_idor_protection_resident_cannot_access_other_invoice(seed_rbac):
    """Resident A must NOT be able to view Resident B's invoice (HTTP 403)."""
    res_a = seed_rbac["users"]["res_a"]
    inv_b = seed_rbac["invoices"]["inv_b"]

    async with make_client(res_a, "resident") as ac:
        resp = await ac.get(f"/api/v1/invoices/{inv_b.id}")
        assert resp.status_code == 403
        assert "không có quyền" in resp.json().get("detail", "").lower()


@pytest.mark.asyncio
async def test_idor_protection_resident_can_access_own_invoice(seed_rbac):
    """Resident A CAN view Resident A's own invoice (HTTP 200)."""
    res_a = seed_rbac["users"]["res_a"]
    inv_a = seed_rbac["invoices"]["inv_a"]

    async with make_client(res_a, "resident") as ac:
        resp = await ac.get(f"/api/v1/invoices/{inv_a.id}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == str(inv_a.id)


@pytest.mark.asyncio
async def test_resident_cannot_access_admin_dashboard(seed_rbac):
    """Resident cannot access /api/v1/admin/dashboard/overview -> 403 Forbidden."""
    res_a = seed_rbac["users"]["res_a"]
    async with make_client(res_a, "resident") as ac:
        resp = await ac.get("/api/v1/admin/dashboard/overview")
        assert resp.status_code == 403


@pytest.mark.asyncio
async def test_super_admin_dynamic_role_grant_and_revoke(seed_rbac):
    """Super Admin grants 'accountant' role to Technician user, then revokes it."""
    super_user = seed_rbac["users"]["super"]
    tech_user = seed_rbac["users"]["tech"]
    acc_role = seed_rbac["roles"]["acc"]
    bldg_id = seed_rbac["building_id"]

    async with make_client(super_user, "admin") as ac:
        # 1. Fetch current users with roles
        resp = await ac.get("/api/v1/admin/users")
        assert resp.status_code == 200
        users = resp.json()
        assert any(u["email"] == tech_user.email for u in users)

        # 2. Grant accountant role to technician
        grant_resp = await ac.post(
            f"/api/v1/admin/users/{tech_user.id}/roles",
            json={"role_id": str(acc_role.id), "building_id": str(bldg_id)}
        )
        assert grant_resp.status_code == 201

        # Verify role is assigned
        resp_after_grant = await ac.get("/api/v1/admin/users")
        updated_tech = next(u for u in resp_after_grant.json() if u["email"] == tech_user.email)
        assert any(r["role_name"] == "accountant" for r in updated_tech["roles"])

        # 3. Revoke accountant role
        revoke_resp = await ac.delete(f"/api/v1/admin/users/{tech_user.id}/roles/{acc_role.id}")
        assert revoke_resp.status_code == 200

        # Verify role is revoked
        resp_after_revoke = await ac.get("/api/v1/admin/users")
        revoked_tech = next(u for u in resp_after_revoke.json() if u["email"] == tech_user.email)
        assert not any(r["role_name"] == "accountant" for r in revoked_tech["roles"])


@pytest.mark.asyncio
async def test_admin_dashboard_endpoints_data_accuracy(seed_rbac):
    """Validate all 4 /api/v1/admin/dashboard/* endpoints return expected metrics."""
    bql_user = seed_rbac["users"]["bql"]
    async with make_client(bql_user, "manager") as ac:
        # Overview
        resp_overview = await ac.get("/api/v1/admin/dashboard/overview")
        assert resp_overview.status_code == 200
        overview = resp_overview.json()
        assert overview["total_apartments"] == 2
        assert overview["occupied_apartments"] == 2
        assert overview["devices_offline"] == 1
        assert "revenue_by_service" in overview

        # Collection rate
        resp_rate = await ac.get("/api/v1/admin/dashboard/collection-rate")
        assert resp_rate.status_code == 200
        rate_data = resp_rate.json()
        assert "current_month" in rate_data

        # Overdue apartments
        resp_overdue = await ac.get("/api/v1/admin/dashboard/overdue-apartments")
        assert resp_overdue.status_code == 200
        overdue_list = resp_overdue.json()
        assert len(overdue_list) >= 1
        assert overdue_list[0]["apartment_unit"] == "201"
        assert overdue_list[0]["total_overdue_amount_vnd"] == 2420000
        assert overdue_list[0]["days_overdue"] >= 9

        # Device health
        resp_dev = await ac.get("/api/v1/admin/dashboard/device-health")
        assert resp_dev.status_code == 200
        dev_health = resp_dev.json()
        assert dev_health["total_devices"] == 2
        assert dev_health["offline_devices"] == 1
        assert len(dev_health["floors"]) == 2
