"""Dashboard service — business logic for dashboard endpoints."""

from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.dashboard_repo import DashboardRepository
from app.schemas.dashboard import DashboardOverview, EnergyDashboard, WaterDashboard


class DashboardService:
    """Business logic for dashboard data."""

    def __init__(self, session: AsyncSession):
        self.repo = DashboardRepository(session)

    async def get_overview(self) -> DashboardOverview:
        """Get dashboard overview statistics."""
        data = await self.repo.get_overview()
        return DashboardOverview(**data)

    async def get_energy(self) -> EnergyDashboard:
        """Get energy consumption dashboard data."""
        data = await self.repo.get_energy_summary()
        return EnergyDashboard(**data)

    async def get_water(self) -> WaterDashboard:
        """Get water consumption dashboard data."""
        data = await self.repo.get_water_summary()
        return WaterDashboard(**data)
