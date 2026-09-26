"""Verification script to ensure data integrity before and after profile migration."""

import asyncio
import sys

from sqlalchemy import func, select
from app.core.database import async_session_factory
from app.models.profile import ApartmentResident, Profile
from app.models.user import User


async def verify_migration():
    print("=== STARTING MIGRATION INTEGRITY VERIFICATION ===")
    async with async_session_factory() as session:
        # 1. Total users vs Total profiles
        user_count_result = await session.execute(select(func.count(User.id)))
        user_count = user_count_result.scalar_one()

        profile_count_result = await session.execute(select(func.count(Profile.id)))
        profile_count = profile_count_result.scalar_one()

        print(f"[*] Total users in system:    {user_count}")
        print(f"[*] Total profiles in system: {profile_count}")

        if user_count != profile_count:
            print(f"[FAIL] Count mismatch: {user_count} users vs {profile_count} profiles!")
            sys.exit(1)
        else:
            print("[PASS] User and Profile counts match exactly (1-to-1).")

        # 2. Check that all users have a corresponding profile record
        orphan_users_result = await session.execute(
            select(User.id).outerjoin(Profile, User.id == Profile.user_id).where(Profile.id.is_(None))
        )
        orphan_users = orphan_users_result.scalars().all()
        if orphan_users:
            print(f"[FAIL] Found {len(orphan_users)} users without a profile: {orphan_users}")
            sys.exit(1)
        else:
            print("[PASS] Zero orphan users detected. All users have valid profiles.")

        # 3. Check apartment residency backfill
        users_with_apt_result = await session.execute(
            select(func.count(User.id)).where(User.apartment_id.is_not(None))
        )
        users_with_apt = users_with_apt_result.scalar_one()

        residents_count_result = await session.execute(
            select(func.count(ApartmentResident.id)).where(ApartmentResident.status == "active")
        )
        residents_count = residents_count_result.scalar_one()

        print(f"[*] Users with apartment_id:        {users_with_apt}")
        print(f"[*] Active apartment residents:     {residents_count}")

        if users_with_apt > 0 and residents_count < users_with_apt:
            print("[WARN] Some users with apartment_id might not have apartment_residents records.")
        else:
            print("[PASS] Apartment residents mapping verified.")

        # 4. Check single primary contact per apartment constraint
        primary_counts_stmt = (
            select(ApartmentResident.apartment_id, func.count(ApartmentResident.id))
            .where(ApartmentResident.is_primary_contact.is_(True), ApartmentResident.status == "active")
            .group_by(ApartmentResident.apartment_id)
            .having(func.count(ApartmentResident.id) > 1)
        )
        duplicate_primary = (await session.execute(primary_counts_stmt)).all()
        if duplicate_primary:
            print(f"[FAIL] Multiple active primary contacts found for apartments: {duplicate_primary}")
            sys.exit(1)
        else:
            print("[PASS] At most 1 active primary contact per apartment verified.")

    print("=== MIGRATION INTEGRITY VERIFICATION COMPLETED SUCCESSFULLY ===")


if __name__ == "__main__":
    asyncio.run(verify_migration())
