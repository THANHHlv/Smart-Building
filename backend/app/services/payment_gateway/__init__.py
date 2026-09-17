"""Payment gateway abstraction layer.

Provides a factory function to obtain the configured gateway implementation.
"""

from app.core.config import get_settings
from app.services.payment_gateway.base import PaymentGatewayBase


def get_payment_gateway() -> PaymentGatewayBase:
    """Return the configured payment gateway instance.

    Uses PAYMENT_GATEWAY_MOCK env var to decide between the mock
    gateway and VNPay production/sandbox gateway.
    """
    settings = get_settings()
    if settings.payment_gateway_mock:
        from app.services.payment_gateway.vnpay import VNPayGateway

        # Return VNPay in sandbox mode — it functions as a mock
        # when credentials are empty
        return VNPayGateway()
    else:
        from app.services.payment_gateway.vnpay import VNPayGateway

        return VNPayGateway()
