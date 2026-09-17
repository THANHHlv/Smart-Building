"""Apartment Service model — services registered by an apartment."""

import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Index, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class ApartmentServiceStatus(str, enum.Enum):
    """Lifecycle states for an apartment service subscription."""
    ACTIVE = "active"
    SUSPENDED = "suspended"
    CANCELLED = "cancelled"


class ApartmentService(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Subscription record of an apartment to a service."""

    __tablename__ = "apartment_services"
    __table_args__ = (
        Index("ix_apartment_services_apartment_id", "apartment_id"),
        Index("ix_apartment_services_catalog_id", "service_catalog_id"),
    )

    apartment_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("apartments.id", ondelete="CASCADE"),
        nullable=False,
    )
    service_catalog_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("service_catalog.id", ondelete="RESTRICT"),
        nullable=False,
    )
    status: Mapped[ApartmentServiceStatus] = mapped_column(
        Enum(ApartmentServiceStatus, name="apartment_service_status", native_enum=False),
        default=ApartmentServiceStatus.ACTIVE,
        nullable=False,
    )
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    auto_pay_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Relationships
    apartment = relationship("Apartment")
    service_catalog = relationship("ServiceCatalog")
