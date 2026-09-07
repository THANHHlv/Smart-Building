"""Apartment API endpoints."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.apartment import (
    ApartmentCreate,
    ApartmentDetailResponse,
    ApartmentResponse,
    ApartmentUpdate,
)
from app.schemas.common import MessageResponse, PaginatedResponse
from app.services.apartment_service import ApartmentService

router = APIRouter(prefix="/apartments", tags=["Apartments"])


@router.get("", response_model=PaginatedResponse)
async def list_apartments(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    floor_id: UUID | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    """List apartments with pagination and optional floor filter."""
    service = ApartmentService(db)
    result = await service.list(page=page, page_size=page_size, floor_id=floor_id)
    result.items = [ApartmentResponse.model_validate(a) for a in result.items]
    return result


@router.post("", response_model=ApartmentResponse, status_code=201)
async def create_apartment(
    data: ApartmentCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create a new apartment."""
    service = ApartmentService(db)
    return await service.create(data)


@router.get("/{apartment_id}", response_model=ApartmentDetailResponse)
async def get_apartment(
    apartment_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get apartment details with devices."""
    service = ApartmentService(db)
    apartment = await service.get_by_id(apartment_id)
    if not apartment:
        raise HTTPException(status_code=404, detail="Apartment not found")
    return apartment


@router.put("/{apartment_id}", response_model=ApartmentResponse)
async def update_apartment(
    apartment_id: UUID,
    data: ApartmentUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update an apartment."""
    service = ApartmentService(db)
    apartment = await service.update(apartment_id, data)
    if not apartment:
        raise HTTPException(status_code=404, detail="Apartment not found")
    return apartment


@router.delete("/{apartment_id}", response_model=MessageResponse)
async def delete_apartment(
    apartment_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Soft-delete an apartment."""
    service = ApartmentService(db)
    apartment = await service.delete(apartment_id)
    if not apartment:
        raise HTTPException(status_code=404, detail="Apartment not found")
    return MessageResponse(message="Apartment deleted", id=apartment_id)
