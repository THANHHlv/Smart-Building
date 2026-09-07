"""API v1 router — aggregates all v1 endpoint routers."""

from fastapi import APIRouter

from app.api.v1.apartments import router as apartments_router
from app.api.v1.buildings import router as buildings_router
from app.api.v1.dashboard import router as dashboard_router
from app.api.v1.devices import router as devices_router
from app.api.v1.floors import router as floors_router
from app.api.v1.readings import router as readings_router

api_v1_router = APIRouter(prefix="/api/v1")

api_v1_router.include_router(buildings_router)
api_v1_router.include_router(floors_router)
api_v1_router.include_router(apartments_router)
api_v1_router.include_router(devices_router)
api_v1_router.include_router(readings_router)
api_v1_router.include_router(dashboard_router)
