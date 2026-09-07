"""Device model."""

import enum
import uuid

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Index, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class DeviceStatus(str, enum.Enum):
    """Device operational status."""

    ONLINE = "online"
    OFFLINE = "offline"
    MAINTENANCE = "maintenance"
    ERROR = "error"


class Device(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Represents an IoT device installed in an apartment."""

    __tablename__ = "devices"
    __table_args__ = (
        Index("ix_devices_apartment_id", "apartment_id"),
    )

    device_code: Mapped[str] = mapped_column(
        String(100), unique=True, nullable=False
    )
    apartment_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("apartments.id", ondelete="CASCADE"),
        nullable=False,
    )
    device_type_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("device_types.id", ondelete="RESTRICT"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[DeviceStatus] = mapped_column(
        Enum(DeviceStatus, name="device_status"),
        default=DeviceStatus.OFFLINE,
        nullable=False,
    )
    installed_at: Mapped[str | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_seen_at: Mapped[str | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    apartment = relationship("Apartment", back_populates="devices")
    device_type = relationship("DeviceType", back_populates="devices", lazy="joined")
    sensor_readings = relationship("SensorReading", back_populates="device")
