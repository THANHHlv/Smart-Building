"""Dashboard API endpoints."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.dashboard import DashboardOverview, EnergyDashboard, WaterDashboard
from app.services.dashboard_service import DashboardService

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/overview", response_model=DashboardOverview)
async def dashboard_overview(
    db: AsyncSession = Depends(get_db),
):
    """Get dashboard summary statistics."""
    service = DashboardService(db)
    return await service.get_overview()


@router.get("/energy", response_model=EnergyDashboard)
async def dashboard_energy(
    db: AsyncSession = Depends(get_db),
):
    """Get energy consumption dashboard data."""
    service = DashboardService(db)
    return await service.get_energy()


@router.get("/water", response_model=WaterDashboard)
async def dashboard_water(
    db: AsyncSession = Depends(get_db),
):
    """Get water consumption dashboard data."""
    service = DashboardService(db)
    return await service.get_water()
