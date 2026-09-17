"""Prometheus metrics instrumentation for Smart Building Platform.

Exposes telemetry for notifications, payment workflows, and API latency.
"""

from prometheus_client import Counter, Histogram

# --- Notification Pipeline Metrics ---

NOTIFICATIONS_REQUESTED = Counter(
    "notifications_requested_total",
    "Total notification requests received by the notification service",
    ["category", "channel"],
)

NOTIFICATIONS_SENT = Counter(
    "notifications_sent_total",
    "Total notification transmissions successfully sent to external providers",
    ["channel", "provider", "status"],
)

NOTIFICATIONS_FAILED = Counter(
    "notifications_failed_total",
    "Total notification transmissions failed",
    ["channel", "provider", "reason"],
)

NOTIFICATION_DELIVERY_DURATION = Histogram(
    "notification_delivery_duration_seconds",
    "Time spent delivering notification to provider API",
    ["channel", "provider"],
    buckets=(0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0),
)

NOTIFICATIONS_DLQ = Counter(
    "notifications_dlq_total",
    "Total notifications routed to Dead-Letter Queue (DLQ) after retry exhaustion",
    ["channel", "reason"],
)
