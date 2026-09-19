"""Self-service requests and community amenity models.

Extends the Ticket System with proactive resident service requests and
provides a community amenity booking system with database-level concurrency
protection against double-booking.
"""

import datetime
import uuid
from typing import Any

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    JSON,
    String,
    Text,
    Uuid,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class ServiceRequest(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Proactive resident service request extending the core Ticket model.

    Linked 1-to-1 to a ticket to reuse the state machine, technician dispatch,
    attachments, comments, and resident rating.
    """

    __tablename__ = "service_requests"
    __table_args__ = (
        Index("ix_service_requests_ticket_id", "ticket_id"),
        Index("ix_service_requests_request_type", "request_type"),
    )

    ticket_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("tickets.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    request_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        comment="cleaning | periodic_maintenance | vehicle_registration | access_card | other",
    )
    scheduled_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    scheduled_slot: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
        comment="e.g. '08:00 - 10:00', '14:00 - 16:00'",
    )
    notes: Mapped[dict[str, Any]] = mapped_column(
        JSON,
        default=dict,
        nullable=False,
        comment="Domain-specific metadata (license plate, vehicle type, cleaning package, card type)",
    )

    # Relationships
    ticket = relationship("Ticket", foreign_keys=[ticket_id], lazy="joined")


class Amenity(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Building amenity available for resident booking (e.g. Community Room, BBQ, Playground)."""

    __tablename__ = "amenities"
    __table_args__ = (
        Index("ix_amenities_building_id", "building_id"),
        Index("ix_amenities_is_active", "is_active"),
    )

    building_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("buildings.id", ondelete="CASCADE"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    capacity: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    available_slots: Mapped[list[str]] = mapped_column(
        JSON,
        default=list,
        nullable=False,
        comment="Configurable time slots list e.g. ['08:00 - 10:00', '14:00 - 16:00']",
    )
    requires_approval: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    building = relationship("Building", foreign_keys=[building_id], lazy="selectin")
    bookings = relationship("AmenityBooking", back_populates="amenity", cascade="all, delete-orphan")


class AmenityBooking(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Resident reservation for a community amenity.

    Guarantees zero double-booking via partial unique index at the database level.
    """

    __tablename__ = "amenity_bookings"
    __table_args__ = (
        Index("ix_amenity_bookings_amenity_id", "amenity_id"),
        Index("ix_amenity_bookings_apartment_id", "apartment_id"),
        Index("ix_amenity_bookings_user_id", "user_id"),
        Index("ix_amenity_bookings_booking_date", "booking_date"),
        Index("ix_amenity_bookings_status", "status"),
        # Partial unique index: 2 residents cannot book the same slot on the same date for the same amenity
        Index(
            "uq_amenity_slot_active",
            "amenity_id",
            "booking_date",
            "time_slot",
            unique=True,
            postgresql_where=text("status IN ('pending', 'confirmed')"),
        ),
    )

    amenity_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("amenities.id", ondelete="CASCADE"),
        nullable=False,
    )
    apartment_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("apartments.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    booking_date: Mapped[datetime.date] = mapped_column(Date, nullable=False)
    time_slot: Mapped[str] = mapped_column(String(50), nullable=False)
    status: Mapped[str] = mapped_column(
        String(20),
        default="confirmed",
        nullable=False,
        comment="pending | confirmed | cancelled | completed",
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    amenity = relationship("Amenity", back_populates="bookings", lazy="joined")
    apartment = relationship("Apartment", foreign_keys=[apartment_id], lazy="joined")
    user = relationship("User", foreign_keys=[user_id], lazy="joined")
