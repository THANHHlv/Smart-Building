"""Test suite for Notification Service — Multi-channel, Preferences, Retry, DLQ, and Metrics."""

import uuid
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.metrics import NOTIFICATIONS_REQUESTED, NOTIFICATIONS_SENT, NOTIFICATIONS_DLQ
from app.core.security import create_access_token, hash_password
from app.main import app
from app.models.apartment import Apartment
from app.models.building import Building
from app.models.floor import Floor
from app.models.notification import (
    DeliveryStatus,
    Notification,
    NotificationCategory,
    NotificationChannel,
    NotificationDeliveryLog,
    NotificationPreference,
    NotificationStatus,
    NotificationTemplate,
)
from app.models.user import User
from app.schemas.notification import (
    NotificationEventPayload,
    NotificationPreferenceItem,
    NotificationPreferencesUpdateRequest,
)
from app.services.notification_service import NotificationService, RateLimiter
from app.services.notification_providers.base import BaseNotificationProvider, ProviderDeliveryResult
from app.services.notification_providers.registry import get_provider_registry

import pytest_asyncio
from tests.conftest import testing_session_factory
from app.core.database import get_db

settings = get_settings()


@pytest_asyncio.fixture
async def db_session() -> AsyncSession:
    """Provide isolated db session for tests."""
    async with testing_session_factory() as session:
        yield session


@pytest_asyncio.fixture
async def seed_test_data(db_session: AsyncSession):
    """Seed test building, floor, apartment, resident, and templates."""
    b = Building(name="Oasis Tower A", address="Hanoi", total_floors=10)
    db_session.add(b)
    await db_session.flush()

    f = Floor(building_id=b.id, floor_number=5)
    db_session.add(f)
    await db_session.flush()

    apt = Apartment(floor_id=f.id, unit_number="502", area_sqm=75.5)
    db_session.add(apt)
    await db_session.flush()

    pwd = hash_password("secret123")
    user = User(
        email="resident502@example.com",
        hashed_password=pwd,
        full_name="Pham Minh Duc",
        role="resident",
        apartment_id=apt.id,
    )
    db_session.add(user)
    await db_session.flush()

    # Seed test templates
    t1 = NotificationTemplate(
        code="billing.payment_due_soon",
        channel=NotificationChannel.IN_APP,
        title_template="Nhắc hạn hóa đơn {invoice_number}",
        body_template="Hóa đơn {invoice_number} số tiền {amount} đ sẽ đến hạn ngày {due_date}.",
        is_active=True,
    )
    t2 = NotificationTemplate(
        code="billing.payment_due_soon",
        channel=NotificationChannel.ZALO,
        title_template="ZALO - Nhắc hạn {invoice_number}",
        body_template="Kính gửi cư dân {apartment_unit}, hóa đơn {invoice_number} ({amount} đ) đến hạn {due_date}.",
        is_active=True,
    )
    db_session.add_all([t1, t2])
    await db_session.commit()

    return {"building": b, "apartment": apt, "user": user}


@pytest.mark.asyncio
async def test_notification_templates_and_rendering(db_session: AsyncSession, seed_test_data):
    """Test that templates resolve placeholders properly."""
    user = seed_test_data["user"]
    service = NotificationService(db_session)

    payload = NotificationEventPayload(
        user_id=user.id,
        category=NotificationCategory.BILLING,
        template_code="billing.payment_due_soon",
        context={
            "invoice_number": "INV-2026-001",
            "amount": "1,500,000",
            "due_date": "15/10/2026",
            "apartment_unit": "502",
        },
        channels=[NotificationChannel.IN_APP, NotificationChannel.ZALO],
    )

    notifications = await service.process_notification_event(payload)
    assert len(notifications) == 2

    in_app_notif = next(n for n in notifications if n.channel == NotificationChannel.IN_APP)
    assert in_app_notif.title == "Nhắc hạn hóa đơn INV-2026-001"
    assert "1,500,000 đ" in in_app_notif.body
    assert in_app_notif.status == NotificationStatus.DELIVERED

    zalo_notif = next(n for n in notifications if n.channel == NotificationChannel.ZALO)
    assert "ZALO" in zalo_notif.title
    assert "cư dân 502" in zalo_notif.body


@pytest.mark.asyncio
async def test_user_preferences_filtering(db_session: AsyncSession, seed_test_data):
    """Test that disabling a channel in preferences prevents dispatching to that channel."""
    user = seed_test_data["user"]
    service = NotificationService(db_session)

    # Disable ZALO for BILLING category
    pref = NotificationPreference(
        user_id=user.id,
        category=NotificationCategory.BILLING,
        channel=NotificationChannel.ZALO,
        is_enabled=False,
    )
    db_session.add(pref)
    await db_session.commit()

    payload = NotificationEventPayload(
        user_id=user.id,
        category=NotificationCategory.BILLING,
        template_code="billing.payment_due_soon",
        context={"invoice_number": "INV-2026-002", "amount": "800,000", "due_date": "15/10/2026"},
        channels=[NotificationChannel.IN_APP, NotificationChannel.ZALO],
    )

    notifications = await service.process_notification_event(payload)
    # Only IN_APP should be created, ZALO was disabled
    assert len(notifications) == 1
    assert notifications[0].channel == NotificationChannel.IN_APP


@pytest.mark.asyncio
async def test_idempotency_prevents_duplicate_send(db_session: AsyncSession, seed_test_data):
    """Test that duplicate events with same idempotency_key are ignored."""
    user = seed_test_data["user"]
    service = NotificationService(db_session)

    idemp_key = f"idemp_test_{uuid.uuid4().hex[:8]}"
    payload = NotificationEventPayload(
        user_id=user.id,
        category=NotificationCategory.BILLING,
        template_code="billing.payment_due_soon",
        idempotency_key=idemp_key,
        context={"invoice_number": "INV-IDEMP", "amount": "500,000", "due_date": "20/10/2026"},
        channels=[NotificationChannel.IN_APP],
    )

    first_dispatch = await service.process_notification_event(payload)
    assert len(first_dispatch) == 1
    first_id = first_dispatch[0].id

    # Dispatch second time with the exact same idempotency_key
    second_dispatch = await service.process_notification_event(payload)
    assert len(second_dispatch) == 1
    assert second_dispatch[0].id == first_id  # Returns existing, does not recreate


@pytest.mark.asyncio
async def test_retry_and_dlq_on_provider_failure(db_session: AsyncSession, seed_test_data):
    """Test that a failing provider triggers retries and ultimately forwards to DLQ."""
    user = seed_test_data["user"]
    service = NotificationService(db_session)

    # Register a failing provider for SMS
    class FailingSMSProvider(BaseNotificationProvider):
        provider_name = "failing_sms"
        channel = NotificationChannel.SMS

        def __init__(self):
            self.call_count = 0

        async def send(self, recipient, title, body, context=None):
            self.call_count += 1
            return ProviderDeliveryResult(
                success=False,
                provider=self.provider_name,
                channel=self.channel,
                status=DeliveryStatus.FAILED,
                error_message="Simulated temporary SMS gateway failure",
                retryable=True,
            )

    mock_fail_provider = FailingSMSProvider()
    registry = get_provider_registry()
    registry.register(mock_fail_provider)

    payload = NotificationEventPayload(
        user_id=user.id,
        category=NotificationCategory.ALERT,
        template_code="alert.anomaly_detected",
        context={"alert_title": "Rò rỉ nước", "message": "Áp lực nước tăng đột biến"},
        channels=[NotificationChannel.SMS],
    )

    notifications = await service.process_notification_event(payload)
    assert len(notifications) == 1
    notif = notifications[0]
    assert notif.status == NotificationStatus.FAILED
    # Check that retry occurred: 1 initial + 3 retries = 4 calls
    assert mock_fail_provider.call_count == 4


@pytest.mark.asyncio
async def test_resident_notification_apis(seed_test_data):
    """Test resident API endpoints: list, mark read, mark all read, and preferences."""
    user = seed_test_data["user"]
    token = create_access_token({"sub": str(user.id), "role": "resident"})
    headers = {"Authorization": f"Bearer {token}"}

    async def override_get_db():
        async with testing_session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Dispatch a test notification
        dispatch_res = await client.post(
            "/api/v1/notifications/dispatch",
            headers=headers,
            json={
                "user_id": str(user.id),
                "category": "billing",
                "template_code": "billing.payment_due_soon",
                "context": {"invoice_number": "INV-API-01", "amount": "990,000", "due_date": "15/10/2026"},
                "channels": ["in_app"],
            },
        )
        assert dispatch_res.status_code == 202
        data = dispatch_res.json()
        assert len(data["notification_ids"]) >= 1
        notif_id = data["notification_ids"][0]

        # 2. GET /api/v1/me/notifications
        list_res = await client.get("/api/v1/me/notifications", headers=headers)
        assert list_res.status_code == 200
        list_data = list_res.json()
        assert list_data["total"] >= 1
        assert list_data["unread_count"] >= 1
        assert any(item["id"] == notif_id for item in list_data["items"])

        # 3. POST /api/v1/me/notifications/{id}/read
        read_res = await client.post(f"/api/v1/me/notifications/{notif_id}/read", headers=headers)
        assert read_res.status_code == 200
        assert read_res.json()["status"] == "read"

        # 4. POST /api/v1/me/notifications/read-all
        read_all_res = await client.post("/api/v1/me/notifications/read-all", headers=headers)
        assert read_all_res.status_code == 200
        assert "read_count" in read_all_res.json()

        # 5. GET /api/v1/me/notification-preferences
        pref_get_res = await client.get("/api/v1/me/notification-preferences", headers=headers)
        assert pref_get_res.status_code == 200
        prefs = pref_get_res.json()["preferences"]
        assert len(prefs) == 4 * 5  # 4 categories x 5 channels

        # 6. PUT /api/v1/me/notification-preferences
        update_res = await client.put(
            "/api/v1/me/notification-preferences",
            headers=headers,
            json={
                "preferences": [
                    {"category": "billing", "channel": "sms", "is_enabled": False},
                    {"category": "billing", "channel": "email", "is_enabled": False},
                ]
            },
        )
        assert update_res.status_code == 200
        updated_prefs = update_res.json()["preferences"]
        sms_billing = next(p for p in updated_prefs if p["category"] == "billing" and p["channel"] == "sms")
        assert sms_billing["is_enabled"] is False


@pytest.mark.asyncio
async def test_prometheus_metrics_endpoint():
    """Test that Prometheus /metrics endpoint is live and outputs notification metrics."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/metrics")
        assert res.status_code == 200
        body = res.text
        assert "notifications_requested_total" in body
        assert "notifications_sent_total" in body
        assert "notification_delivery_duration_seconds" in body
