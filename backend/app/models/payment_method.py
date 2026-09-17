"""PaymentMethod model — tokenized payment credentials for a user.

SECURITY: This table NEVER stores real card numbers or bank account details.
Only gateway-issued tokens (token_reference) are persisted.
"""

import enum
import uuid

from sqlalchemy import Boolean, Enum, ForeignKey, Index, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class PaymentProvider(str, enum.Enum):
    """Supported payment gateway providers."""

    VNPAY = "vnpay"
    MOMO = "momo"
    ZALOPAY = "zalopay"
    STRIPE = "stripe"


class PaymentMethod(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Tokenized payment method belonging to a user.

    The token_reference field stores ONLY the gateway-issued token,
    never raw card numbers or bank account details.
    """

    __tablename__ = "payment_methods"
    __table_args__ = (
        Index("ix_payment_methods_user_active", "user_id", "is_active"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    provider: Mapped[PaymentProvider] = mapped_column(
        Enum(PaymentProvider, name="payment_provider", native_enum=False),
        nullable=False,
    )
    token_reference: Mapped[str] = mapped_column(
        String(500), nullable=False
    )
    display_name: Mapped[str] = mapped_column(
        String(100), nullable=False, default="Phương thức thanh toán"
    )
    is_default: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False
    )

    # Relationships
    user = relationship("User", foreign_keys=[user_id])
