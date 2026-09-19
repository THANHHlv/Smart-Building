"""Community Amenities & Slot Booking API endpoints."""

import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.amenity import (
    AmenityBookingCreate,
    AmenityBookingResponse,
    AmenityResponse,
    AmenitySlotsResponse,
)
from app.services.service_request_service import ServiceRequestService

router = APIRouter(tags=["Community Amenities & Bookings"])


@router.get(
    "/amenities",
    response_model=list[AmenityResponse],
    summary="Danh sách tiện ích cộng đồng tòa nhà",
)
async def list_amenities(
    db: Annotated[AsyncSession, Depends(get_db)],
    building_id: UUID | None = Query(default=None, description="Lọc theo ID tòa nhà"),
):
    """Danh sách các tiện ích có thể đặt chỗ (Phòng cộng đồng, BBQ, Sân chơi...)."""
    service = ServiceRequestService(db)
    return await service.list_amenities(building_id=building_id)


@router.get(
    "/amenities/{amenity_id}/available-slots",
    response_model=AmenitySlotsResponse,
    summary="Kiểm tra khung giờ còn trống của tiện ích theo ngày",
)
async def get_amenity_available_slots(
    amenity_id: UUID,
    date: datetime.date = Query(..., description="Ngày cần đặt chỗ (YYYY-MM-DD)"),
    current_user: Annotated[User, Depends(get_current_user)] = None,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
):
    """Xem danh sách các khung giờ (slot) trong ngày kèm trạng thái còn trống hay đã được đặt."""
    service = ServiceRequestService(db)
    user_id = current_user.id if current_user else None
    return await service.get_available_slots(amenity_id=amenity_id, booking_date=date, current_user_id=user_id)


@router.post(
    "/amenities/{amenity_id}/bookings",
    response_model=AmenityBookingResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Cư dân đặt chỗ tiện ích",
)
async def create_amenity_booking(
    amenity_id: UUID,
    payload: AmenityBookingCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Đặt khung giờ sử dụng tiện ích (kiểm tra chống trùng lịch double-booking)."""
    service = ServiceRequestService(db)
    return await service.create_amenity_booking(amenity_id=amenity_id, user=current_user, payload=payload)


@router.delete(
    "/amenities/bookings/{booking_id}",
    summary="Cư dân tự huỷ lịch đã đặt",
)
async def cancel_amenity_booking(
    booking_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Huỷ lịch đặt tiện ích và giải phóng khung giờ cho cư dân khác."""
    service = ServiceRequestService(db)
    return await service.cancel_amenity_booking(booking_id=booking_id, user=current_user)


@router.get(
    "/me/amenity-bookings",
    response_model=list[AmenityBookingResponse],
    summary="Lịch sử đặt tiện ích của căn hộ",
)
async def list_my_amenity_bookings(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Danh sách các lượt đặt tiện ích đã và sắp tới của căn hộ hiện tại."""
    service = ServiceRequestService(db)
    return await service.list_user_amenity_bookings(current_user)
