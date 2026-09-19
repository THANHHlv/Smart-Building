"""Building Community Bulletin Board models.

Supports:
- Social-feed-style announcements with categories (maintenance, event, safety, general).
- Urgent announcements with immediate notification broadcast and terracotta highlight.
- Auto-expiring feed via `expires_at` and pin-to-top feature.
- Per-resident read tracking with unread count metrics.
"""

import datetime
import uuid

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    String,
    Text,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Announcement(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Building announcement posted by management/admin."""

    __tablename__ = "announcements"
    __table_args__ = (
        Index("ix_announcements_building_id", "building_id"),
        Index("ix_announcements_category", "category"),
        Index("ix_announcements_priority", "priority"),
        Index("ix_announcements_is_active", "is_active"),
        Index("ix_announcements_pin_to_top", "pin_to_top"),
        Index("ix_announcements_published_at", "published_at"),
        Index("ix_announcements_expires_at", "expires_at"),
        Index("ix_announcements_feed_sort", "building_id", "is_active", "pin_to_top", "published_at"),
    )

    building_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("buildings.id", ondelete="CASCADE"),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(
        String(50),
        default="general",
        nullable=False,
        comment="maintenance | event | safety | general",
    )
    priority: Mapped[str] = mapped_column(
        String(50),
        default="standard",
        nullable=False,
        comment="urgent | standard",
    )
    published_by: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    published_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    expires_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="When set, hides from active resident feed after expiration",
    )
    pin_to_top: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    image_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
        comment="Soft-delete flag",
    )

    # Relationships
    building = relationship("Building", foreign_keys=[building_id], lazy="selectin")
    publisher = relationship("User", foreign_keys=[published_by], lazy="joined")
    reads = relationship("AnnouncementRead", back_populates="announcement", cascade="all, delete-orphan")


class AnnouncementRead(Base, UUIDPrimaryKeyMixin):
    """Tracks which resident has read an announcement for unread badges and auditing."""

    __tablename__ = "announcement_reads"
    __table_args__ = (
        Index("ix_announcement_reads_announcement_id", "announcement_id"),
        Index("ix_announcement_reads_user_id", "user_id"),
        UniqueConstraint("announcement_id", "user_id", name="uq_announcement_user_read"),
    )

    announcement_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("announcements.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    read_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    announcement = relationship("Announcement", back_populates="reads", lazy="joined")
    user = relationship("User", foreign_keys=[user_id], lazy="joined")
