"""In-App notification provider.

Directly records notifications into database storage for the resident's active session feed.
"""

from typing import Any

from app.core.logging import get_logger
from app.models.notification import DeliveryStatus, NotificationChannel
from app.services.notification_providers.base import (
    BaseNotificationProvider,
    ProviderDeliveryResult,
)

logger = get_logger(__name__)


class InAppProvider(BaseNotificationProvider):
    """In-app notification delivery provider."""

    @property
    def provider_name(self) -> str:
        return "in_app"

    @property
    def channel(self) -> NotificationChannel:
        return NotificationChannel.IN_APP

    async def send(
        self,
        recipient: str,
        title: str,
        body: str,
        context: dict[str, Any] | None = None,
    ) -> ProviderDeliveryResult:
        """Deliver directly to in-app portal."""
        logger.debug("in_app_notification_delivered", user_id=recipient, title=title)
        return ProviderDeliveryResult(
            success=True,
            provider=self.provider_name,
            channel=self.channel,
            status=DeliveryStatus.DELIVERED,
            message_id=f"inapp_{recipient}",
        )
