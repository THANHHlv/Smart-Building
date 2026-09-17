"""InvoiceItem model — line item within an invoice."""

import enum
import uuid

from sqlalchemy import Enum, ForeignKey, Index, Numeric, String, Text, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDPrimaryKeyMixin


class ServiceType(str, enum.Enum):
    """Billable service categories."""

    ELECTRICITY = "electricity"
    WATER = "water"
    MANAGEMENT_FEE = "management_fee"
    PARKING = "parking"
    MAINTENANCE = "maintenance"
    OTHER = "other"


class InvoiceItem(Base, UUIDPrimaryKeyMixin):
    """Single line item on an invoice (e.g. electricity charge, parking fee)."""

    __tablename__ = "invoice_items"
    __table_args__ = (
        Index("ix_invoice_items_invoice_id", "invoice_id"),
    )

    invoice_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("invoices.id", ondelete="CASCADE"),
        nullable=False,
    )
    service_catalog_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("service_catalog.id", ondelete="SET NULL"),
        nullable=True,
    )
    service_type: Mapped[ServiceType] = mapped_column(
        Enum(ServiceType, name="service_type", native_enum=False),
        nullable=False,
    )
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    quantity: Mapped[float | None] = mapped_column(Numeric(12, 4), nullable=True)
    unit_price: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    metadata_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    # Relationships
    invoice = relationship("Invoice", back_populates="items")
