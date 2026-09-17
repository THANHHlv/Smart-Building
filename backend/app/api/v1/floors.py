"""Floor API endpoints."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_admin
from app.core.database import get_db
from app.models.user import User
from app.schemas.floor import FloorCreate, FloorDetailResponse, FloorResponse, FloorUpdate
from app.services.building_service import BuildingService
from app.services.floor_service import FloorService

router = APIRouter(tags=["Floors"])


@router.get(
    "/buildings/{building_id}/floors",
    response_model=list[FloorResponse],
)
async def list_floors(
    building_id: UUID,
    _current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    """List all floors in a building."""
    # Verify building exists
    building_service = BuildingService(db)
    building = await building_service.get_by_id(building_id)
    if not building:
        raise HTTPException(status_code=404, detail="Building not found")

    service = FloorService(db)
    return await service.list_by_building(building_id)


@router.post(
    "/buildings/{building_id}/floors",
    response_model=FloorResponse,
    status_code=201,
)
async def create_floor(
    building_id: UUID,
    data: FloorCreate,
    _admin: Annotated[User, Depends(require_admin)],
    db: AsyncSession = Depends(get_db),
):
    """Create a new floor in a building. Admin only."""
    building_service = BuildingService(db)
    building = await building_service.get_by_id(building_id)
    if not building:
        raise HTTPException(status_code=404, detail="Building not found")

    service = FloorService(db)
    try:
        return await service.create(building_id, data)
    except Exception as exc:
        if "uq_floor_building_number" in str(exc):
            raise HTTPException(
                status_code=409,
                detail=f"Floor number {data.floor_number} already exists in this building",
            )
        raise


@router.get("/floors/{floor_id}", response_model=FloorDetailResponse)
async def get_floor(
    floor_id: UUID,
    _current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    """Get floor details with apartments."""
    service = FloorService(db)
    floor = await service.get_by_id(floor_id)
    if not floor:
        raise HTTPException(status_code=404, detail="Floor not found")
    return floor


@router.put("/floors/{floor_id}", response_model=FloorResponse)
async def update_floor(
    floor_id: UUID,
    data: FloorUpdate,
    _admin: Annotated[User, Depends(require_admin)],
    db: AsyncSession = Depends(get_db),
):
    """Update a floor. Admin only."""
    service = FloorService(db)
    floor = await service.update(floor_id, data)
    if not floor:
        raise HTTPException(status_code=404, detail="Floor not found")
    return floor
