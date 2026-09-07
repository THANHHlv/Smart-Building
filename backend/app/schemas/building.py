"""Building schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class BuildingBase(BaseModel):
    """Shared building fields."""

    name: str = Field(..., min_length=1, max_length=255)
    address: str = Field(..., min_length=1, max_length=500)
    description: str | None = None
    total_floors: int = Field(default=1, ge=1)


class BuildingCreate(BuildingBase):
    """Schema for creating a building."""

    pass


class BuildingUpdate(BaseModel):
    """Schema for updating a building — all fields optional."""

    name: str | None = Field(default=None, min_length=1, max_length=255)
    address: str | None = Field(default=None, min_length=1, max_length=500)
    description: str | None = None
    total_floors: int | None = Field(default=None, ge=1)
    is_active: bool | None = None


class BuildingResponse(BuildingBase):
    """Schema for building API responses."""

    id: UUID
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class BuildingDetailResponse(BuildingResponse):
    """Building response with nested floors."""

    floors: list["FloorSummary"] = []


# Avoid circular import — define a minimal floor summary here
class FloorSummary(BaseModel):
    """Minimal floor info for building detail."""

    id: UUID
    floor_number: int
    name: str | None = None

    model_config = {"from_attributes": True}


# Rebuild to resolve forward refs
BuildingDetailResponse.model_rebuild()
