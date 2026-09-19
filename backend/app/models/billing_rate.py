"""Billing Rate model — versioned building utility & management rates with effective dates."""

import datetime
import uuid

from sqlalchemy import (
    Date,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDPrimaryKeyMixin


class BillingRate(Base, UUIDPrimaryKeyMixin):
    """Building utility and management service rates versioned by effective_date.

    Guarantees historical isolation: updating rates applies only to billing
    cycles on or after effective_date and NEVER alters already generated invoice items.
    """

    __tablename__ = "billing_rates"
    __table_args__ = (
        Index("ix_billing_rates_building_id", "building_id"),
        Index("ix_billing_rates_effective_date", "effective_date"),
        Index("ix_billing_rates_lookup", "building_id", "effective_date"),
    )

    building_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("buildings.id", ondelete="CASCADE"),
        nullable=False,
    )
    water_price_per_m3: Mapped[float] = mapped_column(
        Numeric(12, 2),
        nullable=False,
        comment="Unit price in VND per cubic meter of water",
    )
    management_fee_per_sqm: Mapped[float] = mapped_column(
        Numeric(12, 2),
        nullable=False,
        comment="Unit price in VND per square meter of apartment area",
    )
    parking_fee_per_slot: Mapped[float] = mapped_column(
        Numeric(12, 2),
        nullable=False,
        comment="Flat fee in VND per vehicle parking slot",
    )
    effective_date: Mapped[datetime.date] = mapped_column(
        Date,
        nullable=False,
        comment="The date from which this rate schedule takes effect",
    )
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    building = relationship("Building", foreign_keys=[building_id], lazy="joined")
    creator = relationship("User", foreign_keys=[created_by], lazy="joined")
