"""Sensor reading API endpoints."""

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.common import MessageResponse, PaginatedResponse
from app.schemas.reading import ReadingBatchCreate, ReadingCreate, ReadingResponse
from app.services.reading_service import ReadingService

router = APIRouter(prefix="/readings", tags=["Readings"])


@router.post("", response_model=ReadingResponse, status_code=201)
async def create_reading(
    data: ReadingCreate,
    db: AsyncSession = Depends(get_db),
):
    """Submit a single sensor reading."""
    service = ReadingService(db)
    return await service.create(data)


@router.post("/batch", response_model=MessageResponse, status_code=201)
async def create_readings_batch(
    data: ReadingBatchCreate,
    db: AsyncSession = Depends(get_db),
):
    """Submit multiple sensor readings in a single request."""
    service = ReadingService(db)
    count = await service.create_batch(data.readings)
    return MessageResponse(message=f"{count} readings created")


@router.get("", response_model=PaginatedResponse)
async def query_readings(
    device_id: UUID | None = Query(default=None),
    metric: str | None = Query(default=None),
    start_time: datetime | None = Query(default=None),
    end_time: datetime | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=1000),
    db: AsyncSession = Depends(get_db),
):
    """Query sensor readings with optional filters.

    At least one filter (device_id, metric, or time range) is recommended
    to avoid unbounded queries.
    """
    service = ReadingService(db)
    result = await service.query(
        device_id=device_id,
        metric=metric,
        start_time=start_time,
        end_time=end_time,
        page=page,
        page_size=page_size,
    )
    result.items = [ReadingResponse.model_validate(r) for r in result.items]
    return result


@router.get("/device/{device_id}", response_model=PaginatedResponse)
async def get_device_readings(
    device_id: UUID,
    metric: str | None = Query(default=None),
    start_time: datetime | None = Query(default=None),
    end_time: datetime | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=1000),
    db: AsyncSession = Depends(get_db),
):
    """Get sensor readings for a specific device."""
    service = ReadingService(db)
    result = await service.get_by_device(
        device_id=device_id,
        start_time=start_time,
        end_time=end_time,
        metric=metric,
        page=page,
        page_size=page_size,
    )
    result.items = [ReadingResponse.model_validate(r) for r in result.items]
    return result
