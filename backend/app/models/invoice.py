"""Invoice model — billing document issued to an apartment for a billing cycle."""

import enum
import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Numeric,
    String,
    Text,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class InvoiceStatus(str, enum.Enum):
    """Lifecycle states for an invoice."""

    DRAFT = "draft"
    PENDING = "pending"  # Awaiting payment
    PAID = "paid"
    OVERDUE = "overdue"
    CANCELLED = "cancelled"


class Invoice(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Billing invoice for an apartment within a billing cycle."""

    __tablename__ = "invoices"
    __table_args__ = (
        Index("ix_invoices_apartment_status", "apartment_id", "status"),
        Index("ix_invoices_due_date", "due_date"),
        CheckConstraint("total_amount >= 0", name="ck_invoice_total_non_negative"),
    )

    apartment_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("apartments.id", ondelete="RESTRICT"),
        nullable=False,
    )
    billing_cycle_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("billing_cycles.id", ondelete="RESTRICT"),
        nullable=False,
    )
    invoice_number: Mapped[str] = mapped_column(
        String(50), unique=True, nullable=False
    )
    total_amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False, default=0
    )
    currency: Mapped[str] = mapped_column(
        String(10), nullable=False, default="VND"
    )
    status: Mapped[InvoiceStatus] = mapped_column(
        Enum(InvoiceStatus, name="invoice_status", native_enum=False),
        default=InvoiceStatus.DRAFT,
        nullable=False,
    )
    due_date: Mapped[date] = mapped_column(Date, nullable=False)
    paid_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    apartment = relationship("Apartment", foreign_keys=[apartment_id])
    billing_cycle = relationship("BillingCycle", back_populates="invoices")
    items = relationship(
        "InvoiceItem", back_populates="invoice", lazy="selectin",
        cascade="all, delete-orphan",
    )
    transactions = relationship(
        "Transaction", back_populates="invoice", lazy="selectin",
    )

