from datetime import datetime, timezone
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_admin
from app.core.database import get_db
from app.models.device import DeviceStatus
from app.models.user import User
from app.schemas.common import MessageResponse, PaginatedResponse
from app.schemas.device import DeviceControlRequest, DeviceCreate, DeviceResponse, DeviceUpdate
from app.services.device_service import DeviceService


router = APIRouter(prefix="/devices", tags=["Devices"])


@router.get("", response_model=PaginatedResponse)
async def list_devices(
    _current_user: Annotated[User, Depends(get_current_user)],
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
    _admin: Annotated[User, Depends(require_admin)],
    db: AsyncSession = Depends(get_db),
):
    """Register a new IoT device. Admin only."""
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
    _current_user: Annotated[User, Depends(get_current_user)],
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
    _admin: Annotated[User, Depends(require_admin)],
    db: AsyncSession = Depends(get_db),
):
    """Update a device. Admin only."""
    service = DeviceService(db)
    device = await service.update(device_id, data)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    return device


@router.delete("/{device_id}", response_model=MessageResponse)
async def delete_device(
    device_id: UUID,
    _admin: Annotated[User, Depends(require_admin)],
    db: AsyncSession = Depends(get_db),
):
    """Soft-delete a device. Admin only."""
    service = DeviceService(db)
    device = await service.delete(device_id)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    return MessageResponse(message="Device deleted", id=device_id)


@router.post("/{device_id}/control", response_model=DeviceResponse)
async def control_device(
    device_id: UUID,
    payload: DeviceControlRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    """Toggle or switch on/off a smart device. Resident can control own devices; Admin controls all."""
    service = DeviceService(db)
    device = await service.get_by_id(device_id)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    if current_user.role != "admin" and device.apartment_id != current_user.apartment_id:
        raise HTTPException(
            status_code=403,
            detail="You do not have permission to control devices outside your apartment",
        )

    current_status = device.status.value if hasattr(device.status, "value") else str(device.status)
    if payload.action == "turn_on":
        new_status = DeviceStatus.ONLINE
    elif payload.action == "turn_off":
        new_status = DeviceStatus.OFFLINE
    else:  # toggle
        new_status = DeviceStatus.OFFLINE if current_status == "online" else DeviceStatus.ONLINE

    device.status = new_status
    device.last_seen_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(device)
    return device

