"""Apartment schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class ApartmentBase(BaseModel):
    """Shared apartment fields."""

    unit_number: str = Field(..., min_length=1, max_length=50)
    area_sqm: float | None = Field(default=None, gt=0)
    num_rooms: int | None = Field(default=None, ge=1)
    resident_name: str | None = Field(default=None, max_length=255)


class ApartmentCreate(ApartmentBase):
    """Schema for creating an apartment."""

    floor_id: UUID


class ApartmentUpdate(BaseModel):
    """Schema for updating an apartment — all fields optional."""

    unit_number: str | None = Field(default=None, min_length=1, max_length=50)
    area_sqm: float | None = Field(default=None, gt=0)
    num_rooms: int | None = Field(default=None, ge=1)
    resident_name: str | None = None
    is_active: bool | None = None


class ApartmentResponse(ApartmentBase):
    """Schema for apartment API responses."""

    id: UUID
    floor_id: UUID
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ApartmentDetailResponse(ApartmentResponse):
    """Apartment response with nested devices."""

    devices: list["DeviceSummary"] = []


class DeviceSummary(BaseModel):
    """Minimal device info for apartment detail."""

    id: UUID
    device_code: str
    name: str
    status: str
    is_active: bool

    model_config = {"from_attributes": True}


ApartmentDetailResponse.model_rebuild()
