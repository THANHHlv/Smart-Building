"""Notification Service — Core orchestration, template resolution, retry and DLQ pipeline."""

import asyncio
import json
import time
import uuid
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.kafka_bus import get_event_bus
from app.core.logging import get_logger
from app.core.metrics import (
    NOTIFICATION_DELIVERY_DURATION,
    NOTIFICATIONS_DLQ,
    NOTIFICATIONS_FAILED,
    NOTIFICATIONS_REQUESTED,
    NOTIFICATIONS_SENT,
)
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
    NotificationListResponse,
    NotificationPreferenceItem,
    NotificationPreferencesResponse,
    NotificationResponse,
)
from app.services.notification_providers.registry import get_provider_registry

logger = get_logger(__name__)
settings = get_settings()


class SafeDict(dict):
    """Dictionary that returns the placeholder key if missing during string format_map."""
    def __missing__(self, key):
        return f"{{{key}}}"


class RateLimiter:
    """In-memory sliding-window rate limiter per user."""

    def __init__(self, limit_per_minute: int = 15):
        self.limit = limit_per_minute
        self._user_timestamps: dict[uuid.UUID, list[float]] = defaultdict(list)

    def is_allowed(self, user_id: uuid.UUID) -> bool:
        now = time.time()
        window_start = now - 60.0
        timestamps = [ts for ts in self._user_timestamps[user_id] if ts > window_start]
        if len(timestamps) >= self.limit:
            return False
        timestamps.append(now)
        self._user_timestamps[user_id] = timestamps
        return True


_global_rate_limiter = RateLimiter(settings.notification_rate_limit_per_minute)


class NotificationService:
    """Service handling multi-channel resident notifications."""

    def __init__(self, session: AsyncSession):
        self.session = session
        self.provider_registry = get_provider_registry()
        self.event_bus = get_event_bus()
        self.rate_limiter = _global_rate_limiter

    # -------------------------------------------------------------------------
    # Ingestion & Dispatch Pipeline (Kafka Consumer / Service Calls)
    # -------------------------------------------------------------------------

    async def process_notification_event(
        self, event: NotificationEventPayload
    ) -> list[Notification]:
        """Process incoming notification request with idempotency, preference checks, and retry/DLQ."""
        logger.info(
            "processing_notification_event",
            user_id=str(event.user_id),
            category=event.category.value,
            template_code=event.template_code,
            idempotency_key=event.idempotency_key,
        )

        # 1. Idempotency Check: prevent duplicate deliveries on Kafka consumer retry
        if event.idempotency_key:
            stmt = select(Notification).where(
                Notification.user_id == event.user_id,
                Notification.idempotency_key == event.idempotency_key,
            )
            result = await self.session.execute(stmt)
            existing = result.scalars().all()
            if existing:
                logger.info(
                    "idempotent_notification_skipped",
                    user_id=str(event.user_id),
                    idempotency_key=event.idempotency_key,
                    existing_count=len(existing),
                )
                return list(existing)

        # 2. Rate Limiting Check
        if not self.rate_limiter.is_allowed(event.user_id):
            logger.warning(
                "user_notification_rate_limited",
                user_id=str(event.user_id),
                limit=self.rate_limiter.limit,
            )
            return []

        # 3. Resolve Target Channels via Resident Preferences
        target_channels = await self._resolve_target_channels(
            user_id=event.user_id,
            category=event.category,
            requested_channels=event.channels,
        )

        if not target_channels:
            logger.info(
                "no_enabled_channels_for_user",
                user_id=str(event.user_id),
                category=event.category.value,
            )
            return []

        # Retrieve user contact info (for SMS/Zalo)
        user_stmt = select(User).where(User.id == event.user_id)
        user_res = await self.session.execute(user_stmt)
        user = user_res.scalar_one_or_none()
        recipient_phone = getattr(user, "phone_number", None) or str(event.user_id)
        recipient_email = getattr(user, "email", "") or ""

        dispatched_notifications: list[Notification] = []

        # 4. Dispatch per channel
        for channel in target_channels:
            NOTIFICATIONS_REQUESTED.labels(category=event.category.value, channel=channel.value).inc()

            # Resolve Template
            title, body = await self._render_template(
                code=event.template_code,
                channel=channel,
                context=event.context,
            )

            # Create notification record
            notification = Notification(
                user_id=event.user_id,
                category=event.category,
                title=title,
                body=body,
                channel=channel,
                status=NotificationStatus.PENDING,
                idempotency_key=event.idempotency_key,
                data_json=json.dumps(event.context, default=str),
            )
            self.session.add(notification)
            await self.session.flush()

            # Determine destination address
            recipient_dest = str(event.user_id)
            if channel in (NotificationChannel.ZALO, NotificationChannel.SMS):
                recipient_dest = recipient_phone
            elif channel == NotificationChannel.EMAIL:
                recipient_dest = recipient_email

            # Execute delivery with retry & DLQ
            success = await self._deliver_with_retry(
                notification=notification,
                recipient=recipient_dest,
                context=event.context,
            )

            if success:
                notification.status = NotificationStatus.DELIVERED
            else:
                notification.status = NotificationStatus.FAILED

            dispatched_notifications.append(notification)

        await self.session.commit()
        return dispatched_notifications

    async def _deliver_with_retry(
        self,
        notification: Notification,
        recipient: str,
        context: dict[str, Any],
    ) -> bool:
        """Deliver to provider with exponential backoff retry (up to max_retries)."""
        channel = notification.channel
        provider = self.provider_registry.get(channel)
        if not provider:
            logger.error("no_provider_for_channel", channel=channel.value)
            return False

        max_retries = settings.notification_max_retries
        attempts = 0
        last_error = None

        while attempts <= max_retries:
            attempts += 1
            start_time = time.time()
            try:
                result = await provider.send(
                    recipient=recipient,
                    title=notification.title,
                    body=notification.body,
                    context=context,
                )
                duration = time.time() - start_time
                NOTIFICATION_DELIVERY_DURATION.labels(
                    channel=channel.value, provider=provider.provider_name
                ).observe(duration)

                if result.success:
                    # Audit Log
                    delivery_log = NotificationDeliveryLog(
                        notification_id=notification.id,
                        channel=channel,
                        provider=result.provider,
                        status=DeliveryStatus.DELIVERED,
                        sent_at=datetime.now(timezone.utc),
                        retry_count=attempts - 1,
                    )
                    self.session.add(delivery_log)
                    NOTIFICATIONS_SENT.labels(
                        channel=channel.value,
                        provider=result.provider,
                        status="delivered",
                    ).inc()
                    return True

                last_error = result.error_message
                if not result.retryable or attempts > max_retries:
                    break

                # Exponential backoff (0.05s * 2^(attempt-1))
                backoff = 0.05 * (2 ** (attempts - 1))
                await asyncio.sleep(backoff)

            except Exception as exc:
                duration = time.time() - start_time
                NOTIFICATION_DELIVERY_DURATION.labels(
                    channel=channel.value, provider=provider.provider_name
                ).observe(duration)
                last_error = str(exc)
                if attempts > max_retries:
                    break
                await asyncio.sleep(0.05 * (2 ** (attempts - 1)))

        # Exhausted retries or fatal error: record failure and route to DLQ
        delivery_log = NotificationDeliveryLog(
            notification_id=notification.id,
            channel=channel,
            provider=provider.provider_name,
            status=DeliveryStatus.FAILED,
            error_message=last_error,
            sent_at=datetime.now(timezone.utc),
            retry_count=attempts - 1,
        )
        self.session.add(delivery_log)
        NOTIFICATIONS_FAILED.labels(
            channel=channel.value,
            provider=provider.provider_name,
            reason=str(last_error)[:50] if last_error else "unknown",
        ).inc()

        # Publish to Dead-Letter Queue (DLQ)
        await self._forward_to_dlq(
            notification=notification,
            error_message=last_error,
            attempts=attempts - 1,
        )

        return False

    async def _forward_to_dlq(
        self,
        notification: Notification,
        error_message: str | None,
        attempts: int,
    ):
        """Route failed notification to Kafka notifications.dlq topic."""
        dlq_payload = {
            "notification_id": str(notification.id),
            "user_id": str(notification.user_id),
            "channel": notification.channel.value,
            "category": notification.category.value,
            "title": notification.title,
            "error_message": error_message,
            "retry_count": attempts,
            "failed_at": datetime.now(timezone.utc).isoformat(),
        }
        await self.event_bus.publish(
            topic=settings.kafka_notifications_dlq_topic,
            value=dlq_payload,
            key=str(notification.user_id),
        )
        NOTIFICATIONS_DLQ.labels(
            channel=notification.channel.value,
            reason=str(error_message)[:50] if error_message else "unknown",
        ).inc()
        logger.warning(
            "notification_routed_to_dlq",
            notification_id=str(notification.id),
            channel=notification.channel.value,
            attempts=attempts,
            error=error_message,
        )

    async def _render_template(
        self,
        code: str,
        channel: NotificationChannel,
        context: dict[str, Any],
    ) -> tuple[str, str]:
        """Look up template in database and safely format title and body."""
        stmt = select(NotificationTemplate).where(
            NotificationTemplate.code == code,
            NotificationTemplate.channel == channel,
            NotificationTemplate.is_active.is_(True),
        )
        result = await self.session.execute(stmt)
        template = result.scalar_one_or_none()

        safe_ctx = SafeDict(context)
        if template:
            title = template.title_template.format_map(safe_ctx)
            body = template.body_template.format_map(safe_ctx)
            return title, body

        # Fallback defaults if template not found in DB
        fallback_title = context.get("title", f"Thông báo hệ thống: {code}")
        fallback_body = context.get("message", "Quý cư dân có thông báo mới từ ban quản lý tòa nhà.")
        return fallback_title, fallback_body

    async def _resolve_target_channels(
        self,
        user_id: uuid.UUID,
        category: NotificationCategory,
        requested_channels: list[NotificationChannel] | None = None,
    ) -> list[NotificationChannel]:
        """Determine which channels are active according to user's saved preferences."""
        stmt = select(NotificationPreference).where(
            NotificationPreference.user_id == user_id,
            NotificationPreference.category == category,
        )
        result = await self.session.execute(stmt)
        preferences = result.scalars().all()

        # If user explicitly turned off some channels
        disabled_channels = {p.channel for p in preferences if not p.is_enabled}

        if requested_channels is not None:
            return [c for c in requested_channels if c not in disabled_channels]

        # Default allowed channels if not explicitly specified:
        # In-App and Zalo are enabled by default for all residents
        candidate_channels = [
            NotificationChannel.IN_APP,
            NotificationChannel.ZALO,
        ]
        return [c for c in candidate_channels if c not in disabled_channels]


    # -------------------------------------------------------------------------
    # Resident Portal Queries & Preference Management
    # -------------------------------------------------------------------------

    async def get_user_notifications(
        self,
        user_id: uuid.UUID,
        category: NotificationCategory | None = None,
        status_filter: NotificationStatus | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> NotificationListResponse:
        """Fetch paginated notifications and total unread count for resident portal."""
        base_query = select(Notification).where(Notification.user_id == user_id)
        if category:
            base_query = base_query.where(Notification.category == category)
        if status_filter:
            base_query = base_query.where(Notification.status == status_filter)

        # Count total
        count_stmt = select(func.count()).select_from(base_query.subquery())
        total = (await self.session.execute(count_stmt)).scalar() or 0

        # Count unread (not READ)
        unread_stmt = select(func.count()).where(
            Notification.user_id == user_id,
            Notification.status != NotificationStatus.READ,
        )
        unread_count = (await self.session.execute(unread_stmt)).scalar() or 0

        # Items paginated, ordered by created_at DESC
        items_stmt = (
            base_query.order_by(Notification.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        items_res = await self.session.execute(items_stmt)
        items = items_res.scalars().all()

        total_pages = (total + page_size - 1) // page_size if page_size > 0 else 1

        return NotificationListResponse(
            items=[NotificationResponse.model_validate(n) for n in items],
            total=total,
            unread_count=unread_count,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
        )

    async def mark_as_read(
        self, notification_id: uuid.UUID, user_id: uuid.UUID
    ) -> NotificationResponse | None:
        """Mark a single notification as read."""
        stmt = (
            update(Notification)
            .where(Notification.id == notification_id, Notification.user_id == user_id)
            .values(status=NotificationStatus.READ, read_at=datetime.now(timezone.utc))
            .returning(Notification)
        )
        res = await self.session.execute(stmt)
        await self.session.commit()
        updated = res.scalar_one_or_none()
        return NotificationResponse.model_validate(updated) if updated else None

    async def mark_all_as_read(self, user_id: uuid.UUID) -> int:
        """Mark all unread notifications for a user as read."""
        stmt = (
            update(Notification)
            .where(
                Notification.user_id == user_id,
                Notification.status != NotificationStatus.READ,
            )
            .values(status=NotificationStatus.READ, read_at=datetime.now(timezone.utc))
        )
        res = await self.session.execute(stmt)
        await self.session.commit()
        return res.rowcount or 0

    async def get_user_preferences(self, user_id: uuid.UUID) -> NotificationPreferencesResponse:
        """Retrieve full matrix of (category x channel) preferences for resident."""
        stmt = select(NotificationPreference).where(NotificationPreference.user_id == user_id)
        result = await self.session.execute(stmt)
        existing_rows = {(p.category, p.channel): p.is_enabled for p in result.scalars().all()}

        items: list[NotificationPreferenceItem] = []
        for cat in NotificationCategory:
            for chan in NotificationChannel:
                # Default: enabled if not explicitly toggled off
                enabled = existing_rows.get((cat, chan), True)
                items.append(
                    NotificationPreferenceItem(
                        category=cat,
                        channel=chan,
                        is_enabled=enabled,
                    )
                )

        return NotificationPreferencesResponse(preferences=items)

    async def update_user_preferences(
        self,
        user_id: uuid.UUID,
        preferences: list[NotificationPreferenceItem],
    ) -> NotificationPreferencesResponse:
        """Upsert resident channel preferences."""
        for pref in preferences:
            stmt = select(NotificationPreference).where(
                NotificationPreference.user_id == user_id,
                NotificationPreference.category == pref.category,
                NotificationPreference.channel == pref.channel,
            )
            res = await self.session.execute(stmt)
            existing = res.scalar_one_or_none()
            if existing:
                existing.is_enabled = pref.is_enabled
            else:
                new_pref = NotificationPreference(
                    user_id=user_id,
                    category=pref.category,
                    channel=pref.channel,
                    is_enabled=pref.is_enabled,
                )
                self.session.add(new_pref)

        await self.session.commit()
        return await self.get_user_preferences(user_id)
