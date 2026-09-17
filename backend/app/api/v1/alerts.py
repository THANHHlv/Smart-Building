"""Alert API endpoints."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_admin
from app.core.database import get_db
from app.models.alert import AlertSeverity, AlertStatus
from app.models.user import User
from app.schemas.alert import AlertCreate, AlertResponse
from app.services.alert_service import AlertService

router = APIRouter(prefix="/alerts", tags=["Alerts"])


@router.get("", response_model=list[AlertResponse])
async def list_alerts(
    _current_user: Annotated[User, Depends(get_current_user)],
    status: AlertStatus | None = Query(default=None),
    severity: AlertSeverity | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    """List recent alerts with optional filters."""
    service = AlertService(db)
    return await service.list_alerts(status=status, severity=severity, limit=limit)


@router.post("", response_model=AlertResponse, status_code=201)
async def create_alert(
    data: AlertCreate,
    _admin: Annotated[User, Depends(require_admin)],
    db: AsyncSession = Depends(get_db),
):
    """Create an alert. Admin only."""
    service = AlertService(db)
    return await service.create(data)


@router.post("/{alert_id}/acknowledge", response_model=AlertResponse)
async def acknowledge_alert(
    alert_id: UUID,
    _admin: Annotated[User, Depends(require_admin)],
    db: AsyncSession = Depends(get_db),
):
    """Acknowledge an open alert. Admin only."""
    service = AlertService(db)
    result = await service.acknowledge(alert_id)
    if not result:
        raise HTTPException(status_code=404, detail="Alert not found")
    return result


@router.post("/{alert_id}/resolve", response_model=AlertResponse)
async def resolve_alert(
    alert_id: UUID,
    _admin: Annotated[User, Depends(require_admin)],
    db: AsyncSession = Depends(get_db),
):
    """Mark an alert as resolved. Admin only."""
    service = AlertService(db)
    result = await service.resolve(alert_id)
    if not result:
        raise HTTPException(status_code=404, detail="Alert not found")
    return result
