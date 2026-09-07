"""Schemas package."""

from app.schemas.common import (
    ErrorResponse,
    HealthResponse,
    MessageResponse,
    PaginatedResponse,
    PaginationParams,
    ReadinessResponse,
)
from app.schemas.building import (
    BuildingCreate,
    BuildingDetailResponse,
    BuildingResponse,
    BuildingUpdate,
)
from app.schemas.floor import FloorCreate, FloorDetailResponse, FloorResponse, FloorUpdate
from app.schemas.apartment import (
    ApartmentCreate,
    ApartmentDetailResponse,
    ApartmentResponse,
    ApartmentUpdate,
)
from app.schemas.device import DeviceCreate, DeviceResponse, DeviceTypeResponse, DeviceUpdate
from app.schemas.reading import (
    ReadingBatchCreate,
    ReadingCreate,
    ReadingQueryParams,
    ReadingResponse,
)
from app.schemas.dashboard import DashboardOverview, EnergyDashboard, WaterDashboard

__all__ = [
    "ErrorResponse",
    "HealthResponse",
    "MessageResponse",
    "PaginatedResponse",
    "PaginationParams",
    "ReadinessResponse",
    "BuildingCreate",
    "BuildingDetailResponse",
    "BuildingResponse",
    "BuildingUpdate",
    "FloorCreate",
    "FloorDetailResponse",
    "FloorResponse",
    "FloorUpdate",
    "ApartmentCreate",
    "ApartmentDetailResponse",
    "ApartmentResponse",
    "ApartmentUpdate",
    "DeviceCreate",
    "DeviceResponse",
    "DeviceTypeResponse",
    "DeviceUpdate",
    "ReadingBatchCreate",
    "ReadingCreate",
    "ReadingQueryParams",
    "ReadingResponse",
    "DashboardOverview",
    "EnergyDashboard",
    "WaterDashboard",
]
