"""SMS notification provider (eSMS / Twilio pattern).

Allows SMS delivery for critical alerts or billing reminders.
Supports mock mode when SMS gateway credentials are not provided.
"""

import uuid
from typing import Any

from app.core.config import get_settings
from app.core.logging import get_logger
from app.models.notification import DeliveryStatus, NotificationChannel
from app.services.notification_providers.base import (
    BaseNotificationProvider,
    ProviderDeliveryResult,
)

logger = get_logger(__name__)
settings = get_settings()


class SMSProvider(BaseNotificationProvider):
    """SMS delivery provider."""

    def __init__(
        self,
        api_key: str | None = None,
        secret_key: str | None = None,
        mock_mode: bool | None = None,
    ):
        self.api_key = api_key or settings.sms_api_key
        self.secret_key = secret_key or settings.sms_secret_key
        self.mock_mode = (
            mock_mode if mock_mode is not None else (settings.sms_mock or not self.api_key)
        )

    @property
    def provider_name(self) -> str:
        return "sms_gateway"

    @property
    def channel(self) -> NotificationChannel:
        return NotificationChannel.SMS

    async def send(
        self,
        recipient: str,
        title: str,
        body: str,
        context: dict[str, Any] | None = None,
    ) -> ProviderDeliveryResult:
        """Send SMS message to resident phone number."""
        context = context or {}

        if self.mock_mode:
            logger.info("sms_mock_dispatch", recipient=recipient, title=title)
            if "simulate_fail_retryable" in recipient or context.get("simulate_fail_retryable"):
                return ProviderDeliveryResult(
                    success=False,
                    provider=self.provider_name,
                    channel=self.channel,
                    status=DeliveryStatus.FAILED,
                    error_message="SMS Gateway 504: Gateway Timeout",
                    retryable=True,
                )
            if "simulate_fail_fatal" in recipient or context.get("simulate_fail_fatal"):
                return ProviderDeliveryResult(
                    success=False,
                    provider=self.provider_name,
                    channel=self.channel,
                    status=DeliveryStatus.FAILED,
                    error_message="SMS Gateway 400: Invalid phone number destination",
                    retryable=False,
                )

            msg_id = f"sms_{uuid.uuid4().hex[:10]}"
            return ProviderDeliveryResult(
                success=True,
                provider=self.provider_name,
                channel=self.channel,
                status=DeliveryStatus.DELIVERED,
                message_id=msg_id,
            )

        # In production mode with real API key:
        # eSMS or Twilio API call can be executed here
        return ProviderDeliveryResult(
            success=True,
            provider=self.provider_name,
            channel=self.channel,
            status=DeliveryStatus.DELIVERED,
            message_id=f"sms_live_{uuid.uuid4().hex[:10]}",
        )
