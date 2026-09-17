"""BillingCycle model — tracks monthly billing periods per apartment."""

import enum
import uuid
from datetime import date

from sqlalchemy import Date, Enum, ForeignKey, Index, String, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class BillingCycleStatus(str, enum.Enum):
    """Lifecycle states for a billing cycle."""

    OPEN = "open"  # Accumulating consumption data
    CALCULATED = "calculated"  # Consumption computed, ready for invoicing
    INVOICED = "invoiced"  # Invoice generated
    CLOSED = "closed"  # Fully settled or expired


class BillingCycle(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Monthly billing cycle bound to an apartment."""

    __tablename__ = "billing_cycles"
    __table_args__ = (
        UniqueConstraint(
            "apartment_id",
            "period_start",
            name="uq_billing_cycle_apartment_period",
        ),
        Index(
            "ix_billing_cycles_apartment_period",
            "apartment_id",
            "period_start",
        ),
    )

    apartment_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("apartments.id", ondelete="CASCADE"),
        nullable=False,
    )
    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    period_end: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[BillingCycleStatus] = mapped_column(
        Enum(BillingCycleStatus, name="billing_cycle_status", native_enum=False),
        default=BillingCycleStatus.OPEN,
        nullable=False,
    )

    # Relationships
    apartment = relationship("Apartment", foreign_keys=[apartment_id])
    invoices = relationship("Invoice", back_populates="billing_cycle", lazy="selectin")
