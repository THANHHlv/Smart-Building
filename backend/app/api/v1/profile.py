"""User Profile and Linked Apartment API endpoints for authenticated users."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.avatar_storage import avatar_service
from app.core.database import get_db
from app.core.security import hash_password, verify_password
from app.models.user import User
from app.schemas.auth import ChangePasswordRequest
from app.schemas.profile import (
    AvatarUploadResponse,
    ResidentApartmentResponse,
    UserProfileResponse,
    UserProfileUpdateRequest,
)
from app.services.profile_service import ProfileService

router = APIRouter(tags=["User Profile"])


@router.get("/me/profile", response_model=UserProfileResponse)
async def get_my_profile(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Retrieve full personal profile and emergency contact details of currently logged-in user."""
    service = ProfileService(db)
    return await service.get_user_profile_response(current_user)


@router.put("/me/profile", response_model=UserProfileResponse)
async def update_my_profile(
    payload: UserProfileUpdateRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Update personal profile, phone number, and emergency contact details."""
    service = ProfileService(db)
    return await service.update_user_profile(current_user, payload)


@router.post("/me/profile/avatar", response_model=AvatarUploadResponse)
async def upload_my_avatar(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    file: UploadFile = File(..., description="Ảnh đại diện (JPEG, PNG, WebP tối đa 5MB)"),
):
    """Upload and optimize user avatar image with Pillow, returning public avatar_url."""
    # 1. Process and store avatar
    avatar_url = await avatar_service.save_avatar(file)

    # 2. Update profile record
    service = ProfileService(db)
    await service.update_avatar_url(current_user, avatar_url)

    return AvatarUploadResponse(
        avatar_url=avatar_url,
        message="Cập nhật ảnh đại diện thành công",
    )


@router.get("/me/apartments", response_model=list[ResidentApartmentResponse])
async def get_my_apartments(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """List all apartments currently or previously linked to the authenticated user."""
    service = ProfileService(db)
    return await service.get_user_apartments(current_user.id)


@router.post("/me/apartments/{apartment_id}/set-primary-contact")
async def set_primary_contact_apartment(
    apartment_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Set the authenticated user as the primary contact for this apartment."""
    service = ProfileService(db)
    return await service.set_primary_contact(current_user, apartment_id)


@router.put("/me/password")
async def update_my_password(
    payload: ChangePasswordRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Change current user's password."""
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mật khẩu hiện tại không chính xác",
        )

    if payload.new_password != payload.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mật khẩu mới và xác nhận mật khẩu không trùng khớp",
        )

    if payload.new_password == payload.current_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mật khẩu mới không được trùng với mật khẩu hiện tại",
        )

    current_user.hashed_password = hash_password(payload.new_password)
    await db.commit()

    return {"message": "Đổi mật khẩu thành công"}

