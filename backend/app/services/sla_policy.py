"""SLA Policy Engine — Configurable resolution deadlines and human-friendly time translations.

Defines target resolution windows by category and priority.
Translates deadlines into natural language for residents (avoiding raw SLA jargon).
"""

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone


@dataclass(frozen=True)
class SLATarget:
    """Target resolution duration."""
    response_hours: float
    resolution_hours: float


# Configurable SLA Matrix: (category, priority) -> SLATarget
# Priorities: critical, high, medium, low
DEFAULT_SLA_MATRIX: dict[tuple[str, str], SLATarget] = {
    # Electrical
    ("electrical", "critical"): SLATarget(response_hours=0.5, resolution_hours=2.0),
    ("electrical", "high"): SLATarget(response_hours=1.0, resolution_hours=4.0),
    ("electrical", "medium"): SLATarget(response_hours=2.0, resolution_hours=12.0),
    ("electrical", "low"): SLATarget(response_hours=4.0, resolution_hours=24.0),

    # Water / Plumbing
    ("water", "critical"): SLATarget(response_hours=0.5, resolution_hours=2.0),
    ("water", "high"): SLATarget(response_hours=1.0, resolution_hours=4.0),
    ("water", "medium"): SLATarget(response_hours=3.0, resolution_hours=16.0),
    ("water", "low"): SLATarget(response_hours=6.0, resolution_hours=36.0),

    # Elevator
    ("elevator", "critical"): SLATarget(response_hours=0.25, resolution_hours=1.0),
    ("elevator", "high"): SLATarget(response_hours=0.5, resolution_hours=2.0),
    ("elevator", "medium"): SLATarget(response_hours=2.0, resolution_hours=8.0),
    ("elevator", "low"): SLATarget(response_hours=4.0, resolution_hours=24.0),

    # Fire Safety
    ("fire_safety", "critical"): SLATarget(response_hours=0.25, resolution_hours=1.0),
    ("fire_safety", "high"): SLATarget(response_hours=0.5, resolution_hours=2.0),
    ("fire_safety", "medium"): SLATarget(response_hours=1.0, resolution_hours=6.0),
    ("fire_safety", "low"): SLATarget(response_hours=2.0, resolution_hours=12.0),

    # HVAC / Climate
    ("hvac", "critical"): SLATarget(response_hours=1.0, resolution_hours=3.0),
    ("hvac", "high"): SLATarget(response_hours=2.0, resolution_hours=6.0),
    ("hvac", "medium"): SLATarget(response_hours=4.0, resolution_hours=24.0),
    ("hvac", "low"): SLATarget(response_hours=8.0, resolution_hours=48.0),

    # Security
    ("security", "critical"): SLATarget(response_hours=0.25, resolution_hours=1.5),
    ("security", "high"): SLATarget(response_hours=1.0, resolution_hours=4.0),
    ("security", "medium"): SLATarget(response_hours=3.0, resolution_hours=12.0),
    ("security", "low"): SLATarget(response_hours=6.0, resolution_hours=24.0),

    # General / Other
    ("general", "critical"): SLATarget(response_hours=1.0, resolution_hours=4.0),
    ("general", "high"): SLATarget(response_hours=2.0, resolution_hours=8.0),
    ("general", "medium"): SLATarget(response_hours=6.0, resolution_hours=24.0),
    ("general", "low"): SLATarget(response_hours=12.0, resolution_hours=48.0),
}

# Fallback matrix for unmapped categories
DEFAULT_PRIORITY_FALLBACK: dict[str, SLATarget] = {
    "critical": SLATarget(response_hours=0.5, resolution_hours=2.0),
    "high": SLATarget(response_hours=1.0, resolution_hours=4.0),
    "medium": SLATarget(response_hours=4.0, resolution_hours=24.0),
    "low": SLATarget(response_hours=8.0, resolution_hours=48.0),
}


def get_sla_target(category: str, priority: str) -> SLATarget:
    """Resolve SLA target duration for a category & priority."""
    norm_cat = (category or "general").lower()
    norm_pri = (priority or "medium").lower()

    if (norm_cat, norm_pri) in DEFAULT_SLA_MATRIX:
        return DEFAULT_SLA_MATRIX[(norm_cat, norm_pri)]
    return DEFAULT_PRIORITY_FALLBACK.get(
        norm_pri, SLATarget(response_hours=4.0, resolution_hours=24.0)
    )


def calculate_due_date(
    category: str,
    priority: str,
    base_time: datetime | None = None,
) -> datetime:
    """Calculate the absolute due_at timestamp based on SLA policy."""
    if base_time is None:
        base_time = datetime.now(timezone.utc)
    target = get_sla_target(category, priority)
    return base_time + timedelta(hours=target.resolution_hours)


def format_sla_for_resident(due_at: datetime | None, status: str = "open") -> str:
    """Translate technical SLA deadline into empathetic, natural resident copy."""
    if status in ("resolved", "closed"):
        return "Đã hoàn thành"

    if due_at is None:
        return "Đang xếp lịch xử lý"

    now = datetime.now(timezone.utc)
    diff = due_at - now
    total_minutes = int(diff.total_seconds() / 60)

    if total_minutes < 0:
        return "Đang được ưu tiên xử lý gấp"
    if total_minutes <= 60:
        return f"Dự kiến trong {max(15, total_minutes)} phút tới"
    if total_minutes <= 120:
        return "Dự kiến trong 2 giờ tới"

    # Same day check (assuming UTC+7 for VN)
    # Using local day representation
    local_offset = timedelta(hours=7)
    due_local = due_at + local_offset
    now_local = now + local_offset

    if due_local.date() == now_local.date():
        return f"Dự kiến trước {due_local.strftime('%H:%M')} hôm nay"
    if (due_local.date() - now_local.date()).days == 1:
        return f"Dự kiến trước {due_local.strftime('%H:%M')} ngày mai"

    hours = int(total_minutes / 60)
    return f"Dự kiến trong vòng {hours} giờ"


def is_ticket_overdue(due_at: datetime | None, status: str) -> bool:
    """Return True if ticket has passed due_at and is not yet resolved/closed."""
    if not due_at:
        return False
    if status in ("resolved", "closed"):
        return False
    return datetime.now(timezone.utc) > due_at
