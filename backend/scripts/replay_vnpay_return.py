"""Replay a signed VNPay sandbox return to the local IPN endpoint.

This is a development-only transport aid. Production payment reconciliation
must use VNPay's server-to-server IPN callback.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qsl, urlsplit
from urllib.request import Request, urlopen

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from app.core.config import get_settings
from app.services.payment_gateway.vnpay import VNPayGateway


LOCAL_IPN_URL = "http://127.0.0.1:8000/api/v1/webhooks/payment/vnpay"


def prepare_signed_callback(return_url: str) -> dict[str, str]:
    """Validate a browser return and extract its signed VNPay parameters."""
    settings = get_settings()
    if not settings.is_development or settings.payment_gateway_mock:
        raise ValueError("Chỉ dùng với VNPay sandbox trong APP_ENV=development")

    actual = urlsplit(return_url.strip())
    expected = urlsplit(settings.vnpay_return_url)
    if (actual.scheme, actual.netloc, actual.path) != (
        expected.scheme, expected.netloc, expected.path
    ):
        raise ValueError("URL trả về không khớp VNPAY_RETURN_URL")

    pairs = parse_qsl(actual.query, keep_blank_values=True)
    if len(pairs) != len(dict(pairs)):
        raise ValueError("URL trả về có tham số trùng lặp")
    payload = {key: value for key, value in pairs if key.startswith("vnp_")}
    required = {
        "vnp_SecureHash", "vnp_TmnCode", "vnp_TxnRef", "vnp_Amount",
        "vnp_ResponseCode", "vnp_TransactionStatus",
    }
    if not required.issubset(payload):
        raise ValueError("URL trả về thiếu tham số VNPay bắt buộc")
    if payload["vnp_TmnCode"] != settings.vnpay_tmn_code:
        raise ValueError("Mã merchant không khớp")
    if not VNPayGateway().verify_webhook_signature(payload, payload["vnp_SecureHash"]):
        raise ValueError("Chữ ký VNPay không hợp lệ")

    return payload


def main() -> int:
    try:
        return_url = input("Dán toàn bộ URL VNPay trả về từ thanh địa chỉ: ").strip()
        payload = prepare_signed_callback(return_url)
        if input("Gửi callback đã xác minh tới backend local? [y/N]: ").strip().lower() != "y":
            print("Đã hủy; hóa đơn chưa được cập nhật.")
            return 0
        request = Request(
            LOCAL_IPN_URL,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urlopen(request, timeout=10) as response:
            result = json.load(response)
    except ValueError as exc:
        print(f"Không thể đối soát local: {exc}", file=sys.stderr)
        return 1
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as exc:
        print(f"Không thể gọi IPN local ({type(exc).__name__}). Kiểm tra backend ở cổng 8000.", file=sys.stderr)
        return 1

    if not isinstance(result, dict):
        print("Phản hồi IPN local không hợp lệ.", file=sys.stderr)
        return 1
    code = result.get("RspCode")
    print(f"Kết quả IPN local: {code} - {result.get('Message', '')}")
    return 0 if code in {"00", "02"} else 1


if __name__ == "__main__":
    raise SystemExit(main())
