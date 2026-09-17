"""Ticket / Work Order System models.

Supports:
- Auto-creation from AI anomaly detection or resident incident reports.
- State machine lifecycle tracking with append-only audit history.
- Multi-channel notification triggers and SLA compliance tracking.
"""

import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Index, Integer, JSON, String, Text, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class TicketSource(str, enum.Enum):
    """Source that initiated the work order."""

    AI_ANOMALY = "ai_anomaly"
    RESIDENT_REPORT = "resident_report"
    MANUAL_ADMIN = "manual_admin"


class TicketPriority(str, enum.Enum):
    """Priority level mapped to category and SLA thresholds."""

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class TicketStatus(str, enum.Enum):
    """Lifecycle state machine for tickets."""

    OPEN = "open"
    ASSIGNED = "assigned"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
    CLOSED = "closed"
    REOPENED = "reopened"


class TicketCategory(str, enum.Enum):
    """Work order category."""

    ELECTRICAL = "electrical"
    WATER = "water"
    ELEVATOR = "elevator"
    HVAC = "hvac"
    SECURITY = "security"
    FIRE_SAFETY = "fire_safety"
    GENERAL = "general"


class Technician(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Technician profile linked to user account."""

    __tablename__ = "technicians"
    __table_args__ = (
        Index("ix_technicians_user_id", "user_id"),
        Index("ix_technicians_is_active", "is_active"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    specialties: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    phone_number: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Relationships
    user = relationship("User", foreign_keys=[user_id], lazy="joined")
    assigned_tickets = relationship("Ticket", back_populates="technician")


class Ticket(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Central ticket / work order entity."""

    __tablename__ = "tickets"
    __table_args__ = (
        Index("ix_tickets_apartment_id", "apartment_id"),
        Index("ix_tickets_device_id", "device_id"),
        Index("ix_tickets_status", "status"),
        Index("ix_tickets_priority", "priority"),
        Index("ix_tickets_category", "category"),
        Index("ix_tickets_assigned_to", "assigned_to"),
        Index("ix_tickets_created_at", "created_at"),
        Index("ix_tickets_due_at", "due_at"),
    )

    source: Mapped[TicketSource] = mapped_column(
        Enum(TicketSource, name="ticket_source", native_enum=False),
        default=TicketSource.RESIDENT_REPORT,
        nullable=False,
    )
    apartment_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("apartments.id", ondelete="SET NULL"),
        nullable=True,
    )
    device_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("devices.id", ondelete="SET NULL"),
        nullable=True,
    )
    category: Mapped[str] = mapped_column(String(50), default="general", nullable=False)
    priority: Mapped[TicketPriority] = mapped_column(
        Enum(TicketPriority, name="ticket_priority", native_enum=False),
        default=TicketPriority.MEDIUM,
        nullable=False,
    )
    status: Mapped[TicketStatus] = mapped_column(
        Enum(TicketStatus, name="ticket_status", native_enum=False),
        default=TicketStatus.OPEN,
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)

    created_by: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    assigned_to: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("technicians.id", ondelete="SET NULL"),
        nullable=True,
    )

    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Resident evaluation after resolution
    rating: Mapped[int | None] = mapped_column(Integer, nullable=True)
    rating_comment: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    apartment = relationship("Apartment", foreign_keys=[apartment_id], lazy="selectin")
    device = relationship("Device", foreign_keys=[device_id], lazy="selectin")
    creator = relationship("User", foreign_keys=[created_by], lazy="selectin")
    technician = relationship("Technician", foreign_keys=[assigned_to], lazy="selectin", back_populates="assigned_tickets")

    attachments = relationship(
        "TicketAttachment",
        back_populates="ticket",
        cascade="all, delete-orphan",
        order_by="TicketAttachment.uploaded_at",
        lazy="selectin",
    )
    comments = relationship(
        "TicketComment",
        back_populates="ticket",
        cascade="all, delete-orphan",
        order_by="TicketComment.created_at",
        lazy="selectin",
    )
    status_history = relationship(
        "TicketStatusHistory",
        back_populates="ticket",
        cascade="all, delete-orphan",
        order_by="TicketStatusHistory.changed_at",
        lazy="selectin",
    )


class TicketAttachment(Base, UUIDPrimaryKeyMixin):
    """File attachment (photos, documents) for a ticket."""

    __tablename__ = "ticket_attachments"
    __table_args__ = (
        Index("ix_ticket_attachments_ticket_id", "ticket_id"),
    )

    ticket_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("tickets.id", ondelete="CASCADE"),
        nullable=False,
    )
    file_url: Mapped[str] = mapped_column(String(1024), nullable=False)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_size: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    mime_type: Mapped[str] = mapped_column(String(100), default="image/jpeg", nullable=False)
    uploaded_by: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    ticket = relationship("Ticket", back_populates="attachments")
    uploader = relationship("User", foreign_keys=[uploaded_by], lazy="selectin")


class TicketComment(Base, UUIDPrimaryKeyMixin):
    """Comment / conversation thread on a ticket."""

    __tablename__ = "ticket_comments"
    __table_args__ = (
        Index("ix_ticket_comments_ticket_id", "ticket_id"),
        Index("ix_ticket_comments_created_at", "created_at"),
    )

    ticket_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("tickets.id", ondelete="CASCADE"),
        nullable=False,
    )
    author_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    comment: Mapped[str] = mapped_column(Text, nullable=False)
    is_internal: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    ticket = relationship("Ticket", back_populates="comments")
    author = relationship("User", foreign_keys=[author_id], lazy="selectin")


class TicketStatusHistory(Base, UUIDPrimaryKeyMixin):
    """Append-only audit log of ticket state machine transitions."""

    __tablename__ = "ticket_status_history"
    __table_args__ = (
        Index("ix_ticket_status_history_ticket_id", "ticket_id"),
        Index("ix_ticket_status_history_changed_at", "changed_at"),
    )

    ticket_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("tickets.id", ondelete="CASCADE"),
        nullable=False,
    )
    from_status: Mapped[str | None] = mapped_column(String(50), nullable=True)
    to_status: Mapped[str] = mapped_column(String(50), nullable=False)
    changed_by: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    changed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    note: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    ticket = relationship("Ticket", back_populates="status_history")
    user = relationship("User", foreign_keys=[changed_by], lazy="selectin")
