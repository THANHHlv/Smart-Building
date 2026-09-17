"""Late Fee Policy model — configuring overdue penalties per building."""

import uuid

from sqlalchemy import ForeignKey, Index, Integer, Numeric, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDPrimaryKeyMixin


class LateFeePolicy(Base, UUIDPrimaryKeyMixin):
    """Configuration for calculating late payment fees."""

    __tablename__ = "late_fee_policies"
    __table_args__ = (
        Index("ix_late_fee_policies_building_id", "building_id"),
    )

    building_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("buildings.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    grace_period_days: Mapped[int] = mapped_column(Integer, default=5, nullable=False)
    daily_rate_percent: Mapped[float] = mapped_column(Numeric(5, 4), default=0.0005, nullable=False)

    # Relationships
    building = relationship("Building")
