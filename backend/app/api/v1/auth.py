"""Authentication and account endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user
from app.core.database import get_db
from app.core.security import create_access_token, hash_password, verify_password
from app.models.apartment import Apartment
from app.models.building import Building
from app.models.floor import Floor
from app.models.user import User
from app.schemas.auth import DemoAccount, LoginRequest, RegisterRequest, TokenResponse, UserProfile

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", response_model=TokenResponse)
async def login(
    credentials: LoginRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Authenticate user with email and password, returning JWT token and role profile."""
    stmt = (
        select(User)
        .options(
            selectinload(User.apartment)
            .selectinload(Apartment.floor)
            .selectinload(Floor.building)
        )
        .where(User.email == credentials.email.lower().strip())
    )
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account has been suspended or deactivated",
        )

    # Build token
    token = create_access_token(data={"sub": str(user.id), "role": user.role})

    # Prepare profile info
    apt_unit = user.apartment.unit_number if user.apartment else None
    bld_name = (
        user.apartment.floor.building.name
        if user.apartment and user.apartment.floor and user.apartment.floor.building
        else None
    )

    profile = UserProfile(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        apartment_id=user.apartment_id,
        apartment_unit=apt_unit,
        building_name=bld_name,
        is_active=user.is_active,
    )

    return TokenResponse(access_token=token, token_type="bearer", user=profile)


@router.post("/register", response_model=TokenResponse, status_code=201)
async def register(
    payload: RegisterRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Register a new resident account. Returns JWT token for auto-login."""
    email_normalized = payload.email.lower().strip()

    # Check for duplicate email
    existing = await db.execute(select(User).where(User.email == email_normalized))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email address already exists",
        )

    # Create the user with default resident role
    new_user = User(
        email=email_normalized,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name.strip(),
        role="resident",
        apartment_id=None,
        is_active=True,
        is_superuser=False,
    )
    db.add(new_user)
    await db.flush()
    await db.refresh(new_user)

    # Generate token
    token = create_access_token(data={"sub": str(new_user.id), "role": new_user.role})

    profile = UserProfile(
        id=new_user.id,
        email=new_user.email,
        full_name=new_user.full_name,
        role=new_user.role,
        apartment_id=None,
        apartment_unit=None,
        building_name=None,
        is_active=True,
    )

    await db.commit()
    return TokenResponse(access_token=token, token_type="bearer", user=profile)


@router.get("/me", response_model=UserProfile)
async def get_me(
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Get profile of currently logged-in user."""
    apt_unit = current_user.apartment.unit_number if current_user.apartment else None
    bld_name = (
        current_user.apartment.floor.building.name
        if current_user.apartment
        and current_user.apartment.floor
        and current_user.apartment.floor.building
        else None
    )

    return UserProfile(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        role=current_user.role,
        apartment_id=current_user.apartment_id,
        apartment_unit=apt_unit,
        building_name=bld_name,
        is_active=current_user.is_active,
    )


@router.get("/demo-accounts", response_model=list[DemoAccount])
async def get_demo_accounts(
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Return available seeded demo accounts for quick 1-click role switching in the UI."""
    stmt = (
        select(User)
        .options(
            selectinload(User.apartment)
            .selectinload(Apartment.floor)
            .selectinload(Floor.building)
        )
        .where(User.is_active.is_(True))
        .order_by(User.role.asc(), User.email.asc())
    )
    result = await db.execute(stmt)
    users = result.scalars().all()

    accounts = []
    for u in users:
        apt_unit = u.apartment.unit_number if u.apartment else None
        bld_name = (
            u.apartment.floor.building.name
            if u.apartment and u.apartment.floor and u.apartment.floor.building
            else None
        )

        if u.role == "admin":
            label = "Quản Trị Viên (Admin Ops)"
            desc = "Toàn quyền quản lý cụm tòa nhà, hạ tầng IoT, Kafka & AI Lab"
        else:
            label = f"Cư Dân Căn Hộ {apt_unit or ''}"
            desc = f"Chỉ xem thông số điện, nước, khí hậu & thiết bị của Căn {apt_unit or ''}"

        accounts.append(
            DemoAccount(
                email=u.email,
                role=u.role,
                label=label,
                description=desc,
                apartment_unit=apt_unit,
                building_name=bld_name,
            )
        )

    return accounts
