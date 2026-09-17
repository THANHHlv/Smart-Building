"""PaymentAuditLog model — immutable, append-only audit trail for payment events.

SECURITY: This table is append-only. No UPDATE or DELETE operations
should ever be performed on it. Every payment-related state change,
webhook event, or administrative action is recorded here.

The metadata_json field MUST NEVER contain sensitive data such as
card numbers, CVVs, bank account details, or raw gateway tokens.
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String, Uuid, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDPrimaryKeyMixin


class PaymentAuditLog(Base, UUIDPrimaryKeyMixin):
    """Immutable audit log entry for a payment transaction event.

    Records every state transition, webhook receipt, and administrative
    action on payment transactions. This table must never be updated
    or deleted from — only appended to.
    """

    __tablename__ = "payment_audit_log"
    __table_args__ = (
        Index(
            "ix_payment_audit_log_txn_created",
            "transaction_id",
            "created_at",
        ),
    )

    transaction_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("transactions.id", ondelete="RESTRICT"),
        nullable=False,
    )
    event_type: Mapped[str] = mapped_column(
        String(100), nullable=False
    )
    old_status: Mapped[str | None] = mapped_column(
        String(50), nullable=True
    )
    new_status: Mapped[str | None] = mapped_column(
        String(50), nullable=True
    )
    actor: Mapped[str] = mapped_column(
        String(255), nullable=False, default="system"
    )
    ip_address: Mapped[str | None] = mapped_column(
        String(45), nullable=True
    )
    metadata_json: Mapped[dict | None] = mapped_column(
        JSONB, nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    transaction = relationship("Transaction", back_populates="audit_logs")
