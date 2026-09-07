"""DeviceType model."""

from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class DeviceType(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Catalog of device types (e.g., electricity_meter, thermometer, water_meter)."""

    __tablename__ = "device_types"

    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    unit: Mapped[str] = mapped_column(String(20), nullable=False)  # kW, °C, L/min, %

    # Relationships
    devices = relationship("Device", back_populates="device_type")
