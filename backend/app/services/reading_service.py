"""Reading service — business logic for sensor readings."""

import math
from datetime import datetime
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.models.sensor_reading import SensorReading
from app.repositories.reading_repo import ReadingRepository
from app.schemas.common import PaginatedResponse
from app.schemas.reading import ReadingCreate

logger = get_logger(__name__)


class ReadingService:
    """Business logic for sensor readings."""

    def __init__(self, session: AsyncSession):
        self.repo = ReadingRepository(session)

    async def create(self, data: ReadingCreate) -> SensorReading:
        """Submit a single sensor reading."""
        reading = SensorReading(**data.model_dump())
        result = await self.repo.create(reading)
        return result

    async def create_batch(self, readings_data: list[ReadingCreate]) -> int:
        """Submit multiple sensor readings."""
        readings = [SensorReading(**r.model_dump()) for r in readings_data]
        count = await self.repo.bulk_create(readings)
        logger.info("readings_batch_created", count=count)
        return count

    async def get_by_device(
        self,
        device_id: UUID,
        start_time: datetime | None = None,
        end_time: datetime | None = None,
        metric: str | None = None,
        page: int = 1,
        page_size: int = 50,
    ) -> PaginatedResponse:
        """Get readings for a device with optional filters."""
        offset = (page - 1) * page_size
        items = await self.repo.get_by_device(
            device_id=device_id,
            start_time=start_time,
            end_time=end_time,
            metric=metric,
            offset=offset,
            limit=page_size,
        )
        total = await self.repo.count_by_device(
            device_id=device_id,
            start_time=start_time,
            end_time=end_time,
        )
        return PaginatedResponse(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=math.ceil(total / page_size) if page_size > 0 else 0,
        )

    async def query(
        self,
        device_id: UUID | None = None,
        metric: str | None = None,
        start_time: datetime | None = None,
        end_time: datetime | None = None,
        page: int = 1,
        page_size: int = 50,
    ) -> PaginatedResponse:
        """Query readings with optional filters."""
        offset = (page - 1) * page_size
        filters = []
        if device_id:
            filters.append(SensorReading.device_id == device_id)
        if metric:
            filters.append(SensorReading.metric == metric)
        if start_time:
            filters.append(SensorReading.timestamp >= start_time)
        if end_time:
            filters.append(SensorReading.timestamp <= end_time)

        items = await self.repo.get_all(
            offset=offset,
            limit=page_size,
            filters=filters,
            order_by=SensorReading.timestamp.desc(),
        )
        total = await self.repo.count(filters=filters)
        return PaginatedResponse(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=math.ceil(total / page_size) if page_size > 0 else 0,
        )
