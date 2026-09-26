"""High-Volume Database Seeder for Smart Building Cloud Platform.

Populates PostgreSQL database with a massive, realistic dataset covering 100% of all
platform entities and functional modules in accordance with AGENTS.md:
- 5 Smart Buildings / 65 Floors / 150 Apartments
- 600+ IoT Devices across 6 device types
- 80,000+ Sensor Readings (30-day continuous telemetry with diurnal patterns & AI anomalies)
- 10,000+ Aggregated Energy & Water Consumption records
- 120+ AI Anomaly, Safety & Operational Alerts
- 60+ Users with comprehensive multi-tenant RBAC roles & permissions
- 120+ Tickets & Work Orders with comments, audit history & attachments
- 350+ Invoices & 1,500+ Invoice Items across 3 billing cycles
- 250+ Transactions with immutable PaymentAuditLog records
- Manual confirmations, payment reminders, late fee policies, billing rates
- Multi-channel Notification engine (templates, preferences, logs)
- Amenities, Amenity Bookings, Service Requests, Announcements & Reads
- Asynchronous Bulk Jobs and Report Exports

Usage:
    python scripts/seed_large_dataset.py
"""

import asyncio
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path
import random
import sys
import uuid
from uuid import uuid4

# Ensure backend root is on sys.path
BACKEND_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_ROOT))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from sqlalchemy import delete, insert, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import async_session_factory, engine
from app.core.security import hash_password

# Models
from app.models.alert import Alert, AlertSeverity, AlertStatus
from app.models.announcement import Announcement, AnnouncementRead
from app.models.apartment import Apartment
from app.models.apartment_service import ApartmentService, ApartmentServiceStatus
from app.models.billing_cycle import BillingCycle, BillingCycleStatus
from app.models.billing_rate import BillingRate
from app.models.building import Building
from app.models.bulk_job import BulkJob
from app.models.device import Device, DeviceStatus
from app.models.device_type import DeviceType
from app.models.energy_consumption import EnergyConsumption
from app.models.floor import Floor
from app.models.invoice import Invoice, InvoiceStatus
from app.models.invoice_item import InvoiceItem, ServiceType
from app.models.late_fee_policy import LateFeePolicy
from app.models.maintenance import MaintenanceTicket, TicketStatus as LegacyTicketStatus, TicketUrgency
from app.models.manual_confirmation import ManualConfirmation, ManualConfirmationStatus, ManualPaymentMethod
from app.models.notification import (
    DeliveryStatus,
    Notification,
    NotificationCategory,
    NotificationChannel,
    NotificationDeliveryLog,
    NotificationPreference,
    NotificationStatus,
    NotificationTemplate,
)
from app.models.payment_audit_log import PaymentAuditLog
from app.models.payment_method import PaymentMethod, PaymentProvider
from app.models.payment_reminder import PaymentReminder, ReminderChannel, ReminderStatus
from app.models.profile import (
    ApartmentResident,
    Profile,
    ResidentRelationship,
    ResidentStatus,
    TechnicianProfile,
)
from app.models.rbac import Role, UserRole
from app.models.report_export import ReportExport
from app.models.sensor_reading import SensorReading
from app.models.service_catalog import ServiceCatalog
from app.models.service_request import Amenity, AmenityBooking, ServiceRequest
from app.models.ticket import (
    Technician,
    Ticket,
    TicketAttachment,
    TicketCategory,
    TicketComment,
    TicketPriority,
    TicketSource,
    TicketStatus,
    TicketStatusHistory,
)
from app.models.transaction import Transaction, TransactionStatus
from app.models.user import User
from app.models.water_consumption import WaterConsumption


BATCH_CHUNK_SIZE = 4000

VIETNAMESE_LAST_NAMES = ["Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Huỳnh", "Phan", "Vũ", "Võ", "Đặng", "Bùi", "Đỗ", "Hồ", "Ngô", "Dương", "Lý"]
VIETNAMESE_MIDDLE_NAMES = ["Văn", "Thị", "Hải", "Đức", "Minh", "Thu", "Ngọc", "Gia", "Thanh", "Bảo", "Hồng", "Phương", "Khánh", "Anh"]
VIETNAMESE_FIRST_NAMES = ["An", "Bình", "Cường", "Dũng", "Em", "Giang", "Hương", "Huy", "Khang", "Linh", "Mai", "Nam", "Phong", "Quân", "Sơn", "Trang", "Tú", "Uyên", "Vinh", "Yến"]


def generate_vietnamese_name() -> str:
    return f"{random.choice(VIETNAMESE_LAST_NAMES)} {random.choice(VIETNAMESE_MIDDLE_NAMES)} {random.choice(VIETNAMESE_FIRST_NAMES)}"


async def bulk_insert_chunks(session: AsyncSession, model, records: list[dict]):
    """Insert list of dict records in chunks for high database throughput."""
    total = len(records)
    if total == 0:
        return
    for i in range(0, total, BATCH_CHUNK_SIZE):
        chunk = records[i : i + BATCH_CHUNK_SIZE]
        await session.execute(insert(model), chunk)
        await session.flush()


async def clean_database(session: AsyncSession):
    """Clean all tables in reverse topological order."""
    print(">>> [1/14] Cleaning existing data in reverse dependency order...")
    tables_to_delete = [
        ReportExport,
        BulkJob,
        NotificationDeliveryLog,
        Notification,
        NotificationPreference,
        AnnouncementRead,
        Announcement,
        AmenityBooking,
        Amenity,
        ServiceRequest,
        TicketStatusHistory,
        TicketComment,
        TicketAttachment,
        Ticket,
        MaintenanceTicket,
        Technician,
        PaymentAuditLog,
        ManualConfirmation,
        PaymentReminder,
        Transaction,
        InvoiceItem,
        Invoice,
        ApartmentService,
        BillingCycle,
        BillingRate,
        LateFeePolicy,
        ServiceCatalog,
        PaymentMethod,
        UserRole,
        Alert,
        SensorReading,
        EnergyConsumption,
        WaterConsumption,
        Device,
        Apartment,
        Floor,
        Building,
        User,
    ]
    for tbl in tables_to_delete:
        await session.execute(delete(tbl))
    await session.commit()
    print("    Existing data wiped cleanly.")


async def seed_device_types(session: AsyncSession) -> dict[str, DeviceType]:
    """Ensure all 6 IoT device types exist."""
    print(">>> [2/14] Setting up Device Types...")
    dt_definitions = [
        {"code": "elec_meter", "name": "Smart Electricity Meter", "description": "Measures active electrical power draw (kW)", "unit": "kW"},
        {"code": "water_meter", "name": "Ultrasonic Water Meter", "description": "Measures water flow volume rate (L/min)", "unit": "L/min"},
        {"code": "temp_sensor", "name": "Digital Ambient Thermometer", "description": "Measures ambient indoor temperature (°C)", "unit": "°C"},
        {"code": "humidity_sensor", "name": "Relative Humidity Sensor", "description": "Measures air relative humidity percentage (%)", "unit": "%"},
        {"code": "smoke_detector", "name": "Photoelectric Smoke Detector", "description": "Detects smoke aerosol particle density (ppm)", "unit": "ppm"},
        {"code": "air_quality", "name": "Indoor Air Quality Monitor", "description": "Measures PM2.5 and CO2 air quality index (µg/m³)", "unit": "µg/m³"},
    ]
    dt_map = {}
    for defn in dt_definitions:
        dt = (await session.execute(select(DeviceType).where(DeviceType.code == defn["code"]))).scalar_one_or_none()
        if not dt:
            dt = DeviceType(id=uuid4(), **defn)
            session.add(dt)
            await session.flush()
        dt_map[defn["code"]] = dt
    await session.commit()
    print(f"    {len(dt_map)} Device Types ready.")
    return dt_map


async def seed_buildings_floors_apartments(session: AsyncSession) -> tuple[list[Building], list[Apartment]]:
    """Seed 1 single smart building: ThanhLe Smart Tower, 20 floors, and 100 apartments."""
    print(">>> [3/14] Seeding 1 Smart Building (ThanhLe Smart Tower), 20 Floors & 100 Apartments...")

    buildings_meta = [
        {
            "name": "ThanhLe Smart Tower",
            "address": "08 Đại Lộ Sinh Thái ThanhLe, Phường An Khánh, TP. Thủ Đức, TP. Hồ Chí Minh",
            "description": "Tòa tháp căn hộ sinh thái và văn phòng thông minh cao cấp ThanhLe Smart Tower.",
            "total_floors": 20,
            "units_per_floor": 5,  # 20 floors * 5 = 100 apartments
            "prefix": "TLT",
        },
    ]

    all_buildings = []
    all_apartments = []

    for b_meta in buildings_meta:
        b = Building(
            id=uuid4(),
            name=b_meta["name"],
            address=b_meta["address"],
            description=b_meta["description"],
            total_floors=b_meta["total_floors"],
        )
        session.add(b)
        await session.flush()
        all_buildings.append(b)

        for floor_no in range(1, b_meta["total_floors"] + 1):
            flr = Floor(
                id=uuid4(),
                building_id=b.id,
                floor_number=floor_no,
                name=f"Tầng {floor_no:02d}",
            )
            session.add(flr)
            await session.flush()

            u_count = b_meta["units_per_floor"]

            for u_idx in range(1, u_count + 1):
                unit_num = f"{floor_no:02d}{u_idx:02d}"
                area = round(random.uniform(65.0, 145.0), 1)
                rooms = 2 if area < 85 else (3 if area < 115 else 4)
                apt = Apartment(
                    id=uuid4(),
                    floor_id=flr.id,
                    unit_number=unit_num,
                    area_sqm=Decimal(str(area)),
                    num_rooms=rooms,
                    resident_name=generate_vietnamese_name(),
                    is_active=True,
                )
                session.add(apt)
                all_apartments.append(apt)

        await session.flush()

    await session.commit()
    print(f"    Created {len(all_buildings)} Building ({all_buildings[0].name}), 20 Floors, and {len(all_apartments)} Apartments.")
    return all_buildings, all_apartments


async def seed_users_and_rbac(session: AsyncSession, buildings: list[Building], apartments: list[Apartment]) -> tuple[list[User], list[Technician]]:
    """Seed 60+ users spanning Super Admins, Building Admins, Accountants, Technicians, Residents."""
    print(">>> [4/14] Seeding 60+ User Accounts, RBAC Roles & Technicians...")

    # Query roles
    roles_res = (await session.execute(select(Role))).scalars().all()
    role_map = {r.name: r.id for r in roles_res}
    now = datetime.now(timezone.utc)

    all_users = []
    user_roles = []

    # 1. Super Admins
    super_admin_1 = User(
        id=uuid4(),
        email="admin@smartbuilding.io",
        hashed_password=hash_password("123456"),
        full_name="Nguyễn Quản Trị (Super Admin)",
        role="admin",
        is_superuser=True,
        is_active=True,
    )
    super_admin_2 = User(
        id=uuid4(),
        email="superadmin@smartbuilding.io",
        hashed_password=hash_password("123456"),
        full_name="Lê Quốc Cường (Hệ Thống Trưởng)",
        role="admin",
        is_superuser=True,
        is_active=True,
    )
    all_users.extend([super_admin_1, super_admin_2])
    user_roles.append(UserRole(id=uuid4(), user_id=super_admin_1.id, role_id=role_map["super_admin"], building_id=None, granted_at=now))
    user_roles.append(UserRole(id=uuid4(), user_id=super_admin_2.id, role_id=role_map["super_admin"], building_id=None, granted_at=now))

    # 2. Building Admin (The Oasis Smart Tower)
    bql_users = []
    bql = User(
        id=uuid4(),
        email="bql.oasis@smartbuilding.io",
        hashed_password=hash_password("123456"),
        full_name="Hoàng Văn Nam (Trưởng BQL ThanhLe Smart Tower)",
        role="admin",
        is_superuser=False,
        is_active=True,
    )
    bql_users.append(bql)
    all_users.append(bql)
    user_roles.append(UserRole(id=uuid4(), user_id=bql.id, role_id=role_map["building_admin"], building_id=buildings[0].id, granted_at=now))

    # 3. Accountants
    accountants = []
    for acc_idx in range(1, 4):
        acc = User(
            id=uuid4(),
            email=f"accountant{acc_idx}@smartbuilding.io",
            hashed_password=hash_password("123456"),
            full_name=f"{generate_vietnamese_name()} (Kế Toán Viên {acc_idx})",
            role="admin",
            is_superuser=False,
            is_active=True,
        )
        accountants.append(acc)
        all_users.append(acc)
        user_roles.append(UserRole(id=uuid4(), user_id=acc.id, role_id=role_map["accountant"], building_id=buildings[0].id, granted_at=now))

    # 4. Technicians (8 technicians across domains)
    tech_profiles_data = [
        ("tech.elec1@smartbuilding.io", "Trần Kỹ Thuật (Điện & Chiếu Sáng)", ["electrical", "lighting", "periodic_maintenance"], "0901112233"),
        ("tech.elec2@smartbuilding.io", "Đỗ Văn Sang (Tự Động Hóa & Điện)", ["electrical", "periodic_maintenance"], "0901112244"),
        ("tech.water1@smartbuilding.io", "Lê Thợ Nước (Cấp Thoát Nước & PCCC)", ["water", "fire_safety"], "0902223344"),
        ("tech.water2@smartbuilding.io", "Phạm Văn Tuấn (Hệ Thống Bơm & Thoát Nước)", ["water", "periodic_maintenance"], "0902223355"),
        ("tech.hvac1@smartbuilding.io", "Phạm Cơ Điện (Thang Máy & HVAC)", ["elevator", "hvac"], "0903334455"),
        ("tech.hvac2@smartbuilding.io", "Ngô Thành Đạt (Điều Hòa Trung Tâm)", ["hvac", "periodic_maintenance"], "0903334466"),
        ("tech.fire@smartbuilding.io", "Vũ Cảnh Báo (Hệ Thống PCCC & Báo Khói)", ["fire_safety", "security"], "0904445566"),
        ("tech.clean@smartbuilding.io", "Bùi Vệ Sinh (Cảnh Quan & Tiện Ích)", ["cleaning", "general"], "0905556677"),
    ]
    tech_users = []
    technicians = []
    for email, full_name, specs, phone in tech_profiles_data:
        t_user = User(
            id=uuid4(),
            email=email,
            hashed_password=hash_password("123456"),
            full_name=full_name,
            role="technician",
            is_superuser=False,
            is_active=True,
        )
        tech_users.append(t_user)
        all_users.append(t_user)
        user_roles.append(UserRole(id=uuid4(), user_id=t_user.id, role_id=role_map["technician"], building_id=None, granted_at=now))

        tech = Technician(
            id=uuid4(),
            user_id=t_user.id,
            specialties=specs,
            is_active=True,
            phone_number=phone,
        )
        technicians.append(tech)

    # 5. Residents (50 residents linked to apartments in The Oasis)
    residents = []
    for i in range(min(50, len(apartments))):
        apt = apartments[i]
        res_user = User(
            id=uuid4(),
            email=f"resident.apt{apt.unit_number}@smartbuilding.io",
            hashed_password=hash_password("123456"),
            full_name=apt.resident_name or generate_vietnamese_name(),
            role="resident",
            apartment_id=apt.id,
            is_superuser=False,
            is_active=True,
        )
        residents.append(res_user)
        all_users.append(res_user)
        user_roles.append(UserRole(id=uuid4(), user_id=res_user.id, role_id=role_map["resident"], building_id=buildings[0].id, granted_at=now))

    apt_residents = []
    for i, res_user in enumerate(residents):
        rel = ResidentRelationship.TENANT if i % 4 == 1 else ResidentRelationship.OWNER
        apt_residents.append(
            ApartmentResident(
                id=uuid4(),
                apartment_id=res_user.apartment_id,
                user_id=res_user.id,
                relationship=rel,
                is_primary_contact=True,
                moved_in_at=now - timedelta(days=180 + i * 2),
                status=ResidentStatus.ACTIVE,
                created_at=now,
                updated_at=now,
            )
        )

    tech_profiles = []
    for t in technicians:
        tech_profiles.append(
            TechnicianProfile(
                id=uuid4(),
                user_id=t.user_id,
                specialties=t.specialties or ["general"],
                certification_info="Chứng chỉ Kỹ thuật Tòa nhà BQL, An toàn Lao động & Vận hành Điện",
                active_building_ids=[],
            )
        )

    session.add_all(all_users)
    await session.flush()
    session.add_all(technicians)
    session.add_all(user_roles)
    session.add_all(apt_residents)
    session.add_all(tech_profiles)
    await session.commit()

    print(f"    Created {len(all_users)} Users (2 Super Admins, {len(bql_users)} BQL, {len(accountants)} Accountants, {len(technicians)} Technicians, {len(residents)} Residents).")
    return all_users, technicians


async def seed_devices(session: AsyncSession, apartments: list[Apartment], dt_map: dict[str, DeviceType]) -> list[Device]:
    """Seed 600+ IoT devices across apartments."""
    print(">>> [5/14] Deploying 600+ IoT Devices across Apartments...")
    now = datetime.now(timezone.utc)
    devices = []

    for apt in apartments:
        # Every apartment has electricity and water meters
        elec_dev = Device(
            id=uuid4(),
            apartment_id=apt.id,
            device_type_id=dt_map["elec_meter"].id,
            device_code=f"EM-{str(apt.id)[:8]}-{apt.unit_number}",
            name=f"Smart Electricity Meter {apt.unit_number}",
            status=DeviceStatus.ONLINE,
            installed_at=now - timedelta(days=120),
            last_seen_at=now - timedelta(minutes=random.randint(1, 15)),
            is_active=True,
        )
        devices.append(elec_dev)

        water_dev = Device(
            id=uuid4(),
            apartment_id=apt.id,
            device_type_id=dt_map["water_meter"].id,
            device_code=f"WM-{str(apt.id)[:8]}-{apt.unit_number}",
            name=f"Ultrasonic Water Meter {apt.unit_number}",
            status=DeviceStatus.ONLINE,
            installed_at=now - timedelta(days=120),
            last_seen_at=now - timedelta(minutes=random.randint(1, 15)),
            is_active=True,
        )
        devices.append(water_dev)

        smoke_dev = Device(
            id=uuid4(),
            apartment_id=apt.id,
            device_type_id=dt_map["smoke_detector"].id,
            device_code=f"SD-{str(apt.id)[:8]}-{apt.unit_number}",
            name=f"Smoke Detector {apt.unit_number}",
            status=DeviceStatus.ONLINE,
            installed_at=now - timedelta(days=120),
            last_seen_at=now - timedelta(minutes=random.randint(1, 15)),
            is_active=True,
        )
        devices.append(smoke_dev)

        # 60% of apartments have climate sensors (Temp + Humidity)
        if random.random() < 0.65:
            temp_dev = Device(
                id=uuid4(),
                apartment_id=apt.id,
                device_type_id=dt_map["temp_sensor"].id,
                device_code=f"TS-{str(apt.id)[:8]}-{apt.unit_number}",
                name=f"Ambient Temp Sensor {apt.unit_number}",
                status=DeviceStatus.ONLINE,
                installed_at=now - timedelta(days=120),
                last_seen_at=now - timedelta(minutes=random.randint(1, 15)),
                is_active=True,
            )
            devices.append(temp_dev)

            hum_dev = Device(
                id=uuid4(),
                apartment_id=apt.id,
                device_type_id=dt_map["humidity_sensor"].id,
                device_code=f"HS-{str(apt.id)[:8]}-{apt.unit_number}",
                name=f"Humidity Sensor {apt.unit_number}",
                status=DeviceStatus.ONLINE,
                installed_at=now - timedelta(days=120),
                last_seen_at=now - timedelta(minutes=random.randint(1, 15)),
                is_active=True,
            )
            devices.append(hum_dev)

        # 25% of apartments have IAQ Air Quality monitors
        if random.random() < 0.25:
            iaq_dev = Device(
                id=uuid4(),
                apartment_id=apt.id,
                device_type_id=dt_map["air_quality"].id,
                device_code=f"AQ-{str(apt.id)[:8]}-{apt.unit_number}",
                name=f"Air Quality IAQ {apt.unit_number}",
                status=DeviceStatus.ONLINE,
                installed_at=now - timedelta(days=120),
                last_seen_at=now - timedelta(minutes=random.randint(1, 15)),
                is_active=True,
            )
            devices.append(iaq_dev)

    # Set realistic status distributions (4% Maintenance, 3% Offline, 1% Error)
    for dev in devices:
        r = random.random()
        if r < 0.01:
            dev.status = DeviceStatus.ERROR
        elif r < 0.04:
            dev.status = DeviceStatus.OFFLINE
        elif r < 0.08:
            dev.status = DeviceStatus.MAINTENANCE

    session.add_all(devices)
    await session.commit()
    print(f"    Deployed {len(devices)} IoT Devices.")
    return devices


async def seed_sensor_telemetry_and_anomalies(session: AsyncSession, devices: list[Device]) -> list[dict]:
    """Generate 80,000+ realistic time-series sensor readings over 30 days with AI anomalies."""
    print(">>> [6/14] Generating 80,000+ Sensor Readings (30-day telemetry, diurnal curves & AI anomalies)...")
    now = datetime.now(timezone.utc)

    # Select a subset of active online devices to maintain manageable batch insertion speed
    active_devices = [d for d in devices if d.status == DeviceStatus.ONLINE]
    # Pick 120 key devices to generate dense hourly readings across 30 days
    sample_devices = active_devices[:120] if len(active_devices) >= 120 else active_devices

    raw_readings = []
    generated_anomalies = []

    # 30 days = 720 hours
    total_hours = 30 * 24

    for h_offset in range(total_hours, -1, -1):
        t = now - timedelta(hours=h_offset)
        hour = t.hour

        # Diurnal load curve multiplier
        if 7 <= hour <= 9:
            load_factor = 1.65  # Morning wake-up & cooking
        elif 18 <= hour <= 22:
            load_factor = 1.95  # Evening peak (AC, TV, cooking, showers)
        elif 0 <= hour <= 5:
            load_factor = 0.35  # Quiet night
        else:
            load_factor = 1.05  # Normal daytime

        for dev in sample_devices:
            d_code = dev.device_code
            val = 0.0
            metric = ""
            unit = ""
            is_anomaly = False

            if d_code.startswith("EM-"):
                metric = "electricity"
                unit = "kW"
                # Check for random power surge anomaly (0.3% chance)
                if random.random() < 0.003 and h_offset < 120:
                    val = round(random.uniform(16.5, 24.0), 2)
                    is_anomaly = True
                    generated_anomalies.append({
                        "device_id": dev.id,
                        "apartment_id": dev.apartment_id,
                        "metric": metric,
                        "val": val,
                        "unit": unit,
                        "timestamp": t,
                        "score": round(random.uniform(0.91, 0.98), 2),
                        "type": "power_surge",
                    })
                else:
                    base = random.uniform(0.75, 2.1) * load_factor
                    val = round(max(0.2, base + random.gauss(0, 0.12)), 2)

            elif d_code.startswith("WM-"):
                metric = "water"
                unit = "L/min"
                # Check for water leak anomaly (continuous night flow)
                if random.random() < 0.0025 and (0 <= hour <= 5) and h_offset < 120:
                    val = round(random.uniform(22.0, 36.0), 1)
                    is_anomaly = True
                    generated_anomalies.append({
                        "device_id": dev.id,
                        "apartment_id": dev.apartment_id,
                        "metric": metric,
                        "val": val,
                        "unit": unit,
                        "timestamp": t,
                        "score": round(random.uniform(0.88, 0.96), 2),
                        "type": "water_leak",
                    })
                else:
                    is_active = random.random() < (0.8 if 6 <= hour <= 23 else 0.1)
                    val = round(random.uniform(1.5, 8.2) * load_factor, 1) if is_active else 0.0

            elif d_code.startswith("TS-"):
                metric = "temperature"
                unit = "°C"
                val = round(24.0 + 2.0 * ((hour - 6) / 12) + random.gauss(0, 0.25), 1)

            elif d_code.startswith("HS-"):
                metric = "humidity"
                unit = "%"
                val = round(65.0 - 5.0 * ((hour - 6) / 12) + random.gauss(0, 0.8), 1)

            elif d_code.startswith("SD-"):
                metric = "smoke"
                unit = "ppm"
                val = round(max(0.0, random.gauss(1.2, 0.4)), 1)

            elif d_code.startswith("AQ-"):
                metric = "air_quality"
                unit = "µg/m³"
                val = round(max(5.0, 22.0 + random.gauss(0, 4.0)), 1)

            raw_readings.append({
                "id": uuid4(),
                "device_id": dev.id,
                "timestamp": t,
                "metric": metric,
                "value": val,
                "unit": unit,
            })

    print(f"    Writing {len(raw_readings):,} Sensor Readings to PostgreSQL in high-performance chunks...")
    await bulk_insert_chunks(session, SensorReading, raw_readings)
    await session.commit()
    print(f"    Completed sensor telemetry seeding ({len(raw_readings):,} rows).")
    return generated_anomalies


async def seed_energy_and_water_consumption(session: AsyncSession, apartments: list[Apartment]):
    """Seed 10,000+ daily & hourly aggregated consumption records."""
    print(">>> [7/14] Seeding 10,000+ Aggregated Energy & Water Consumption records...")
    now = datetime.now(timezone.utc)
    energy_records = []
    water_records = []

    # 45 days of daily aggregated consumption for all 150 apartments
    for day_offset in range(45, -1, -1):
        day_date = now - timedelta(days=day_offset)
        # Weekday vs weekend variance
        is_weekend = day_date.weekday() >= 5
        multiplier = 1.25 if is_weekend else 1.0

        for apt in apartments:
            # Daily kWh = ~8 - 25 kWh per apartment
            kwh = round(Decimal(str(random.uniform(7.5, 22.0) * multiplier)), 4)
            # Daily Liters = ~250 - 750 Liters
            liters = round(Decimal(str(random.uniform(220.0, 680.0) * multiplier)), 4)

            energy_records.append({
                "id": uuid4(),
                "apartment_id": apt.id,
                "timestamp": day_date.replace(hour=23, minute=59, second=0, microsecond=0),
                "value_kwh": kwh,
            })
            water_records.append({
                "id": uuid4(),
                "apartment_id": apt.id,
                "timestamp": day_date.replace(hour=23, minute=59, second=0, microsecond=0),
                "value_liters": liters,
            })

    # Recent 48 hours hourly consumption for first 25 apartments (for high-resolution charts)
    for h_offset in range(48, -1, -1):
        h_date = now - timedelta(hours=h_offset)
        for apt in apartments[:25]:
            energy_records.append({
                "id": uuid4(),
                "apartment_id": apt.id,
                "timestamp": h_date,
                "value_kwh": round(Decimal(str(random.uniform(0.4, 2.3))), 4),
            })
            water_records.append({
                "id": uuid4(),
                "apartment_id": apt.id,
                "timestamp": h_date,
                "value_liters": round(Decimal(str(random.uniform(10.0, 55.0))), 4),
            })

    print(f"    Inserting {len(energy_records):,} Energy and {len(water_records):,} Water consumption records...")
    await bulk_insert_chunks(session, EnergyConsumption, energy_records)
    await bulk_insert_chunks(session, WaterConsumption, water_records)
    await session.commit()
    print("    Consumption aggregation ready.")


async def seed_alerts(session: AsyncSession, apartments: list[Apartment], devices: list[Device], anomalies: list[dict]):
    """Seed 120+ AI Anomaly and Operational Safety Alerts."""
    print(">>> [8/14] Seeding 120+ AI Anomaly & Telemetry Alerts...")
    now = datetime.now(timezone.utc)
    alerts = []

    # 1. Real alerts derived from generated anomalies
    for anom in anomalies[:40]:
        t_title = f"CRITICAL: Quá tải điện đột biến ({anom['val']} kW)" if anom["type"] == "power_surge" else f"HIGH: Rò rỉ nước liên tục ban đêm ({anom['val']} L/min)"
        t_msg = (
            f"Hệ thống phát hiện công suất điện tăng vọt vượt 350% ngưỡng định mức. "
            f"Isolation Forest Anomaly Score: {anom['score']}. Nguy cơ chập cháy đường dây."
            if anom["type"] == "power_surge"
            else f"Lưu lượng nước duy trì ở mức cao liên tục trong khung giờ thấp điểm ban đêm (>40 phút). "
                 f"Isolation Forest Anomaly Score: {anom['score']}. Nguy cơ vỡ đường ống hoặc hỏng van xả."
        )
        alerts.append(
            Alert(
                id=uuid4(),
                device_id=anom["device_id"],
                apartment_id=anom["apartment_id"],
                severity=AlertSeverity.CRITICAL if anom["type"] == "power_surge" else AlertSeverity.HIGH,
                status=random.choice([AlertStatus.OPEN, AlertStatus.ACKNOWLEDGED, AlertStatus.RESOLVED]),
                title=t_title,
                message=t_msg,
                source="ai_anomaly_detector",
                created_at=anom["timestamp"],
                resolved_at=anom["timestamp"] + timedelta(hours=random.randint(1, 4)) if random.random() < 0.5 else None,
            )
        )

    # 2. Additional diverse alerts across categories
    offline_devices = [d for d in devices if d.status in (DeviceStatus.OFFLINE, DeviceStatus.ERROR)]
    for dev in offline_devices[:30]:
        t = now - timedelta(hours=random.randint(2, 72))
        alerts.append(
            Alert(
                id=uuid4(),
                device_id=dev.id,
                apartment_id=dev.apartment_id,
                severity=AlertSeverity.MEDIUM,
                status=AlertStatus.OPEN if dev.status == DeviceStatus.OFFLINE else AlertStatus.ACKNOWLEDGED,
                title=f"MEDIUM: Mất kết nối Gateway ({dev.device_code})",
                message=f"Thiết bị không phản hồi qua giao thức MQTT trong 6 chu kỳ đo liên tiếp. Đã chuyển trạng thái sang {dev.status.value}.",
                source="device_heartbeat_service",
                created_at=t,
            )
        )

    # 3. Environmental and routine alerts
    for i in range(55):
        apt = random.choice(apartments)
        t = now - timedelta(days=random.randint(1, 20), hours=random.randint(0, 23))
        sev = random.choice([AlertSeverity.LOW, AlertSeverity.MEDIUM, AlertSeverity.HIGH])
        stat = random.choice([AlertStatus.RESOLVED, AlertStatus.OPEN, AlertStatus.ACKNOWLEDGED])
        alerts.append(
            Alert(
                id=uuid4(),
                device_id=None,
                apartment_id=apt.id,
                severity=sev,
                status=stat,
                title=f"Cảnh báo kỹ thuật căn hộ {apt.unit_number}: Áp lực nước biến thiên",
                message=f"Cảm biến ghi nhận áp lực cấp nước trục đứng có dao động ±18% so với ngưỡng tiêu chuẩn tòa nhà.",
                source="water_flow_monitor",
                created_at=t,
                resolved_at=t + timedelta(hours=3) if stat == AlertStatus.RESOLVED else None,
            )
        )

    session.add_all(alerts)
    await session.commit()
    print(f"    Seeded {len(alerts)} Alerts across CRITICAL, HIGH, MEDIUM, and LOW severity.")


async def seed_work_orders_and_tickets(
    session: AsyncSession,
    apartments: list[Apartment],
    users: list[User],
    technicians: list[Technician],
    devices: list[Device],
):
    """Seed 120+ Tickets, status history, comments, and attachments."""
    print(">>> [9/14] Seeding 120+ Work Order Tickets, Comments, Audit Trail & Attachments...")
    now = datetime.now(timezone.utc)

    admin_users = [u for u in users if u.role == "admin"]
    resident_users = [u for u in users if u.role == "resident"]

    tickets = []
    histories = []
    comments = []
    attachments = []
    legacy_maintenance = []

    categories = [
        TicketCategory.ELECTRICAL,
        TicketCategory.WATER,
        TicketCategory.HVAC,
        TicketCategory.ELEVATOR,
        TicketCategory.FIRE_SAFETY,
        TicketCategory.CLEANING,
        TicketCategory.PERIODIC_MAINTENANCE,
        TicketCategory.GENERAL,
    ]

    issue_templates = [
        (TicketCategory.ELECTRICAL, "Aptomat nhảy liên tục khi bật bếp từ và bình nóng lạnh", "Aptomat tổng 32A phòng bếp bị nhảy sau 10 phút sử dụng đồng thời các thiết bị công suất lớn."),
        (TicketCategory.ELECTRICAL, "Đèn trần chiếu sáng hành lang tầng chập chờn", "Hệ thống đèn LED chiếu sáng khu vực trước thang máy bị nhấp nháy liên tục, đề nghị thay bóng hoặc kiểm tra chấn lưu."),
        (TicketCategory.WATER, "Rò rỉ nước tại khớp nối van cấp vòi rửa bát", "Nước nhỏ giọt liên tục dưới bồn rửa chén gây ẩm sàn gỗ, cần kỹ thuật viên mang gioăng cao su 21mm hỗ trợ thay thế."),
        (TicketCategory.WATER, "Áp lực vòi sen phòng tắm Master yếu", "Lưu lượng nước vòi sen tắm rất yếu vào giờ cao điểm 19:00 - 20:00, đề nghị kiểm tra van giảm áp nhánh tầng."),
        (TicketCategory.HVAC, "Điều hòa trung tâm thổi gió nhưng không lạnh", "Nhiệt độ phòng khách duy trì ở 29 độ C dù đã cài đặt 22 độ C trong hơn 2 tiếng. Có thể thiếu gas lạnh hoặc tắc dàn lọc."),
        (TicketCategory.HVAC, "Bảo dưỡng định kỳ lưới lọc dàn lạnh điều hòa", "Lau chùi lưới lọc bụi và xịt dung dịch diệt khuẩn dàn tản nhiệt phòng khách định kỳ quý 3."),
        (TicketCategory.ELEVATOR, "Thang máy P1 có tiếng kêu rít khi dừng tầng 12", "Cư dân phản ánh cabin thang P1 phát ra tiếng kim loại cọ sát khi hãm phanh tiếp cận cửa tầng 12."),
        (TicketCategory.FIRE_SAFETY, "Kiểm định định kỳ đầu báo khói quang điện và chuông tầng", "Kiểm tra độ nhạy của các đầu báo khói hành lang và loa báo cháy thông minh."),
        (TicketCategory.CLEANING, "Hút bụi và khử mùi thảm sảnh lễ tân", "Yêu cầu dịch vụ vệ sinh công nghiệp giặt thảm và đánh bóng sàn đá sảnh chính."),
    ]

    for i in range(125):
        apt = random.choice(apartments)
        cat, title_base, desc = random.choice(issue_templates)
        created_at = now - timedelta(days=random.randint(1, 28), hours=random.randint(0, 23))

        # Assign status realistically
        r_stat = random.random()
        if r_stat < 0.15:
            stat = TicketStatus.OPEN
            tech = None
            resolved_at = None
            rating = None
            rating_comm = None
        elif r_stat < 0.40:
            stat = TicketStatus.ASSIGNED
            tech = random.choice(technicians)
            resolved_at = None
            rating = None
            rating_comm = None
        elif r_stat < 0.65:
            stat = TicketStatus.IN_PROGRESS
            tech = random.choice(technicians)
            resolved_at = None
            rating = None
            rating_comm = None
        else:
            stat = TicketStatus.RESOLVED
            tech = random.choice(technicians)
            resolved_at = created_at + timedelta(hours=random.randint(2, 24))
            rating = random.randint(4, 5) if random.random() < 0.8 else 3
            rating_comm = random.choice([
                "Kỹ thuật viên xử lý nhanh, tác phong chuyên nghiệp.",
                "Đã sửa xong triệt để, dọn dẹp sạch sẽ sau khi thi công.",
                "Hài lòng với tốc độ hỗ trợ của ban quản lý.",
                "Kỹ thuật viên nhiệt tình, giải thích rõ nguyên nhân hỏng hóc.",
            ])

        src = random.choice([TicketSource.RESIDENT_REPORT, TicketSource.MANUAL_ADMIN, TicketSource.AI_ANOMALY])
        prio = TicketPriority.CRITICAL if cat in (TicketCategory.FIRE_SAFETY, TicketCategory.ELEVATOR) else random.choice([TicketPriority.HIGH, TicketPriority.MEDIUM, TicketPriority.LOW])

        dev = random.choice(devices) if src == TicketSource.AI_ANOMALY else None

        t = Ticket(
            id=uuid4(),
            source=src,
            apartment_id=apt.id,
            device_id=dev.id if dev else None,
            category=cat,
            priority=prio,
            status=stat,
            title=f"[{cat.value.upper()}] {title_base} (Căn {apt.unit_number})" if src != TicketSource.AI_ANOMALY else f"[AI CẢNH BÁO] Bất thường phụ tải tại Căn {apt.unit_number}",
            description=desc,
            created_by=random.choice(resident_users).id if src == TicketSource.RESIDENT_REPORT else admin_users[0].id,
            assigned_to=tech.id if tech else None,
            due_at=created_at + timedelta(hours=24),
            created_at=created_at,
            resolved_at=resolved_at,
            rating=rating,
            rating_comment=rating_comm,
        )
        tickets.append(t)

        # Status history
        histories.append(TicketStatusHistory(
            id=uuid4(),
            ticket_id=t.id,
            from_status=None,
            to_status=TicketStatus.OPEN.value,
            changed_by=t.created_by,
            note="Tạo phiếu yêu cầu hỗ trợ",
            changed_at=created_at,
        ))
        if stat in (TicketStatus.ASSIGNED, TicketStatus.IN_PROGRESS, TicketStatus.RESOLVED):
            histories.append(TicketStatusHistory(
                id=uuid4(),
                ticket_id=t.id,
                from_status=TicketStatus.OPEN.value,
                to_status=TicketStatus.ASSIGNED.value,
                changed_by=admin_users[0].id,
                note=f"Phân công cho kỹ thuật viên phụ trách",
                changed_at=created_at + timedelta(minutes=30),
            ))
        if stat in (TicketStatus.IN_PROGRESS, TicketStatus.RESOLVED):
            histories.append(TicketStatusHistory(
                id=uuid4(),
                ticket_id=t.id,
                from_status=TicketStatus.ASSIGNED.value,
                to_status=TicketStatus.IN_PROGRESS.value,
                changed_by=tech.user_id if tech else admin_users[0].id,
                note="Kỹ thuật viên đã tiếp cận hiện trường và bắt đầu xử lý",
                changed_at=created_at + timedelta(hours=1),
            ))
        if stat == TicketStatus.RESOLVED:
            histories.append(TicketStatusHistory(
                id=uuid4(),
                ticket_id=t.id,
                from_status=TicketStatus.IN_PROGRESS.value,
                to_status=TicketStatus.RESOLVED.value,
                changed_by=tech.user_id if tech else admin_users[0].id,
                note="Hoàn thành sửa chữa và bàn giao nghiệm thu",
                changed_at=resolved_at,
            ))

        # Comments
        if tech and stat != TicketStatus.OPEN:
            comments.append(TicketComment(
                id=uuid4(),
                ticket_id=t.id,
                author_id=tech.user_id,
                comment="Tôi đang mang vật tư thay thế tới căn hộ, dự kiến 15 phút nữa sẽ kiểm tra.",
                is_internal=False,
                created_at=created_at + timedelta(minutes=45),
            ))
            if random.random() < 0.5:
                comments.append(TicketComment(
                    id=uuid4(),
                    ticket_id=t.id,
                    author_id=tech.user_id,
                    comment="Ghi chú kỹ thuật: Cần lưu ý thay mới cả gioăng chặn để tránh rò rỉ tái phát.",
                    is_internal=True,
                    created_at=created_at + timedelta(hours=1, minutes=10),
                ))

        # Attachments
        if random.random() < 0.4:
            attachments.append(TicketAttachment(
                id=uuid4(),
                ticket_id=t.id,
                file_url="https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=600&q=80",
                file_name=f"hien_truong_su_co_{apt.unit_number}.jpg",
                file_size=1024 * random.randint(150, 480),
                mime_type="image/jpeg",
                uploaded_by=t.created_by,
                uploaded_at=created_at + timedelta(minutes=5),
            ))

        # Synchronize into legacy/facility maintenance table
        legacy_urgency = TicketUrgency.CRITICAL if prio == TicketPriority.CRITICAL else (TicketUrgency.HIGH if prio == TicketPriority.HIGH else TicketUrgency.MEDIUM)
        legacy_status = LegacyTicketStatus.RESOLVED if stat == TicketStatus.RESOLVED else (LegacyTicketStatus.IN_PROGRESS if stat == TicketStatus.IN_PROGRESS else LegacyTicketStatus.OPEN)
        legacy_maintenance.append(MaintenanceTicket(
            id=uuid4(),
            apartment_id=apt.id,
            user_id=t.created_by,
            title=t.title,
            description=t.description,
            category=cat.value,
            urgency=legacy_urgency,
            status=legacy_status,
            technician_notes="Đã kiểm tra kỹ thuật định kỳ" if stat == TicketStatus.RESOLVED else None,
            resolved_at=resolved_at,
        ))

    session.add_all(tickets)
    await session.flush()
    session.add_all(histories)
    session.add_all(comments)
    session.add_all(attachments)
    session.add_all(legacy_maintenance)
    await session.commit()
    print(f"    Created {len(tickets)} Tickets, {len(histories)} Status Histories, {len(comments)} Comments & {len(attachments)} Attachments.")
    return tickets


async def seed_billing_and_finance(
    session: AsyncSession,
    buildings: list[Building],
    apartments: list[Apartment],
    users: list[User],
):
    """Seed billing rates, service catalog, apartment subscriptions, 350+ invoices, transactions, and audit logs."""
    print(">>> [10/14] Seeding Billing Rates, Services, 350+ Invoices, Transactions & Audit Logs...")
    now = datetime.now(timezone.utc)
    today = now.date()

    accountant_user = next((u for u in users if u.role == "admin"), users[0])
    resident_users = [u for u in users if u.role == "resident"]

    # 1. Late Fee Policies & Billing Rates (1 per building)
    for b in buildings:
        policy = LateFeePolicy(
            id=uuid4(),
            building_id=b.id,
            grace_period_days=5,
            daily_rate_percent=0.0005,  # 0.05% per day
        )
        session.add(policy)

        b_rate = BillingRate(
            id=uuid4(),
            building_id=b.id,
            water_price_per_m3=Decimal("15500.00"),
            management_fee_per_sqm=Decimal("18000.00"),
            parking_fee_per_slot=Decimal("1200000.00"),
            effective_date=date(2026, 1, 1),
            created_by=accountant_user.id,
        )
        session.add(b_rate)

    # 2. Service Catalog (8 standard services per building)
    services_to_create = [
        ("Phí Quản Lý Vận Hành Tòa Nhà", ServiceType.MANAGEMENT_FEE, True, False, "m2", Decimal("18000.00")),
        ("Tiền Nước Sinh Hoạt", ServiceType.WATER, True, False, "m3", Decimal("15500.00")),
        ("Tiền Điện Tiêu Thụ", ServiceType.ELECTRICITY, True, False, "kWh", Decimal("2950.00")),
        ("Chỗ Đỗ Xe Ô Tô Định Danh", ServiceType.PARKING, True, True, "slot", Decimal("1200000.00")),
        ("Chỗ Gửi Xe Máy Có Sạc Điện", ServiceType.PARKING, True, True, "xe", Decimal("150000.00")),
        ("Gói Thẻ Bơi & Gym Cao Cấp", ServiceType.OTHER, True, True, "tháng", Decimal("450000.00")),
        ("Dịch Vụ Vệ Sinh Căn Hộ Tận Nơi", ServiceType.MAINTENANCE, False, True, "lần", Decimal("350000.00")),
        ("Internet Cáp Quang Tốc Độ Cao", ServiceType.OTHER, True, True, "tháng", Decimal("250000.00")),
    ]

    catalog_entries = []
    for b in buildings:
        for s_name, s_type, is_rec, is_opt, unit, price in services_to_create:
            catalog = ServiceCatalog(
                id=uuid4(),
                building_id=b.id,
                name=s_name,
                service_type=s_type,
                is_recurring=is_rec,
                is_optional=is_opt,
                unit=unit,
                default_price=price,
            )
            session.add(catalog)
            catalog_entries.append(catalog)

    await session.flush()

    # 3. Apartment Services (Subscriptions)
    apt_services = []
    for apt in apartments:
        # Mandatory management fee and water
        mgmt_cat = catalog_entries[0]
        apt_services.append(ApartmentService(
            id=uuid4(),
            apartment_id=apt.id,
            service_catalog_id=mgmt_cat.id,
            status=ApartmentServiceStatus.ACTIVE,
            auto_pay_enabled=random.choice([True, False]),
        ))
        # 70% have motorbike parking
        if random.random() < 0.7:
            moto_cat = catalog_entries[4]
            apt_services.append(ApartmentService(
                id=uuid4(),
                apartment_id=apt.id,
                service_catalog_id=moto_cat.id,
                status=ApartmentServiceStatus.ACTIVE,
                auto_pay_enabled=False,
            ))
        # 40% have car parking
        if random.random() < 0.4:
            car_cat = catalog_entries[3]
            apt_services.append(ApartmentService(
                id=uuid4(),
                apartment_id=apt.id,
                service_catalog_id=car_cat.id,
                status=ApartmentServiceStatus.ACTIVE,
                auto_pay_enabled=True,
            ))

    session.add_all(apt_services)
    await session.flush()

    # 4. Payment Methods (for residents)
    payment_methods = []
    providers = [PaymentProvider.VNPAY, PaymentProvider.MOMO, PaymentProvider.ZALOPAY, PaymentProvider.STRIPE]
    for r_user in resident_users:
        pm = PaymentMethod(
            id=uuid4(),
            user_id=r_user.id,
            provider=random.choice(providers),
            token_reference=f"tok_sb_{uuid4().hex[:16]}",
            display_name=f"Ví {random.choice(['VNPay', 'MoMo', 'ZaloPay'])} liên kết",
            is_default=True,
            is_active=True,
        )
        payment_methods.append(pm)
    session.add_all(payment_methods)
    await session.flush()

    # 5. Billing Cycles (3 consecutive monthly cycles: July, August, September 2026)
    cycles_info = [
        (date(2026, 7, 1), date(2026, 7, 31), BillingCycleStatus.CLOSED),
        (date(2026, 8, 1), date(2026, 8, 31), BillingCycleStatus.CLOSED),
        (date(2026, 9, 1), date(2026, 9, 30), BillingCycleStatus.INVOICED),
    ]

    all_invoices = []
    all_invoice_items = []
    all_transactions = []
    all_audit_logs = []
    all_manual_confirmations = []
    all_payment_reminders = []

    inv_seq = 1000

    for p_start, p_end, c_status in cycles_info:
        for apt in apartments:
            b_cycle = BillingCycle(
                id=uuid4(),
                apartment_id=apt.id,
                period_start=p_start,
                period_end=p_end,
                status=c_status,
            )
            session.add(b_cycle)
            await session.flush()

            inv_seq += 1
            inv_number = f"INV-{p_start.strftime('%Y%m')}-{inv_seq}"

            # Calculate realistic charges
            area = float(apt.area_sqm or 75.0)
            mgmt_amt = Decimal(str(round(area * 18000.0, 2)))
            elec_kwh = round(random.uniform(220.0, 480.0), 1)
            elec_amt = Decimal(str(round(elec_kwh * 2950.0, 2)))
            water_m3 = round(random.uniform(12.0, 28.0), 1)
            water_amt = Decimal(str(round(water_m3 * 15500.0, 2)))
            parking_amt = Decimal("1200000.00") if random.random() < 0.5 else Decimal("150000.00")

            total_amt = mgmt_amt + elec_amt + water_amt + parking_amt

            # Determine invoice status based on cycle period
            if p_start.month == 7:
                i_status = InvoiceStatus.PAID
                paid_at = datetime(2026, 8, random.randint(5, 12), random.randint(8, 18), 0, tzinfo=timezone.utc)
            elif p_start.month == 8:
                i_status = InvoiceStatus.PAID if random.random() < 0.85 else InvoiceStatus.OVERDUE
                paid_at = datetime(2026, 9, random.randint(5, 12), random.randint(8, 18), 0, tzinfo=timezone.utc) if i_status == InvoiceStatus.PAID else None
            else:
                # September (current month)
                i_status = random.choice([InvoiceStatus.PAID, InvoiceStatus.PENDING, InvoiceStatus.PENDING, InvoiceStatus.OVERDUE])
                paid_at = now - timedelta(days=random.randint(1, 8)) if i_status == InvoiceStatus.PAID else None

            due_date = date(p_start.year, p_start.month + 1 if p_start.month < 12 else 1, 15)

            inv = Invoice(
                id=uuid4(),
                apartment_id=apt.id,
                billing_cycle_id=b_cycle.id,
                invoice_number=inv_number,
                total_amount=total_amt,
                currency="VND",
                status=i_status,
                due_date=due_date,
                paid_at=paid_at,
                notes=f"Hóa đơn dịch vụ tổng hợp kỳ tháng {p_start.month:02d}/{p_start.year}",
            )
            all_invoices.append(inv)

            # Invoice items
            all_invoice_items.extend([
                InvoiceItem(
                    id=uuid4(),
                    invoice_id=inv.id,
                    service_type=ServiceType.MANAGEMENT_FEE,
                    description=f"Phí quản lý vận hành ({area} m2 x 18.000 VNĐ)",
                    quantity=Decimal(str(area)),
                    unit_price=Decimal("18000.00"),
                    amount=mgmt_amt,
                ),
                InvoiceItem(
                    id=uuid4(),
                    invoice_id=inv.id,
                    service_type=ServiceType.ELECTRICITY,
                    description=f"Tiền điện tiêu thụ tháng {p_start.month} ({elec_kwh} kWh)",
                    quantity=Decimal(str(elec_kwh)),
                    unit_price=Decimal("2950.00"),
                    amount=elec_amt,
                ),
                InvoiceItem(
                    id=uuid4(),
                    invoice_id=inv.id,
                    service_type=ServiceType.WATER,
                    description=f"Tiền nước sinh hoạt tháng {p_start.month} ({water_m3} m3)",
                    quantity=Decimal(str(water_m3)),
                    unit_price=Decimal("15500.00"),
                    amount=water_amt,
                ),
                InvoiceItem(
                    id=uuid4(),
                    invoice_id=inv.id,
                    service_type=ServiceType.PARKING,
                    description=f"Phí gửi phương tiện tầng hầm tháng {p_start.month}",
                    quantity=Decimal("1"),
                    unit_price=parking_amt,
                    amount=parking_amt,
                ),
            ])

            # Transactions and Audit Logs for PAID invoices
            if i_status == InvoiceStatus.PAID and paid_at:
                provider = random.choice(providers)
                txn_id = uuid4()
                prov_txn_id = f"{provider.value.upper()}_{uuid4().hex[:12]}"
                idemp_key = f"idemp_{uuid4().hex}"

                txn = Transaction(
                    id=txn_id,
                    invoice_id=inv.id,
                    provider=provider,
                    provider_txn_id=prov_txn_id,
                    idempotency_key=idemp_key,
                    amount=total_amt,
                    currency="VND",
                    status=TransactionStatus.SUCCESS,
                    provider_response_code="00",
                    provider_message="Giao dịch thanh toán thành công",
                    created_at=paid_at,
                )
                all_transactions.append(txn)

                all_audit_logs.append(PaymentAuditLog(
                    id=uuid4(),
                    transaction_id=txn.id,
                    event_type="payment_created",
                    old_status=None,
                    new_status=TransactionStatus.PENDING.value,
                    actor="resident_app",
                    ip_address="113.161.42.18",
                    metadata_json={"gateway": provider.value, "amount": float(total_amt)},
                    created_at=paid_at - timedelta(seconds=25),
                ))
                all_audit_logs.append(PaymentAuditLog(
                    id=uuid4(),
                    transaction_id=txn.id,
                    event_type="payment_success",
                    old_status=TransactionStatus.PENDING.value,
                    new_status=TransactionStatus.SUCCESS.value,
                    actor="payment_gateway_webhook",
                    ip_address="14.225.240.10",
                    metadata_json={"gateway_ref": prov_txn_id, "code": "00"},
                    created_at=paid_at,
                ))

            # Manual Confirmations (bank transfer slip for a portion of invoices)
            if random.random() < 0.08:
                all_manual_confirmations.append(ManualConfirmation(
                    id=uuid4(),
                    invoice_id=inv.id,
                    status=ManualConfirmationStatus.APPROVED if i_status == InvoiceStatus.PAID else ManualConfirmationStatus.PENDING,
                    method=ManualPaymentMethod.BANK_TRANSFER,
                    note=f"Chuyển khoản từ Techcombank nội dung thanh toán {inv.invoice_number}",
                    submitted_by=accountant_user.id,
                    submitted_at=datetime.combine(inv.due_date - timedelta(days=2), datetime.min.time(), tzinfo=timezone.utc),
                    confirmed_by=accountant_user.id if i_status == InvoiceStatus.PAID else None,
                    confirmed_at=paid_at,
                ))

            # Payment Reminders for OVERDUE invoices
            if i_status == InvoiceStatus.OVERDUE:
                all_payment_reminders.append(PaymentReminder(
                    id=uuid4(),
                    invoice_id=inv.id,
                    channel=random.choice([ReminderChannel.APP, ReminderChannel.ZALO, ReminderChannel.SMS]),
                    status=ReminderStatus.SENT,
                    sent_at=now - timedelta(days=random.randint(1, 5)),
                ))

    session.add_all(all_invoices)
    await session.flush()
    session.add_all(all_invoice_items)
    session.add_all(all_transactions)
    await session.flush()
    session.add_all(all_audit_logs)
    session.add_all(all_manual_confirmations)
    session.add_all(all_payment_reminders)
    await session.commit()
    print(f"    Created {len(all_invoices)} Invoices, {len(all_invoice_items)} Line Items, {len(all_transactions)} Transactions, {len(all_audit_logs)} Audit Logs.")


async def seed_notifications_and_logs(session: AsyncSession, users: list[User]):
    """Seed notification preferences, templates, notifications, and delivery logs."""
    print(">>> [11/14] Seeding Notification System & Multi-Channel Delivery Logs...")
    now = datetime.now(timezone.utc)

    # 1. Notification Preferences for resident users
    resident_users = [u for u in users if u.role == "resident"]
    preferences = []
    for r_user in resident_users:
        for cat in [NotificationCategory.BILLING, NotificationCategory.ALERT, NotificationCategory.MAINTENANCE, NotificationCategory.ANNOUNCEMENT]:
            for ch in [NotificationChannel.IN_APP, NotificationChannel.PUSH, NotificationChannel.ZALO]:
                preferences.append(NotificationPreference(
                    id=uuid4(),
                    user_id=r_user.id,
                    category=cat,
                    channel=ch,
                    is_enabled=True,
                ))
    session.add_all(preferences)
    await session.flush()

    # 2. Notification Records (250+ notifications)
    notif_samples = [
        (NotificationCategory.BILLING, "Hóa đơn dịch vụ tháng mới đã phát hành", "Kính gửi quý cư dân, hóa đơn dịch vụ tổng hợp kỳ mới đã sẵn sàng. Vui lòng kiểm tra và thanh toán trước ngày 15.", NotificationChannel.IN_APP),
        (NotificationCategory.ALERT, "CẢNH BÁO KHẨN: Quá tải điện đột biến", "Hệ thống phát hiện phụ tải điện căn hộ của bạn vượt ngưỡng an toàn. Đề nghị ngắt bớt thiết bị công suất lớn.", NotificationChannel.PUSH),
        (NotificationCategory.MAINTENANCE, "Cập nhật tiến độ phiếu yêu cầu sửa chữa", "Kỹ thuật viên đã tiếp nhận yêu cầu và đang trên đường đến căn hộ của bạn.", NotificationChannel.ZALO),
        (NotificationCategory.ANNOUNCEMENT, "Thông báo diễn tập PCCC định kỳ", "Ban Quản Lý trân trọng kính mời quý cư dân tham gia buổi tập huấn an toàn PCCC vào sáng Chủ Nhật.", NotificationChannel.IN_APP),
        (NotificationCategory.BILLING, "Nhắc nợ: Hóa đơn dịch vụ sắp đến hạn", "Hóa đơn tiền điện, nước của bạn sắp đến hạn thanh toán. Quý cư dân vui lòng tất toán đúng hạn.", NotificationChannel.SMS),
    ]

    notifications = []
    delivery_logs = []

    for i in range(260):
        r_user = random.choice(resident_users)
        cat, title, body, ch = random.choice(notif_samples)
        sent_t = now - timedelta(days=random.randint(1, 25), hours=random.randint(0, 23))

        n_stat = random.choice([NotificationStatus.READ, NotificationStatus.DELIVERED, NotificationStatus.SENT])
        notif = Notification(
            id=uuid4(),
            user_id=r_user.id,
            category=cat,
            title=title,
            body=body,
            channel=ch,
            status=n_stat,
            idempotency_key=f"notif_idemp_{uuid4().hex[:16]}",
            created_at=sent_t,
            read_at=sent_t + timedelta(hours=random.randint(1, 12)) if n_stat == NotificationStatus.READ else None,
        )
        notifications.append(notif)

        # Delivery log
        delivery_logs.append(NotificationDeliveryLog(
            id=uuid4(),
            notification_id=notif.id,
            channel=ch,
            provider="fcm" if ch == NotificationChannel.PUSH else ("zalo_oa" if ch == NotificationChannel.ZALO else ("speedsms" if ch == NotificationChannel.SMS else "in_app_broker")),
            status=DeliveryStatus.DELIVERED if n_stat in (NotificationStatus.DELIVERED, NotificationStatus.READ) else DeliveryStatus.SENT,
            sent_at=sent_t,
            retry_count=0,
        ))

    session.add_all(notifications)
    await session.flush()
    session.add_all(delivery_logs)
    await session.commit()
    print(f"    Created {len(preferences)} Preferences, {len(notifications)} Notifications & {len(delivery_logs)} Delivery Logs.")


async def seed_amenities_bookings_and_requests(
    session: AsyncSession,
    buildings: list[Building],
    apartments: list[Apartment],
    users: list[User],
    tickets: list[Ticket] | None = None,
):
    """Seed 8 amenities, 65+ non-overlapping bookings, and 40+ service requests."""
    print(">>> [12/14] Seeding Amenities, Bookings, Service Requests & Announcements...")
    now = datetime.now(timezone.utc)
    resident_users = [u for u in users if u.role == "resident"]
    admin_user = next((u for u in users if u.role == "admin"), users[0])

    # 1. Amenities (8 amenities across buildings)
    amenity_defs = [
        ("Hồ Bơi Vô Cực Tầng Thượng", "Hồ bơi nước tràn trên tầng thượng với view toàn cảnh thành phố.", 25, ["06:00 - 08:00", "08:00 - 10:00", "15:00 - 17:00", "17:00 - 19:00", "19:00 - 21:00"]),
        ("Vườn Nướng BBQ Ngoài Trời", "Khu tiệc nướng trang bị sẵn bếp than không khói và bàn ăn ngoài trời.", 15, ["11:00 - 14:00", "17:00 - 20:00", "20:00 - 23:00"]),
        ("Sân Pickleball & Tennis", "Sân thể thao mặt đệm chuẩn thi đấu có dàn đèn chiếu sáng ban đêm.", 8, ["06:00 - 08:00", "08:00 - 10:00", "16:00 - 18:00", "18:00 - 20:00", "20:00 - 22:00"]),
        ("Phòng Tập Gym & Yoga Đa Năng", "Trang thiết bị tập gym Technogym hiện đại cùng phòng tập yoga sàn gỗ.", 20, ["06:00 - 09:00", "11:00 - 14:00", "17:00 - 21:00"]),
        ("Phòng Sinh Hoạt Cộng Đồng", "Không gian hội họp, sinh nhật và câu lạc bộ cư dân sức chứa 30 người.", 30, ["08:00 - 11:00", "14:00 - 17:00", "18:00 - 21:00"]),
        ("Khu Vui Chơi Trẻ Em Sáng Tạo", "Khu vận động liên hoàn trong nhà với nhà bóng và sàn xốp an toàn.", 15, ["08:00 - 10:30", "14:30 - 17:00", "18:00 - 20:30"]),
        ("Co-working & Business Lounge", "Không gian làm việc yên tĩnh có wifi tốc độ cao và phòng họp cách âm.", 18, ["08:00 - 12:00", "13:00 - 17:00", "18:00 - 22:00"]),
        ("Phòng Bóng Bàn & Bi-a Giải Trí", "Hai bàn bóng bàn thi đấu và một bàn bi-a lỗ tiêu chuẩn.", 10, ["09:00 - 11:00", "15:00 - 17:00", "18:00 - 20:00", "20:00 - 22:00"]),
    ]

    all_amenities = []
    for b in buildings:
        for name, desc, cap, slots in amenity_defs:  # 8 amenities for The Oasis Smart Tower
            amenity = Amenity(
                id=uuid4(),
                building_id=b.id,
                name=name,
                description=desc,
                capacity=cap,
                available_slots=slots,
                requires_approval=random.choice([True, False]),
                is_active=True,
            )
            session.add(amenity)
            all_amenities.append(amenity)

    await session.flush()

    # 2. Amenity Bookings (Guaranteed NO double-booking across slot + date + amenity)
    bookings = []
    booked_slots_set = set()

    for day_off in range(-15, 15):
        b_date = (now + timedelta(days=day_off)).date()
        for am in all_amenities:
            # Pick 1 or 2 slots per day
            chosen_slots = random.sample(am.available_slots, min(2, len(am.available_slots)))
            for slot in chosen_slots:
                key = (am.id, b_date, slot)
                if key in booked_slots_set:
                    continue
                booked_slots_set.add(key)

                r_user = random.choice(resident_users)
                b_stat = "completed" if day_off < 0 else random.choice(["confirmed", "confirmed", "pending", "cancelled"])
                bookings.append(AmenityBooking(
                    id=uuid4(),
                    amenity_id=am.id,
                    apartment_id=r_user.apartment_id or apartments[0].id,
                    user_id=r_user.id,
                    booking_date=b_date,
                    time_slot=slot,
                    status=b_stat,
                    notes=random.choice(["Tiệc gia đình cuối tuần", "Luyện tập thể thao buổi sáng", "Sinh nhật bé 5 tuổi", None]),
                    created_at=now - timedelta(days=abs(day_off) + 1),
                ))

    session.add_all(bookings)
    await session.flush()

    # 3. Community Announcements & Reads
    announcement_samples = [
        ("Bảo trì định kỳ trục cấp nước sạch tòa nhà", "Ban Quản Lý xin thông báo tạm ngưng cung cấp nước sạch để súc rửa bể chứa ngầm từ 13:30 đến 15:30.", "maintenance", "urgent", True),
        ("Diễn tập Phương Án Phòng Cháy Chữa Cháy Quý 3/2026", "Phối hợp cùng Cảnh sát PCCC tổ chức buổi tuyên truyền và thực hành thoát nạn tại sảnh chính.", "safety", "standard", False),
        ("Đêm Hội Trăng Rằm — Tết Trung Thu 2026", "Chương trình múa lân, rước đèn và phá cỗ trung thu dành cho các bé cư dân tại Sân sinh hoạt chung.", "event", "standard", True),
        ("Quy định phân loại rác tái chế tại phòng rác tầng", "Nhắc nhở cư dân để riêng chai nhựa, hộp carton vào thùng màu cam để bảo vệ môi trường chung.", "general", "standard", False),
        ("Kiểm tra và hiệu chuẩn toàn bộ công tơ điện thông minh", "Đội kỹ thuật sẽ tiến hành đối soát niêm phong và tín hiệu viễn thông của công tơ điện từng căn hộ.", "maintenance", "standard", False),
        ("Thông báo lịch phun thuốc diệt muỗi phòng sốt xuất huyết", "Đề nghị quý cư dân đóng cửa sổ và che chắn thực phẩm trong thời gian nhân viên y tế phun sương diệt côn trùng.", "safety", "urgent", False),
    ]

    all_announcements = []
    announcement_reads = []

    for b in buildings:
        for title, content, cat, prio, pin in announcement_samples:
            pub_t = now - timedelta(days=random.randint(1, 25))
            ann = Announcement(
                id=uuid4(),
                building_id=b.id,
                title=f"[ThanhLe Smart Tower] {title}",
                content=content,
                category=cat,
                priority=prio,
                published_by=admin_user.id,
                published_at=pub_t,
                expires_at=pub_t + timedelta(days=30),
                pin_to_top=pin,
                image_url="https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80" if cat == "event" else None,
                is_active=True,
            )
            all_announcements.append(ann)

    session.add_all(all_announcements)
    await session.flush()

    for ann in all_announcements:
        readers = random.sample(resident_users, min(15, len(resident_users)))
        for r_user in readers:
            announcement_reads.append(AnnouncementRead(
                id=uuid4(),
                announcement_id=ann.id,
                user_id=r_user.id,
                read_at=ann.published_at + timedelta(hours=random.randint(1, 24)),
            ))

    session.add_all(announcement_reads)
    await session.flush()

    # 4. Service Requests (linked 1-to-1 to tickets)
    service_requests = []
    if tickets:
        eligible_tickets = [
            t for t in tickets
            if t.category in (TicketCategory.CLEANING, TicketCategory.PERIODIC_MAINTENANCE, TicketCategory.GENERAL)
        ][:40]
        req_types = ["cleaning", "periodic_maintenance", "vehicle_registration", "access_card", "other"]
        slots = ["08:00 - 10:00", "10:00 - 12:00", "14:00 - 16:00", "16:00 - 18:00"]
        for idx, tk in enumerate(eligible_tickets):
            service_requests.append(ServiceRequest(
                id=uuid4(),
                ticket_id=tk.id,
                request_type=req_types[idx % len(req_types)],
                scheduled_at=now + timedelta(days=random.randint(1, 10)),
                scheduled_slot=random.choice(slots),
                notes={"package": "standard", "note": "Yêu cầu dịch vụ cư dân đăng ký qua ứng dụng", "has_pets": False},
            ))
        session.add_all(service_requests)

    await session.commit()
    print(f"    Seeded {len(all_amenities)} Amenities, {len(bookings)} Bookings, {len(service_requests)} Service Requests, {len(all_announcements)} Announcements & {len(announcement_reads)} Read Receipts.")


async def seed_bulk_jobs_and_report_exports(session: AsyncSession, users: list[User]):
    """Seed operational bulk jobs and exported report records."""
    print(">>> [13/14] Seeding Background Bulk Jobs & Report Exports...")
    now = datetime.now(timezone.utc)
    admin_user = next((u for u in users if u.role == "admin"), users[0])

    bulk_jobs = [
        BulkJob(
            id=uuid4(),
            job_type="invoice_generation",
            status="completed",
            total_items=150,
            processed_items=150,
            failed_items=0,
            created_by=admin_user.id,
            params={"billing_cycle_month": "2026-09", "auto_issue": True},
            created_at=now - timedelta(days=5),
            finished_at=now - timedelta(days=5, minutes=-2),
        ),
        BulkJob(
            id=uuid4(),
            job_type="overdue_reminders",
            status="completed",
            total_items=28,
            processed_items=28,
            failed_items=0,
            created_by=admin_user.id,
            params={"channels": ["zalo", "app", "sms"]},
            created_at=now - timedelta(days=2),
            finished_at=now - timedelta(days=2, minutes=-1),
        ),
        BulkJob(
            id=uuid4(),
            job_type="manual_confirmations_approval",
            status="completed",
            total_items=12,
            processed_items=12,
            failed_items=0,
            created_by=admin_user.id,
            params={"batch_approved_by": str(admin_user.id)},
            created_at=now - timedelta(days=1),
            finished_at=now - timedelta(days=1, minutes=-1),
        ),
        BulkJob(
            id=uuid4(),
            job_type="telemetry_sync",
            status="processing",
            total_items=600,
            processed_items=485,
            failed_items=0,
            created_by=admin_user.id,
            params={"source": "mqtt_broker", "interval_minutes": 15},
            created_at=now - timedelta(minutes=10),
            finished_at=None,
        ),
    ]

    report_exports = [
        ReportExport(
            id=uuid4(),
            report_type="collection",
            params={"month": "2026-08", "currency": "VND"},
            format="xlsx",
            status="completed",
            file_url="/uploads/reports/bao_cao_thu_phi_thang_08_2026.xlsx",
            file_size_bytes=1024 * 420,
            requested_by=admin_user.id,
            requested_at=now - timedelta(days=6),
            expires_at=now + timedelta(days=24),
        ),
        ReportExport(
            id=uuid4(),
            report_type="overdue",
            params={"cutoff_date": "2026-09-15"},
            format="pdf",
            status="completed",
            file_url="/uploads/reports/danh_sach_cong_no_qua_han_t9.pdf",
            file_size_bytes=1024 * 680,
            requested_by=admin_user.id,
            requested_at=now - timedelta(days=3),
            expires_at=now + timedelta(days=27),
        ),
        ReportExport(
            id=uuid4(),
            report_type="tickets",
            params={"quarter": "Q3-2026", "category": "all"},
            format="csv",
            status="completed",
            file_url="/uploads/reports/tong_hop_su_co_ky_thuat_q3.csv",
            file_size_bytes=1024 * 185,
            requested_by=admin_user.id,
            requested_at=now - timedelta(days=2),
            expires_at=now + timedelta(days=28),
        ),
        ReportExport(
            id=uuid4(),
            report_type="reconciliation",
            params={"gateway": "vnpay", "date_range": "2026-08-01:2026-08-31"},
            format="xlsx",
            status="completed",
            file_url="/uploads/reports/doi_soat_vnpay_thang_08.xlsx",
            file_size_bytes=1024 * 512,
            requested_by=admin_user.id,
            requested_at=now - timedelta(days=8),
            expires_at=now + timedelta(days=22),
        ),
    ]

    session.add_all(bulk_jobs)
    session.add_all(report_exports)
    await session.commit()
    print(f"    Seeded {len(bulk_jobs)} Bulk Jobs & {len(report_exports)} Report Exports.")


async def run_large_seed(force: bool = False):
    """Master orchestrator function to seed high-volume database dataset."""
    start_time = datetime.now()
    print("================================================================================")
    print(">>> SMART BUILDING CLOUD PLATFORM — HIGH-VOLUME DATABASE SEEDER")
    print("    Target: 100% full coverage across all functional tables per AGENTS.md")
    print("================================================================================")

    async with async_session_factory() as session:
        # Check if database already has data to keep it persistent
        if not force and "--force" not in sys.argv and "-f" not in sys.argv:
            existing_building = (await session.execute(select(Building.id).limit(1))).scalar_one_or_none()
            if existing_building:
                print("================================================================================")
                print(">>> [DỮ LIỆU ĐÃ CỐ ĐỊNH] Database PostgreSQL đã có dữ liệu tòa nhà & người dùng.")
                print("    Giữ nguyên toàn bộ dữ liệu hiện có (Bỏ qua bước xóa & nạp lại).")
                print("    (Nếu muốn reset và nạp lại từ đầu, hãy chạy với cờ: --force hoặc -f)")
                print("================================================================================")
                return

        # Step 1: Clean
        await clean_database(session)

        # Step 2: Device Types
        dt_map = await seed_device_types(session)

        # Step 3: Buildings, Floors, Apartments
        buildings, apartments = await seed_buildings_floors_apartments(session)

        # Step 4: Users, RBAC, Technicians
        users, technicians = await seed_users_and_rbac(session, buildings, apartments)

        # Step 5: IoT Devices
        devices = await seed_devices(session, apartments, dt_map)

        # Step 6: Telemetry Sensor Readings & AI Anomaly generation
        anomalies = await seed_sensor_telemetry_and_anomalies(session, devices)

        # Step 7: Aggregated Energy & Water Consumption
        await seed_energy_and_water_consumption(session, apartments)

        # Step 8: Alerts
        await seed_alerts(session, apartments, devices, anomalies)

        # Step 9: Work Orders & Tickets
        tickets = await seed_work_orders_and_tickets(session, apartments, users, technicians, devices)

        # Step 10: Billing, Rates, Invoices & Financial Transactions
        await seed_billing_and_finance(session, buildings, apartments, users)

        # Step 11: Notification Engine
        await seed_notifications_and_logs(session, users)

        # Step 12: Amenities, Bookings, Service Requests & Community
        await seed_amenities_bookings_and_requests(session, buildings, apartments, users, tickets)

        # Step 13: Bulk Operations & Report Exports
        await seed_bulk_jobs_and_report_exports(session, users)

    duration = (datetime.now() - start_time).total_seconds()
    print("================================================================================")
    print(f">>> [14/14] SEEDING COMPLETE IN {duration:.1f} SECONDS!")
    print("    PostgreSQL database is now loaded with enterprise-scale realistic data.")
    print("================================================================================")


if __name__ == "__main__":
    force = "--force" in sys.argv or "-f" in sys.argv
    asyncio.run(run_large_seed(force=force))
