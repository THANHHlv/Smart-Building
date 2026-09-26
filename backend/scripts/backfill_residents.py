"""Backfill apartment_residents and technician_profiles from existing database records."""

import asyncio
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

from datetime import datetime, timedelta, timezone
from uuid import uuid4

from sqlalchemy import select, text
from app.core.database import async_session_factory
from app.models.apartment import Apartment
from app.models.profile import (
    ApartmentResident,
    Profile,
    ResidentRelationship,
    ResidentStatus,
    TechnicianProfile,
)
from app.models.ticket import Technician
from app.models.user import User


async def backfill():
    print("=== STARTING RESIDENTS & TECHNICIANS BACKFILL ===")
    now = datetime.now(timezone.utc)
    
    async with async_session_factory() as session:
        # 1. Backfill primary residents from existing users with apartment_id
        user_stmt = (
            select(User)
            .where(User.apartment_id.is_not(None), User.role == "resident")
            .order_by(User.created_at.asc())
        )
        users = (await session.execute(user_stmt)).scalars().all()
        print(f"[*] Found {len(users)} resident users with apartment_id.")

        added_residents = 0
        for i, u in enumerate(users):
            # Check if resident record already exists
            check_stmt = select(ApartmentResident).where(
                ApartmentResident.apartment_id == u.apartment_id,
                ApartmentResident.user_id == u.id,
            )
            existing = (await session.execute(check_stmt)).scalar_one_or_none()
            if not existing:
                rel = ResidentRelationship.TENANT if i % 4 == 1 else ResidentRelationship.OWNER
                resident_record = ApartmentResident(
                    id=uuid4(),
                    apartment_id=u.apartment_id,
                    user_id=u.id,
                    relationship=rel,
                    is_primary_contact=True,
                    moved_in_at=u.created_at or (now - timedelta(days=180 + i * 2)),
                    status=ResidentStatus.ACTIVE,
                    created_at=u.created_at or now,
                    updated_at=u.updated_at or now,
                )
                session.add(resident_record)
                added_residents += 1

        await session.flush()
        print(f"[+] Added {added_residents} active primary resident records.")

        # 2. Add some secondary family members / co-tenants to demonstrate N-N relationships
        # We can add a few family members for the first 5 apartments
        if len(users) >= 5:
            # Check if family demo users exist, if not create a couple
            sample_apts = [u.apartment_id for u in users[:4]]
            family_names = [
                ("Nguyễn Văn Hùng", "hung.nguyen.fam@smartbuilding.io", "0912345601", ResidentRelationship.FAMILY_MEMBER),
                ("Lê Thị Mai", "mai.le.fam@smartbuilding.io", "0912345602", ResidentRelationship.FAMILY_MEMBER),
                ("Trần Đức Anh", "anh.tran.fam@smartbuilding.io", "0912345603", ResidentRelationship.FAMILY_MEMBER),
                ("Hoàng Minh Tuấn", "tuan.hoang.tenant@smartbuilding.io", "0912345604", ResidentRelationship.TENANT),
            ]

            for apt_id, (fam_name, fam_email, fam_phone, rel) in zip(sample_apts, family_names):
                existing_user = (await session.execute(select(User).where(User.email == fam_email))).scalar_one_or_none()
                if not existing_user:
                    fam_user = User(
                        id=uuid4(),
                        email=fam_email,
                        phone=fam_phone,
                        role="resident",
                        apartment_id=apt_id,
                        is_active=True,
                        is_superuser=False,
                    )
                    from app.core.security import hash_password
                    fam_user.hashed_password = hash_password("123456")
                    session.add(fam_user)
                    await session.flush()

                    fam_profile = Profile(
                        user_id=fam_user.id,
                        full_name=fam_name,
                        emergency_contact_name=fam_name,
                        emergency_contact_phone=fam_phone,
                    )
                    session.add(fam_profile)
                    await session.flush()

                    fam_res = ApartmentResident(
                        id=uuid4(),
                        apartment_id=apt_id,
                        user_id=fam_user.id,
                        relationship=rel,
                        is_primary_contact=False,
                        moved_in_at=now - timedelta(days=120),
                        status=ResidentStatus.ACTIVE,
                    )
                    session.add(fam_res)
                    print(f"[+] Added secondary resident: {fam_name} ({rel.value})")

        # 3. Add 2 historical moved-out records to demonstrate historical audit preservation
        if len(users) >= 7:
            moved_out_demos = [
                ("Vũ Đình Khoa (Cựu cư dân)", "khoa.vu.movedout@smartbuilding.io", "0934567890", users[5].apartment_id),
                ("Đặng Thu Thảo (Cựu người thuê)", "thao.dang.movedout@smartbuilding.io", "0934567891", users[6].apartment_id),
            ]
            for mo_name, mo_email, mo_phone, mo_apt_id in moved_out_demos:
                existing_mo_user = (await session.execute(select(User).where(User.email == mo_email))).scalar_one_or_none()
                if not existing_mo_user:
                    from app.core.security import hash_password
                    mo_user = User(
                        id=uuid4(),
                        email=mo_email,
                        phone=mo_phone,
                        role="resident",
                        apartment_id=None,
                        is_active=False,
                        is_superuser=False,
                    )
                    mo_user.hashed_password = hash_password("123456")
                    session.add(mo_user)
                    await session.flush()

                    mo_profile = Profile(
                        user_id=mo_user.id,
                        full_name=mo_name,
                    )
                    session.add(mo_profile)
                    await session.flush()

                    mo_res = ApartmentResident(
                        id=uuid4(),
                        apartment_id=mo_apt_id,
                        user_id=mo_user.id,
                        relationship=ResidentRelationship.TENANT,
                        is_primary_contact=False,
                        moved_in_at=now - timedelta(days=360),
                        moved_out_at=now - timedelta(days=45),
                        status=ResidentStatus.MOVED_OUT,
                    )
                    session.add(mo_res)
                    print(f"[+] Added moved-out resident history: {mo_name}")

        # 4. Backfill technician_profiles from technicians table
        tech_stmt = select(Technician)
        technicians = (await session.execute(tech_stmt)).scalars().all()
        print(f"[*] Found {len(technicians)} technicians.")

        added_tech_profiles = 0
        for t in technicians:
            check_tp = (
                await session.execute(
                    select(TechnicianProfile).where(TechnicianProfile.user_id == t.user_id)
                )
            ).scalar_one_or_none()
            if not check_tp:
                certs = "Chứng chỉ Kỹ thuật Tòa nhà BQL, An toàn Lao động & Vận hành Điện"
                tp = TechnicianProfile(
                    id=uuid4(),
                    user_id=t.user_id,
                    specialties=t.specialties or ["general"],
                    certification_info=certs,
                    active_building_ids=[],
                )
                session.add(tp)
                added_tech_profiles += 1

        print(f"[+] Added {added_tech_profiles} technician profiles.")

        await session.commit()
        print("=== BACKFILL COMPLETED AND COMMITTED SUCCESSFULLY ===")


if __name__ == "__main__":
    asyncio.run(backfill())
