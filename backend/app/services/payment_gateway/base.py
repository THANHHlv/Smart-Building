"""Abstract base class for payment gateway integrations.

All payment gateway implementations must inherit from this class
and implement its abstract methods. This abstraction layer allows
swapping or adding new gateways (MoMo, ZaloPay, Stripe) without
modifying the PaymentService business logic.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class WebhookResult:
    """Parsed result from a payment gateway webhook/IPN callback."""

    provider_txn_id: str
    status: str  # Should map to TransactionStatus enum value
    response_code: str
    message: str
    amount: float | None = None
    raw_data: dict | None = None


class PaymentGatewayBase(ABC):
    """Abstract interface that all payment gateways must implement."""

    @abstractmethod
    async def create_payment_url(
        self,
        transaction_id: str,
        amount: float,
        description: str,
        return_url: str,
        ip_address: str,
    ) -> str:
        """Create a redirect URL to the payment provider's hosted checkout.

        Args:
            transaction_id: Internal transaction UUID (used as order reference).
            amount: Payment amount in the local currency (VND).
            description: Human-readable payment description.
            return_url: URL to redirect the user after payment.
            ip_address: Client IP address (required by some providers).

        Returns:
            The full URL the client should be redirected to.
        """

    @abstractmethod
    def verify_webhook_signature(
        self, raw_payload: dict, signature: str
    ) -> bool:
        """Verify the cryptographic signature of a webhook/IPN callback.

        This MUST be called before any business logic processes the webhook.

        Args:
            raw_payload: The raw query parameters or body from the webhook.
            signature: The signature value to verify against.

        Returns:
            True if the signature is valid, False otherwise.
        """

    @abstractmethod
    def parse_webhook_payload(self, raw_payload: dict) -> WebhookResult:
        """Parse a verified webhook payload into the internal schema.

        Should only be called AFTER verify_webhook_signature returns True.

        Args:
            raw_payload: The raw query parameters or body from the webhook.

        Returns:
            A WebhookResult with normalized transaction data.
        """

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Return the provider identifier (e.g. 'vnpay', 'momo')."""
