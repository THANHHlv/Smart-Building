"""Device service — business logic for devices."""

import math
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.models.device import Device
from app.repositories.device_repo import DeviceRepository
from app.schemas.common import PaginatedResponse
from app.schemas.device import DeviceCreate, DeviceUpdate

logger = get_logger(__name__)


class DeviceService:
    """Business logic for device management."""

    def __init__(self, session: AsyncSession):
        self.repo = DeviceRepository(session)

    async def create(self, data: DeviceCreate) -> Device:
        """Register a new device."""
        device = Device(**data.model_dump())
        result = await self.repo.create(device)
        logger.info(
            "device_created",
            device_id=str(result.id),
            device_code=result.device_code,
        )
        return result

    async def get_by_id(self, id: UUID) -> Device | None:
        """Get a device by ID."""
        return await self.repo.get_by_id(id)

    async def list(
        self,
        page: int = 1,
        page_size: int = 20,
        apartment_id: UUID | None = None,
    ) -> PaginatedResponse:
        """List devices with pagination and optional apartment filter."""
        offset = (page - 1) * page_size
        filters = [Device.is_active.is_(True)]
        if apartment_id:
            filters.append(Device.apartment_id == apartment_id)

        items = await self.repo.get_all(offset=offset, limit=page_size, filters=filters)
        total = await self.repo.count(filters=filters)
        return PaginatedResponse(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=math.ceil(total / page_size) if page_size > 0 else 0,
        )

    async def update(self, id: UUID, data: DeviceUpdate) -> Device | None:
        """Update a device."""
        device = await self.repo.get_by_id(id)
        if not device:
            return None
        update_data = data.model_dump(exclude_unset=True)
        if not update_data:
            return device
        result = await self.repo.update(device, update_data)
        logger.info("device_updated", device_id=str(id))
        return result

    async def delete(self, id: UUID) -> Device | None:
        """Soft-delete a device."""
        device = await self.repo.get_by_id(id)
        if not device:
            return None
        result = await self.repo.soft_delete(device)
        logger.info("device_deleted", device_id=str(id))
        return result
