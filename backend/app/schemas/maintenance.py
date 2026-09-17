"""Schemas for Maintenance Tickets and Resident Support Requests."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class MaintenanceTicketCreate(BaseModel):
    """Payload for submitting a new maintenance request."""

    title: str = Field(..., min_length=3, max_length=255)
    description: str = Field(..., min_length=5)
    category: str = Field(default="general", pattern="^(electrical|plumbing|hvac|general|appliance)$")
    urgency: str = Field(default="medium", pattern="^(low|medium|high|critical)$")


class MaintenanceTicketUpdate(BaseModel):
    """Payload for technician or admin updating a maintenance ticket."""

    status: str | None = Field(default=None, pattern="^(open|in_progress|resolved|cancelled)$")
    technician_notes: str | None = None


class MaintenanceTicketResponse(BaseModel):
    """Response representation of a maintenance ticket."""

    id: uuid.UUID
    apartment_id: uuid.UUID
    apartment_unit: str | None = None
    building_name: str | None = None
    user_id: uuid.UUID | None = None
    resident_name: str | None = None
    title: str
    description: str
    category: str
    urgency: str
    status: str
    technician_notes: str | None = None
    resolved_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
