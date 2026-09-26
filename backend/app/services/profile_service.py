"""Profile, Resident Management, and Technician Profile services."""

import uuid
from datetime import datetime, timezone
from typing import Sequence

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.logging import get_logger
from app.core.security import hash_password
from app.models.apartment import Apartment
from app.models.building import Building
from app.models.floor import Floor
from app.models.profile import (
    ApartmentResident,
    Profile,
    ResidentRelationship,
    ResidentStatus,
    TechnicianProfile,
)
from app.models.ticket import Technician
from app.models.user import User
from app.schemas.profile import (
    AdminCreateResidentRequest,
    AdminResidentItemResponse,
    AdminUpdateResidentRequest,
    ResidentApartmentResponse,
    TechnicianProfileResponse,
    TechnicianProfileUpdateRequest,
    UserProfileResponse,
    UserProfileUpdateRequest,
)

logger = get_logger(__name__)


class ProfileService:
    """Business logic for User Profiles, Resident Assignments, and Technicians."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_or_create_profile(self, user: User) -> Profile:
        """Fetch profile for user or auto-create if missing."""
        stmt = select(Profile).where(Profile.user_id == user.id)
        result = await self.db.execute(stmt)
        prof = result.scalar_one_or_none()

        if not prof:
            prof = Profile(
                user_id=user.id,
                full_name=getattr(user, "full_name", None),
            )
            self.db.add(prof)
            await self.db.commit()
            await self.db.refresh(prof)

        return prof

    async def get_user_profile_response(self, user: User) -> UserProfileResponse:
        """Assemble complete UserProfileResponse for the user."""
        prof = await self.get_or_create_profile(user)
        return UserProfileResponse(
            id=prof.id,
            user_id=user.id,
            email=user.email,
            phone=user.phone,
            role=user.role,
            full_name=prof.full_name,
            date_of_birth=prof.date_of_birth,
            gender=prof.gender,
            avatar_url=prof.avatar_url,
            national_id_masked=prof.national_id_masked,
            emergency_contact_name=prof.emergency_contact_name,
            emergency_contact_phone=prof.emergency_contact_phone,
            is_active=user.is_active,
            is_verified=user.is_verified,
            created_at=prof.created_at,
            updated_at=prof.updated_at,
        )

    async def update_user_profile(
        self, user: User, payload: UserProfileUpdateRequest
    ) -> UserProfileResponse:
        """Update personal profile and emergency contact details."""
        prof = await self.get_or_create_profile(user)

        # Update auth phone if changed
        if payload.phone is not None:
            user.phone = payload.phone

        # Update profile fields
        if payload.full_name is not None:
            prof.full_name = payload.full_name.strip()
        if payload.date_of_birth is not None:
            prof.date_of_birth = payload.date_of_birth
        if payload.gender is not None:
            prof.gender = payload.gender
        if payload.national_id is not None:
            prof.national_id_masked = payload.national_id
        if payload.emergency_contact_name is not None:
            prof.emergency_contact_name = payload.emergency_contact_name.strip()
        if payload.emergency_contact_phone is not None:
            prof.emergency_contact_phone = payload.emergency_contact_phone

        await self.db.commit()
        await self.db.refresh(prof)
        await self.db.refresh(user)

        return await self.get_user_profile_response(user)

    async def update_avatar_url(self, user: User, avatar_url: str) -> str:
        """Set avatar URL for user's profile."""
        prof = await self.get_or_create_profile(user)
        prof.avatar_url = avatar_url
        await self.db.commit()
        return avatar_url

    # -------------------------------------------------------------------------
    # Apartment Residencies
    # -------------------------------------------------------------------------

    async def get_user_apartments(self, user_id: uuid.UUID) -> list[ResidentApartmentResponse]:
        """Fetch all apartments linked to user with physical details."""
        stmt = (
            select(ApartmentResident)
            .options(
                selectinload(ApartmentResident.apartment)
                .selectinload(Apartment.floor)
                .selectinload(Floor.building)
            )
            .where(ApartmentResident.user_id == user_id)
            .order_by(
                ApartmentResident.status.asc(),
                ApartmentResident.is_primary_contact.desc(),
                ApartmentResident.created_at.desc(),
            )
        )
        result = await self.db.execute(stmt)
        residencies = result.scalars().all()

        response = []
        for r in residencies:
            apt = r.apartment
            flr = apt.floor if apt else None
            bld = flr.building if flr else None

            response.append(
                ResidentApartmentResponse(
                    id=r.id,
                    apartment_id=r.apartment_id,
                    unit_number=apt.unit_number if apt else "Unknown",
                    floor_number=flr.floor_number if flr else 0,
                    building_id=bld.id if bld else uuid.UUID(int=0),
                    building_name=bld.name if bld else "Unknown",
                    building_address=bld.address if bld else None,
                    relationship=r.relationship.value if hasattr(r.relationship, "value") else str(r.relationship),
                    is_primary_contact=r.is_primary_contact,
                    status=r.status.value if hasattr(r.status, "value") else str(r.status),
                    moved_in_at=r.moved_in_at,
                    moved_out_at=r.moved_out_at,
                )
            )
        return response

    async def set_primary_contact(
        self, user: User, apartment_id: uuid.UUID
    ) -> dict[str, str]:
        """Set current user as primary contact for the specified apartment."""
        # 1. Verify user has an active residency in this apartment
        stmt = select(ApartmentResident).where(
            ApartmentResident.apartment_id == apartment_id,
            ApartmentResident.user_id == user.id,
            ApartmentResident.status == ResidentStatus.ACTIVE,
        )
        res = await self.db.execute(stmt)
        residency = res.scalar_one_or_none()

        if not residency:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Bạn không phải là cư dân đang cư trú tại căn hộ này",
            )

        # 2. Reset any other primary contact in this apartment
        other_stmt = select(ApartmentResident).where(
            ApartmentResident.apartment_id == apartment_id,
            ApartmentResident.status == ResidentStatus.ACTIVE,
            ApartmentResident.is_primary_contact.is_(True),
            ApartmentResident.id != residency.id,
        )
        others = (await self.db.execute(other_stmt)).scalars().all()
        for other in others:
            other.is_primary_contact = False

        residency.is_primary_contact = True
        # Also switch user's active apartment pointer for seamless context switching
        user.apartment_id = apartment_id

        await self.db.commit()
        return {"message": "Đã đặt làm người liên hệ chính thành công"}

    # -------------------------------------------------------------------------
    # Admin Resident Management
    # -------------------------------------------------------------------------

    async def list_admin_residents(
        self,
        building_id: uuid.UUID | None = None,
        floor_id: uuid.UUID | None = None,
        apartment_id: uuid.UUID | None = None,
        status_filter: str | None = None,
        search: str | None = None,
    ) -> list[AdminResidentItemResponse]:
        """Admin views list of residents filtered by building, floor, apartment, and status."""
        stmt = (
            select(ApartmentResident)
            .join(Apartment, ApartmentResident.apartment_id == Apartment.id)
            .join(Floor, Apartment.floor_id == Floor.id)
            .join(Building, Floor.building_id == Building.id)
            .join(User, ApartmentResident.user_id == User.id)
            .outerjoin(Profile, User.id == Profile.user_id)
            .options(
                selectinload(ApartmentResident.apartment)
                .selectinload(Apartment.floor)
                .selectinload(Floor.building),
                selectinload(ApartmentResident.user).selectinload(User.profile),
            )
        )

        if building_id:
            stmt = stmt.where(Building.id == building_id)
        if floor_id:
            stmt = stmt.where(Floor.id == floor_id)
        if apartment_id:
            stmt = stmt.where(Apartment.id == apartment_id)

        if status_filter and status_filter.lower() != "all":
            stmt = stmt.where(ApartmentResident.status == status_filter.lower())

        if search and search.strip():
            q = f"%{search.strip().lower()}%"
            stmt = stmt.where(
                or_(
                    func.lower(User.email).like(q),
                    func.lower(User.phone).like(q),
                    func.lower(Profile.full_name).like(q),
                    func.lower(Apartment.unit_number).like(q),
                )
            )

        stmt = stmt.order_by(
            Building.name.asc(),
            Floor.floor_number.asc(),
            Apartment.unit_number.asc(),
            ApartmentResident.is_primary_contact.desc(),
        )

        result = await self.db.execute(stmt)
        residencies = result.scalars().all()

        items = []
        for r in residencies:
            apt = r.apartment
            flr = apt.floor if apt else None
            bld = flr.building if flr else None
            usr = r.user
            prof = usr.profile if usr else None

            items.append(
                AdminResidentItemResponse(
                    id=r.id,
                    apartment_id=r.apartment_id,
                    unit_number=apt.unit_number if apt else "Unknown",
                    floor_number=flr.floor_number if flr else 0,
                    building_id=bld.id if bld else uuid.UUID(int=0),
                    building_name=bld.name if bld else "Unknown",
                    user_id=usr.id,
                    resident_name=(prof.full_name if prof and prof.full_name else usr.email),
                    email=usr.email,
                    phone=usr.phone or (prof.emergency_contact_phone if prof else None),
                    avatar_url=prof.avatar_url if prof else None,
                    relationship=r.relationship.value if hasattr(r.relationship, "value") else str(r.relationship),
                    is_primary_contact=r.is_primary_contact,
                    status=r.status.value if hasattr(r.status, "value") else str(r.status),
                    moved_in_at=r.moved_in_at,
                    moved_out_at=r.moved_out_at,
                )
            )

        return items

    async def create_admin_resident(
        self, payload: AdminCreateResidentRequest, admin_user: User | None = None
    ) -> AdminResidentItemResponse:
        """Admin links a resident to an apartment."""
        # 1. Resolve user
        user = None
        if payload.user_id:
            user = await self.db.get(User, payload.user_id)
        elif payload.email:
            email_clean = payload.email.strip().lower()
            stmt = select(User).where(func.lower(User.email) == email_clean)
            user = (await self.db.execute(stmt)).scalar_one_or_none()

            if not user:
                # Create a new user account for this resident
                user = User(
                    email=email_clean,
                    phone=payload.phone,
                    role="resident",
                    hashed_password=hash_password("123456"),
                    apartment_id=payload.apartment_id,
                )
                self.db.add(user)
                await self.db.flush()

                # Create profile
                prof = Profile(
                    user_id=user.id,
                    full_name=payload.full_name or email_clean.split("@")[0],
                )
                self.db.add(prof)
                await self.db.flush()

        if not user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cần cung cấp user_id hoặc email hợp lệ của cư dân",
            )

        # 2. Check if user already has an active residency in this apartment
        active_stmt = select(ApartmentResident).where(
            ApartmentResident.apartment_id == payload.apartment_id,
            ApartmentResident.user_id == user.id,
            ApartmentResident.status == ResidentStatus.ACTIVE,
        )
        existing = (await self.db.execute(active_stmt)).scalar_one_or_none()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cư dân này đã đang cư trú tại căn hộ này",
            )

        # 3. If primary contact requested, unset existing active primary contact
        if payload.is_primary_contact:
            unset_stmt = select(ApartmentResident).where(
                ApartmentResident.apartment_id == payload.apartment_id,
                ApartmentResident.status == ResidentStatus.ACTIVE,
                ApartmentResident.is_primary_contact.is_(True),
            )
            current_primaries = (await self.db.execute(unset_stmt)).scalars().all()
            for p in current_primaries:
                p.is_primary_contact = False

        # 4. Insert new resident record
        rel_enum = ResidentRelationship(payload.relationship)
        residency = ApartmentResident(
            apartment_id=payload.apartment_id,
            user_id=user.id,
            relationship=rel_enum,
            is_primary_contact=payload.is_primary_contact,
            status=ResidentStatus.ACTIVE,
        )
        self.db.add(residency)

        # Bind active apartment to user if not bound
        if not user.apartment_id:
            user.apartment_id = payload.apartment_id

        await self.db.commit()

        # Load fresh record for response
        return (
            await self.list_admin_residents(
                apartment_id=payload.apartment_id, search=user.email
            )
        )[0]

    async def update_admin_resident(
        self, resident_id: uuid.UUID, payload: AdminUpdateResidentRequest
    ) -> AdminResidentItemResponse:
        """Update resident relationship, primary contact, or moving status."""
        residency = await self.db.get(ApartmentResident, resident_id)
        if not residency:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Không tìm thấy thông tin cư dân căn hộ",
            )

        if payload.relationship is not None:
            residency.relationship = ResidentRelationship(payload.relationship)

        if payload.is_primary_contact is not None:
            if payload.is_primary_contact:
                # Unset other primaries in same apartment
                unset_stmt = select(ApartmentResident).where(
                    ApartmentResident.apartment_id == residency.apartment_id,
                    ApartmentResident.status == ResidentStatus.ACTIVE,
                    ApartmentResident.is_primary_contact.is_(True),
                    ApartmentResident.id != residency.id,
                )
                current_primaries = (await self.db.execute(unset_stmt)).scalars().all()
                for p in current_primaries:
                    p.is_primary_contact = False
            residency.is_primary_contact = payload.is_primary_contact

        if payload.status is not None:
            if payload.status == "moved_out":
                residency.status = ResidentStatus.MOVED_OUT
                residency.moved_out_at = datetime.now(timezone.utc)
                residency.is_primary_contact = False
            else:
                residency.status = ResidentStatus.ACTIVE
                residency.moved_out_at = None

        await self.db.commit()

        # Return updated record
        updated_list = await self.list_admin_residents(apartment_id=residency.apartment_id)
        for item in updated_list:
            if item.id == residency.id:
                return item
        return updated_list[0]

    async def soft_delete_resident(self, resident_id: uuid.UUID) -> dict[str, str]:
        """Mark resident as moved out (preserves billing/support history)."""
        residency = await self.db.get(ApartmentResident, resident_id)
        if not residency:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Không tìm thấy thông tin cư dân căn hộ",
            )

        residency.status = ResidentStatus.MOVED_OUT
        residency.moved_out_at = datetime.now(timezone.utc)
        residency.is_primary_contact = False

        # If user.apartment_id points to this apartment, clear or fallback to another active
        user = await self.db.get(User, residency.user_id)
        if user and user.apartment_id == residency.apartment_id:
            # Check if user has any other active apartment
            other_apt = await self.db.execute(
                select(ApartmentResident.apartment_id).where(
                    ApartmentResident.user_id == user.id,
                    ApartmentResident.status == ResidentStatus.ACTIVE,
                    ApartmentResident.id != residency.id,
                ).limit(1)
            )
            next_apt = other_apt.scalar_one_or_none()
            user.apartment_id = next_apt

        await self.db.commit()
        return {"message": "Đã đánh dấu cư dân chuyển đi thành công"}

    # -------------------------------------------------------------------------
    # Technicians
    # -------------------------------------------------------------------------

    async def list_technicians(self) -> list[TechnicianProfileResponse]:
        """List all technician profiles with specialties and certifications."""
        # Join User with role 'technician'
        stmt = (
            select(User)
            .options(
                selectinload(User.profile),
                selectinload(User.technician_profile),
            )
            .where(User.role == "technician")
            .order_by(User.email.asc())
        )
        result = await self.db.execute(stmt)
        users = result.scalars().all()

        items = []
        for u in users:
            prof = u.profile
            tech_prof = u.technician_profile

            # Auto-create technician profile if missing
            if not tech_prof:
                tech_prof = TechnicianProfile(
                    user_id=u.id,
                    specialties=["general"],
                    certification_info="Chứng chỉ kỹ thuật tòa nhà",
                    active_building_ids=[],
                )
                self.db.add(tech_prof)
                await self.db.commit()
                await self.db.refresh(tech_prof)

            items.append(
                TechnicianProfileResponse(
                    id=tech_prof.id,
                    user_id=u.id,
                    full_name=prof.full_name if prof and prof.full_name else u.email,
                    email=u.email,
                    phone=u.phone or (prof.emergency_contact_phone if prof else None),
                    avatar_url=prof.avatar_url if prof else None,
                    specialties=tech_prof.specialties or [],
                    certification_info=tech_prof.certification_info,
                    active_building_ids=tech_prof.active_building_ids or [],
                    is_active=u.is_active,
                )
            )

        return items

    async def update_technician(
        self, technician_id: uuid.UUID, payload: TechnicianProfileUpdateRequest
    ) -> TechnicianProfileResponse:
        """Update technician profile info."""
        # Find technician profile by its id or by user_id
        stmt = select(TechnicianProfile).where(
            (TechnicianProfile.id == technician_id) | (TechnicianProfile.user_id == technician_id)
        )
        tech_prof = (await self.db.execute(stmt)).scalar_one_or_none()

        if not tech_prof:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Không tìm thấy hồ sơ kỹ thuật viên",
            )

        if payload.specialties is not None:
            tech_prof.specialties = payload.specialties
        if payload.certification_info is not None:
            tech_prof.certification_info = payload.certification_info
        if payload.active_building_ids is not None:
            tech_prof.active_building_ids = payload.active_building_ids

        if payload.is_active is not None:
            user = await self.db.get(User, tech_prof.user_id)
            if user:
                user.is_active = payload.is_active

        await self.db.commit()
        await self.db.refresh(tech_prof)

        # Load user
        user = await self.db.get(User, tech_prof.user_id)
        prof = await self.get_or_create_profile(user)

        return TechnicianProfileResponse(
            id=tech_prof.id,
            user_id=user.id,
            full_name=prof.full_name if prof and prof.full_name else user.email,
            email=user.email,
            phone=user.phone,
            avatar_url=prof.avatar_url,
            specialties=tech_prof.specialties,
            certification_info=tech_prof.certification_info,
            active_building_ids=tech_prof.active_building_ids,
            is_active=user.is_active,
        )
