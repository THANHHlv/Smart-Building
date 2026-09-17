"""Maintenance Ticket model — tracking resident service requests and technician maintenance."""

import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class TicketUrgency(str, enum.Enum):
    """Urgency level of the maintenance ticket."""

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class TicketStatus(str, enum.Enum):
    """Lifecycle status of the maintenance ticket."""

    OPEN = "open"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
    CANCELLED = "cancelled"


class MaintenanceTicket(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Maintenance ticket submitted by residents or created by facility operators."""

    __tablename__ = "maintenance_tickets"
    __table_args__ = (
        Index("ix_maintenance_apartment_id", "apartment_id"),
        Index("ix_maintenance_user_id", "user_id"),
        Index("ix_maintenance_status", "status"),
        Index("ix_maintenance_created_at", "created_at"),
    )

    apartment_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("apartments.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(String(50), default="general", nullable=False)
    urgency: Mapped[str] = mapped_column(String(50), default="medium", nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="open", nullable=False)
    technician_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    apartment = relationship("Apartment", foreign_keys=[apartment_id], lazy="selectin")
    user = relationship("User", foreign_keys=[user_id], lazy="selectin")
