"""Building repository."""

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.building import Building
from app.repositories.base import BaseRepository


class BuildingRepository(BaseRepository[Building]):
    """Repository for Building entity."""

    def __init__(self, session: AsyncSession):
        super().__init__(Building, session)
