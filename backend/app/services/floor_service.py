"""Floor service — business logic for floors."""

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.models.floor import Floor
from app.repositories.floor_repo import FloorRepository
from app.schemas.floor import FloorCreate, FloorUpdate

logger = get_logger(__name__)


class FloorService:
    """Business logic for floor management."""

    def __init__(self, session: AsyncSession):
        self.repo = FloorRepository(session)

    async def create(self, building_id: UUID, data: FloorCreate) -> Floor:
        """Create a new floor in a building."""
        floor = Floor(building_id=building_id, **data.model_dump())
        result = await self.repo.create(floor)
        logger.info(
            "floor_created",
            floor_id=str(result.id),
            building_id=str(building_id),
            floor_number=result.floor_number,
        )
        return result

    async def get_by_id(self, id: UUID) -> Floor | None:
        """Get a floor by ID."""
        return await self.repo.get_by_id(id)

    async def list_by_building(self, building_id: UUID) -> list[Floor]:
        """Get all floors for a building."""
        return await self.repo.get_by_building(building_id)

    async def update(self, id: UUID, data: FloorUpdate) -> Floor | None:
        """Update a floor."""
        floor = await self.repo.get_by_id(id)
        if not floor:
            return None
        update_data = data.model_dump(exclude_unset=True)
        if not update_data:
            return floor
        result = await self.repo.update(floor, update_data)
        logger.info("floor_updated", floor_id=str(id))
        return result
