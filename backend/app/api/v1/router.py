"""API v1 router — aggregates all v1 endpoint routers."""

from fastapi import APIRouter

from app.api.v1.ai_assistant import router as ai_assistant_router
from app.api.v1.alerts import router as alerts_router
from app.api.v1.apartments import router as apartments_router
from app.api.v1.auth import router as auth_router
from app.api.v1.buildings import router as buildings_router
from app.api.v1.dashboard import router as dashboard_router
from app.api.v1.devices import router as devices_router
from app.api.v1.floors import router as floors_router
from app.api.v1.maintenance import router as maintenance_router
from app.api.v1.me import router as me_router
from app.api.v1.readings import router as readings_router
from app.api.v1.resident import router as resident_router
from app.api.v1.simulation import router as simulation_router
from app.api.v1.users import router as users_router

# --- Payment & Billing ---
from app.api.v1.invoices import router as invoices_router
from app.api.v1.payment_methods import router as payment_methods_router
from app.api.v1.webhooks import router as webhooks_router
from app.api.v1.services_catalog import router as services_catalog_router

# --- Notifications ---
from app.api.v1.notifications import router as notifications_router

# --- Tickets & Work Orders ---
from app.api.v1.tickets import router as tickets_router, admin_router as tickets_admin_router

# --- Admin Operations & RBAC ---
from app.api.v1.admin import router as admin_router

api_v1_router = APIRouter(prefix="/api/v1")

# Admin Operations & RBAC
api_v1_router.include_router(admin_router)

# Authentication & Account management
api_v1_router.include_router(auth_router)
api_v1_router.include_router(users_router)

# Resident-scoped portal
api_v1_router.include_router(resident_router)
api_v1_router.include_router(me_router)

# Core infrastructure & operations
api_v1_router.include_router(buildings_router)
api_v1_router.include_router(floors_router)
api_v1_router.include_router(apartments_router)
api_v1_router.include_router(devices_router)
api_v1_router.include_router(readings_router)
api_v1_router.include_router(dashboard_router)
api_v1_router.include_router(alerts_router)
api_v1_router.include_router(maintenance_router)
api_v1_router.include_router(tickets_router)
api_v1_router.include_router(tickets_admin_router)
api_v1_router.include_router(simulation_router)
api_v1_router.include_router(ai_assistant_router)


# Payment & Billing
api_v1_router.include_router(invoices_router)
api_v1_router.include_router(payment_methods_router)
api_v1_router.include_router(webhooks_router)
api_v1_router.include_router(services_catalog_router)

# Notifications
api_v1_router.include_router(notifications_router)

# Self-Service Requests, Amenities & Community Bulletin Board
from app.api.v1.service_requests import router as service_requests_router
from app.api.v1.amenities import router as amenities_router
from app.api.v1.announcements import router as announcements_router

api_v1_router.include_router(service_requests_router)
api_v1_router.include_router(amenities_router)
api_v1_router.include_router(announcements_router)

# Bulk Operations & Report Exports (Priority 5)
from app.api.v1.admin_bulk import router as admin_bulk_router
from app.api.v1.admin_reports import router as admin_reports_router

api_v1_router.include_router(admin_bulk_router)
api_v1_router.include_router(admin_reports_router)

