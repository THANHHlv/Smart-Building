"""Notification models — multi-channel notification engine.

Supports in-app notifications, Zalo OA, SMS, Web Push, and Email with
template management, resident preferences, delivery auditing, and retry tracking.
"""

import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    String,
    Text,
    UniqueConstraint,
    Uuid,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDPrimaryKeyMixin


class NotificationCategory(str, enum.Enum):
    """Business category of the notification."""
    BILLING = "billing"
    ALERT = "alert"
    ANNOUNCEMENT = "announcement"
    MAINTENANCE = "maintenance"


class NotificationChannel(str, enum.Enum):
    """Delivery channels."""
    IN_APP = "in_app"
    PUSH = "push"
    SMS = "sms"
    ZALO = "zalo"
    EMAIL = "email"


class NotificationStatus(str, enum.Enum):
    """Lifecycle status of a notification."""
    PENDING = "pending"
    SENT = "sent"
    DELIVERED = "delivered"
    FAILED = "failed"
    READ = "read"


class DeliveryStatus(str, enum.Enum):
    """Status recorded in the delivery log for a single transmission attempt."""
    SENT = "sent"
    DELIVERED = "delivered"
    FAILED = "failed"
    RETRYING = "retrying"


class NotificationTemplate(Base, UUIDPrimaryKeyMixin):
    """Notification template decoupled from application code.

    Allows dynamic formatting without requiring service redeployment.
    """

    __tablename__ = "notification_templates"
    __table_args__ = (
        UniqueConstraint("code", "channel", name="uq_notification_templates_code_channel"),
        Index("ix_notification_templates_code", "code"),
    )

    code: Mapped[str] = mapped_column(String(100), nullable=False)
    channel: Mapped[NotificationChannel] = mapped_column(
        Enum(NotificationChannel, name="notification_channel", native_enum=False),
        nullable=False,
    )
    title_template: Mapped[str] = mapped_column(String(255), nullable=False)
    body_template: Mapped[str] = mapped_column(Text, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class NotificationPreference(Base, UUIDPrimaryKeyMixin):
    """Resident preference per category and channel.

    Allows residents to opt in/out of specific channels for billing,
    emergency alerts, maintenance, and announcements.
    """

    __tablename__ = "notification_preferences"
    __table_args__ = (
        UniqueConstraint("user_id", "category", "channel", name="uq_user_category_channel"),
        Index("ix_notification_preferences_user_category", "user_id", "category"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    category: Mapped[NotificationCategory] = mapped_column(
        Enum(NotificationCategory, name="notification_category", native_enum=False),
        nullable=False,
    )
    channel: Mapped[NotificationChannel] = mapped_column(
        Enum(NotificationChannel, name="notification_channel", native_enum=False),
        nullable=False,
    )
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    user = relationship("User")


class Notification(Base, UUIDPrimaryKeyMixin):
    """Individual notification instance destined for or delivered to a user."""

    __tablename__ = "notifications"
    __table_args__ = (
        Index("ix_notifications_user_created", "user_id", "created_at"),
        Index("ix_notifications_user_status", "user_id", "status"),
        Index(
            "ix_notifications_idempotency_key",
            "idempotency_key",
            unique=True,
            postgresql_where=text("idempotency_key IS NOT NULL"),
        ),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    category: Mapped[NotificationCategory] = mapped_column(
        Enum(NotificationCategory, name="notification_category", native_enum=False),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    channel: Mapped[NotificationChannel] = mapped_column(
        Enum(NotificationChannel, name="notification_channel", native_enum=False),
        nullable=False,
    )
    status: Mapped[NotificationStatus] = mapped_column(
        Enum(NotificationStatus, name="notification_status", native_enum=False),
        default=NotificationStatus.PENDING,
        nullable=False,
    )
    idempotency_key: Mapped[str | None] = mapped_column(String(120), nullable=True)
    data_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    read_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Relationships
    user = relationship("User")
    delivery_logs = relationship("NotificationDeliveryLog", back_populates="notification", cascade="all, delete-orphan")


class NotificationDeliveryLog(Base, UUIDPrimaryKeyMixin):
    """Audit log of delivery attempts across external providers.

    Omits sensitive OTP or credentials in long-term logs per security policy.
    """

    __tablename__ = "notification_delivery_log"
    __table_args__ = (
        Index("ix_delivery_log_notification_id", "notification_id"),
        Index("ix_delivery_log_sent_at", "sent_at"),
    )

    notification_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("notifications.id", ondelete="CASCADE"),
        nullable=False,
    )
    channel: Mapped[NotificationChannel] = mapped_column(
        Enum(NotificationChannel, name="notification_channel", native_enum=False),
        nullable=False,
    )
    provider: Mapped[str] = mapped_column(String(50), nullable=False)
    status: Mapped[DeliveryStatus] = mapped_column(
        Enum(DeliveryStatus, name="delivery_status", native_enum=False),
        default=DeliveryStatus.SENT,
        nullable=False,
    )
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    sent_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    retry_count: Mapped[int] = mapped_column(default=0, nullable=False)

    # Relationships
    notification = relationship("Notification", back_populates="delivery_logs")
