"""Pydantic schemas for Admin Operations Dashboard and RBAC User/Role management."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


# --- RBAC Schemas ---

class PermissionItem(BaseModel):
    """Granular permission code."""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    code: str
    description: str | None = None
    module: str


class RoleItem(BaseModel):
    """Role definition."""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    description: str | None = None
    is_system: bool
    permissions: list[str] = Field(default_factory=list)


class UserRoleAssignmentItem(BaseModel):
    """Role assigned to a specific user, optionally scoped to a building."""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    role_id: UUID
    role_name: str
    role_description: str | None = None
    building_id: UUID | None = None
    building_name: str | None = None
    granted_at: datetime


class UserWithRolesResponse(BaseModel):
    """User account with current RBAC roles and building scope."""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    full_name: str | None = None
    legacy_role: str
    is_active: bool
    apartment_id: UUID | None = None
    apartment_unit: str | None = None
    building_name: str | None = None
    roles: list[UserRoleAssignmentItem] = Field(default_factory=list)
    created_at: datetime


class AssignUserRoleRequest(BaseModel):
    """Request to assign a role to a user."""
    role_id: UUID
    building_id: UUID | None = None


# --- Admin Operations Dashboard Schemas ---

class ServiceRevenueItem(BaseModel):
    """Revenue item by utility service category."""
    service_type: str
    service_name: str
    amount_vnd: int
    percentage: float


class AdminDashboardOverview(BaseModel):
    """Operational business summary for Building Management & Accounting."""
    total_apartments: int
    occupied_apartments: int
    occupancy_rate_percent: float
    # Tickets
    active_tickets_count: int
    overdue_tickets_count: int
    avg_ticket_resolution_hours: float
    # Billing & Financials
    unpaid_invoices_count: int
    total_unpaid_amount_vnd: int
    total_revenue_this_month_vnd: int
    revenue_by_service: list[ServiceRevenueItem] = Field(default_factory=list)
    # IoT Devices operational health
    total_devices: int
    devices_online: int
    devices_offline: int
    offline_summary_text: str


class CollectionRateMonth(BaseModel):
    """Collection metrics for a single billing month."""
    month: str  # YYYY-MM
    total_billed_vnd: int
    total_collected_vnd: int
    collection_rate_percent: float
    on_time_rate_percent: float
    invoices_count: int
    paid_count: int


class CollectionRateResponse(BaseModel):
    """Trend and comparison of on-time payment collection rates."""
    current_month: CollectionRateMonth
    previous_month: CollectionRateMonth | None = None
    month_over_month_change_percent: float
    history: list[CollectionRateMonth] = Field(default_factory=list)


class OverdueApartmentItem(BaseModel):
    """Apartment with overdue invoices needing reminder action."""
    apartment_id: UUID
    apartment_unit: str
    floor_number: int | None = None
    building_name: str
    resident_name: str | None = None
    resident_email: str | None = None
    unpaid_invoices_count: int
    total_overdue_amount_vnd: int
    oldest_due_date: str
    days_overdue: int


class FloorDeviceHealth(BaseModel):
    """Operational summary of devices by building floor."""
    floor_number: int
    building_name: str
    total_devices: int
    online_devices: int
    offline_devices: int
    maintenance_needed: bool
    summary_text: str


class DeviceHealthResponse(BaseModel):
    """Aggregated operational health of building devices."""
    total_devices: int
    online_devices: int
    offline_devices: int
    overall_health_percent: float
    floors: list[FloorDeviceHealth] = Field(default_factory=list)
