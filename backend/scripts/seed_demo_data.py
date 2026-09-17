"""Seed realistic demo data for Smart Building Cloud Platform."""

import asyncio
from pathlib import Path
import random
import sys
from datetime import datetime, timedelta, timezone
from uuid import uuid4

# Ensure backend root is on sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import async_session_factory, engine
from app.core.security import hash_password
from app.models.alert import Alert, AlertSeverity, AlertStatus
from app.models.apartment import Apartment
from app.models.building import Building
from app.models.device import Device, DeviceStatus
from app.models.device_type import DeviceType
from app.models.energy_consumption import EnergyConsumption
from app.models.floor import Floor
from app.models.rbac import Role, UserRole
from app.models.sensor_reading import SensorReading
from app.models.ticket import (
    Technician,
    Ticket,
    TicketAttachment,
    TicketComment,
    TicketPriority,
    TicketSource,
    TicketStatus,
    TicketStatusHistory,
)
from app.models.user import User
from app.models.water_consumption import WaterConsumption


async def seed_data():
    """Populate database with rich demo buildings, devices, readings, alerts, and work orders."""
    print(">>> Starting Demo Data Seeder...")

    async with async_session_factory() as session:
        # 1. Clean existing records in reverse dependency order
        print("[1/9] Cleaning old demo data...")
        await session.execute(delete(UserRole))
        await session.execute(delete(TicketStatusHistory))
        await session.execute(delete(TicketComment))
        await session.execute(delete(TicketAttachment))
        await session.execute(delete(Ticket))
        await session.execute(delete(Technician))
        await session.execute(delete(SensorReading))

        await session.execute(delete(EnergyConsumption))
        await session.execute(delete(WaterConsumption))
        await session.execute(delete(Alert))
        await session.execute(delete(Device))
        await session.execute(delete(DeviceType))
        await session.execute(delete(User))
        await session.execute(delete(Apartment))
        await session.execute(delete(Floor))
        await session.execute(delete(Building))
        await session.commit()

        # 2. Create Device Types
        print("[2/6] Creating Device Types...")
        device_types = [
            DeviceType(
                id=uuid4(),
                code="elec_meter",
                name="Smart Electricity Meter",
                description="Measures real-time electrical active power draw",
                unit="kW",
            ),
            DeviceType(
                id=uuid4(),
                code="water_meter",
                name="Ultrasonic Water Meter",
                description="Measures instantaneous water flow rate",
                unit="L/min",
            ),
            DeviceType(
                id=uuid4(),
                code="temp_sensor",
                name="Digital Ambient Thermometer",
                description="Monitors indoor ambient temperature",
                unit="°C",
            ),
            DeviceType(
                id=uuid4(),
                code="humidity_sensor",
                name="Relative Humidity Sensor",
                description="Monitors indoor air relative humidity",
                unit="%",
            ),
            DeviceType(
                id=uuid4(),
                code="smoke_detector",
                name="Photoelectric Smoke Detector",
                description="Detects smoke particle density",
                unit="ppm",
            ),
        ]
        session.add_all(device_types)
        await session.flush()
        dt_map = {dt.code: dt for dt in device_types}

        # 3. Create Buildings & Floors & Apartments
        print("[3/6] Creating Buildings, Floors, and Apartments...")
        buildings_data = [
            {
                "name": "Skyline Tower",
                "address": "88 Innovation Blvd, District 1",
                "description": "High-tech commercial & residential smart tower",
                "total_floors": 3,
                "floors": [
                    {"floor_number": 1, "units": ["101", "102"]},
                    {"floor_number": 2, "units": ["201", "202"]},
                    {"floor_number": 3, "units": ["301", "302"]},
                ],
            },
            {
                "name": "Green Oasis",
                "address": "12 Eco Valley Road, District 2",
                "description": "Sustainable low-energy smart community",
                "total_floors": 2,
                "floors": [
                    {"floor_number": 1, "units": ["101", "102"]},
                    {"floor_number": 2, "units": ["201", "202"]},
                ],
            },
        ]

        apartments = []
        resident_names = [
            "Nguyen Van An", "Tran Thi Mai", "Le Hoang Nam", "Pham Thu Huong",
            "Doan Minh Tri", "Vuong Bich Ngoc", "Hoang Gia Huy", "Dang My Linh",
            "Bui Tien Dung", "Truong Thao Nhi"
        ]
        res_idx = 0

        for b_data in buildings_data:
            building = Building(
                id=uuid4(),
                name=b_data["name"],
                address=b_data["address"],
                description=b_data["description"],
                total_floors=b_data["total_floors"],
            )
            session.add(building)
            await session.flush()

            for f_data in b_data["floors"]:
                floor = Floor(
                    id=uuid4(),
                    building_id=building.id,
                    floor_number=f_data["floor_number"],
                )
                session.add(floor)
                await session.flush()

                for unit in f_data["units"]:
                    apt = Apartment(
                        id=uuid4(),
                        floor_id=floor.id,
                        unit_number=unit,
                        area_sqm=round(random.uniform(65.0, 110.0), 1),
                        num_rooms=random.randint(2, 4),
                        resident_name=resident_names[res_idx % len(resident_names)],
                    )
                    res_idx += 1
                    session.add(apt)
                    apartments.append((apt, b_data["name"]))

        await session.flush()
        print(f"   Created {len(buildings_data)} buildings, {len(apartments)} apartments.")

        # 4. Create Devices across apartments
        print("[4/6] Registering IoT Devices...")
        devices = []
        now = datetime.now(timezone.utc)

        for apt, b_name in apartments:
            prefix = "sky" if "Skyline" in b_name else "oasis"
            # Electricity Meter
            elec_dev = Device(
                id=uuid4(),
                apartment_id=apt.id,
                device_type_id=dt_map["elec_meter"].id,
                device_code=f"elec-{prefix}-{apt.unit_number}",
                name=f"Power Meter Apt {apt.unit_number} ({b_name})",
                status=DeviceStatus.ONLINE,
                last_seen_at=now,
            )
            devices.append(elec_dev)

            # Water Meter
            water_dev = Device(
                id=uuid4(),
                apartment_id=apt.id,
                device_type_id=dt_map["water_meter"].id,
                device_code=f"water-{prefix}-{apt.unit_number}",
                name=f"Water Meter Apt {apt.unit_number} ({b_name})",
                status=DeviceStatus.ONLINE,
                last_seen_at=now,
            )
            devices.append(water_dev)

            # Temp/Humidity in selected apartments
            if apt.unit_number in ["101", "201"]:
                temp_dev = Device(
                    id=uuid4(),
                    apartment_id=apt.id,
                    device_type_id=dt_map["temp_sensor"].id,
                    device_code=f"temp-{prefix}-{apt.unit_number}",
                    name=f"Climate Sensor Apt {apt.unit_number}",
                    status=DeviceStatus.ONLINE,
                    last_seen_at=now,
                )
                devices.append(temp_dev)

        # Make one device offline and one in maintenance for realism
        if devices:
            devices[-1].status = DeviceStatus.MAINTENANCE
            devices[-2].status = DeviceStatus.OFFLINE

        session.add_all(devices)
        await session.flush()
        print(f"   Registered {len(devices)} IoT devices.")

        # 5. Generate 24 hours of realistic historical Sensor Readings
        print("[5/6] Generating 24-hour historical sensor telemetry...")
        readings = []
        # Generate hourly readings for past 24 hours
        for hour_offset in range(24, -1, -1):
            timestamp = now - timedelta(hours=hour_offset)
            h = timestamp.hour

            # Diurnal curve factor
            if 7 <= h <= 9:
                load_factor = 1.6  # Morning rush
            elif 18 <= h <= 22:
                load_factor = 1.9  # Evening peak
            elif 0 <= h <= 5:
                load_factor = 0.4  # Night quiet
            else:
                load_factor = 1.0  # Normal daytime

            for dev in devices:
                if dev.status == DeviceStatus.OFFLINE:
                    continue

                if "elec" in dev.device_code:
                    kw = round(max(0.3, random.uniform(0.9, 2.3) * load_factor + random.gauss(0, 0.15)), 2)
                    readings.append(
                        SensorReading(
                            id=uuid4(),
                            device_id=dev.id,
                            timestamp=timestamp,
                            metric="electricity",
                            value=kw,
                            unit="kW",
                        )
                    )
                elif "water" in dev.device_code:
                    active = random.random() < (0.8 if 6 <= h <= 23 else 0.15)
                    flow = round(random.uniform(1.2, 7.5) * load_factor, 1) if active else 0.0
                    readings.append(
                        SensorReading(
                            id=uuid4(),
                            device_id=dev.id,
                            timestamp=timestamp,
                            metric="water",
                            value=flow,
                            unit="L/min",
                        )
                    )
                elif "temp" in dev.device_code:
                    temp_val = round(23.5 + 1.5 * ((h - 6) / 12) + random.gauss(0, 0.2), 1)
                    readings.append(
                        SensorReading(
                            id=uuid4(),
                            device_id=dev.id,
                            timestamp=timestamp,
                            metric="temperature",
                            value=temp_val,
                            unit="°C",
                        )
                    )

        session.add_all(readings)
        await session.flush()
        print(f"   Generated {len(readings)} sensor reading data points.")

        # 6. Create realistic Alerts
        print("[6/6] Seeding realistic security & anomaly Alerts...")
        sample_alerts = [
            Alert(
                id=uuid4(),
                device_id=devices[0].id,
                apartment_id=devices[0].apartment_id,
                severity=AlertSeverity.CRITICAL,
                status=AlertStatus.OPEN,
                title=f"CRITICAL: Extreme Load Anomaly on {devices[0].device_code} (18.4 kW)",
                message="Sudden power surge detected exceeding peak rated threshold by 320%. Isolation Forest anomaly score: 0.94.",
                source="ai_anomaly_detector",
                created_at=now - timedelta(minutes=15),
            ),
            Alert(
                id=uuid4(),
                device_id=devices[1].id,
                apartment_id=devices[1].apartment_id,
                severity=AlertSeverity.HIGH,
                status=AlertStatus.OPEN,
                title=f"HIGH: Uncontrolled Continuous Flow on {devices[1].device_code} (24.0 L/min)",
                message="Continuous high water volume for > 45 minutes during quiet hours. Probable valve leakage or burst pipe.",
                source="water_flow_monitor",
                created_at=now - timedelta(hours=1, minutes=30),
            ),
            Alert(
                id=uuid4(),
                device_id=devices[-2].id,
                apartment_id=devices[-2].apartment_id,
                severity=AlertSeverity.MEDIUM,
                status=AlertStatus.ACKNOWLEDGED,
                title=f"MEDIUM: Gateway Heartbeat Timeout: {devices[-2].device_code}",
                message="Device has missed 6 consecutive polling intervals. Unit marked as OFFLINE.",
                source="device_heartbeat_service",
                created_at=now - timedelta(hours=3),
            ),
            Alert(
                id=uuid4(),
                device_id=devices[-1].id,
                apartment_id=devices[-1].apartment_id,
                severity=AlertSeverity.LOW,
                status=AlertStatus.RESOLVED,
                title=f"INFO: Routine Calibration Due for {devices[-1].device_code}",
                message="Annual sensor sensitivity calibration check completed successfully.",
                source="maintenance_scheduler",
                created_at=now - timedelta(days=1),
                resolved_at=now - timedelta(hours=4),
            ),
        ]
        session.add_all(sample_alerts)
        await session.commit()
        # 7. Create Admin and Resident accounts
        print("[7/7] Seeding Admin & Resident User Accounts...")
        apt_301 = next((a for a, b in apartments if a.unit_number == "301" and "Skyline" in b), apartments[0][0])
        apt_101 = next((a for a, b in apartments if a.unit_number == "101" and "Skyline" in b), apartments[1][0])
        apt_202 = next((a for a, b in apartments if a.unit_number == "202" and "Skyline" in b), apartments[2][0])

        # Define specific named user accounts
        admin_user = User(
            id=uuid4(),
            email="admin@smartbuilding.io",
            hashed_password=hash_password("admin123"),
            full_name="Nguyễn Quản Trị (Super Admin)",
            role="admin",
            apartment_id=None,
            is_superuser=True,
            is_active=True,
        )
        bql_user = User(
            id=uuid4(),
            email="bql.oasis@smartbuilding.io",
            hashed_password=hash_password("bql123"),
            full_name="Hoàng Văn Nam (Trưởng BQL The Oasis)",
            role="admin",
            apartment_id=None,
            is_superuser=False,
            is_active=True,
        )
        accountant_user = User(
            id=uuid4(),
            email="accountant@smartbuilding.io",
            hashed_password=hash_password("accountant123"),
            full_name="Nguyễn Thu Hà (Kế toán BQL)",
            role="admin",
            apartment_id=None,
            is_superuser=False,
            is_active=True,
        )
        res_301 = User(
            id=uuid4(),
            email="resident.apt301@smartbuilding.io",
            hashed_password=hash_password("resident123"),
            full_name="Nguyễn Văn An (Căn 301)",
            role="resident",
            apartment_id=apt_301.id,
            is_superuser=False,
            is_active=True,
        )
        res_101 = User(
            id=uuid4(),
            email="resident.apt101@smartbuilding.io",
            hashed_password=hash_password("resident123"),
            full_name="Trần Thị Mai (Căn 101)",
            role="resident",
            apartment_id=apt_101.id,
            is_superuser=False,
            is_active=True,
        )
        res_202 = User(
            id=uuid4(),
            email="resident.apt202@smartbuilding.io",
            hashed_password=hash_password("resident123"),
            full_name="Lê Hoàng Nam (Căn 202)",
            role="resident",
            apartment_id=apt_202.id,
            is_superuser=False,
            is_active=True,
        )
        tech_elec_user = User(
            id=uuid4(),
            email="tech.electrical@smartbuilding.io",
            hashed_password=hash_password("tech123"),
            full_name="Trần Kỹ Thuật (Điện & Chiếu sáng)",
            role="technician",
            apartment_id=None,
            is_superuser=False,
            is_active=True,
        )
        tech_water_user = User(
            id=uuid4(),
            email="tech.plumbing@smartbuilding.io",
            hashed_password=hash_password("tech123"),
            full_name="Lê Thợ Nước (Cấp thoát nước & PCCC)",
            role="technician",
            apartment_id=None,
            is_superuser=False,
            is_active=True,
        )
        tech_hvac_user = User(
            id=uuid4(),
            email="tech.hvac@smartbuilding.io",
            hashed_password=hash_password("tech123"),
            full_name="Phạm Cơ Điện (Thang máy & HVAC)",
            role="technician",
            apartment_id=None,
            is_superuser=False,
            is_active=True,
        )

        users = [
            admin_user,
            bql_user,
            accountant_user,
            res_301,
            res_101,
            res_202,
            tech_elec_user,
            tech_water_user,
            tech_hvac_user,
        ]
        session.add_all(users)
        await session.commit()
        print(f"   Created {len(users)} demo accounts (1 Super Admin, 1 Building Admin, 1 Accountant, 3 Residents, 3 Technicians).")

        # 8. Create Technicians profiles
        print("[8/8] Seeding Technicians & Sample Work Order Tickets...")
        admin_user = users[0]
        res_301 = users[1]
        tech_elec_user = users[4]
        tech_water_user = users[5]
        tech_hvac_user = users[6]

        tech_elec = Technician(
            id=uuid4(),
            user_id=tech_elec_user.id,
            specialties=["electrical", "lighting", "fire_safety"],
            is_active=True,
            phone_number="0901234567",
        )
        tech_water = Technician(
            id=uuid4(),
            user_id=tech_water_user.id,
            specialties=["water", "fire_safety", "plumbing"],
            is_active=True,
            phone_number="0902345678",
        )
        tech_hvac = Technician(
            id=uuid4(),
            user_id=tech_hvac_user.id,
            specialties=["elevator", "hvac", "ventilation"],
            is_active=True,
            phone_number="0903456789",
        )
        session.add_all([tech_elec, tech_water, tech_hvac])
        await session.flush()

        # Create sample tickets across statuses
        t1_id = uuid4()
        t2_id = uuid4()
        t3_id = uuid4()
        t4_id = uuid4()

        sample_tickets = [
            # Ticket 1: AI Anomaly on electrical meter (Critical -> Assigned)
            Ticket(
                id=t1_id,
                source=TicketSource.AI_ANOMALY,
                apartment_id=apt_301.id,
                device_id=devices[0].id,
                category="electrical",
                priority=TicketPriority.CRITICAL,
                status=TicketStatus.ASSIGNED,
                title=f"[AI Cảnh Báo] Quá tải điện đột biến tại Căn 301 ({devices[0].device_code})",
                description="[HỆ THỐNG TỰ ĐỘNG PHÁT HIỆN BẤT THƯỜNG - AI ANOMALY DETECTION]\n- Cảnh báo: Công suất tiêu thụ 18.4 kW vượt 320% ngưỡng định mức.\n- Isolation Forest Anomaly Score: 0.94\n- Nguy cơ chập cháy aptomat tầng.",
                created_by=None,
                assigned_to=tech_elec.id,
                due_at=now + timedelta(hours=1, minutes=30),
                created_at=now - timedelta(minutes=30),
            ),
            # Ticket 2: Resident Report on water leak (High -> In Progress)
            Ticket(
                id=t2_id,
                source=TicketSource.RESIDENT_REPORT,
                apartment_id=apt_301.id,
                device_id=devices[1].id if len(devices) > 1 else None,
                category="water",
                priority=TicketPriority.HIGH,
                status=TicketStatus.IN_PROGRESS,
                title="Rò rỉ van cấp nước phòng tắm Master",
                description="Van khóa dưới bồn rửa mặt bị rỉ nước liên tục xuống sàn gỗ. Cần thợ kiểm tra thay gioăng cao su khẩn cấp.",
                created_by=res_301.id,
                assigned_to=tech_water.id,
                due_at=now + timedelta(hours=3),
                created_at=now - timedelta(hours=1),
            ),
            # Ticket 3: Resident Report (Medium -> Open)
            Ticket(
                id=t3_id,
                source=TicketSource.RESIDENT_REPORT,
                apartment_id=apt_301.id,
                device_id=None,
                category="electrical",
                priority=TicketPriority.MEDIUM,
                status=TicketStatus.OPEN,
                title="Đèn trần ban công không sáng",
                description="Bật công tắc nhưng bóng đèn led ban công nhấp nháy rồi tắt hẳn, nhờ kỹ thuật kiểm tra đuôi đèn.",
                created_by=res_301.id,
                assigned_to=None,
                due_at=now + timedelta(hours=22),
                created_at=now - timedelta(hours=2),
            ),
            # Ticket 4: Admin Routine Maintenance (Medium -> Resolved & Rated)
            Ticket(
                id=t4_id,
                source=TicketSource.MANUAL_ADMIN,
                apartment_id=apt_202.id,
                device_id=None,
                category="hvac",
                priority=TicketPriority.MEDIUM,
                status=TicketStatus.RESOLVED,
                title="Bảo dưỡng định kỳ lưới lọc điều hòa trung tâm",
                description="Vệ sinh dàn lạnh và kiểm tra lượng gas điều hòa định kỳ quý 3.",
                created_by=admin_user.id,
                assigned_to=tech_hvac.id,
                due_at=now - timedelta(hours=2),
                created_at=now - timedelta(days=1),
                resolved_at=now - timedelta(hours=4),
                rating=5,
                rating_comment="Kỹ thuật viên thao tác sạch sẽ, điều hòa chạy êm mát.",
            ),
        ]
        session.add_all(sample_tickets)
        await session.flush()

        # Add sample history & comments
        history_records = [
            TicketStatusHistory(
                ticket_id=t1_id,
                from_status=None,
                to_status=TicketStatus.OPEN.value,
                changed_by=None,
                note="Tự động phát hiện từ cảnh báo AI Anomaly",
                changed_at=now - timedelta(minutes=30),
            ),
            TicketStatusHistory(
                ticket_id=t1_id,
                from_status=TicketStatus.OPEN.value,
                to_status=TicketStatus.ASSIGNED.value,
                changed_by=admin_user.id,
                note=f"Phân công cho kỹ thuật viên {tech_elec_user.full_name}",
                changed_at=now - timedelta(minutes=20),
            ),
            TicketStatusHistory(
                ticket_id=t2_id,
                from_status=None,
                to_status=TicketStatus.OPEN.value,
                changed_by=res_301.id,
                note="Cư dân tạo yêu cầu qua ứng dụng",
                changed_at=now - timedelta(hours=1),
            ),
            TicketStatusHistory(
                ticket_id=t2_id,
                from_status=TicketStatus.OPEN.value,
                to_status=TicketStatus.ASSIGNED.value,
                changed_by=admin_user.id,
                note=f"Phân công cho {tech_water_user.full_name}",
                changed_at=now - timedelta(minutes=45),
            ),
            TicketStatusHistory(
                ticket_id=t2_id,
                from_status=TicketStatus.ASSIGNED.value,
                to_status=TicketStatus.IN_PROGRESS.value,
                changed_by=tech_water_user.id,
                note="Đã có mặt tại căn hộ 301 bắt đầu kiểm tra van",
                changed_at=now - timedelta(minutes=15),
            ),
        ]
        session.add_all(history_records)

        sample_comments = [
            TicketComment(
                ticket_id=t2_id,
                author_id=tech_water_user.id,
                comment="Tôi đã chuẩn bị bộ gioăng và khóa van phụ, khoảng 10 phút nữa sẽ bấm chuông căn 301.",
                is_internal=False,
                created_at=now - timedelta(minutes=25),
            ),
            TicketComment(
                ticket_id=t2_id,
                author_id=tech_water_user.id,
                comment="Ghi chú kỹ thuật: Cần lưu ý đường ống mềm ren 21 có dấu hiệu lão hóa, đề xuất thay dây mềm chịu áp.",
                is_internal=True,
                created_at=now - timedelta(minutes=10),
            ),
        ]
        session.add_all(sample_comments)
        await session.commit()
        print(f"   Created {len(sample_tickets)} sample tickets, 3 technicians, comments & audit history.")

        # 9. Bind User Roles (RBAC)
        print("[9/9] Binding RBAC User Roles...")
        roles_res = (await session.execute(select(Role))).scalars().all()
        role_lookup = {r.name: r.id for r in roles_res}

        bql_user = users[7]
        accountant_user = users[8]

        user_role_mappings = [
            # Super Admin
            UserRole(id=uuid4(), user_id=admin_user.id, role_id=role_lookup["super_admin"], building_id=None, granted_at=now),
            # Building Admin (Scoped to Oasis Building)
            UserRole(id=uuid4(), user_id=bql_user.id, role_id=role_lookup["building_admin"], building_id=building.id, granted_at=now),
            # Accountant
            UserRole(id=uuid4(), user_id=accountant_user.id, role_id=role_lookup["accountant"], building_id=building.id, granted_at=now),
            # Technicians
            UserRole(id=uuid4(), user_id=tech_elec_user.id, role_id=role_lookup["technician"], building_id=building.id, granted_at=now),
            UserRole(id=uuid4(), user_id=tech_water_user.id, role_id=role_lookup["technician"], building_id=building.id, granted_at=now),
            UserRole(id=uuid4(), user_id=tech_hvac_user.id, role_id=role_lookup["technician"], building_id=building.id, granted_at=now),
            # Residents
            UserRole(id=uuid4(), user_id=users[1].id, role_id=role_lookup["resident"], building_id=building.id, granted_at=now),
            UserRole(id=uuid4(), user_id=users[2].id, role_id=role_lookup["resident"], building_id=building.id, granted_at=now),
            UserRole(id=uuid4(), user_id=users[3].id, role_id=role_lookup["resident"], building_id=building.id, granted_at=now),
        ]
        session.add_all(user_role_mappings)
        await session.commit()
        print(f"   Assigned {len(user_role_mappings)} RBAC user role permissions.")

    print("[SUCCESS] Demo Data Seeding Complete! PostgreSQL database is now primed for live demo.")



if __name__ == "__main__":
    asyncio.run(seed_data())
