"""Device schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class DeviceBase(BaseModel):
    """Shared device fields."""

    device_code: str = Field(..., min_length=1, max_length=100)
    name: str = Field(..., min_length=1, max_length=255)


class DeviceCreate(DeviceBase):
    """Schema for creating a device."""

    apartment_id: UUID
    device_type_id: UUID


class DeviceUpdate(BaseModel):
    """Schema for updating a device — all fields optional."""

    name: str | None = Field(default=None, min_length=1, max_length=255)
    status: str | None = None
    is_active: bool | None = None


class DeviceControlRequest(BaseModel):
    """Payload for commanding a smart device."""

    action: str = Field(..., pattern="^(turn_on|turn_off|toggle)$")



class DeviceTypeResponse(BaseModel):
    """Schema for device type API responses."""

    id: UUID
    code: str
    name: str
    description: str | None = None
    unit: str

    model_config = {"from_attributes": True}


class DeviceResponse(DeviceBase):
    """Schema for device API responses."""

    id: UUID
    apartment_id: UUID
    device_type_id: UUID
    status: str
    installed_at: datetime | None = None
    last_seen_at: datetime | None = None
    is_active: bool
    created_at: datetime
    updated_at: datetime
    device_type: DeviceTypeResponse | None = None

    model_config = {"from_attributes": True}
