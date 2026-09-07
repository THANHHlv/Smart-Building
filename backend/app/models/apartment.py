"""Apartment model."""

import uuid

from sqlalchemy import Boolean, Float, ForeignKey, Integer, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Apartment(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Represents an apartment unit within a floor."""

    __tablename__ = "apartments"

    floor_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("floors.id", ondelete="CASCADE"),
        nullable=False,
    )
    unit_number: Mapped[str] = mapped_column(String(50), nullable=False)
    area_sqm: Mapped[float | None] = mapped_column(Float, nullable=True)
    num_rooms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    resident_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    floor = relationship("Floor", back_populates="apartments")
    devices = relationship("Device", back_populates="apartment", lazy="selectin")
