"""Zalo Official Account (Zalo OA / ZNS) notification provider.

Prioritized channel for Vietnamese residents with higher open/read rates compared to email.
Supports production ZNS API and realistic mock mode for development and testing.
"""

import uuid
from typing import Any

import httpx

from app.core.config import get_settings
from app.core.logging import get_logger
from app.models.notification import DeliveryStatus, NotificationChannel
from app.services.notification_providers.base import (
    BaseNotificationProvider,
    ProviderDeliveryResult,
)

logger = get_logger(__name__)
settings = get_settings()


class ZaloOAProvider(BaseNotificationProvider):
    """Zalo OA Provider for Vietnam resident communications."""

    def __init__(
        self,
        app_id: str | None = None,
        secret_key: str | None = None,
        access_token: str | None = None,
        mock_mode: bool | None = None,
    ):
        self.app_id = app_id or settings.zalo_oa_app_id
        self.secret_key = secret_key or settings.zalo_oa_secret_key
        self.access_token = access_token or settings.zalo_oa_access_token
        self.mock_mode = (
            mock_mode if mock_mode is not None else (settings.zalo_oa_mock or not self.access_token)
        )

    @property
    def provider_name(self) -> str:
        return "zalo_oa"

    @property
    def channel(self) -> NotificationChannel:
        return NotificationChannel.ZALO

    async def send(
        self,
        recipient: str,
        title: str,
        body: str,
        context: dict[str, Any] | None = None,
    ) -> ProviderDeliveryResult:
        """Send notification via Zalo OA."""
        context = context or {}

        # 1. Mock mode handling
        if self.mock_mode:
            return await self._mock_send(recipient, title, body, context)

        # 2. Production Zalo ZNS / OA API call
        return await self._live_send(recipient, title, body, context)

    async def _mock_send(
        self,
        recipient: str,
        title: str,
        body: str,
        context: dict[str, Any],
    ) -> ProviderDeliveryResult:
        """Simulate Zalo OA transmission in dev/test environments."""
        logger.info(
            "zalo_oa_mock_dispatch",
            recipient=recipient,
            title=title,
            template_code=context.get("template_code"),
        )

        # Allow test cases to force retryable or non-retryable failures
        if "simulate_fail_retryable" in recipient or context.get("simulate_fail_retryable"):
            logger.warning("zalo_oa_simulated_retryable_error", recipient=recipient)
            return ProviderDeliveryResult(
                success=False,
                provider=self.provider_name,
                channel=self.channel,
                status=DeliveryStatus.FAILED,
                error_message="Zalo OA API 503: Service Unavailable (simulated network timeout)",
                retryable=True,
            )

        if "simulate_fail_fatal" in recipient or context.get("simulate_fail_fatal"):
            logger.error("zalo_oa_simulated_fatal_error", recipient=recipient)
            return ProviderDeliveryResult(
                success=False,
                provider=self.provider_name,
                channel=self.channel,
                status=DeliveryStatus.FAILED,
                error_message="Zalo OA API 400: Invalid resident Zalo User ID or phone number",
                retryable=False,
            )

        mock_msg_id = f"zalo_msg_{uuid.uuid4().hex[:12]}"
        return ProviderDeliveryResult(
            success=True,
            provider=self.provider_name,
            channel=self.channel,
            status=DeliveryStatus.DELIVERED,
            message_id=mock_msg_id,
            raw_response={"error": 0, "message": "Success", "data": {"msg_id": mock_msg_id}},
        )

    async def _live_send(
        self,
        recipient: str,
        title: str,
        body: str,
        context: dict[str, Any],
    ) -> ProviderDeliveryResult:
        """Production HTTP call to Zalo Open API."""
        url = "https://business.openapi.zalo.me/message/template"
        headers = {
            "access_token": self.access_token,
            "Content-Type": "application/json",
        }
        payload = {
            "phone": recipient,
            "template_id": context.get("template_id", "default_template"),
            "template_data": {
                "title": title,
                "body": body,
                **context,
            },
            "tracking_id": str(uuid.uuid4()),
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(url, headers=headers, json=payload)

            if resp.status_code == 200:
                data = resp.json()
                if data.get("error") == 0:
                    return ProviderDeliveryResult(
                        success=True,
                        provider=self.provider_name,
                        channel=self.channel,
                        status=DeliveryStatus.DELIVERED,
                        message_id=data.get("data", {}).get("msg_id"),
                        raw_response=data,
                    )
                else:
                    err_code = data.get("error")
                    retryable = err_code in [-32, -33, -34]  # Rate limit or temporary service issue
                    return ProviderDeliveryResult(
                        success=False,
                        provider=self.provider_name,
                        channel=self.channel,
                        status=DeliveryStatus.FAILED,
                        error_message=f"Zalo API error {err_code}: {data.get('message')}",
                        retryable=retryable,
                        raw_response=data,
                    )
            elif resp.status_code in (500, 502, 503, 504, 429):
                return ProviderDeliveryResult(
                    success=False,
                    provider=self.provider_name,
                    channel=self.channel,
                    status=DeliveryStatus.FAILED,
                    error_message=f"Zalo HTTP {resp.status_code}: {resp.text[:200]}",
                    retryable=True,
                )
            else:
                return ProviderDeliveryResult(
                    success=False,
                    provider=self.provider_name,
                    channel=self.channel,
                    status=DeliveryStatus.FAILED,
                    error_message=f"Zalo HTTP {resp.status_code}: {resp.text[:200]}",
                    retryable=False,
                )
        except httpx.RequestError as exc:
            return ProviderDeliveryResult(
                success=False,
                provider=self.provider_name,
                channel=self.channel,
                status=DeliveryStatus.FAILED,
                error_message=f"Network error calling Zalo OA: {str(exc)}",
                retryable=True,
            )
