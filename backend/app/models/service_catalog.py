"""Service Catalog model — global or building-level services."""

import uuid

from sqlalchemy import Boolean, Enum, ForeignKey, Index, Numeric, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDPrimaryKeyMixin
from app.models.invoice_item import ServiceType


class ServiceCatalog(Base, UUIDPrimaryKeyMixin):
    """Catalog of services available in a building (e.g., electricity, parking)."""

    __tablename__ = "service_catalog"
    __table_args__ = (
        Index("ix_service_catalog_building_id", "building_id"),
    )

    building_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("buildings.id", ondelete="CASCADE"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    service_type: Mapped[ServiceType] = mapped_column(
        Enum(ServiceType, name="service_type", native_enum=False),
        nullable=False,
    )
    is_recurring: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_optional: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    unit: Mapped[str] = mapped_column(String(50), nullable=False, default="month")
    default_price: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)

    # Relationships
    building = relationship("Building")
