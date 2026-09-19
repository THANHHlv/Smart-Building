"""Pydantic schemas for community amenities and slot bookings."""

import datetime
import uuid

from pydantic import BaseModel, ConfigDict, Field


class AmenityResponse(BaseModel):
    """Amenity definition and configuration."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    building_id: uuid.UUID
    name: str
    description: str | None = None
    capacity: int
    available_slots: list[str] = Field(default_factory=list)
    requires_approval: bool
    is_active: bool


class AmenitySlotStatus(BaseModel):
    """Slot availability state for a specific date."""

    time_slot: str
    is_available: bool
    booking_id: uuid.UUID | None = None
    status: str | None = Field(default=None, description="pending | confirmed | None if free")
    is_own_booking: bool = False


class AmenitySlotsResponse(BaseModel):
    """Availability schedule for an amenity on a target date."""

    amenity_id: uuid.UUID
    amenity_name: str
    capacity: int
    requires_approval: bool
    booking_date: datetime.date
    slots: list[AmenitySlotStatus]


class AmenityBookingCreate(BaseModel):
    """Payload for booking an amenity slot."""

    booking_date: datetime.date = Field(..., description="Date of reservation (YYYY-MM-DD)")
    time_slot: str = Field(..., examples=["08:00 - 10:00"])
    notes: str | None = Field(default=None, max_length=500, description="Notes or event details")
    apartment_id: uuid.UUID | None = Field(default=None, description="Target apartment ID (defaults to user's apartment)")


class AmenityBookingResponse(BaseModel):
    """Response model for an amenity booking."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    amenity_id: uuid.UUID
    amenity_name: str
    apartment_id: uuid.UUID
    apartment_unit: str | None = None
    user_id: uuid.UUID
    user_name: str | None = None
    booking_date: datetime.date
    time_slot: str
    status: str
    notes: str | None = None
    created_at: datetime.datetime
