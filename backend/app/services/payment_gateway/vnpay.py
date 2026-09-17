"""VNPay payment gateway implementation.

Implements the VNPay v2 payment API with HMAC-SHA512 signature verification.
Supports both sandbox and production modes via environment configuration.

Reference: https://sandbox.vnpayment.vn/apis/
"""

import hashlib
import hmac
import urllib.parse
from datetime import datetime, timezone

from app.core.config import get_settings
from app.core.logging import get_logger
from app.services.payment_gateway.base import PaymentGatewayBase, WebhookResult

logger = get_logger(__name__)


# VNPay response code → internal status mapping
_VNPAY_STATUS_MAP: dict[str, str] = {
    "00": "success",
    "01": "failed",     # Transaction incomplete
    "02": "failed",     # Order already paid
    "04": "failed",     # Invalid amount
    "05": "processing", # Processing at bank
    "06": "failed",     # Refund request sent
    "07": "cancelled",  # Suspected fraud
    "09": "failed",     # Transaction refused
    "10": "failed",     # Auth failed 3+ times
    "11": "failed",     # Payment timeout
    "12": "failed",     # Card/account locked
    "24": "cancelled",  # Customer cancelled
    "51": "failed",     # Insufficient funds
    "65": "failed",     # Over daily limit
    "75": "failed",     # Bank under maintenance
    "99": "failed",     # Unknown error
}


class VNPayGateway(PaymentGatewayBase):
    """VNPay v2 payment gateway with HMAC-SHA512 signature."""

    def __init__(self) -> None:
        settings = get_settings()
        self._tmn_code = settings.vnpay_tmn_code
        self._hash_secret = settings.vnpay_hash_secret
        self._payment_url = settings.vnpay_payment_url
        self._return_url = settings.vnpay_return_url
        self._is_mock = settings.payment_gateway_mock

    @property
    def provider_name(self) -> str:
        return "vnpay"

    async def create_payment_url(
        self,
        transaction_id: str,
        amount: float,
        description: str,
        return_url: str,
        ip_address: str,
    ) -> str:
        """Create VNPay payment URL with required parameters and HMAC signature."""
        if self._is_mock:
            # Mock mode: return a local mock URL
            mock_url = (
                f"{return_url}?vnp_ResponseCode=00"
                f"&vnp_TxnRef={transaction_id}"
                f"&vnp_Amount={int(amount * 100)}"
                f"&mock=true"
            )
            logger.info(
                "vnpay_mock_payment_url_created",
                transaction_id=transaction_id,
                amount=amount,
            )
            return mock_url

        now = datetime.now(timezone.utc)
        params = {
            "vnp_Version": "2.1.0",
            "vnp_Command": "pay",
            "vnp_TmnCode": self._tmn_code,
            "vnp_Amount": str(int(amount * 100)),  # VNPay uses amount × 100
            "vnp_CurrCode": "VND",
            "vnp_TxnRef": transaction_id,
            "vnp_OrderInfo": description[:255],  # Max 255 chars
            "vnp_OrderType": "billpayment",
            "vnp_Locale": "vn",
            "vnp_ReturnUrl": return_url or self._return_url,
            "vnp_IpAddr": ip_address,
            "vnp_CreateDate": now.strftime("%Y%m%d%H%M%S"),
        }

        # Sort params alphabetically and create query string
        sorted_params = sorted(params.items())
        query_string = urllib.parse.urlencode(sorted_params)

        # Sign with HMAC-SHA512
        signature = hmac.new(
            self._hash_secret.encode("utf-8"),
            query_string.encode("utf-8"),
            hashlib.sha512,
        ).hexdigest()

        payment_url = f"{self._payment_url}?{query_string}&vnp_SecureHash={signature}"

        logger.info(
            "vnpay_payment_url_created",
            transaction_id=transaction_id,
            amount=amount,
        )
        return payment_url

    def verify_webhook_signature(
        self, raw_payload: dict, signature: str
    ) -> bool:
        """Verify VNPay IPN/return URL signature using HMAC-SHA512.

        This MUST be called before processing any webhook data.
        """
        if self._is_mock:
            logger.info("vnpay_mock_signature_verification_skipped")
            return True

        if not signature or not self._hash_secret:
            logger.warning("vnpay_signature_verification_failed_empty_inputs")
            return False

        # Remove signature fields from payload for verification
        check_params = {
            k: v for k, v in raw_payload.items()
            if k not in ("vnp_SecureHash", "vnp_SecureHashType")
        }

        # Sort and create query string
        sorted_params = sorted(check_params.items())
        query_string = urllib.parse.urlencode(sorted_params)

        # Compute expected signature
        expected = hmac.new(
            self._hash_secret.encode("utf-8"),
            query_string.encode("utf-8"),
            hashlib.sha512,
        ).hexdigest()

        is_valid = hmac.compare_digest(expected.lower(), signature.lower())

        if not is_valid:
            logger.warning(
                "vnpay_webhook_signature_invalid",
                # DO NOT log the actual signatures or payload values
            )

        return is_valid

    def parse_webhook_payload(self, raw_payload: dict) -> WebhookResult:
        """Parse VNPay IPN/return payload into internal WebhookResult."""
        response_code = raw_payload.get("vnp_ResponseCode", "99")
        status = _VNPAY_STATUS_MAP.get(response_code, "failed")

        # Extract amount (VNPay sends amount × 100)
        raw_amount = raw_payload.get("vnp_Amount", "0")
        try:
            amount = float(raw_amount) / 100.0
        except (ValueError, TypeError):
            amount = 0.0

        return WebhookResult(
            provider_txn_id=raw_payload.get("vnp_TransactionNo", ""),
            status=status,
            response_code=response_code,
            message=raw_payload.get("vnp_OrderInfo", ""),
            amount=amount,
            # Scrub sensitive fields before storing
            raw_data={
                k: v for k, v in raw_payload.items()
                if k not in ("vnp_SecureHash", "vnp_SecureHashType")
            },
        )
