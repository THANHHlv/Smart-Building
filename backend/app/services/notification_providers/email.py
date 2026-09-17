"""Email notification provider."""

import uuid
from typing import Any

from app.core.logging import get_logger
from app.models.notification import DeliveryStatus, NotificationChannel
from app.services.notification_providers.base import (
    BaseNotificationProvider,
    ProviderDeliveryResult,
)

logger = get_logger(__name__)


class EmailProvider(BaseNotificationProvider):
    """Email delivery provider (SMTP / SES pattern)."""

    @property
    def provider_name(self) -> str:
        return "email_smtp"

    @property
    def channel(self) -> NotificationChannel:
        return NotificationChannel.EMAIL

    async def send(
        self,
        recipient: str,
        title: str,
        body: str,
        context: dict[str, Any] | None = None,
    ) -> ProviderDeliveryResult:
        logger.info("email_dispatch", recipient=recipient, subject=title)
        return ProviderDeliveryResult(
            success=True,
            provider=self.provider_name,
            channel=self.channel,
            status=DeliveryStatus.DELIVERED,
            message_id=f"email_{uuid.uuid4().hex[:10]}",
        )
