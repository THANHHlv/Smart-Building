"""Ticket / Work Order Service — State Machine, SLA tracking, and Notification triggers."""

import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import get_settings
from app.core.kafka_bus import get_event_bus
from app.core.logging import get_logger
from app.models.apartment import Apartment
from app.models.floor import Floor
from app.models.device import Device
from app.models.notification import NotificationCategory

from app.models.ticket import (
    Technician,
    Ticket,
    TicketAttachment,
    TicketComment,
    TicketPriority,
    TicketSource,
    TicketStatus,
    TicketStatusHistory,
)
from app.models.user import User
from app.schemas.ticket import (
    CategorySlaStat,
    SlaReportResponse,
    TicketAttachmentResponse,
    TicketCommentResponse,
    TicketCreate,
    TicketDetailResponse,
    TicketResponse,
    TicketStatusHistoryResponse,
)
from app.services.sla_policy import calculate_due_date, format_sla_for_resident, is_ticket_overdue

logger = get_logger(__name__)
settings = get_settings()

# Strictly enforced State Machine transitions
VALID_TRANSITIONS: dict[TicketStatus, list[TicketStatus]] = {
    TicketStatus.OPEN: [TicketStatus.ASSIGNED, TicketStatus.IN_PROGRESS],
    TicketStatus.ASSIGNED: [TicketStatus.IN_PROGRESS, TicketStatus.OPEN],
    TicketStatus.IN_PROGRESS: [TicketStatus.RESOLVED, TicketStatus.ASSIGNED],
    TicketStatus.RESOLVED: [TicketStatus.CLOSED, TicketStatus.REOPENED],
    TicketStatus.CLOSED: [],  # Closed is terminal
    TicketStatus.REOPENED: [TicketStatus.ASSIGNED, TicketStatus.IN_PROGRESS],
}

CATEGORY_LABELS: dict[str, str] = {
    "electrical": "Điện & Chiếu sáng",
    "water": "Cấp thoát nước",
    "elevator": "Thang máy",
    "hvac": "Điều hòa & Thông gió",
    "fire_safety": "PCCC & Cảm biến khói",
    "security": "An ninh & Cửa ra vào",
    "general": "Khác / Chung",
}


class TicketService:
    """Service orchestrating tickets, status transitions, attachments, and audit history."""

    def __init__(self, session: AsyncSession):
        self.session = session
        self.event_bus = get_event_bus()

    # -------------------------------------------------------------------------
    # Ticket Creation
    # -------------------------------------------------------------------------

    async def create_ticket(
        self,
        data: TicketCreate,
        creator: User,
        source: TicketSource = TicketSource.RESIDENT_REPORT,
    ) -> Ticket:
        """Create a new ticket from resident or admin with initial status history and SLA."""
        # Enforce apartment boundary: resident can only create tickets for their own apartment
        if creator.role != "admin":
            if data.apartment_id and creator.apartment_id and data.apartment_id != creator.apartment_id:
                raise ValueError("Bạn không có quyền tạo phiếu yêu cầu cho căn hộ khác")
            target_apt_id = creator.apartment_id
        else:
            target_apt_id = data.apartment_id or creator.apartment_id

        # Determine priority
        try:
            priority = TicketPriority(data.priority.lower())
        except (ValueError, AttributeError):
            priority = TicketPriority.MEDIUM

        category = (data.category or "general").lower()
        now = datetime.now(timezone.utc)
        due_at = calculate_due_date(category, priority.value, base_time=now)

        ticket = Ticket(
            source=source,
            apartment_id=target_apt_id,
            device_id=data.device_id,
            category=category,
            priority=priority,
            status=TicketStatus.OPEN,
            title=data.title.strip(),
            description=data.description.strip(),
            created_by=creator.id,
            due_at=due_at,
        )
        self.session.add(ticket)
        await self.session.flush()

        # Initial append-only audit log
        init_history = TicketStatusHistory(
            ticket_id=ticket.id,
            from_status=None,
            to_status=TicketStatus.OPEN.value,
            changed_by=creator.id,
            note="Khởi tạo phiếu yêu cầu xử lý sự cố",
        )
        self.session.add(init_history)

        # Attach any uploaded image URLs
        if data.attachment_urls:
            for idx, url in enumerate(data.attachment_urls[:3]):
                att = TicketAttachment(
                    ticket_id=ticket.id,
                    file_url=url,
                    file_name=f"attachment_{idx + 1}.jpg",
                    file_size=1024,
                    mime_type="image/jpeg",
                    uploaded_by=creator.id,
                )
                self.session.add(att)

        await self.session.commit()
        await self.session.refresh(ticket)

        logger.info(
            "ticket_created",
            ticket_id=str(ticket.id),
            source=source.value,
            category=category,
            priority=priority.value,
        )

        return ticket

    async def create_from_anomaly(
        self,
        alert_title: str,
        alert_message: str,
        device_id: uuid.UUID | None,
        apartment_id: uuid.UUID | None,
        severity: str,
        metric: str,
        value: float,
        unit: str,
        anomaly_score: float | None = None,
    ) -> Ticket:
        """Create ticket automatically from AI Anomaly alert with snapshot data."""
        # Map metric / device to category
        category = "general"
        if "elec" in metric.lower():
            category = "electrical"
        elif "water" in metric.lower():
            category = "water"
        elif "temp" in metric.lower() or "hvac" in metric.lower():
            category = "hvac"
        elif "smoke" in metric.lower():
            category = "fire_safety"

        # Deduce priority from severity
        priority = TicketPriority.CRITICAL if severity.lower() == "critical" else TicketPriority.HIGH

        now = datetime.now(timezone.utc)
        due_at = calculate_due_date(category, priority.value, base_time=now)

        # Build snapshot description for technician
        snapshot_lines = [
            f"[HỆ THỐNG TỰ ĐỘNG PHÁT HIỆN BẤT THƯỜNG - AI ANOMALY DETECTION]",
            f"- Cảnh báo: {alert_title}",
            f"- Chi tiết thông số: {metric.upper()} = {value} {unit}",
            f"- Mức độ nghiêm trọng: {severity.upper()}",
        ]
        if anomaly_score is not None:
            snapshot_lines.append(f"- Điểm bất thường (Isolation Forest Score): {round(anomaly_score, 3)}")
        if alert_message:
            snapshot_lines.append(f"- Mô tả sự cố: {alert_message}")
        snapshot_lines.append(f"- Thời điểm phát hiện: {now.strftime('%Y-%m-%d %H:%M:%S UTC')}")

        description = "\n".join(snapshot_lines)

        ticket = Ticket(
            source=TicketSource.AI_ANOMALY,
            apartment_id=apartment_id,
            device_id=device_id,
            category=category,
            priority=priority,
            status=TicketStatus.OPEN,
            title=f"[AI Cảnh Báo] {alert_title[:200]}",
            description=description,
            created_by=None,
            due_at=due_at,
        )
        self.session.add(ticket)
        await self.session.flush()

        init_history = TicketStatusHistory(
            ticket_id=ticket.id,
            from_status=None,
            to_status=TicketStatus.OPEN.value,
            changed_by=None,
            note="Tự động tạo từ cảnh báo bất thường AI Anomaly Detector",
        )
        self.session.add(init_history)
        await self.session.commit()
        await self.session.refresh(ticket)

        logger.info(
            "ticket_created_from_anomaly",
            ticket_id=str(ticket.id),
            device_id=str(device_id),
            category=category,
            priority=priority.value,
        )

        return ticket

    # -------------------------------------------------------------------------
    # State Machine & Status Updates
    # -------------------------------------------------------------------------

    async def update_status(
        self,
        ticket_id: uuid.UUID,
        new_status_str: str,
        user: User,
        note: str | None = None,
    ) -> Ticket:
        """Execute state machine transition with validation and append-only audit history."""
        ticket = await self.get_ticket_by_id(ticket_id)
        if not ticket:
            raise ValueError("Không tìm thấy phiếu yêu cầu xử lý")

        current_status = ticket.status
        try:
            target_status = TicketStatus(new_status_str.lower())
        except ValueError:
            raise ValueError(f"Trạng thái '{new_status_str}' không hợp lệ")

        if current_status == target_status:
            return ticket

        allowed_targets = VALID_TRANSITIONS.get(current_status, [])
        if target_status not in allowed_targets:
            allowed_names = [s.value for s in allowed_targets]
            raise ValueError(
                f"Chuyển trạng thái không hợp lệ: không thể từ '{current_status.value}' sang '{target_status.value}'. "
                f"Các trạng thái được phép tiếp theo: {allowed_names or 'Không có (đã đóng)'}."
            )

        now = datetime.now(timezone.utc)
        ticket.status = target_status

        # Status specific lifecycle side-effects
        if target_status == TicketStatus.RESOLVED:
            ticket.resolved_at = now
        elif target_status == TicketStatus.CLOSED:
            ticket.closed_at = now
            if not ticket.resolved_at:
                ticket.resolved_at = now
        elif target_status == TicketStatus.REOPENED:
            ticket.resolved_at = None
            ticket.closed_at = None
            # Recalculate urgent SLA upon reopening
            ticket.due_at = calculate_due_date(ticket.category, TicketPriority.HIGH.value, base_time=now)

        # Append to status history
        history = TicketStatusHistory(
            ticket_id=ticket.id,
            from_status=current_status.value,
            to_status=target_status.value,
            changed_by=user.id,
            note=note or f"Chuyển trạng thái sang {target_status.value}",
        )
        self.session.add(history)
        await self.session.commit()
        await self.session.refresh(ticket)

        logger.info(
            "ticket_status_transitioned",
            ticket_id=str(ticket.id),
            from_status=current_status.value,
            to_status=target_status.value,
            user_id=str(user.id),
        )

        # Notify resident on resolution or progress
        await self._notify_on_status_change(ticket, current_status, target_status)

        return ticket

    # -------------------------------------------------------------------------
    # Technician Assignment
    # -------------------------------------------------------------------------

    async def assign_technician(
        self,
        ticket_id: uuid.UUID,
        technician_id: uuid.UUID,
        assigned_by: User,
        note: str | None = None,
    ) -> Ticket:
        """Assign technician to ticket and transition to ASSIGNED state."""
        ticket = await self.get_ticket_by_id(ticket_id)
        if not ticket:
            raise ValueError("Không tìm thấy phiếu yêu cầu xử lý")

        # Verify technician
        tech_stmt = (
            select(Technician)
            .options(selectinload(Technician.user))
            .where(Technician.id == technician_id, Technician.is_active.is_(True))
        )
        tech_res = await self.session.execute(tech_stmt)
        technician = tech_res.scalar_one_or_none()
        if not technician:
            raise ValueError("Kỹ thuật viên không tồn tại hoặc đã ngưng hoạt động")

        old_status = ticket.status
        ticket.assigned_to = technician.id

        # Transition to ASSIGNED if currently OPEN or REOPENED
        new_status = old_status
        if ticket.status in (TicketStatus.OPEN, TicketStatus.REOPENED):
            ticket.status = TicketStatus.ASSIGNED
            new_status = TicketStatus.ASSIGNED

        history_note = note or f"Phân công cho kỹ thuật viên: {technician.user.full_name or technician.user.email}"
        history = TicketStatusHistory(
            ticket_id=ticket.id,
            from_status=old_status.value,
            to_status=new_status.value,
            changed_by=assigned_by.id,
            note=history_note,
        )
        self.session.add(history)
        await self.session.commit()
        await self.session.refresh(ticket)

        # Notify technician via Notification Service
        await self._notify_technician_assigned(ticket, technician)

        return ticket

    # -------------------------------------------------------------------------
    # Comments & Attachments
    # -------------------------------------------------------------------------

    async def add_comment(
        self,
        ticket_id: uuid.UUID,
        user: User,
        comment_text: str,
        is_internal: bool = False,
    ) -> TicketComment:
        """Add comment or internal work note to a ticket."""
        ticket = await self.get_ticket_by_id(ticket_id)
        if not ticket:
            raise ValueError("Không tìm thấy phiếu yêu cầu xử lý")

        # Residents cannot create internal comments or comment on other apartments' tickets
        if user.role not in ("admin", "technician"):
            if ticket.apartment_id and user.apartment_id and ticket.apartment_id != user.apartment_id:
                raise ValueError("Bạn không có quyền bình luận trên yêu cầu của căn hộ khác")
            is_internal = False

        comment = TicketComment(
            ticket_id=ticket.id,
            author_id=user.id,
            comment=comment_text.strip(),
            is_internal=is_internal,
        )
        self.session.add(comment)
        await self.session.commit()
        await self.session.refresh(comment)

        # Notify counterpart if public comment
        if not is_internal:
            await self._notify_on_new_comment(ticket, user, comment_text)

        return comment

    async def add_attachment(
        self,
        ticket_id: uuid.UUID,
        user: User,
        file_url: str,
        file_name: str,
        file_size: int,
        mime_type: str,
    ) -> TicketAttachment:
        """Attach a photo or document to a ticket."""
        ticket = await self.get_ticket_by_id(ticket_id)
        if not ticket:
            raise ValueError("Không tìm thấy phiếu yêu cầu xử lý")

        # IDOR check: residents cannot upload attachments to other apartments' tickets
        if user.role not in ("admin", "technician"):
            if ticket.apartment_id and user.apartment_id and ticket.apartment_id != user.apartment_id:
                raise ValueError("Bạn không có quyền đính kèm tệp vào yêu cầu của căn hộ khác")

        attachment = TicketAttachment(
            ticket_id=ticket.id,
            file_url=file_url,
            file_name=file_name,
            file_size=file_size,
            mime_type=mime_type,
            uploaded_by=user.id,
        )
        self.session.add(attachment)
        await self.session.commit()
        await self.session.refresh(attachment)
        return attachment

    # -------------------------------------------------------------------------
    # Rating & Reopening
    # -------------------------------------------------------------------------

    async def rate_ticket(
        self,
        ticket_id: uuid.UUID,
        resident: User,
        rating: int,
        rating_comment: str | None = None,
    ) -> Ticket:
        """Resident rates resolved/closed ticket quality."""
        ticket = await self.get_ticket_by_id(ticket_id)
        if not ticket:
            raise ValueError("Không tìm thấy phiếu yêu cầu xử lý")

        if ticket.status not in (TicketStatus.RESOLVED, TicketStatus.CLOSED):
            raise ValueError("Chỉ có thể đánh giá phiếu công việc đã được xử lý hoàn thành")

        if ticket.apartment_id and resident.apartment_id and ticket.apartment_id != resident.apartment_id:
            raise ValueError("Bạn chỉ có thể đánh giá yêu cầu của căn hộ mình")

        ticket.rating = max(1, min(5, rating))
        ticket.rating_comment = rating_comment.strip() if rating_comment else None
        await self.session.commit()
        await self.session.refresh(ticket)
        return ticket

    async def reopen_ticket(
        self,
        ticket_id: uuid.UUID,
        resident: User,
        reason: str,
    ) -> Ticket:
        """Resident reopens an unsatisfactory resolved ticket."""
        ticket = await self.get_ticket_by_id(ticket_id)
        if not ticket:
            raise ValueError("Không tìm thấy phiếu yêu cầu xử lý")

        if ticket.status != TicketStatus.RESOLVED:
            raise ValueError("Chỉ có thể mở lại phiếu đang ở trạng thái Hoàn thành (Resolved)")

        if resident.role not in ("admin", "technician"):
            if ticket.apartment_id and resident.apartment_id and ticket.apartment_id != resident.apartment_id:
                raise ValueError("Bạn chỉ có thể mở lại yêu cầu của căn hộ mình")

        note = f"Cư dân yêu cầu xử lý lại: {reason.strip()}"
        return await self.update_status(ticket_id, TicketStatus.REOPENED.value, resident, note=note)

    # -------------------------------------------------------------------------
    # Query & Reporting
    # -------------------------------------------------------------------------

    async def get_ticket_by_id(self, ticket_id: uuid.UUID) -> Ticket | None:
        """Retrieve ticket with full relationships."""
        stmt = (
            select(Ticket)
            .options(
                selectinload(Ticket.apartment).selectinload(Apartment.floor).selectinload(Floor.building),
                selectinload(Ticket.device),
                selectinload(Ticket.creator),
                selectinload(Ticket.technician).selectinload(Technician.user),
                selectinload(Ticket.attachments).selectinload(TicketAttachment.uploader),
                selectinload(Ticket.comments).selectinload(TicketComment.author),
                selectinload(Ticket.status_history).selectinload(TicketStatusHistory.user),
            )
            .where(Ticket.id == ticket_id)
        )
        res = await self.session.execute(stmt)
        return res.scalar_one_or_none()

    async def list_tickets(
        self,
        user: User,
        status_filter: str | None = None,
        category_filter: str | None = None,
        priority_filter: str | None = None,
        apartment_id: uuid.UUID | None = None,
        technician_id: uuid.UUID | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[Ticket]:
        """List tickets with filtering and role boundaries."""
        stmt = (
            select(Ticket)
            .options(
                selectinload(Ticket.apartment).selectinload(Apartment.floor).selectinload(Floor.building),
                selectinload(Ticket.device),
                selectinload(Ticket.creator),
                selectinload(Ticket.technician).selectinload(Technician.user),
                selectinload(Ticket.attachments),
                selectinload(Ticket.comments),
            )
            .order_by(Ticket.created_at.desc())
        )


        # Residents can only view tickets for their apartment
        if user.role not in ("admin", "technician"):
            if not user.apartment_id:
                return []
            stmt = stmt.where(Ticket.apartment_id == user.apartment_id)
        else:
            if apartment_id:
                stmt = stmt.where(Ticket.apartment_id == apartment_id)
            if technician_id:
                stmt = stmt.where(Ticket.assigned_to == technician_id)

        if status_filter and status_filter != "all":
            stmt = stmt.where(Ticket.status == status_filter)
        if category_filter and category_filter != "all":
            stmt = stmt.where(Ticket.category == category_filter)
        if priority_filter and priority_filter != "all":
            stmt = stmt.where(Ticket.priority == priority_filter)

        stmt = stmt.limit(limit).offset(offset)
        res = await self.session.execute(stmt)
        return list(res.scalars().all())

    async def list_technicians(self) -> list[Technician]:
        """List active technicians with user relationships."""
        stmt = (
            select(Technician)
            .options(selectinload(Technician.user))
            .where(Technician.is_active.is_(True))
            .order_by(Technician.created_at.asc())
        )
        res = await self.session.execute(stmt)
        return list(res.scalars().all())

    async def get_sla_report(self) -> SlaReportResponse:
        """Aggregate MTTR and SLA compliance statistics grouped by category."""
        all_tickets_stmt = select(Ticket)
        res = await self.session.execute(all_tickets_stmt)
        tickets = list(res.scalars().all())

        total_tickets = len(tickets)
        now = datetime.now(timezone.utc)

        # Group by category
        category_map: dict[str, list[Ticket]] = {}
        priority_breakdown: dict[str, int] = {"critical": 0, "high": 0, "medium": 0, "low": 0}

        for t in tickets:
            cat = t.category or "general"
            category_map.setdefault(cat, []).append(t)
            p_val = t.priority.value if hasattr(t.priority, "value") else str(t.priority)
            priority_breakdown[p_val] = priority_breakdown.get(p_val, 0) + 1

        category_stats: list[CategorySlaStat] = []
        overall_resolved_hours: list[float] = []
        overall_within_sla = 0
        overall_resolved_count = 0

        for cat, cat_tickets in category_map.items():
            cat_total = len(cat_tickets)
            resolved_in_cat = [t for t in cat_tickets if t.resolved_at is not None]
            resolved_count = len(resolved_in_cat)

            hours_list: list[float] = []
            within_sla_count = 0

            for t in resolved_in_cat:
                if t.resolved_at and t.created_at:
                    dur_hours = (t.resolved_at - t.created_at).total_seconds() / 3600.0
                    hours_list.append(dur_hours)
                    overall_resolved_hours.append(dur_hours)

                    # Check SLA compliance
                    if t.due_at and t.resolved_at <= t.due_at:
                        within_sla_count += 1
                        overall_within_sla += 1
                    elif not t.due_at:
                        within_sla_count += 1
                        overall_within_sla += 1

            overall_resolved_count += resolved_count
            avg_hours = round(sum(hours_list) / resolved_count, 1) if resolved_count > 0 else 0.0
            compliance = round((within_sla_count / resolved_count) * 100.0, 1) if resolved_count > 0 else 100.0

            category_stats.append(
                CategorySlaStat(
                    category=cat,
                    category_label=CATEGORY_LABELS.get(cat, cat.capitalize()),
                    total_tickets=cat_total,
                    resolved_tickets=resolved_count,
                    avg_resolution_hours=avg_hours,
                    within_sla_count=within_sla_count,
                    sla_compliance_rate=compliance,
                )
            )

        overall_avg_hours = (
            round(sum(overall_resolved_hours) / len(overall_resolved_hours), 1)
            if overall_resolved_hours
            else 0.0
        )
        overall_compliance = (
            round((overall_within_sla / overall_resolved_count) * 100.0, 1)
            if overall_resolved_count > 0
            else 100.0
        )

        return SlaReportResponse(
            period=now.strftime("%B %Y"),
            total_tickets=total_tickets,
            overall_sla_compliance_rate=overall_compliance,
            overall_avg_resolution_hours=overall_avg_hours,
            categories=sorted(category_stats, key=lambda c: c.total_tickets, reverse=True),
            priority_breakdown=priority_breakdown,
        )

    # -------------------------------------------------------------------------
    # Notification Dispatch Helpers
    # -------------------------------------------------------------------------

    async def _notify_technician_assigned(self, ticket: Ticket, technician: Technician):
        """Send notification to assigned technician."""
        try:
            event_payload = {
                "user_id": str(technician.user_id),
                "category": NotificationCategory.MAINTENANCE.value,
                "template_code": "maintenance.technician_assigned",
                "idempotency_key": f"ticket_assigned_{ticket.id}_{technician.id}",
                "context": {
                    "ticket_id": str(ticket.id)[:8],
                    "title": ticket.title,
                    "category": CATEGORY_LABELS.get(ticket.category, ticket.category),
                    "priority": ticket.priority.value,
                    "description": ticket.description[:100],
                },
            }
            await self.event_bus.publish(
                topic=settings.kafka_notifications_topic,
                value=event_payload,
                key=str(technician.user_id),
            )
        except Exception:
            logger.exception("failed_to_notify_technician", ticket_id=str(ticket.id))

    async def _notify_on_status_change(self, ticket: Ticket, from_status: TicketStatus, to_status: TicketStatus):
        """Send notification to resident on ticket status milestones."""
        try:
            target_user_id = ticket.created_by
            if not target_user_id and ticket.apartment_id:
                u_stmt = select(User.id).where(User.apartment_id == ticket.apartment_id).limit(1)
                u_res = await self.session.execute(u_stmt)
                target_user_id = u_res.scalar_one_or_none()

            if target_user_id:
                status_texts = {
                    TicketStatus.ASSIGNED: "đã được gán kỹ thuật viên tiếp nhận",
                    TicketStatus.IN_PROGRESS: "đang được kỹ thuật viên trực tiếp xử lý",
                    TicketStatus.RESOLVED: "đã được xử lý hoàn thành, mời bạn kiểm tra và nghiệm thu",
                    TicketStatus.REOPENED: "đã được ghi nhận mở lại để tiếp tục kiểm tra",
                }
                status_msg = status_texts.get(to_status, f"đã chuyển sang trạng thái {to_status.value}")

                event_payload = {
                    "user_id": str(target_user_id),
                    "category": NotificationCategory.MAINTENANCE.value,
                    "template_code": "maintenance.status_updated",
                    "idempotency_key": f"ticket_status_{ticket.id}_{to_status.value}_{int(datetime.now().timestamp())}",
                    "context": {
                        "ticket_id": str(ticket.id)[:8],
                        "title": ticket.title,
                        "status_message": status_msg,
                    },
                }
                await self.event_bus.publish(
                    topic=settings.kafka_notifications_topic,
                    value=event_payload,
                    key=str(target_user_id),
                )
        except Exception:
            logger.exception("failed_to_notify_resident_status", ticket_id=str(ticket.id))

    async def _notify_on_new_comment(self, ticket: Ticket, commenter: User, comment_text: str):
        """Send notification to the other party when a new comment is posted."""
        try:
            # If commenter is admin/technician, notify resident; if resident, notify technician
            target_user_id = None
            if commenter.role in ("admin", "technician"):
                target_user_id = ticket.created_by
            elif ticket.assigned_to:
                tech_stmt = select(Technician.user_id).where(Technician.id == ticket.assigned_to)
                t_res = await self.session.execute(tech_stmt)
                target_user_id = t_res.scalar_one_or_none()

            if target_user_id and target_user_id != commenter.id:
                event_payload = {
                    "user_id": str(target_user_id),
                    "category": NotificationCategory.MAINTENANCE.value,
                    "template_code": "maintenance.new_comment",
                    "idempotency_key": f"comment_{ticket.id}_{int(datetime.now().timestamp())}",
                    "context": {
                        "ticket_id": str(ticket.id)[:8],
                        "author": commenter.full_name or commenter.email,
                        "comment": comment_text[:100],
                    },
                }
                await self.event_bus.publish(
                    topic=settings.kafka_notifications_topic,
                    value=event_payload,
                    key=str(target_user_id),
                )
        except Exception:
            logger.exception("failed_to_notify_comment", ticket_id=str(ticket.id))

    # -------------------------------------------------------------------------
    # Serializer Helpers
    # -------------------------------------------------------------------------

    @staticmethod
    def to_response(ticket: Ticket) -> TicketResponse:
        """Convert Ticket model to TicketResponse schema with formatted SLA."""
        apt_unit = None
        bld_name = None
        dev_name = None
        creator_name = None
        tech_name = None

        if "apartment" in ticket.__dict__ and ticket.apartment:
            apt = ticket.apartment
            apt_unit = getattr(apt, "unit_number", None)
            if "floor" in apt.__dict__ and apt.floor:
                flr = apt.floor
                if "building" in flr.__dict__ and flr.building:
                    bld_name = getattr(flr.building, "name", None)

        if "device" in ticket.__dict__ and ticket.device:
            dev_name = getattr(ticket.device, "name", None)

        if "creator" in ticket.__dict__ and ticket.creator:
            creator_name = getattr(ticket.creator, "full_name", None) or getattr(ticket.creator, "email", None)

        if "technician" in ticket.__dict__ and ticket.technician:
            tech = ticket.technician
            if "user" in tech.__dict__ and tech.user:
                tech_name = getattr(tech.user, "full_name", None) or getattr(tech.user, "email", None)

        p_str = ticket.priority.value if hasattr(ticket.priority, "value") else str(ticket.priority)
        s_str = ticket.status.value if hasattr(ticket.status, "value") else str(ticket.status)
        source_str = ticket.source.value if hasattr(ticket.source, "value") else str(ticket.source)

        att_count = len(ticket.attachments) if "attachments" in ticket.__dict__ and ticket.attachments else 0
        com_count = len(ticket.comments) if "comments" in ticket.__dict__ and ticket.comments else 0

        return TicketResponse(
            id=ticket.id,
            source=source_str,
            apartment_id=ticket.apartment_id,
            apartment_unit=apt_unit,
            building_name=bld_name,
            device_id=ticket.device_id,
            device_name=dev_name,
            category=ticket.category,
            priority=p_str,
            status=s_str,
            title=ticket.title,
            description=ticket.description,
            created_by=ticket.created_by,
            creator_name=creator_name,
            assigned_to=ticket.assigned_to,
            technician_name=tech_name,
            due_at=ticket.due_at,
            resolved_at=ticket.resolved_at,
            closed_at=ticket.closed_at,
            rating=ticket.rating,
            rating_comment=ticket.rating_comment,
            is_overdue=is_ticket_overdue(ticket.due_at, s_str),
            resident_sla_text=format_sla_for_resident(ticket.due_at, s_str),
            attachment_count=att_count,
            comment_count=com_count,
            created_at=ticket.created_at,
            updated_at=ticket.updated_at,
        )

    @staticmethod
    def to_detail_response(ticket: Ticket, include_internal: bool = True) -> TicketDetailResponse:
        """Convert Ticket model to TicketDetailResponse schema with attachments and filtered comments."""
        base = TicketService.to_response(ticket)

        attachments = []
        if "attachments" in ticket.__dict__ and ticket.attachments:
            for a in ticket.attachments:
                attachments.append(
                    TicketAttachmentResponse(
                        id=a.id,
                        ticket_id=a.ticket_id,
                        file_url=a.file_url,
                        file_name=a.file_name,
                        file_size=a.file_size,
                        mime_type=a.mime_type,
                        uploaded_by=a.uploaded_by,
                        uploaded_at=a.uploaded_at,
                    )
                )

        comments = []
        if "comments" in ticket.__dict__ and ticket.comments:
            for c in ticket.comments:
                if c.is_internal and not include_internal:
                    continue
                author_name = None
                author_role = None
                if "author" in c.__dict__ and c.author:
                    author_name = getattr(c.author, "full_name", None) or getattr(c.author, "email", None)
                    author_role = getattr(c.author, "role", None)
                comments.append(
                    TicketCommentResponse(
                        id=c.id,
                        ticket_id=c.ticket_id,
                        author_id=c.author_id,
                        author_name=author_name,
                        author_role=author_role,
                        comment=c.comment,
                        is_internal=c.is_internal,
                        created_at=c.created_at,
                    )
                )

        status_history = []
        if "status_history" in ticket.__dict__ and ticket.status_history:
            for h in ticket.status_history:
                changed_by_name = None
                if "user" in h.__dict__ and h.user:
                    changed_by_name = getattr(h.user, "full_name", None) or getattr(h.user, "email", None)
                status_history.append(
                    TicketStatusHistoryResponse(
                        id=h.id,
                        ticket_id=h.ticket_id,
                        from_status=h.from_status,
                        to_status=h.to_status,
                        changed_by=h.changed_by,
                        changed_by_name=changed_by_name,
                        changed_at=h.changed_at,
                        note=h.note,
                    )
                )

        return TicketDetailResponse(
            **base.model_dump(),
            attachments=attachments,
            comments=comments,
            status_history=status_history,
        )

