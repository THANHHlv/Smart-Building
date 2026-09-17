"""Notification provider registry.

Coordinates channel routing and provider resolution.
"""

from app.models.notification import NotificationChannel
from app.services.notification_providers.base import BaseNotificationProvider
from app.services.notification_providers.email import EmailProvider
from app.services.notification_providers.in_app import InAppProvider
from app.services.notification_providers.push import PushProvider
from app.services.notification_providers.sms import SMSProvider
from app.services.notification_providers.zalo_oa import ZaloOAProvider


class NotificationProviderRegistry:
    """Registry mapping NotificationChannel to its active provider."""

    def __init__(self):
        self._providers: dict[NotificationChannel, BaseNotificationProvider] = {}
        self._register_defaults()

    def _register_defaults(self):
        """Register default providers for each supported channel."""
        self.register(InAppProvider())
        self.register(ZaloOAProvider())
        self.register(SMSProvider())
        self.register(PushProvider())
        self.register(EmailProvider())

    def register(self, provider: BaseNotificationProvider):
        """Register or override a provider for a channel."""
        self._providers[provider.channel] = provider

    def get(self, channel: NotificationChannel) -> BaseNotificationProvider | None:
        """Retrieve provider for given channel."""
        return self._providers.get(channel)


_global_registry = NotificationProviderRegistry()


def get_provider_registry() -> NotificationProviderRegistry:
    """Get the global notification provider registry."""
    return _global_registry
