"""Admin Operations Dashboard & RBAC Management API endpoints."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_permission
from app.core.database import get_db
from app.models.user import User
from app.schemas.admin_dashboard import (
    AdminDashboardOverview,
    AssignUserRoleRequest,
    CollectionRateResponse,
    DeviceHealthResponse,
    OverdueApartmentItem,
    RoleItem,
    UserWithRolesResponse,
)
from app.services.admin_dashboard_service import AdminDashboardService

router = APIRouter(prefix="/admin", tags=["Admin Operations & RBAC"])


# -----------------------------------------------------------------------------
# 1. RBAC User & Role Administration Endpoints
# -----------------------------------------------------------------------------

@router.get("/users", response_model=list[UserWithRolesResponse])
async def list_admin_users(
    _user: Annotated[User, Depends(require_permission("user.manage"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    search: str | None = Query(default=None, description="Search by email or full name"),
):
    """List all registered users with their assigned RBAC roles and building scope."""
    service = AdminDashboardService(db)
    return await service.list_users_with_roles(search=search)


@router.get("/roles", response_model=list[RoleItem])
async def list_admin_roles(
    _user: Annotated[User, Depends(require_permission("role.manage"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """List all available system roles and their permission matrix."""
    service = AdminDashboardService(db)
    return await service.list_roles()


@router.post("/users/{user_id}/roles", status_code=status.HTTP_201_CREATED)
async def assign_role_to_user(
    user_id: UUID,
    payload: AssignUserRoleRequest,
    current_user: Annotated[User, Depends(require_permission("role.manage"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Assign a role to a user, optionally scoped to a building. Super admin only."""
    service = AdminDashboardService(db)
    assignment = await service.assign_user_role(
        user_id=user_id,
        role_id=payload.role_id,
        building_id=payload.building_id,
        granted_by=current_user.id,
    )
    return {
        "message": "Phân vai trò thành công",
        "assignment_id": str(assignment.id),
        "user_id": str(user_id),
        "role_id": str(payload.role_id),
        "building_id": str(payload.building_id) if payload.building_id else None,
    }


@router.delete("/users/{user_id}/roles/{role_id}", status_code=status.HTTP_200_OK)
async def revoke_role_from_user(
    user_id: UUID,
    role_id: UUID,
    _current_user: Annotated[User, Depends(require_permission("role.manage"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Revoke a role from a user. Matches by user_id and role_id (or assignment id)."""
    service = AdminDashboardService(db)

    from sqlalchemy import select
    from app.models.rbac import UserRole

    # Check if role_id is UserRole.id or Role.id
    stmt = select(UserRole).where(
        (UserRole.id == role_id) | ((UserRole.user_id == user_id) & (UserRole.role_id == role_id))
    )
    user_role = (await db.execute(stmt)).scalar_one_or_none()
    if not user_role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy vai trò đã gán của người dùng này",
        )

    await service.revoke_user_role(user_role.id)
    return {"message": "Đã thu hồi vai trò thành công"}


# -----------------------------------------------------------------------------
# 2. Admin Business Operations Dashboard Endpoints
# -----------------------------------------------------------------------------

@router.get("/dashboard/overview", response_model=AdminDashboardOverview)
async def get_dashboard_overview(
    _admin: Annotated[User, Depends(require_permission("admin.dashboard.read"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    building_id: UUID | None = Query(default=None, description="Optional building filter"),
):
    """Business operations overview for building management & accounting."""
    service = AdminDashboardService(db)
    return await service.get_overview(building_id=building_id)


@router.get("/dashboard/collection-rate", response_model=CollectionRateResponse)
async def get_collection_rate(
    _admin: Annotated[User, Depends(require_permission("admin.dashboard.read"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """On-time payment collection rate and month-over-month trends."""
    service = AdminDashboardService(db)
    return await service.get_collection_rate()


@router.get("/dashboard/overdue-apartments", response_model=list[OverdueApartmentItem])
async def get_overdue_apartments(
    _admin: Annotated[User, Depends(require_permission("admin.dashboard.read"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(default=20, ge=1, le=100),
):
    """Top apartments with pending or overdue utility bills."""
    service = AdminDashboardService(db)
    return await service.get_overdue_apartments(limit=limit)


@router.get("/dashboard/device-health", response_model=DeviceHealthResponse)
async def get_device_health(
    _admin: Annotated[User, Depends(require_permission("admin.dashboard.read"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Operational devices condition summary grouped by building floor."""
    service = AdminDashboardService(db)
    return await service.get_device_health()
