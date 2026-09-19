"""Pydantic schemas for self-service requests."""

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class ServiceRequestCreate(BaseModel):
    """Payload for resident submitting a self-service request."""

    request_type: str = Field(
        ...,
        description="cleaning | periodic_maintenance | vehicle_registration | access_card | other",
        examples=["cleaning"],
    )
    title: str = Field(..., max_length=255, examples=["Yêu cầu tổng vệ sinh căn hộ cuối tuần"])
    description: str = Field(..., min_length=5, examples=["Nhờ BQL cử đội vệ sinh dọn dẹp căn hộ 75m2"])
    apartment_id: uuid.UUID | None = Field(default=None, description="Apartment ID (auto-inferred for residents)")
    scheduled_at: datetime | None = Field(default=None, description="Preferred scheduled date")
    scheduled_slot: str | None = Field(default=None, description="Preferred time slot e.g. '08:00 - 10:00'")
    notes: dict[str, Any] = Field(
        default_factory=dict,
        description="Structured metadata (license plate, vehicle type, cleaning package, card type)",
    )


class ServiceRequestResponse(BaseModel):
    """Response model for a service request with ticket status summary."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    ticket_id: uuid.UUID
    request_type: str
    scheduled_at: datetime | None = None
    scheduled_slot: str | None = None
    notes: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime

    # Denormalized / linked ticket fields
    ticket_status: str
    ticket_title: str
    ticket_description: str
    ticket_priority: str
    apartment_unit: str | None = None
    technician_name: str | None = None
    rating: int | None = None
    rating_comment: str | None = None
