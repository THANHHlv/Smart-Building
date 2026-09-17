"""Schemas for Admin User Management and Resident Onboarding."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class UserAdminItem(BaseModel):
    """User account representation in Admin User Management console."""

    id: uuid.UUID
    email: str
    full_name: str | None = None
    role: str
    is_active: bool
    apartment_id: uuid.UUID | None = None
    apartment_unit: str | None = None
    building_name: str | None = None
    floor_number: int | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AssignApartmentRequest(BaseModel):
    """Request payload to assign a resident to an apartment."""

    apartment_id: uuid.UUID


class UserStatusUpdateRequest(BaseModel):
    """Request payload to update active status or role."""

    is_active: bool
