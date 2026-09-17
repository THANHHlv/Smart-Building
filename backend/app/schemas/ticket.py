"""Pydantic schemas for Ticket / Work Order System."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


# ---------------------------------------------------------------------------
# Technician Schemas
# ---------------------------------------------------------------------------

class TechnicianResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    full_name: str
    email: str
    phone_number: str | None = None
    specialties: list[str] = Field(default_factory=list)
    is_active: bool = True
    active_ticket_count: int = 0


# ---------------------------------------------------------------------------
# Attachment & Comment Schemas
# ---------------------------------------------------------------------------

class TicketAttachmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    ticket_id: UUID
    file_url: str
    file_name: str
    file_size: int
    mime_type: str
    uploaded_by: UUID | None = None
    uploaded_at: datetime


class TicketCommentCreate(BaseModel):
    comment: str = Field(min_length=1, max_length=2000)
    is_internal: bool = False


class TicketCommentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    ticket_id: UUID
    author_id: UUID | None = None
    author_name: str | None = None
    author_role: str | None = None
    comment: str
    is_internal: bool
    created_at: datetime


class TicketStatusHistoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    ticket_id: UUID
    from_status: str | None = None
    to_status: str
    changed_by: UUID | None = None
    changed_by_name: str | None = None
    changed_at: datetime
    note: str | None = None


# ---------------------------------------------------------------------------
# Ticket CRUD & Operation Schemas
# ---------------------------------------------------------------------------

class TicketCreate(BaseModel):
    title: str = Field(min_length=3, max_length=255)
    description: str = Field(min_length=5)
    category: str = Field(default="general")
    priority: str = Field(default="medium")
    apartment_id: UUID | None = None
    device_id: UUID | None = None
    # Optional image URLs uploaded before submission
    attachment_urls: list[str] = Field(default_factory=list, max_length=3)


class TicketStatusUpdate(BaseModel):
    status: str = Field(description="Target status: open, assigned, in_progress, resolved, closed, reopened")
    note: str | None = Field(default=None, max_length=500, description="Optional explanation or work notes")


class TicketAssign(BaseModel):
    technician_id: UUID
    note: str | None = Field(default=None, max_length=500)


class TicketRatingRequest(BaseModel):
    rating: int = Field(ge=1, le=5, description="1 to 5 star rating")
    rating_comment: str | None = Field(default=None, max_length=1000)


class TicketReopenRequest(BaseModel):
    reason: str = Field(min_length=5, max_length=1000, description="Reason for reopening resolved ticket")


class TicketResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    source: str
    apartment_id: UUID | None = None
    apartment_unit: str | None = None
    building_name: str | None = None
    device_id: UUID | None = None
    device_name: str | None = None
    category: str
    priority: str
    status: str
    title: str
    description: str
    created_by: UUID | None = None
    creator_name: str | None = None
    assigned_to: UUID | None = None
    technician_name: str | None = None
    due_at: datetime | None = None
    resolved_at: datetime | None = None
    closed_at: datetime | None = None
    rating: int | None = None
    rating_comment: str | None = None
    is_overdue: bool = False
    resident_sla_text: str = ""
    attachment_count: int = 0
    comment_count: int = 0
    created_at: datetime
    updated_at: datetime


class TicketDetailResponse(TicketResponse):
    attachments: list[TicketAttachmentResponse] = Field(default_factory=list)
    comments: list[TicketCommentResponse] = Field(default_factory=list)
    status_history: list[TicketStatusHistoryResponse] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# SLA Report Schemas
# ---------------------------------------------------------------------------

class CategorySlaStat(BaseModel):
    category: str
    category_label: str
    total_tickets: int
    resolved_tickets: int
    avg_resolution_hours: float
    within_sla_count: int
    sla_compliance_rate: float  # Percentage (0-100)


class SlaReportResponse(BaseModel):
    period: str
    total_tickets: int
    overall_sla_compliance_rate: float
    overall_avg_resolution_hours: float
    categories: list[CategorySlaStat]
    priority_breakdown: dict[str, int]
