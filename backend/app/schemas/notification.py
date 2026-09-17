"""Notification schemas for request validation and API responses."""

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.models.notification import (
    NotificationCategory,
    NotificationChannel,
    NotificationStatus,
)


class NotificationResponse(BaseModel):
    """Notification item displayed in resident feed."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    category: NotificationCategory
    title: str
    body: str
    channel: NotificationChannel
    status: NotificationStatus
    created_at: datetime
    read_at: datetime | None = None
    data_json: str | None = None


class NotificationListResponse(BaseModel):
    """Paginated list of resident notifications with unread count summary."""
    items: list[NotificationResponse]
    total: int
    unread_count: int
    page: int
    page_size: int
    total_pages: int


class NotificationPreferenceItem(BaseModel):
    """Channel preference for a specific notification category."""
    category: NotificationCategory
    channel: NotificationChannel
    is_enabled: bool = True


class NotificationPreferencesResponse(BaseModel):
    """Complete preference matrix for the resident."""
    preferences: list[NotificationPreferenceItem]


class NotificationPreferencesUpdateRequest(BaseModel):
    """Update payload for resident preferences."""
    preferences: list[NotificationPreferenceItem]


class NotificationEventPayload(BaseModel):
    """Kafka event schema on notifications.requested topic."""
    user_id: uuid.UUID
    category: NotificationCategory
    template_code: str
    context: dict[str, Any] = Field(default_factory=dict)
    idempotency_key: str | None = None
    channels: list[NotificationChannel] | None = None
