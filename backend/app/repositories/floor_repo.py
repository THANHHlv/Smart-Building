"""Floor repository."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.floor import Floor
from app.repositories.base import BaseRepository


class FloorRepository(BaseRepository[Floor]):
    """Repository for Floor entity."""

    def __init__(self, session: AsyncSession):
        super().__init__(Floor, session)

    async def get_by_building(self, building_id: UUID) -> list[Floor]:
        """Get all floors for a building, ordered by floor number."""
        result = await self.session.execute(
            select(Floor)
            .where(Floor.building_id == building_id)
            .order_by(Floor.floor_number)
        )
        return list(result.scalars().all())
