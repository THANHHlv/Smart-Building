"""Apartment repository."""

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.apartment import Apartment
from app.repositories.base import BaseRepository


class ApartmentRepository(BaseRepository[Apartment]):
    """Repository for Apartment entity."""

    def __init__(self, session: AsyncSession):
        super().__init__(Apartment, session)
