"""Device API endpoints."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.common import MessageResponse, PaginatedResponse
from app.schemas.device import DeviceCreate, DeviceResponse, DeviceUpdate
from app.services.device_service import DeviceService

router = APIRouter(prefix="/devices", tags=["Devices"])


@router.get("", response_model=PaginatedResponse)
async def list_devices(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    apartment_id: UUID | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    """List devices with pagination and optional apartment filter."""
    service = DeviceService(db)
    result = await service.list(page=page, page_size=page_size, apartment_id=apartment_id)
    result.items = [DeviceResponse.model_validate(d) for d in result.items]
    return result


@router.post("", response_model=DeviceResponse, status_code=201)
async def create_device(
    data: DeviceCreate,
    db: AsyncSession = Depends(get_db),
):
    """Register a new IoT device."""
    service = DeviceService(db)
    try:
        return await service.create(data)
    except Exception as exc:
        if "unique" in str(exc).lower():
            raise HTTPException(
                status_code=409,
                detail=f"Device code '{data.device_code}' already exists",
            )
        raise


@router.get("/{device_id}", response_model=DeviceResponse)
async def get_device(
    device_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get device details."""
    service = DeviceService(db)
    device = await service.get_by_id(device_id)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    return device


@router.put("/{device_id}", response_model=DeviceResponse)
async def update_device(
    device_id: UUID,
    data: DeviceUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update a device."""
    service = DeviceService(db)
    device = await service.update(device_id, data)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    return device


@router.delete("/{device_id}", response_model=MessageResponse)
async def delete_device(
    device_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Soft-delete a device."""
    service = DeviceService(db)
    device = await service.delete(device_id)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    return MessageResponse(message="Device deleted", id=device_id)
