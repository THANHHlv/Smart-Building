"""Alert schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.models.alert import AlertSeverity, AlertStatus


class AlertBase(BaseModel):
    """Base schema for alerts."""

    severity: AlertSeverity = AlertSeverity.MEDIUM
    title: str
    message: str | None = None
    source: str = "system"


class AlertCreate(AlertBase):
    """Schema for creating an alert."""

    device_id: UUID | None = None
    apartment_id: UUID | None = None


class AlertUpdate(BaseModel):
    """Schema for updating an alert."""

    status: AlertStatus | None = None
    message: str | None = None


class AlertResponse(AlertBase):
    """Schema for alert responses."""

    id: UUID
    device_id: UUID | None = None
    apartment_id: UUID | None = None
    status: AlertStatus
    resolved_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
