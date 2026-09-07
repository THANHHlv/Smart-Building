"""Building service — business logic for buildings."""

import math
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.models.building import Building
from app.repositories.building_repo import BuildingRepository
from app.schemas.building import BuildingCreate, BuildingUpdate
from app.schemas.common import PaginatedResponse

logger = get_logger(__name__)


class BuildingService:
    """Business logic for building management."""

    def __init__(self, session: AsyncSession):
        self.repo = BuildingRepository(session)

    async def create(self, data: BuildingCreate) -> Building:
        """Create a new building."""
        building = Building(**data.model_dump())
        result = await self.repo.create(building)
        logger.info("building_created", building_id=str(result.id), name=result.name)
        return result

    async def get_by_id(self, id: UUID) -> Building | None:
        """Get a building by ID."""
        return await self.repo.get_by_id(id)

    async def list(self, page: int = 1, page_size: int = 20) -> PaginatedResponse:
        """List buildings with pagination."""
        offset = (page - 1) * page_size
        filters = [Building.is_active.is_(True)]
        items = await self.repo.get_all(offset=offset, limit=page_size, filters=filters)
        total = await self.repo.count(filters=filters)
        return PaginatedResponse(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=math.ceil(total / page_size) if page_size > 0 else 0,
        )

    async def update(self, id: UUID, data: BuildingUpdate) -> Building | None:
        """Update a building."""
        building = await self.repo.get_by_id(id)
        if not building:
            return None
        update_data = data.model_dump(exclude_unset=True)
        if not update_data:
            return building
        result = await self.repo.update(building, update_data)
        logger.info("building_updated", building_id=str(id))
        return result

    async def delete(self, id: UUID) -> Building | None:
        """Soft-delete a building."""
        building = await self.repo.get_by_id(id)
        if not building:
            return None
        result = await self.repo.soft_delete(building)
        logger.info("building_deleted", building_id=str(id))
        return result
