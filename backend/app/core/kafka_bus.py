"""Kafka Event Bus — Asynchronous event streaming with graceful fallback.

Connects to Apache Kafka via aiokafka when available. If Kafka broker is unreachable
or in local dev/testing environments, automatically falls back to an async in-memory
event bus so that notification pipelines, retry loops, and tests execute reliably.
"""

import asyncio
import json
from collections.abc import Callable, Coroutine
from typing import Any

from app.core.config import get_settings
from app.core.logging import get_logger

logger = get_logger(__name__)
settings = get_settings()


class KafkaEventBus:
    """Event bus supporting both aiokafka and resilient in-memory fallback."""

    def __init__(self):
        self._producer = None
        self._is_connected = False
        self._memory_subscribers: dict[str, list[Callable[[dict[str, Any]], Coroutine[Any, Any, None]]]] = {}
        self._memory_queue: asyncio.Queue[tuple[str, dict[str, Any]]] = asyncio.Queue()
        self._worker_task: asyncio.Task | None = None
        self._running = False

    async def start(self):
        """Initialize connection to Kafka or start in-memory worker."""
        self._running = True
        try:
            from aiokafka import AIOKafkaProducer

            producer = AIOKafkaProducer(
                bootstrap_servers=settings.kafka_bootstrap_servers,
                value_serializer=lambda v: json.dumps(v, default=str).encode("utf-8"),
                key_serializer=lambda k: k.encode("utf-8") if k else None,
                request_timeout_ms=3000,
            )
            # Try starting with short timeout
            await asyncio.wait_for(producer.start(), timeout=2.0)
            self._producer = producer
            self._is_connected = True
            logger.info("kafka_producer_connected", servers=settings.kafka_bootstrap_servers)
        except Exception as exc:
            self._is_connected = False
            self._producer = None
            logger.info(
                "kafka_fallback_to_in_memory",
                detail="Kafka broker unreachable or mock mode; using in-memory event bus",
                reason=str(exc),
            )

        # Always start background processor for in-memory queue dispatch
        self._worker_task = asyncio.create_task(self._process_memory_queue())

    async def stop(self):
        """Gracefully stop producer and consumer workers."""
        self._running = False
        if self._producer:
            try:
                await self._producer.stop()
            except Exception:
                pass
            self._producer = None
            self._is_connected = False

        if self._worker_task:
            self._worker_task.cancel()
            try:
                await self._worker_task
            except asyncio.CancelledError:
                pass
            self._worker_task = None
        logger.info("kafka_event_bus_stopped")

    async def publish(self, topic: str, value: dict[str, Any], key: str | None = None) -> bool:
        """Publish an event to a Kafka topic."""
        if self._is_connected and self._producer:
            try:
                await self._producer.send_and_wait(topic, value=value, key=key)
                logger.debug("kafka_event_published", topic=topic, key=key)
                return True
            except Exception as exc:
                logger.warning(
                    "kafka_publish_failed_fallback_memory",
                    topic=topic,
                    error=str(exc),
                )

        # Fallback / In-Memory dispatch
        await self._memory_queue.put((topic, value))
        logger.debug("event_queued_in_memory", topic=topic, key=key)
        return True

    def subscribe(self, topic: str, handler: Callable[[dict[str, Any]], Coroutine[Any, Any, None]]):
        """Subscribe an async handler to a topic."""
        if topic not in self._memory_subscribers:
            self._memory_subscribers[topic] = []
        self._memory_subscribers[topic].append(handler)

    async def _process_memory_queue(self):
        """Background worker that dispatches in-memory events to registered subscribers."""
        while self._running:
            try:
                topic, payload = await self._memory_queue.get()
                handlers = self._memory_subscribers.get(topic, [])
                for handler in handlers:
                    try:
                        await handler(payload)
                    except Exception:
                        logger.exception("event_handler_failed", topic=topic)
                self._memory_queue.task_done()
            except asyncio.CancelledError:
                break
            except Exception:
                logger.exception("memory_queue_error")


_global_event_bus = KafkaEventBus()


def get_event_bus() -> KafkaEventBus:
    """Get global event bus instance."""
    return _global_event_bus
