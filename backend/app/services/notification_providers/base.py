"""Base classes and contracts for notification channel providers."""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any

from app.models.notification import DeliveryStatus, NotificationChannel


@dataclass
class ProviderDeliveryResult:
    """Standard delivery result across all channel providers."""
    success: bool
    provider: str
    channel: NotificationChannel
    status: DeliveryStatus
    error_message: str | None = None
    message_id: str | None = None
    retryable: bool = False
    raw_response: dict[str, Any] | None = None


class BaseNotificationProvider(ABC):
    """Abstract interface for external notification providers."""

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Name of the provider (e.g. 'zalo_oa', 'mock_sms', 'in_app')."""
        pass

    @property
    @abstractmethod
    def channel(self) -> NotificationChannel:
        """Delivery channel this provider serves."""
        pass

    @abstractmethod
    async def send(
        self,
        recipient: str,
        title: str,
        body: str,
        context: dict[str, Any] | None = None,
    ) -> ProviderDeliveryResult:
        """Transmit notification to the recipient through provider API."""
        pass
