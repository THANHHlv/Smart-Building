"""Bulk Job model — tracking asynchronous batch background jobs."""

import datetime
import uuid
from typing import Any

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Index,
    Integer,
    JSON,
    String,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDPrimaryKeyMixin


class BulkJob(Base, UUIDPrimaryKeyMixin):
    """Tracks asynchronous background operations for mass actions.

    Includes bulk invoice issuance, mass overdue reminder broadcasts,
    and bulk manual payment approvals.
    """

    __tablename__ = "bulk_jobs"
    __table_args__ = (
        Index("ix_bulk_jobs_job_type", "job_type"),
        Index("ix_bulk_jobs_status", "status"),
        Index("ix_bulk_jobs_created_at", "created_at"),
    )

    job_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        comment="invoice_generation | overdue_reminders | manual_confirmations_approval",
    )
    status: Mapped[str] = mapped_column(
        String(20),
        default="pending",
        nullable=False,
        comment="pending | processing | completed | failed",
    )
    total_items: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    processed_items: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    failed_items: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    params: Mapped[dict[str, Any]] = mapped_column(
        JSON,
        default=dict,
        nullable=False,
    )
    error_summary: Mapped[list[Any]] = mapped_column(
        JSON,
        default=list,
        nullable=False,
    )
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    finished_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Relationships
    creator = relationship("User", foreign_keys=[created_by], lazy="joined")
