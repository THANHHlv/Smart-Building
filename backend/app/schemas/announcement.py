"""Pydantic schemas for building community announcements."""

import datetime
import uuid

from pydantic import BaseModel, ConfigDict, Field


class AnnouncementCreate(BaseModel):
    """Payload for creating a building announcement."""

    building_id: uuid.UUID | None = Field(default=None, description="Target building ID (optional if inferred from admin)")
    title: str = Field(..., min_length=3, max_length=255, examples=["Bảo trì hệ thống thang máy Tháp A"])
    content: str = Field(..., min_length=5, examples=["Thang máy số 2 sẽ được bảo dưỡng định kỳ từ 14h đến 16h..."])
    category: str = Field(
        default="general",
        description="maintenance | event | safety | general",
        examples=["maintenance"],
    )
    priority: str = Field(
        default="standard",
        description="urgent | standard",
        examples=["urgent"],
    )
    expires_at: datetime.datetime | None = Field(default=None, description="Expiration date to auto-hide from feed")
    pin_to_top: bool = Field(default=False, description="Pin to top of resident feed")
    image_url: str | None = Field(default=None, max_length=1024, description="Optional banner or notice image")


class AnnouncementUpdate(BaseModel):
    """Payload for updating an existing announcement."""

    title: str | None = Field(default=None, min_length=3, max_length=255)
    content: str | None = Field(default=None, min_length=5)
    category: str | None = None
    priority: str | None = None
    expires_at: datetime.datetime | None = None
    pin_to_top: bool | None = None
    image_url: str | None = None
    is_active: bool | None = None


class AnnouncementResponse(BaseModel):
    """Base announcement model."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    building_id: uuid.UUID
    title: str
    content: str
    category: str
    priority: str
    published_by: uuid.UUID | None = None
    publisher_name: str | None = None
    published_at: datetime.datetime
    expires_at: datetime.datetime | None = None
    pin_to_top: bool
    image_url: str | None = None
    is_active: bool
    created_at: datetime.datetime


class AnnouncementFeedItem(AnnouncementResponse):
    """Resident feed item with read tracking state."""

    is_read: bool = False
    read_at: datetime.datetime | None = None


class AnnouncementFeedResponse(BaseModel):
    """Resident feed response with unread metrics."""

    items: list[AnnouncementFeedItem]
    total_unread: int
    total_count: int
