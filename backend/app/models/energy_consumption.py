"""EnergyConsumption model."""

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Index, Numeric, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, UUIDPrimaryKeyMixin


class EnergyConsumption(Base, UUIDPrimaryKeyMixin):
    """Aggregated energy consumption per apartment over time."""

    __tablename__ = "energy_consumption"
    __table_args__ = (
        Index(
            "ix_energy_consumption_apartment_timestamp",
            "apartment_id",
            "timestamp",
        ),
    )

    apartment_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("apartments.id", ondelete="CASCADE"),
        nullable=False,
    )
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    value_kwh: Mapped[Decimal] = mapped_column(Numeric(12, 4), nullable=False)

