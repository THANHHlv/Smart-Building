"""Notification providers package."""

from app.services.notification_providers.base import (
    BaseNotificationProvider,
    ProviderDeliveryResult,
)
from app.services.notification_providers.email import EmailProvider
from app.services.notification_providers.in_app import InAppProvider
from app.services.notification_providers.push import PushProvider
from app.services.notification_providers.registry import (
    NotificationProviderRegistry,
    get_provider_registry,
)
from app.services.notification_providers.sms import SMSProvider
from app.services.notification_providers.zalo_oa import ZaloOAProvider

__all__ = [
    "BaseNotificationProvider",
    "ProviderDeliveryResult",
    "InAppProvider",
    "ZaloOAProvider",
    "SMSProvider",
    "PushProvider",
    "EmailProvider",
    "NotificationProviderRegistry",
    "get_provider_registry",
]
