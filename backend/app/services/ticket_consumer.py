"""Ticket Kafka Consumer — Consumes anomaly alert events to auto-generate work orders.

When an AI anomaly or threshold alert exceeds configured severity (critical/high),
this consumer automatically creates a ticket, snapshots telemetry, and links the device.
"""

import asyncio
import json
from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession


from app.core.config import get_settings
from app.core.database import async_session_factory
from app.core.kafka_bus import get_event_bus
from app.core.logging import get_logger
from app.models.ticket import Ticket, TicketSource
from app.services.ticket_service import TicketService

logger = get_logger(__name__)
settings = get_settings()


class TicketKafkaConsumer:
    """Consumer processing alert events from Kafka / in-memory event bus."""

    def __init__(self, session_factory=None):
        self.event_bus = get_event_bus()
        self._running = False
        self._kafka_consumer = None
        self._consumer_task = None
        self._session_factory = session_factory


    async def start(self):
        """Start listening to building.alerts topic."""
        self._running = True

        # 1. Register in-memory subscription (for development & testing)
        self.event_bus.subscribe(
            topic=settings.kafka_alerts_topic,
            handler=self.handle_alert_event,
        )

        # 2. Try starting aiokafka consumer if Kafka broker is available
        try:
            from aiokafka import AIOKafkaConsumer

            consumer = AIOKafkaConsumer(
                settings.kafka_alerts_topic,
                bootstrap_servers=settings.kafka_bootstrap_servers,
                group_id="ticket-auto-creator-group",
                value_deserializer=lambda v: json.loads(v.decode("utf-8")),
                auto_offset_reset="latest",
                enable_auto_commit=True,
            )
            await asyncio.wait_for(consumer.start(), timeout=2.0)
            self._kafka_consumer = consumer
            self._consumer_task = asyncio.create_task(self._consume_kafka_loop())
            logger.info("ticket_kafka_consumer_started", topic=settings.kafka_alerts_topic)
        except Exception as exc:
            self._kafka_consumer = None
            logger.info(
                "ticket_kafka_consumer_fallback_memory",
                detail="Kafka consumer not connected to cluster, active on in-memory bus",
                reason=str(exc),
            )

    async def stop(self):
        """Stop consumer loop gracefully."""
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
        logger.info("ticket_kafka_consumer_stopped")

    async def handle_alert_event(self, event_data: dict[str, Any], session: AsyncSession | None = None):
        """Evaluate incoming alert and auto-generate ticket if severity meets threshold."""
        try:
            severity = str(event_data.get("severity", "medium")).lower()
            min_severity = settings.ticket_auto_create_min_severity.lower()

            # Threshold check: critical always triggers; high triggers if min_severity == "high"
            should_create = False
            if severity == "critical":
                should_create = True
            elif severity == "high" and min_severity in ("high", "medium", "low"):
                should_create = True

            if not should_create:
                logger.debug("alert_below_ticket_threshold", severity=severity, min_threshold=min_severity)
                return

            alert_id = event_data.get("alert_id")
            title = event_data.get("title", "Cảnh báo bất thường")
            message = event_data.get("message", "")
            metric = event_data.get("metric", "general")
            value = float(event_data.get("value", 0.0))
            unit = event_data.get("unit", "")
            score = event_data.get("anomaly_score")
            score_float = float(score) if score is not None else None

            dev_id_str = event_data.get("device_id")
            dev_id = UUID(dev_id_str) if dev_id_str else None

            apt_id_str = event_data.get("apartment_id")
            apt_id = UUID(apt_id_str) if apt_id_str else None

            async def _process_with_session(db_sess: AsyncSession):
                # Idempotency check: prevent duplicate ticket creation for the same alert
                if alert_id:
                    stmt = select(func.count(Ticket.id)).where(
                        Ticket.source == TicketSource.AI_ANOMALY,
                        Ticket.description.contains(str(alert_id)),
                    )
                    exists = (await db_sess.execute(stmt)).scalar() or 0
                    if exists > 0:
                        logger.info("ticket_already_created_for_alert", alert_id=alert_id)
                        return

                # Auto create ticket
                service = TicketService(db_sess)
                ticket = await service.create_from_anomaly(
                    alert_title=title,
                    alert_message=f"{message} [Alert ID: {alert_id}]" if alert_id else message,
                    device_id=dev_id,
                    apartment_id=apt_id,
                    severity=severity,
                    metric=metric,
                    value=value,
                    unit=unit,
                    anomaly_score=score_float,
                )
                logger.info(
                    "auto_ticket_created_from_kafka_event",
                    ticket_id=str(ticket.id),
                    alert_title=title,
                    severity=severity,
                )

            if session is not None:
                await _process_with_session(session)
            else:
                factory = self._session_factory or async_session_factory
                async with factory() as new_session:
                    await _process_with_session(new_session)
        except Exception:

            logger.exception("failed_to_process_alert_event", event_data=event_data)

    async def _consume_kafka_loop(self):
        """Continuous polling loop for Kafka messages."""
        if not self._kafka_consumer:
            return
        while self._running:
            try:
                msg = await self._kafka_consumer.getone()
                await self.handle_alert_event(msg.value)
            except asyncio.CancelledError:
                break
            except Exception:
                logger.exception("ticket_kafka_consumer_iteration_error")
                await asyncio.sleep(1.0)


_global_ticket_consumer = TicketKafkaConsumer()


def get_ticket_consumer() -> TicketKafkaConsumer:
    """Get singleton TicketKafkaConsumer."""
    return _global_ticket_consumer
