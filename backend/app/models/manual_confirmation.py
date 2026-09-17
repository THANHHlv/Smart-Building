"""Manual Confirmation model — tracking manual payments (cash, manual bank transfer)."""

import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, ForeignKey, Index, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDPrimaryKeyMixin


class ManualPaymentMethod(str, enum.Enum):
    """Manual payment methods reported by residents."""
    CASH = "cash"
    BANK_TRANSFER = "bank_transfer"


class ManualConfirmationStatus(str, enum.Enum):
    """Statuses for manual confirmation flow."""
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class ManualConfirmation(Base, UUIDPrimaryKeyMixin):
    """A record of manual payment submission and admin approval."""

    __tablename__ = "manual_confirmations"
    __table_args__ = (
        Index("ix_manual_confirmations_invoice_id", "invoice_id"),
    )

    invoice_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("invoices.id", ondelete="CASCADE"),
        nullable=False,
    )
    status: Mapped[ManualConfirmationStatus] = mapped_column(
        Enum(ManualConfirmationStatus, name="manual_confirmation_status", native_enum=False),
        default=ManualConfirmationStatus.PENDING,
        nullable=False,
    )
    method: Mapped[ManualPaymentMethod] = mapped_column(
        Enum(ManualPaymentMethod, name="manual_payment_method", native_enum=False),
        nullable=False,
    )
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    # Audit fields
    submitted_by: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    submitted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    confirmed_by: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    confirmed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relationships
    invoice = relationship("Invoice")
    submitter = relationship("User", foreign_keys=[submitted_by])
    confirmer = relationship("User", foreign_keys=[confirmed_by])
