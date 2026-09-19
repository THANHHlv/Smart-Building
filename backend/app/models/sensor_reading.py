"""SensorReading model."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Index, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDPrimaryKeyMixin


class SensorReading(Base, UUIDPrimaryKeyMixin):
    """Individual sensor data point from a device."""

    __tablename__ = "sensor_readings"
    __table_args__ = (
        Index("ix_sensor_readings_device_timestamp", "device_id", "timestamp"),
        Index("ix_sensor_readings_metric_timestamp", "metric", "timestamp"),
    )

    device_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("devices.id", ondelete="CASCADE"),
        nullable=False,
    )
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    metric: Mapped[str] = mapped_column(String(50), nullable=False)
    value: Mapped[float] = mapped_column(Float, nullable=False)
    unit: Mapped[str] = mapped_column(String(20), nullable=False)

    # Relationships
    device = relationship("Device", back_populates="sensor_readings")
