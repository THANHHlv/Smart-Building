"""Admin User Management endpoints — onboard residents, assign apartments, and control access."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import require_admin
from app.core.database import get_db
from app.models.apartment import Apartment
from app.models.floor import Floor
from app.models.user import User
from app.schemas.common import MessageResponse
from app.schemas.user_admin import AssignApartmentRequest, UserAdminItem, UserStatusUpdateRequest

router = APIRouter(prefix="/users", tags=["User Management (Admin)"])


@router.get("", response_model=list[UserAdminItem])
async def list_users(
    _admin: Annotated[User, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
    role: str | None = Query(default=None, description="Filter by role: 'admin' or 'resident'"),
    assigned: bool | None = Query(default=None, description="Filter residents with or without apartment"),
    search: str | None = Query(default=None, description="Search by email or full name"),
):
    """List registered users with apartment and onboarding status. Admin only."""
    stmt = (
        select(User)
        .options(
            selectinload(User.apartment)
            .selectinload(Apartment.floor)
            .selectinload(Floor.building)
        )
        .order_by(User.created_at.desc())
    )

    if role:
        stmt = stmt.where(User.role == role)

    if assigned is True:
        stmt = stmt.where(User.apartment_id.is_not(None))
    elif assigned is False:
        stmt = stmt.where(User.apartment_id.is_(None))

    if search:
        search_term = f"%{search.lower().strip()}%"
        stmt = stmt.where(
            or_(
                func.lower(User.email).like(search_term),
                func.lower(User.full_name).like(search_term),
            )
        )

    result = await db.execute(stmt)
    users = result.scalars().all()

    items = []
    for u in users:
        apt_unit = u.apartment.unit_number if u.apartment else None
        bld_name = (
            u.apartment.floor.building.name
            if u.apartment and u.apartment.floor and u.apartment.floor.building
            else None
        )
        fl_num = (
            u.apartment.floor.floor_number
            if u.apartment and u.apartment.floor
            else None
        )
        items.append(
            UserAdminItem(
                id=u.id,
                email=u.email,
                full_name=u.full_name,
                role=u.role,
                is_active=u.is_active,
                apartment_id=u.apartment_id,
                apartment_unit=apt_unit,
                building_name=bld_name,
                floor_number=fl_num,
                created_at=u.created_at,
            )
        )

    return items


@router.put("/{user_id}/assign-apartment", response_model=UserAdminItem)
async def assign_apartment(
    user_id: uuid.UUID,
    payload: AssignApartmentRequest,
    _admin: Annotated[User, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Assign an apartment to a resident. Admin only."""
    stmt = (
        select(User)
        .options(
            selectinload(User.apartment)
            .selectinload(Apartment.floor)
            .selectinload(Floor.building)
        )
        .where(User.id == user_id)
    )
    user = (await db.execute(stmt)).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Verify apartment exists
    apt_stmt = (
        select(Apartment)
        .options(selectinload(Apartment.floor).selectinload(Floor.building))
        .where(Apartment.id == payload.apartment_id)
    )
    apartment = (await db.execute(apt_stmt)).scalar_one_or_none()
    if not apartment:
        raise HTTPException(status_code=404, detail="Apartment not found")

    # Check if this apartment is already assigned to another active resident
    conflict_stmt = select(User).where(
        User.apartment_id == payload.apartment_id,
        User.id != user_id,
        User.is_active.is_(True),
    )
    existing_occupant = (await db.execute(conflict_stmt)).scalar_one_or_none()
    if existing_occupant:
        occ_name = existing_occupant.full_name or existing_occupant.email
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Căn hộ {apartment.unit_number} hiện đã được gán cho cư dân '{occ_name}'. "
                "Vui lòng hủy gán cư dân cũ trước khi gán cho người khác."
            ),
        )

    # If user was previously assigned to a different apartment, clean up old apartment resident_name
    if user.apartment_id and user.apartment_id != payload.apartment_id:
        old_apt_stmt = select(Apartment).where(Apartment.id == user.apartment_id)
        old_apt = (await db.execute(old_apt_stmt)).scalar_one_or_none()
        if old_apt and (old_apt.resident_name == user.full_name or old_apt.resident_name == user.email):
            old_apt.resident_name = None

    user.apartment_id = payload.apartment_id
    # Sync apartment resident_name
    if user.full_name:
        apartment.resident_name = user.full_name
    elif not apartment.resident_name:
        apartment.resident_name = user.email

    await db.commit()
    await db.refresh(user)

    apt_unit = apartment.unit_number
    bld_name = apartment.floor.building.name if apartment.floor and apartment.floor.building else None
    fl_num = apartment.floor.floor_number if apartment.floor else None

    return UserAdminItem(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        is_active=user.is_active,
        apartment_id=user.apartment_id,
        apartment_unit=apt_unit,
        building_name=bld_name,
        floor_number=fl_num,
        created_at=user.created_at,
    )


@router.put("/{user_id}/unassign-apartment", response_model=UserAdminItem)
async def unassign_apartment(
    user_id: uuid.UUID,
    _admin: Annotated[User, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Unassign resident from their apartment (e.g. lease ended). Admin only."""
    stmt = select(User).where(User.id == user_id)
    user = (await db.execute(stmt)).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.apartment_id:
        old_apt_stmt = select(Apartment).where(Apartment.id == user.apartment_id)
        old_apt = (await db.execute(old_apt_stmt)).scalar_one_or_none()
        if old_apt and (old_apt.resident_name == user.full_name or old_apt.resident_name == user.email):
            old_apt.resident_name = None

    user.apartment_id = None
    await db.commit()
    await db.refresh(user)

    return UserAdminItem(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        is_active=user.is_active,
        apartment_id=None,
        apartment_unit=None,
        building_name=None,
        floor_number=None,
        created_at=user.created_at,
    )


@router.put("/{user_id}/toggle-status", response_model=MessageResponse)
async def toggle_user_status(
    user_id: uuid.UUID,
    payload: UserStatusUpdateRequest,
    _admin: Annotated[User, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Enable or disable user access. Admin only."""
    stmt = select(User).where(User.id == user_id)
    user = (await db.execute(stmt)).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_active = payload.is_active
    await db.commit()

    action_str = "kích hoạt" if payload.is_active else "vô hiệu hóa"
    return MessageResponse(message=f"Tài khoản đã được {action_str}", id=user.id)
