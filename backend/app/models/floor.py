"""Floor model."""

import uuid

from sqlalchemy import ForeignKey, Integer, String, Uuid, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Floor(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Represents a floor within a building."""

    __tablename__ = "floors"
    __table_args__ = (
        UniqueConstraint("building_id", "floor_number", name="uq_floor_building_number"),
    )

    building_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("buildings.id", ondelete="CASCADE"),
        nullable=False,
    )
    floor_number: Mapped[int] = mapped_column(Integer, nullable=False)
    name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Relationships
    building = relationship("Building", back_populates="floors")
    apartments = relationship("Apartment", back_populates="floor", lazy="selectin")
