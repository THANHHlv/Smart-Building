"""User model with role-based access control, profile binding, and apartment residency."""

import uuid

from sqlalchemy import Boolean, ForeignKey, String, Uuid, select
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class User(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """User account strictly scoped to authentication credentials and account status."""

    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    role: Mapped[str] = mapped_column(String(50), default="resident", nullable=False)  # 'admin' | 'resident'
    apartment_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("apartments.id", ondelete="SET NULL"),
        nullable=True,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_superuser: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Relationships
    apartment = relationship("Apartment", foreign_keys=[apartment_id], lazy="joined")
    profile = relationship(
        "Profile",
        back_populates="user",
        uselist=False,
        lazy="joined",
        cascade="all, delete-orphan",
    )
    apartment_residencies = relationship(
        "ApartmentResident",
        back_populates="user",
        lazy="selectin",
        cascade="all, delete-orphan",
    )
    technician_profile = relationship(
        "TechnicianProfile",
        back_populates="user",
        uselist=False,
        lazy="selectin",
        cascade="all, delete-orphan",
    )

    def __init__(self, **kwargs):
        """Allow passing full_name at construction time for backward compatibility."""
        full_name_val = kwargs.pop("full_name", None)
        super().__init__(**kwargs)
        if full_name_val is not None:
            from app.models.profile import Profile

            if self.profile is None:
                self.profile = Profile(full_name=full_name_val)
            else:
                self.profile.full_name = full_name_val

    @hybrid_property
    def full_name(self) -> str | None:
        """Access full_name from related Profile seamlessly."""
        if self.profile is not None:
            return self.profile.full_name
        return None

    @full_name.setter
    def full_name(self, value: str | None) -> None:
        """Assign full_name to related Profile automatically."""
        if self.profile is None:
            from app.models.profile import Profile

            self.profile = Profile(full_name=value)
        else:
            self.profile.full_name = value

    @full_name.expression
    def full_name(cls):
        """SQL expression enabling queries against User.full_name directly."""
        from app.models.profile import Profile

        return (
            select(Profile.full_name)
            .where(Profile.user_id == cls.id)
            .correlate_except(Profile)
            .scalar_subquery()
        )
