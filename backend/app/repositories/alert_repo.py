"""Alert repository."""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.alert import Alert, AlertSeverity, AlertStatus


class AlertRepository:
    """Repository for alert operations."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def list_alerts(
        self,
        status: AlertStatus | None = None,
        severity: AlertSeverity | None = None,
        limit: int = 50,
    ) -> list[Alert]:
        """List alerts with optional status and severity filtering."""
        query = select(Alert).order_by(desc(Alert.created_at)).limit(limit)
        if status:
            query = query.where(Alert.status == status)
        if severity:
            query = query.where(Alert.severity == severity)

        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def get_by_id(self, alert_id: UUID) -> Alert | None:
        """Get alert by ID."""
        result = await self.session.execute(
            select(Alert).where(Alert.id == alert_id)
        )
        return result.scalar_one_or_none()

    async def create(self, alert: Alert) -> Alert:
        """Create a new alert."""
        self.session.add(alert)
        await self.session.flush()
        await self.session.refresh(alert)
        return alert

    async def update_status(self, alert_id: UUID, status: AlertStatus) -> Alert | None:
        """Update alert status and set resolved_at if resolved."""
        alert = await self.get_by_id(alert_id)
        if not alert:
            return None

        alert.status = status
        if status == AlertStatus.RESOLVED:
            alert.resolved_at = datetime.now(timezone.utc)
        await self.session.flush()
        await self.session.refresh(alert)
        return alert
