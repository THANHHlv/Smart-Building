"""WaterConsumption model."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Index, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, UUIDPrimaryKeyMixin


class WaterConsumption(Base, UUIDPrimaryKeyMixin):
    """Aggregated water consumption per apartment over time."""

    __tablename__ = "water_consumption"
    __table_args__ = (
        Index(
            "ix_water_consumption_apartment_timestamp",
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
    value_liters: Mapped[float] = mapped_column(Float, nullable=False)
