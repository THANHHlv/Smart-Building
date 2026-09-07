"""Sensor reading schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class ReadingCreate(BaseModel):
    """Schema for submitting a single sensor reading."""

    device_id: UUID
    timestamp: datetime
    metric: str = Field(..., min_length=1, max_length=50)
    value: float
    unit: str = Field(..., min_length=1, max_length=20)


class ReadingBatchCreate(BaseModel):
    """Schema for submitting multiple readings at once."""

    readings: list[ReadingCreate] = Field(..., min_length=1, max_length=1000)


class ReadingResponse(BaseModel):
    """Schema for reading API responses."""

    id: UUID
    device_id: UUID
    timestamp: datetime
    metric: str
    value: float
    unit: str

    model_config = {"from_attributes": True}


class ReadingQueryParams(BaseModel):
    """Query parameters for reading endpoints."""

    device_id: UUID | None = None
    metric: str | None = None
    start_time: datetime | None = None
    end_time: datetime | None = None
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=50, ge=1, le=1000)

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size
