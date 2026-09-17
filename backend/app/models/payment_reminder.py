"""Payment Reminder model — tracking reminder notifications for invoices."""

import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, ForeignKey, Index, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDPrimaryKeyMixin


class ReminderChannel(str, enum.Enum):
    """Communication channels for payment reminders."""
    APP = "app"
    SMS = "sms"
    ZALO = "zalo"
    EMAIL = "email"


class ReminderStatus(str, enum.Enum):
    """Statuses for reminder delivery."""
    PENDING = "pending"
    SENT = "sent"
    FAILED = "failed"


class PaymentReminder(Base, UUIDPrimaryKeyMixin):
    """Record of a payment reminder sent to a resident."""

    __tablename__ = "payment_reminders"
    __table_args__ = (
        Index("ix_payment_reminders_invoice_id", "invoice_id"),
    )

    invoice_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("invoices.id", ondelete="CASCADE"),
        nullable=False,
    )
    channel: Mapped[ReminderChannel] = mapped_column(
        Enum(ReminderChannel, name="reminder_channel", native_enum=False),
        nullable=False,
    )
    status: Mapped[ReminderStatus] = mapped_column(
        Enum(ReminderStatus, name="reminder_status", native_enum=False),
        default=ReminderStatus.PENDING,
        nullable=False,
    )
    sent_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    
    # Relationships
    invoice = relationship("Invoice")
