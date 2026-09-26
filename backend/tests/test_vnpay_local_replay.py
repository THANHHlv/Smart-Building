"""Local sandbox replay accepts only an authentic VNPay return URL."""

import hashlib
import hmac
from urllib.parse import urlencode

import pytest

from app.core.config import get_settings
from scripts.replay_vnpay_return import prepare_signed_callback


def signed_return_url(settings) -> str:
    payload = {
        "vnp_Amount": "1000000",
        "vnp_ResponseCode": "00",
        "vnp_TmnCode": settings.vnpay_tmn_code,
        "vnp_TransactionStatus": "00",
        "vnp_TxnRef": "00000000-0000-0000-0000-000000000001",
    }
    canonical = urlencode(sorted(payload.items()))
    payload["vnp_SecureHash"] = hmac.new(
        settings.vnpay_hash_secret.encode(), canonical.encode(), hashlib.sha512
    ).hexdigest()
    return f"{settings.vnpay_return_url}?{urlencode(payload)}"


def test_local_replay_accepts_signed_return(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "app_env", "development")
    monkeypatch.setattr(settings, "payment_gateway_mock", False)
    monkeypatch.setattr(settings, "vnpay_tmn_code", "TESTMER1")
    monkeypatch.setattr(settings, "vnpay_hash_secret", "test-only-signing-secret")

    payload = prepare_signed_callback(signed_return_url(settings))
    assert payload["vnp_TxnRef"] == "00000000-0000-0000-0000-000000000001"

    with pytest.raises(ValueError, match="Chữ ký"):
        prepare_signed_callback(signed_return_url(settings).replace("1000000", "2000000"))
    with pytest.raises(ValueError, match="URL trả về"):
        prepare_signed_callback(signed_return_url(settings).replace(settings.vnpay_return_url, "http://localhost:5173/other"))


def test_local_replay_refuses_production(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "app_env", "production")
    monkeypatch.setattr(settings, "payment_gateway_mock", False)
    with pytest.raises(ValueError, match="development"):
        prepare_signed_callback(settings.vnpay_return_url)
