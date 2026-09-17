"""Alert service."""

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.alert import Alert, AlertSeverity, AlertStatus
from app.repositories.alert_repo import AlertRepository
from app.schemas.alert import AlertCreate, AlertResponse


class AlertService:
    """Service for managing alerts."""

    def __init__(self, session: AsyncSession):
        self.repo = AlertRepository(session)

    async def list_alerts(
        self,
        status: AlertStatus | None = None,
        severity: AlertSeverity | None = None,
        limit: int = 50,
    ) -> list[AlertResponse]:
        """List alerts with filtering."""
        alerts = await self.repo.list_alerts(status=status, severity=severity, limit=limit)
        return [AlertResponse.model_validate(a) for a in alerts]

    async def create(self, data: AlertCreate) -> AlertResponse:
        """Create a new alert."""
        alert = Alert(
            device_id=data.device_id,
            apartment_id=data.apartment_id,
            severity=data.severity,
            status=AlertStatus.OPEN,
            title=data.title,
            message=data.message,
            source=data.source,
        )
        created = await self.repo.create(alert)

        # Publish notification event to Kafka / Event Bus
        try:
            from sqlalchemy import select
            from app.core.config import get_settings
            from app.core.kafka_bus import get_event_bus
            from app.models.notification import NotificationCategory
            from app.models.user import User

            settings = get_settings()
            event_bus = get_event_bus()

            # Find target user: resident of apartment or admin
            target_user_id = None
            if data.apartment_id:
                u_stmt = select(User.id).where(User.apartment_id == data.apartment_id).limit(1)
                u_res = await self.repo.session.execute(u_stmt)
                target_user_id = u_res.scalar_one_or_none()

            if not target_user_id:
                # Default to an admin user
                admin_stmt = select(User.id).where(User.role == "admin").limit(1)
                admin_res = await self.repo.session.execute(admin_stmt)
                target_user_id = admin_res.scalar_one_or_none()

            if target_user_id:
                event_payload = {
                    "user_id": str(target_user_id),
                    "category": NotificationCategory.ALERT.value,
                    "template_code": "alert.anomaly_detected",
                    "idempotency_key": f"alert_{created.id}",
                    "context": {
                        "alert_title": created.title,
                        "message": created.message,
                        "severity": created.severity.value,
                        "device_name": str(created.device_id) if created.device_id else "Thiết bị",
                        "apartment_unit": str(data.apartment_id) if data.apartment_id else "Khu vực chung",
                    },
                }
                await event_bus.publish(
                    topic=settings.kafka_notifications_topic,
                    value=event_payload,
                    key=str(target_user_id),
                )

            # Publish to building.alerts topic for Work Order auto-creation
            alert_event_payload = {
                "event_type": "alert.created",
                "alert_id": str(created.id),
                "title": created.title,
                "message": created.message or "",
                "severity": created.severity.value,
                "source": created.source,
                "device_id": str(created.device_id) if created.device_id else None,
                "apartment_id": str(created.apartment_id) if created.apartment_id else None,
            }
            await event_bus.publish(
                topic=settings.kafka_alerts_topic,
                value=alert_event_payload,
                key=str(created.id),
            )
        except Exception:
            # Never let event publishing break alert creation
            pass


        return AlertResponse.model_validate(created)

    async def acknowledge(self, alert_id: UUID) -> AlertResponse | None:
        """Mark alert as acknowledged."""
        updated = await self.repo.update_status(alert_id, AlertStatus.ACKNOWLEDGED)
        if not updated:
            return None
        return AlertResponse.model_validate(updated)

    async def resolve(self, alert_id: UUID) -> AlertResponse | None:
        """Mark alert as resolved."""
        updated = await self.repo.update_status(alert_id, AlertStatus.RESOLVED)
        if not updated:
            return None
        return AlertResponse.model_validate(updated)
