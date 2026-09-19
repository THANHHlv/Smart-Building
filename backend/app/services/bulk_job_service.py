"""Bulk operations domain service — asynchronous batch processing."""

import asyncio
import datetime
import uuid
from typing import Any
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import async_session_factory
from app.core.logging import get_logger
from app.models.apartment import Apartment
from app.models.billing_cycle import BillingCycle, BillingCycleStatus
from app.models.billing_rate import BillingRate
from app.models.bulk_job import BulkJob
from app.models.floor import Floor
from app.models.invoice import Invoice, InvoiceStatus
from app.models.manual_confirmation import ManualConfirmation, ManualConfirmationStatus
from app.models.notification import (
    NotificationCategory,
    NotificationChannel,
)
from app.models.payment_audit_log import PaymentAuditLog
from app.models.payment_reminder import PaymentReminder, ReminderChannel, ReminderStatus
from app.models.user import User
from app.schemas.bulk_job import (
    BillingRateResponse,
    BillingRateUpdateRequest,
    BulkApprovalRequest,
    BulkInvoiceGenerateRequest,
    BulkJobResponse,
    BulkReminderSendRequest,
)
from app.schemas.notification import NotificationEventPayload
from app.services.billing_engine import BillingEngine
from app.services.notification_service import NotificationService

logger = get_logger(__name__)


class BulkJobService:
    """Manages asynchronous bulk jobs, progress tracking, and batch workflows."""

    session_factory: Any = async_session_factory

    @classmethod
    def get_session_factory(cls) -> Any:
        return cls.session_factory if cls.session_factory is not None else async_session_factory

    def __init__(self, session: AsyncSession):
        self.session = session

    # -------------------------------------------------------------------------
    # 1. Job Status Query
    # -------------------------------------------------------------------------

    async def get_job_status(self, job_id: UUID) -> BulkJobResponse:
        """Fetch current status and progress metrics of a bulk job."""
        stmt = select(BulkJob).where(BulkJob.id == job_id)
        job = (await self.session.execute(stmt)).scalar_one_or_none()
        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Không tìm thấy công việc nền với mã {job_id}",
            )
        return BulkJobResponse.model_validate(job)

    # -------------------------------------------------------------------------
    # 2. Bulk Invoices Generation
    # -------------------------------------------------------------------------

    async def start_bulk_invoice_generation(
        self,
        payload: BulkInvoiceGenerateRequest,
        user_id: UUID | None,
    ) -> BulkJobResponse:
        """Enqueue asynchronous invoice generation for all apartments in a billing period."""
        target_date = payload.target_date or datetime.date.today()
        period_start = target_date.replace(day=1)

        # Count total eligible apartments to initialize progress
        count_stmt = select(func.count(Apartment.id)).where(Apartment.is_active.is_(True))
        if payload.building_id:
            count_stmt = count_stmt.join(Floor, Apartment.floor_id == Floor.id).where(
                Floor.building_id == payload.building_id
            )
        total_apts = (await self.session.execute(count_stmt)).scalar() or 0

        job_id = uuid.uuid4()
        job = BulkJob(
            id=job_id,
            job_type="invoice_generation",
            status="pending",
            total_items=total_apts,
            processed_items=0,
            failed_items=0,
            created_by=user_id,
            params={
                "building_id": str(payload.building_id) if payload.building_id else None,
                "target_date": target_date.isoformat(),
                "period_start": period_start.isoformat(),
            },
            error_summary=[],
        )
        self.session.add(job)
        await self.session.commit()

        # Spawn non-blocking background task
        asyncio.create_task(
            self._run_bulk_invoice_generation(job_id, payload.building_id, target_date)
        )

        return BulkJobResponse.model_validate(job)

    @staticmethod
    async def _run_bulk_invoice_generation(
        job_id: UUID,
        building_id: UUID | None,
        target_date: datetime.date,
    ) -> None:
        """Background execution worker for mass invoice generation."""
        logger.info("bulk_invoice_generation_started", job_id=str(job_id))
        async with BulkJobService.get_session_factory()() as session:
            try:
                # Mark processing
                await session.execute(
                    update(BulkJob)
                    .where(BulkJob.id == job_id)
                    .values(status="processing")
                )
                await session.commit()

                engine = BillingEngine(session)
                # 1. Ensure billing cycles exist (idempotent)
                await engine.create_billing_cycles_for_month(target_date)

                # 2. Query open cycles for period
                period_start = target_date.replace(day=1)
                cycles_query = (
                    select(BillingCycle)
                    .join(Apartment, BillingCycle.apartment_id == Apartment.id)
                    .where(
                        BillingCycle.status == BillingCycleStatus.OPEN,
                        BillingCycle.period_start == period_start,
                    )
                )
                if building_id:
                    cycles_query = cycles_query.join(Floor, Apartment.floor_id == Floor.id).where(
                        Floor.building_id == building_id
                    )

                result = await session.execute(cycles_query)
                open_cycles = result.scalars().all()

                # Update total items to actual open cycles found
                await session.execute(
                    update(BulkJob)
                    .where(BulkJob.id == job_id)
                    .values(total_items=len(open_cycles))
                )
                await session.commit()

                processed = 0
                failed = 0
                errors: list[dict[str, Any]] = []

                for cycle in open_cycles:
                    try:
                        inv = await engine._generate_invoice_for_cycle(cycle)
                        if inv:
                            processed += 1
                        else:
                            # Cycle had no billable consumption/items
                            processed += 1
                    except Exception as exc:
                        failed += 1
                        logger.exception(
                            "bulk_invoice_item_failed",
                            job_id=str(job_id),
                            cycle_id=str(cycle.id),
                            error=str(exc),
                        )
                        errors.append({"cycle_id": str(cycle.id), "error": str(exc)})

                    # Update progress periodically
                    if (processed + failed) % 10 == 0:
                        await session.execute(
                            update(BulkJob)
                            .where(BulkJob.id == job_id)
                            .values(processed_items=processed, failed_items=failed)
                        )
                        await session.commit()

                # Mark completed
                now = datetime.datetime.now(datetime.timezone.utc)
                await session.execute(
                    update(BulkJob)
                    .where(BulkJob.id == job_id)
                    .values(
                        status="completed" if failed == 0 else ("completed" if processed > 0 else "failed"),
                        processed_items=processed,
                        failed_items=failed,
                        error_summary=errors,
                        finished_at=now,
                    )
                )
                await session.commit()
                logger.info(
                    "bulk_invoice_generation_finished",
                    job_id=str(job_id),
                    processed=processed,
                    failed=failed,
                )
            except Exception as e:
                logger.exception("bulk_invoice_generation_fatal_error", job_id=str(job_id), error=str(e))
                await session.execute(
                    update(BulkJob)
                    .where(BulkJob.id == job_id)
                    .values(
                        status="failed",
                        error_summary=[{"fatal_error": str(e)}],
                        finished_at=datetime.datetime.now(datetime.timezone.utc),
                    )
                )
                await session.commit()

    # -------------------------------------------------------------------------
    # 3. Bulk Overdue Payment Reminders
    # -------------------------------------------------------------------------

    async def start_bulk_reminders(
        self,
        payload: BulkReminderSendRequest,
        user_id: UUID | None,
    ) -> BulkJobResponse:
        """Enqueue asynchronous reminder dispatch for overdue invoices."""
        job_id = uuid.uuid4()
        job = BulkJob(
            id=job_id,
            job_type="overdue_reminders",
            status="pending",
            total_items=0,
            processed_items=0,
            failed_items=0,
            created_by=user_id,
            params={
                "building_id": str(payload.building_id) if payload.building_id else None,
                "min_overdue_days": payload.min_overdue_days,
                "apartment_ids": [str(a) for a in payload.apartment_ids] if payload.apartment_ids else None,
            },
            error_summary=[],
        )
        self.session.add(job)
        await self.session.commit()

        asyncio.create_task(
            self._run_bulk_reminders(job_id, payload.building_id, payload.min_overdue_days, payload.apartment_ids)
        )

        return BulkJobResponse.model_validate(job)

    @staticmethod
    async def _run_bulk_reminders(
        job_id: UUID,
        building_id: UUID | None,
        min_overdue_days: int,
        apartment_ids: list[UUID] | None,
    ) -> None:
        """Background execution worker for sending overdue reminders."""
        logger.info("bulk_reminders_started", job_id=str(job_id))
        async with BulkJobService.get_session_factory()() as session:
            try:
                await session.execute(
                    update(BulkJob).where(BulkJob.id == job_id).values(status="processing")
                )
                await session.commit()

                today = datetime.date.today()
                cutoff_date = today - datetime.timedelta(days=min_overdue_days)

                # Query overdue invoices
                stmt = (
                    select(Invoice)
                    .options(selectinload(Invoice.apartment))
                    .join(Apartment, Invoice.apartment_id == Apartment.id)
                    .where(
                        Invoice.status.in_([InvoiceStatus.PENDING, InvoiceStatus.OVERDUE]),
                        Invoice.due_date <= cutoff_date,
                    )
                )
                if building_id:
                    stmt = stmt.join(Floor, Apartment.floor_id == Floor.id).where(
                        Floor.building_id == building_id
                    )
                if apartment_ids:
                    stmt = stmt.where(Invoice.apartment_id.in_(apartment_ids))

                invoices = (await session.execute(stmt)).scalars().all()

                await session.execute(
                    update(BulkJob).where(BulkJob.id == job_id).values(total_items=len(invoices))
                )
                await session.commit()

                notif_service = NotificationService(session)
                processed = 0
                failed = 0
                errors: list[dict[str, Any]] = []

                for inv in invoices:
                    try:
                        # Find residents for this apartment
                        u_stmt = select(User).where(User.apartment_id == inv.apartment_id, User.is_active.is_(True))
                        residents = (await session.execute(u_stmt)).scalars().all()

                        days_overdue = (today - inv.due_date).days if inv.due_date else min_overdue_days
                        unit_str = inv.apartment.unit_number if inv.apartment else "căn hộ"

                        for res in residents:
                            # Send reminder notification
                            event = NotificationEventPayload(
                                user_id=res.id,
                                category=NotificationCategory.BILLING,
                                template_code="payment.overdue_reminder",
                                template_data={
                                    "apartment_unit": unit_str,
                                    "invoice_number": inv.invoice_number,
                                    "amount_formatted": f"{inv.total_amount:,.0f} đ",
                                    "days_overdue": str(days_overdue),
                                    "due_date": inv.due_date.isoformat() if inv.due_date else "",
                                },
                                title=f"Nhắc hạn thanh toán: Căn {unit_str} quá hạn {days_overdue} ngày",
                                body=f"Hóa đơn {inv.invoice_number} với số tiền {inv.total_amount:,.0f} đ đã quá hạn {days_overdue} ngày. Quý cư dân vui lòng thanh toán sớm để tránh gián đoạn dịch vụ.",
                                channels=[NotificationChannel.IN_APP],
                            )
                            await notif_service.dispatch(event)

                        # Record PaymentReminder audit record
                        reminder = PaymentReminder(
                            id=uuid.uuid4(),
                            invoice_id=inv.id,
                            channel=ReminderChannel.APP,
                            status=ReminderStatus.SENT,
                            sent_at=datetime.datetime.now(datetime.timezone.utc),
                        )
                        session.add(reminder)

                        # Ensure invoice is marked overdue if not already
                        if inv.status == InvoiceStatus.PENDING:
                            inv.status = InvoiceStatus.OVERDUE

                        processed += 1
                    except Exception as exc:
                        failed += 1
                        logger.exception("bulk_reminder_item_failed", invoice_id=str(inv.id), error=str(exc))
                        errors.append({"invoice_id": str(inv.id), "error": str(exc)})

                now = datetime.datetime.now(datetime.timezone.utc)
                await session.execute(
                    update(BulkJob)
                    .where(BulkJob.id == job_id)
                    .values(
                        status="completed" if failed == 0 else "completed",
                        processed_items=processed,
                        failed_items=failed,
                        error_summary=errors,
                        finished_at=now,
                    )
                )
                await session.commit()
                logger.info("bulk_reminders_finished", job_id=str(job_id), processed=processed, failed=failed)
            except Exception as e:
                logger.exception("bulk_reminders_fatal_error", job_id=str(job_id), error=str(e))
                await session.execute(
                    update(BulkJob)
                    .where(BulkJob.id == job_id)
                    .values(
                        status="failed",
                        error_summary=[{"fatal_error": str(e)}],
                        finished_at=datetime.datetime.now(datetime.timezone.utc),
                    )
                )
                await session.commit()

    # -------------------------------------------------------------------------
    # 4. Bulk Manual Confirmations Approval
    # -------------------------------------------------------------------------

    async def start_bulk_manual_approval(
        self,
        payload: BulkApprovalRequest,
        user_id: UUID | None,
    ) -> BulkJobResponse:
        """Enqueue asynchronous bulk approval of manual payment confirmations."""
        job_id = uuid.uuid4()
        job = BulkJob(
            id=job_id,
            job_type="manual_confirmations_approval",
            status="pending",
            total_items=len(payload.confirmation_ids),
            processed_items=0,
            failed_items=0,
            created_by=user_id,
            params={
                "confirmation_ids": [str(c) for c in payload.confirmation_ids],
                "note": payload.note,
            },
            error_summary=[],
        )
        self.session.add(job)
        await self.session.commit()

        asyncio.create_task(
            self._run_bulk_manual_approval(job_id, payload.confirmation_ids, payload.note, user_id)
        )

        return BulkJobResponse.model_validate(job)

    @staticmethod
    async def _run_bulk_manual_approval(
        job_id: UUID,
        confirmation_ids: list[UUID],
        note: str | None,
        approver_id: UUID | None,
    ) -> None:
        """Background execution worker for mass manual confirmation approval."""
        logger.info("bulk_manual_approval_started", job_id=str(job_id))
        async with BulkJobService.get_session_factory()() as session:
            try:
                await session.execute(
                    update(BulkJob).where(BulkJob.id == job_id).values(status="processing")
                )
                await session.commit()

                # Fetch confirmations
                stmt = (
                    select(ManualConfirmation)
                    .options(
                        selectinload(ManualConfirmation.invoice).selectinload(Invoice.apartment)
                    )
                    .where(ManualConfirmation.id.in_(confirmation_ids))
                )
                confirmations = (await session.execute(stmt)).scalars().all()

                notif_service = NotificationService(session)
                processed = 0
                failed = 0
                errors: list[dict[str, Any]] = []
                now = datetime.datetime.now(datetime.timezone.utc)

                for mc in confirmations:
                    try:
                        # Idempotency: skip if already approved
                        if mc.status == ManualConfirmationStatus.APPROVED:
                            processed += 1
                            continue

                        mc.status = ManualConfirmationStatus.APPROVED
                        mc.confirmed_by = approver_id
                        mc.confirmed_at = now
                        if note:
                            mc.note = f"{mc.note or ''}\n[Duyệt hàng loạt]: {note}".strip()

                        # Update Invoice
                        inv = mc.invoice
                        if inv:
                            inv.status = InvoiceStatus.PAID
                            inv.paid_at = now
                            inv.payment_method = mc.method.value

                            # Send notification to submitter or apartment residents
                            submitter_id = mc.submitted_by
                            if not submitter_id and inv.apartment_id:
                                u_stmt = select(User.id).where(User.apartment_id == inv.apartment_id).limit(1)
                                submitter_id = (await session.execute(u_stmt)).scalar_one_or_none()

                            if submitter_id:
                                event = NotificationEventPayload(
                                    user_id=submitter_id,
                                    category=NotificationCategory.BILLING,
                                    template_code="payment.approved",
                                    template_data={
                                        "invoice_number": inv.invoice_number,
                                        "amount": f"{inv.total_amount:,.0f} đ",
                                        "method": mc.method.value,
                                    },
                                    title=f"Thanh toán thành công: Hóa đơn {inv.invoice_number}",
                                    body=f"Ban Quản Lý đã xác nhận thanh toán thành công số tiền {inv.total_amount:,.0f} đ qua {mc.method.value}.",
                                    channels=[NotificationChannel.IN_APP],
                                )
                                await notif_service.dispatch(event)

                        processed += 1
                    except Exception as exc:
                        failed += 1
                        logger.exception("bulk_approval_item_failed", confirmation_id=str(mc.id), error=str(exc))
                        errors.append({"confirmation_id": str(mc.id), "error": str(exc)})

                await session.execute(
                    update(BulkJob)
                    .where(BulkJob.id == job_id)
                    .values(
                        status="completed" if failed == 0 else "completed",
                        processed_items=processed,
                        failed_items=failed,
                        error_summary=errors,
                        finished_at=datetime.datetime.now(datetime.timezone.utc),
                    )
                )
                await session.commit()
                logger.info("bulk_manual_approval_finished", job_id=str(job_id), processed=processed, failed=failed)
            except Exception as e:
                logger.exception("bulk_manual_approval_fatal_error", job_id=str(job_id), error=str(e))
                await session.execute(
                    update(BulkJob)
                    .where(BulkJob.id == job_id)
                    .values(
                        status="failed",
                        error_summary=[{"fatal_error": str(e)}],
                        finished_at=datetime.datetime.now(datetime.timezone.utc),
                    )
                )
                await session.commit()

    # -------------------------------------------------------------------------
    # 5. Billing Rates Versioning with Effective Date
    # -------------------------------------------------------------------------

    async def update_billing_rates(
        self,
        payload: BillingRateUpdateRequest,
        user_id: UUID | None,
    ) -> BillingRateResponse:
        """Create a new versioned billing rate schedule with effective date."""
        rate_id = uuid.uuid4()
        rate = BillingRate(
            id=rate_id,
            building_id=payload.building_id,
            water_price_per_m3=payload.water_price_per_m3,
            management_fee_per_sqm=payload.management_fee_per_sqm,
            parking_fee_per_slot=payload.parking_fee_per_slot,
            effective_date=payload.effective_date,
            created_by=user_id,
        )
        self.session.add(rate)
        await self.session.commit()

        logger.info(
            "billing_rates_updated",
            rate_id=str(rate_id),
            building_id=str(payload.building_id),
            effective_date=payload.effective_date.isoformat(),
        )
        return BillingRateResponse.model_validate(rate)
