"""Floor schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class FloorBase(BaseModel):
    """Shared floor fields."""

    floor_number: int = Field(..., ge=-10, le=200)
    name: str | None = Field(default=None, max_length=100)
    description: str | None = Field(default=None, max_length=500)


class FloorCreate(FloorBase):
    """Schema for creating a floor within a building."""

    pass


class FloorUpdate(BaseModel):
    """Schema for updating a floor."""

    name: str | None = Field(default=None, max_length=100)
    description: str | None = Field(default=None, max_length=500)


class FloorResponse(FloorBase):
    """Schema for floor API responses."""

    id: UUID
    building_id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class FloorDetailResponse(FloorResponse):
    """Floor response with nested apartments."""

    apartments: list["ApartmentSummary"] = []


class ApartmentSummary(BaseModel):
    """Minimal apartment info for floor detail."""

    id: UUID
    unit_number: str
    is_active: bool

    model_config = {"from_attributes": True}


FloorDetailResponse.model_rebuild()
