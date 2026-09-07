"""Device repository."""

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.device import Device
from app.repositories.base import BaseRepository


class DeviceRepository(BaseRepository[Device]):
    """Repository for Device entity."""

    def __init__(self, session: AsyncSession):
        super().__init__(Device, session)
