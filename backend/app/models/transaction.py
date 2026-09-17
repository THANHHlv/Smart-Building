"""Transaction model — payment transaction record.

DESIGN DECISION: Transaction records are effectively append-only.
Status transitions are tracked via the PaymentAuditLog table.
The 'status' field on Transaction IS updated in-place for query efficiency,
but every change is also recorded in the audit log.
"""

import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Numeric,
    String,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDPrimaryKeyMixin
from app.models.payment_method import PaymentProvider


class TransactionStatus(str, enum.Enum):
    """Payment transaction lifecycle states."""

    PENDING = "pending"
    PROCESSING = "processing"
    SUCCESS = "success"
    FAILED = "failed"
    REFUNDED = "refunded"
    CANCELLED = "cancelled"


class Transaction(Base, UUIDPrimaryKeyMixin):
    """Payment transaction linked to an invoice.

    Every status change is also recorded in payment_audit_log
    for a full, immutable history trail.
    """

    __tablename__ = "transactions"
    __table_args__ = (
        Index("ix_transactions_invoice_id", "invoice_id"),
        Index(
            "ix_transactions_provider_txn_id",
            "provider_txn_id",
            unique=True,
            postgresql_where="provider_txn_id IS NOT NULL",
        ),
        Index("ix_transactions_idempotency_key", "idempotency_key", unique=True),
    )

    invoice_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("invoices.id", ondelete="RESTRICT"),
        nullable=False,
    )
    provider: Mapped[PaymentProvider] = mapped_column(
        Enum(PaymentProvider, name="payment_provider", native_enum=False, create_constraint=False),
        nullable=False,
    )
    provider_txn_id: Mapped[str | None] = mapped_column(
        String(255), nullable=True
    )
    idempotency_key: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False
    )
    amount: Mapped[float] = mapped_column(
        Numeric(12, 2), nullable=False
    )
    currency: Mapped[str] = mapped_column(
        String(10), nullable=False, default="VND"
    )
    status: Mapped[TransactionStatus] = mapped_column(
        Enum(TransactionStatus, name="transaction_status", native_enum=False),
        default=TransactionStatus.PENDING,
        nullable=False,
    )
    provider_response_code: Mapped[str | None] = mapped_column(
        String(50), nullable=True
    )
    provider_message: Mapped[str | None] = mapped_column(
        String(500), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    invoice = relationship("Invoice", back_populates="transactions")
    audit_logs = relationship(
        "PaymentAuditLog", back_populates="transaction", lazy="selectin",
    )
