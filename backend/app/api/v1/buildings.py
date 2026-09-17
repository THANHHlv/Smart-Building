"""Building API endpoints."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_admin
from app.core.database import get_db
from app.models.user import User
from app.schemas.building import (
    BuildingCreate,
    BuildingDetailResponse,
    BuildingResponse,
    BuildingUpdate,
)
from app.schemas.common import MessageResponse, PaginatedResponse
from app.services.building_service import BuildingService

router = APIRouter(prefix="/buildings", tags=["Buildings"])


@router.get("", response_model=PaginatedResponse)
async def list_buildings(
    _current_user: Annotated[User, Depends(get_current_user)],
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """List all active buildings with pagination."""
    service = BuildingService(db)
    result = await service.list(page=page, page_size=page_size)
    result.items = [BuildingResponse.model_validate(b) for b in result.items]
    return result


@router.post("", response_model=BuildingResponse, status_code=201)
async def create_building(
    _admin: Annotated[User, Depends(require_admin)],
    data: BuildingCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create a new building. Admin only."""
    service = BuildingService(db)
    return await service.create(data)


@router.get("/{building_id}", response_model=BuildingDetailResponse)
async def get_building(
    building_id: UUID,
    _current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    """Get building details with floors."""
    service = BuildingService(db)
    building = await service.get_by_id(building_id)
    if not building:
        raise HTTPException(status_code=404, detail="Building not found")
    return building


@router.put("/{building_id}", response_model=BuildingResponse)
async def update_building(
    building_id: UUID,
    data: BuildingUpdate,
    _admin: Annotated[User, Depends(require_admin)],
    db: AsyncSession = Depends(get_db),
):
    """Update a building. Admin only."""
    service = BuildingService(db)
    building = await service.update(building_id, data)
    if not building:
        raise HTTPException(status_code=404, detail="Building not found")
    return building


@router.delete("/{building_id}", response_model=MessageResponse)
async def delete_building(
    building_id: UUID,
    _admin: Annotated[User, Depends(require_admin)],
    db: AsyncSession = Depends(get_db),
):
    """Soft-delete a building. Admin only."""
    service = BuildingService(db)
    building = await service.delete(building_id)
    if not building:
        raise HTTPException(status_code=404, detail="Building not found")
    return MessageResponse(message="Building deleted", id=building_id)
