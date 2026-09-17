"""Web Push / Mobile Push notification provider."""

import uuid
from typing import Any

from app.core.logging import get_logger
from app.models.notification import DeliveryStatus, NotificationChannel
from app.services.notification_providers.base import (
    BaseNotificationProvider,
    ProviderDeliveryResult,
)

logger = get_logger(__name__)


class PushProvider(BaseNotificationProvider):
    """Browser Web Push / Mobile Push provider."""

    @property
    def provider_name(self) -> str:
        return "web_push"

    @property
    def channel(self) -> NotificationChannel:
        return NotificationChannel.PUSH

    async def send(
        self,
        recipient: str,
        title: str,
        body: str,
        context: dict[str, Any] | None = None,
    ) -> ProviderDeliveryResult:
        logger.info("web_push_dispatch", recipient=recipient, title=title)
        return ProviderDeliveryResult(
            success=True,
            provider=self.provider_name,
            channel=self.channel,
            status=DeliveryStatus.DELIVERED,
            message_id=f"push_{uuid.uuid4().hex[:10]}",
        )
