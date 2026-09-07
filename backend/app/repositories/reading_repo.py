"""Sensor reading repository."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.sensor_reading import SensorReading
from app.repositories.base import BaseRepository


class ReadingRepository(BaseRepository[SensorReading]):
    """Repository for SensorReading entity."""

    def __init__(self, session: AsyncSession):
        super().__init__(SensorReading, session)

    async def get_by_device(
        self,
        device_id: UUID,
        start_time: datetime | None = None,
        end_time: datetime | None = None,
        metric: str | None = None,
        offset: int = 0,
        limit: int = 50,
    ) -> list[SensorReading]:
        """Get readings for a device with optional time range and metric filter."""
        query = select(SensorReading).where(SensorReading.device_id == device_id)

        if start_time:
            query = query.where(SensorReading.timestamp >= start_time)
        if end_time:
            query = query.where(SensorReading.timestamp <= end_time)
        if metric:
            query = query.where(SensorReading.metric == metric)

        query = query.order_by(SensorReading.timestamp.desc()).offset(offset).limit(limit)
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def count_by_device(
        self,
        device_id: UUID,
        start_time: datetime | None = None,
        end_time: datetime | None = None,
    ) -> int:
        """Count readings for a device with optional time range."""
        query = (
            select(func.count())
            .select_from(SensorReading)
            .where(SensorReading.device_id == device_id)
        )
        if start_time:
            query = query.where(SensorReading.timestamp >= start_time)
        if end_time:
            query = query.where(SensorReading.timestamp <= end_time)
        result = await self.session.execute(query)
        return result.scalar_one()

    async def bulk_create(self, readings: list[SensorReading]) -> int:
        """Insert multiple readings efficiently."""
        self.session.add_all(readings)
        await self.session.flush()
        return len(readings)
