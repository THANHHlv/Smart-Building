"""Dashboard API endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_admin
from app.core.database import get_db
from app.models.user import User
from app.schemas.dashboard import DashboardOverview, EnergyDashboard, WaterDashboard
from app.services.dashboard_service import DashboardService

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/overview", response_model=DashboardOverview)
async def dashboard_overview(
    _admin: Annotated[User, Depends(require_admin)],
    db: AsyncSession = Depends(get_db),
):
    """Get dashboard summary statistics. Admin only."""
    service = DashboardService(db)
    return await service.get_overview()


@router.get("/energy", response_model=EnergyDashboard)
async def dashboard_energy(
    _admin: Annotated[User, Depends(require_admin)],
    db: AsyncSession = Depends(get_db),
):
    """Get energy consumption dashboard data. Admin only."""
    service = DashboardService(db)
    return await service.get_energy()


@router.get("/water", response_model=WaterDashboard)
async def dashboard_water(
    _admin: Annotated[User, Depends(require_admin)],
    db: AsyncSession = Depends(get_db),
):
    """Get water consumption dashboard data. Admin only."""
    service = DashboardService(db)
    return await service.get_water()
