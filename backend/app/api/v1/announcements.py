"""Building Community Bulletin Board API endpoints."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_permission
from app.core.database import get_db
from app.models.user import User
from app.schemas.announcement import (
    AnnouncementCreate,
    AnnouncementFeedResponse,
    AnnouncementResponse,
    AnnouncementUpdate,
)
from app.services.announcement_service import AnnouncementService

router = APIRouter(tags=["Community Bulletin Board"])


# -----------------------------------------------------------------------------
# Resident Endpoints
# -----------------------------------------------------------------------------

@router.get(
    "/announcements",
    response_model=AnnouncementFeedResponse,
    summary="Bảng tin chung cư dành cho cư dân",
)
async def get_announcements_feed(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    category: str | None = Query(default=None, description="Lọc theo phân loại (maintenance, event, safety, general)"),
    building_id: UUID | None = Query(default=None, description="Lọc theo tòa nhà"),
):
    """Lấy feed bảng tin đã lọc bài hết hạn (expires_at) và kèm trạng thái đã đọc của cư dân."""
    service = AnnouncementService(db)
    return await service.get_resident_feed(user=current_user, category=category, building_id=building_id)


@router.post(
    "/announcements/{announcement_id}/read",
    summary="Đánh dấu đã đọc bài viết",
)
async def mark_announcement_as_read(
    announcement_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Ghi nhận cư dân đã đọc thông báo để trừ badge chưa đọc."""
    service = AnnouncementService(db)
    return await service.mark_as_read(announcement_id=announcement_id, user=current_user)


# -----------------------------------------------------------------------------
# Building Management / Admin Endpoints
# -----------------------------------------------------------------------------

@router.post(
    "/admin/announcements",
    response_model=AnnouncementResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Admin tạo bài đăng thông báo mới",
)
async def create_announcement(
    payload: AnnouncementCreate,
    admin_user: Annotated[User, Depends(require_permission("announcement.manage"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Ban Quản Lý đăng thông báo mới. Nếu priority='urgent', lập tức phát thông báo đẩy đến toàn bộ cư dân."""
    service = AnnouncementService(db)
    return await service.create_announcement(payload=payload, current_user=admin_user)


@router.patch(
    "/admin/announcements/{announcement_id}",
    response_model=AnnouncementResponse,
    summary="Admin cập nhật bài thông báo",
)
async def update_announcement(
    announcement_id: UUID,
    payload: AnnouncementUpdate,
    _admin_user: Annotated[User, Depends(require_permission("announcement.manage"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Chỉnh sửa tiêu đề, nội dung, ngày hết hạn hoặc ghim bài viết."""
    service = AnnouncementService(db)
    return await service.update_announcement(announcement_id=announcement_id, payload=payload)


@router.delete(
    "/admin/announcements/{announcement_id}",
    summary="Admin xoá bài thông báo (soft-delete)",
)
async def delete_announcement(
    announcement_id: UUID,
    _admin_user: Annotated[User, Depends(require_permission("announcement.manage"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Ẩn bài thông báo khỏi feed của cư dân."""
    service = AnnouncementService(db)
    return await service.delete_announcement(announcement_id=announcement_id)
