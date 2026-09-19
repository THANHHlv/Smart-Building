"""Report Export model — tracking asynchronous report exports."""

import datetime
import uuid
from typing import Any

from sqlalchemy import (
    BigInteger,
    DateTime,
    ForeignKey,
    Index,
    JSON,
    String,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDPrimaryKeyMixin


class ReportExport(Base, UUIDPrimaryKeyMixin):
    """Tracks generated periodic reports exported for building management.

    Supports:
    - Monthly collection report (collection)
    - Overdue debts report (overdue)
    - Maintenance / tickets report (tickets)
    - Transaction reconciliation report (reconciliation)
    """

    __tablename__ = "report_exports"
    __table_args__ = (
        Index("ix_report_exports_report_type", "report_type"),
        Index("ix_report_exports_status", "status"),
        Index("ix_report_exports_requested_at", "requested_at"),
        Index("ix_report_exports_expires_at", "expires_at"),
    )

    report_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        comment="collection | overdue | tickets | reconciliation",
    )
    params: Mapped[dict[str, Any]] = mapped_column(
        JSON,
        default=dict,
        nullable=False,
    )
    format: Mapped[str] = mapped_column(
        String(10),
        default="xlsx",
        nullable=False,
        comment="xlsx | pdf | csv",
    )
    status: Mapped[str] = mapped_column(
        String(20),
        default="pending",
        nullable=False,
        comment="pending | processing | completed | failed",
    )
    file_url: Mapped[str | None] = mapped_column(
        String(1024),
        nullable=True,
    )
    file_size_bytes: Mapped[int] = mapped_column(
        BigInteger,
        default=0,
        nullable=False,
    )
    requested_by: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    requested_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    expires_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Auto-cleanup expiration timestamp",
    )

    # Relationships
    requester = relationship("User", foreign_keys=[requested_by], lazy="joined")
