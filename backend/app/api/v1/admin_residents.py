"""Admin Resident Management and Technician Directory API endpoints."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_permission
from app.core.database import get_db
from app.models.user import User
from app.schemas.profile import (
    AdminCreateResidentRequest,
    AdminResidentItemResponse,
    AdminUpdateResidentRequest,
    TechnicianProfileResponse,
    TechnicianProfileUpdateRequest,
)
from app.services.profile_service import ProfileService

router = APIRouter(prefix="/admin", tags=["Admin Resident & Technician Management"])


@router.get("/residents", response_model=list[AdminResidentItemResponse])
async def list_residents(
    _user: Annotated[User, Depends(require_permission("resident.manage"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    building_id: uuid.UUID | None = Query(None, description="Lọc theo Tòa nhà"),
    floor_id: uuid.UUID | None = Query(None, description="Lọc theo Tầng"),
    apartment_id: uuid.UUID | None = Query(None, description="Lọc theo Căn hộ"),
    status: str | None = Query("all", description="Trạng thái: active, moved_out, all"),
    search: str | None = Query(None, description="Tìm kiếm theo tên, email, phone, số căn hộ"),
):
    """Admin views list of residents across buildings, floors, and apartments."""
    service = ProfileService(db)
    return await service.list_admin_residents(
        building_id=building_id,
        floor_id=floor_id,
        apartment_id=apartment_id,
        status_filter=status,
        search=search,
    )


@router.post(
    "/residents",
    response_model=AdminResidentItemResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_resident_occupancy(
    payload: AdminCreateResidentRequest,
    _user: Annotated[User, Depends(require_permission("resident.manage"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Admin registers a resident into an apartment upon moving in."""
    service = ProfileService(db)
    return await service.create_admin_resident(payload, _user)


@router.patch("/residents/{resident_id}", response_model=AdminResidentItemResponse)
async def update_resident_occupancy(
    resident_id: uuid.UUID,
    payload: AdminUpdateResidentRequest,
    _user: Annotated[User, Depends(require_permission("resident.manage"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Update resident relationship, primary contact designation, or moving status."""
    service = ProfileService(db)
    return await service.update_admin_resident(resident_id, payload)


@router.delete("/residents/{resident_id}")
async def mark_resident_moved_out(
    resident_id: uuid.UUID,
    _user: Annotated[User, Depends(require_permission("resident.manage"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Mark resident as moved out (soft delete preserving historical billing records)."""
    service = ProfileService(db)
    return await service.soft_delete_resident(resident_id)


# -----------------------------------------------------------------------------
# Technicians Directory & Profiles
# -----------------------------------------------------------------------------

@router.get("/technicians", response_model=list[TechnicianProfileResponse])
async def list_admin_technicians(
    _user: Annotated[User, Depends(require_permission("user.manage"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """List all building technicians with their specialties and certifications."""
    service = ProfileService(db)
    return await service.list_technicians()


@router.put("/technicians/{technician_id}", response_model=TechnicianProfileResponse)
async def update_admin_technician(
    technician_id: uuid.UUID,
    payload: TechnicianProfileUpdateRequest,
    _user: Annotated[User, Depends(require_permission("user.manage"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Update technician specialties, active building assignments, or certification details."""
    service = ProfileService(db)
    return await service.update_technician(technician_id, payload)
