"""User Profile, Apartment Resident mapping, and Technician Profile models."""

import enum
import uuid
from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    JSON,
    String,
    Text,
    Uuid,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship as sa_relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class ResidentRelationship(str, enum.Enum):
    """Relationship of a resident to an apartment."""

    OWNER = "owner"
    TENANT = "tenant"
    FAMILY_MEMBER = "family_member"
    OTHER = "other"


class ResidentStatus(str, enum.Enum):
    """Residency status in an apartment."""

    ACTIVE = "active"
    MOVED_OUT = "moved_out"


class Profile(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Personal profile information separated from authentication credentials."""

    __tablename__ = "profiles"
    __table_args__ = (
        Index("ix_profiles_user_id", "user_id"),
        CheckConstraint("date_of_birth <= CURRENT_DATE", name="ck_profile_dob_not_future"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    full_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    date_of_birth: Mapped[date | None] = mapped_column(Date, nullable=True)
    gender: Mapped[str | None] = mapped_column(String(20), nullable=True)  # 'male' | 'female' | 'other'
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    national_id_masked: Mapped[str | None] = mapped_column(String(50), nullable=True)  # e.g. 037***1234
    emergency_contact_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    emergency_contact_phone: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Relationship back to user
    user = sa_relationship("User", back_populates="profile")


class ApartmentResident(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """N-N mapping between apartments and residents, preserving moving history."""

    __tablename__ = "apartment_residents"
    __table_args__ = (
        Index("ix_apartment_residents_apartment_id", "apartment_id"),
        Index("ix_apartment_residents_user_id", "user_id"),
        Index("ix_apartment_residents_status", "status"),
        # PostgreSQL Partial Unique Index: only 1 active primary contact per apartment
        Index(
            "uq_apartment_primary_contact",
            "apartment_id",
            unique=True,
            postgresql_where=text("is_primary_contact = true AND status = 'active'"),
        ),
        # Prevent duplicate active occupancy records for the same user in the same apartment
        Index(
            "uq_apartment_user_active",
            "apartment_id",
            "user_id",
            unique=True,
            postgresql_where=text("status = 'active'"),
        ),
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
    relationship: Mapped[ResidentRelationship] = mapped_column(
        Enum(
            ResidentRelationship,
            name="resident_relationship",
            native_enum=False,
            values_callable=lambda obj: [e.value for e in obj],
        ),
        default=ResidentRelationship.OWNER,
        nullable=False,
    )
    is_primary_contact: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    moved_in_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    moved_out_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[ResidentStatus] = mapped_column(
        Enum(
            ResidentStatus,
            name="resident_status",
            native_enum=False,
            values_callable=lambda obj: [e.value for e in obj],
        ),
        default=ResidentStatus.ACTIVE,
        nullable=False,
    )

    # Relationships
    apartment = sa_relationship("Apartment", back_populates="residents")
    user = sa_relationship("User", back_populates="apartment_residencies")


class TechnicianProfile(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Role-specific profile extension for technicians."""

    __tablename__ = "technician_profiles"
    __table_args__ = (
        Index("ix_technician_profiles_user_id", "user_id"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    specialties: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    certification_info: Mapped[str | None] = mapped_column(Text, nullable=True)
    active_building_ids: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)

    # Relationship back to user
    user = sa_relationship("User", back_populates="technician_profile")
