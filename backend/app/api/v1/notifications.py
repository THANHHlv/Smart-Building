"""Notification internal and administration endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_admin
from app.core.config import get_settings
from app.core.database import get_db
from app.core.kafka_bus import get_event_bus
from app.models.user import User
from app.schemas.notification import NotificationEventPayload
from app.services.notification_service import NotificationService

router = APIRouter(prefix="/notifications", tags=["Notifications"])
settings = get_settings()


@router.post("/dispatch", status_code=status.HTTP_202_ACCEPTED)
async def dispatch_notification_event(
    payload: NotificationEventPayload,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Publish a notification event to Kafka topic notifications.requested.

    Accessible by admin or internal services to trigger multi-channel notifications.
    """
    event_bus = get_event_bus()
    event_dict = payload.model_dump(mode="json")

    # Publish to Kafka / Event Bus
    published = await event_bus.publish(
        topic=settings.kafka_notifications_topic,
        value=event_dict,
        key=str(payload.user_id),
    )

    # For synchronous immediate execution (e.g. testing or direct fallback)
    service = NotificationService(db)
    created_notifications = await service.process_notification_event(payload)

    return {
        "message": "Notification event accepted and queued for delivery",
        "published_to_bus": published,
        "dispatched_count": len(created_notifications),
        "notification_ids": [str(n.id) for n in created_notifications],
    }
