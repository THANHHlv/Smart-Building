"""Kafka Consumer for notifications.requested topic.

Processes incoming notification events asynchronously, resolving templates,
checking resident channel preferences, and delivering to target channels.
"""

import asyncio
import json
from typing import Any

from app.core.config import get_settings
from app.core.database import async_session_factory
from app.core.kafka_bus import get_event_bus
from app.core.logging import get_logger
from app.schemas.notification import NotificationEventPayload
from app.services.notification_service import NotificationService

logger = get_logger(__name__)
settings = get_settings()


class NotificationKafkaConsumer:
    """Consumer worker processing notifications.requested events."""

    def __init__(self):
        self.event_bus = get_event_bus()
        self._running = False
        self._kafka_consumer = None
        self._consumer_task = None

    async def start(self):
        """Start listening to notifications.requested on both Kafka and in-memory event bus."""
        self._running = True

        # 1. Register handler for in-memory event bus (development/testing)
        self.event_bus.subscribe(
            topic=settings.kafka_notifications_topic,
            handler=self.handle_event_dict,
        )

        # 2. Try starting aiokafka Consumer if Kafka broker is available
        try:
            from aiokafka import AIOKafkaConsumer

            consumer = AIOKafkaConsumer(
                settings.kafka_notifications_topic,
                bootstrap_servers=settings.kafka_bootstrap_servers,
                group_id="notification-service-group",
                value_deserializer=lambda v: json.loads(v.decode("utf-8")),
                auto_offset_reset="latest",
                enable_auto_commit=True,
            )
            await asyncio.wait_for(consumer.start(), timeout=2.0)
            self._kafka_consumer = consumer
            self._consumer_task = asyncio.create_task(self._consume_kafka_loop())
            logger.info("notification_kafka_consumer_started", topic=settings.kafka_notifications_topic)
        except Exception as exc:
            self._kafka_consumer = None
            logger.info(
                "notification_kafka_consumer_fallback_memory",
                detail="Kafka consumer not connected to cluster, active on in-memory bus",
                reason=str(exc),
            )

    async def stop(self):
        """Stop consumer."""
        self._running = False
        if self._kafka_consumer:
            try:
                await self._kafka_consumer.stop()
            except Exception:
                pass
            self._kafka_consumer = None

        if self._consumer_task:
            self._consumer_task.cancel()
            try:
                await self._consumer_task
            except asyncio.CancelledError:
                pass
            self._consumer_task = None
        logger.info("notification_consumer_stopped")

    async def handle_event_dict(self, event_data: dict[str, Any]):
        """Handler invoked when an event arrives."""
        try:
            payload = NotificationEventPayload.model_validate(event_data)
            async with async_session_factory() as session:
                service = NotificationService(session)
                await service.process_notification_event(payload)
        except Exception:
            logger.exception("failed_to_process_notification_event", event_data=event_data)

    async def _consume_kafka_loop(self):
        """Continuous consumption loop for aiokafka messages."""
        if not self._kafka_consumer:
            return
        while self._running:
            try:
                msg = await self._kafka_consumer.getone()
                await self.handle_event_dict(msg.value)
            except asyncio.CancelledError:
                break
            except Exception:
                logger.exception("kafka_consumer_iteration_error")
                await asyncio.sleep(1.0)


_global_consumer = NotificationKafkaConsumer()


def get_notification_consumer() -> NotificationKafkaConsumer:
    """Get singleton notification consumer."""
    return _global_consumer
