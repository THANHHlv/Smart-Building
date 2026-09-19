"""Billing engine — automated invoice generation from consumption data.

Runs as a scheduled job via APScheduler. Reads from energy_consumption
and water_consumption tables (read-only) and writes to billing/invoice tables.

The EVN 6-tier tariff calculation is extracted here as a shared utility
so both this engine and the resident dashboard can use it without duplication.
"""

import uuid
from datetime import date, datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import get_settings
from app.core.logging import get_logger
from app.models.apartment import Apartment
from app.models.billing_cycle import BillingCycle, BillingCycleStatus
from app.models.billing_rate import BillingRate
from app.models.energy_consumption import EnergyConsumption
from app.models.floor import Floor
from app.models.invoice import Invoice, InvoiceStatus
from app.models.invoice_item import InvoiceItem, ServiceType
from app.models.water_consumption import WaterConsumption
from app.repositories.billing_repo import BillingRepository
from app.repositories.invoice_repo import InvoiceRepository

logger = get_logger(__name__)
settings = get_settings()


# ---------------------------------------------------------------------------
# EVN 6-Tier Residential Electricity Tariff (shared utility)
# ---------------------------------------------------------------------------

def calculate_evn_tariff(kwh: float) -> tuple[int, int, str]:
    """Calculate electricity cost using the EVN 6-tier residential tariff.

    Args:
        kwh: Total kilowatt-hours consumed in the billing period.

    Returns:
        Tuple of (base_cost_vnd, vat_vnd, tier_name).
    """
    if kwh <= 0:
        return 0, 0, "Bậc 1 (0 - 50 kWh)"

    tiers = [
        (50, 1893, "Bậc 1 (0 - 50 kWh)"),
        (50, 1956, "Bậc 2 (51 - 100 kWh)"),
        (100, 2271, "Bậc 3 (101 - 200 kWh)"),
        (100, 2860, "Bậc 4 (201 - 300 kWh)"),
        (100, 3197, "Bậc 5 (301 - 400 kWh)"),
        (float("inf"), 3302, "Bậc 6 (> 400 kWh)"),
    ]

    remaining = kwh
    cost = 0.0
    current_tier = tiers[0][2]

    for quota, rate, name in tiers:
        if remaining <= 0:
            break
        current_tier = name
        units = min(remaining, quota)
        cost += units * rate
        remaining -= units

    vat = cost * 0.08  # 8% VAT
    return int(round(cost)), int(round(vat)), current_tier


def calculate_water_cost(liters: float, price_per_m3: float | None = None) -> int:
    """Calculate water cost from liters consumed.

    Args:
        liters: Total liters consumed in the billing period.
        price_per_m3: Optional unit price per m3 in VND (defaults to settings).

    Returns:
        Cost in VND.
    """
    if price_per_m3 is None:
        price_per_m3 = settings.billing_water_price_per_m3
    return int(round((liters / 1000.0) * price_per_m3))


# ---------------------------------------------------------------------------
# Billing Engine Jobs
# ---------------------------------------------------------------------------

class BillingEngine:
    """Automated billing engine for generating monthly invoices."""

    def __init__(self, session: AsyncSession):
        self.session = session
        self.billing_repo = BillingRepository(session)
        self.invoice_repo = InvoiceRepository(session)

    async def create_billing_cycles_for_month(
        self, target_date: date | None = None,
    ) -> int:
        """Create billing cycles for all active apartments for the target month.

        Idempotent: skips apartments that already have a cycle for the period.

        Returns:
            Number of new billing cycles created.
        """
        if target_date is None:
            target_date = date.today()

        period_start = target_date.replace(day=1)
        # Period end = last day of month
        if period_start.month == 12:
            period_end = date(period_start.year + 1, 1, 1)
        else:
            period_end = date(period_start.year, period_start.month + 1, 1)

        # Fetch all active apartments
        apt_query = select(Apartment).where(Apartment.is_active.is_(True))
        result = await self.session.execute(apt_query)
        apartments = result.scalars().all()

        created_count = 0
        for apt in apartments:
            # Check if cycle already exists (idempotent)
            existing = await self.billing_repo.get_by_apartment_and_period(
                apartment_id=apt.id, period_start=period_start
            )
            if existing:
                continue

            cycle = BillingCycle(
                apartment_id=apt.id,
                period_start=period_start,
                period_end=period_end,
                status=BillingCycleStatus.OPEN,
            )
            await self.billing_repo.create(cycle)
            created_count += 1

        logger.info(
            "billing_cycles_created",
            period=period_start.isoformat(),
            count=created_count,
            total_apartments=len(apartments),
        )
        return created_count

    async def generate_monthly_invoices(
        self, target_date: date | None = None,
    ) -> int:
        """Generate invoices for all OPEN billing cycles.

        For each cycle:
        1. Query energy/water consumption for the period
        2. Calculate costs using EVN tariff + water rate
        3. Add management fee and parking fee
        4. Create Invoice + InvoiceItems
        5. Update cycle status to INVOICED

        Idempotent: cycles already INVOICED are skipped.

        Returns:
            Number of invoices generated.
        """
        if target_date is None:
            target_date = date.today()

        # Ensure cycles exist first
        await self.create_billing_cycles_for_month(target_date)

        # Find open cycles for this period
        period_start = target_date.replace(day=1)
        open_cycles_query = (
            select(BillingCycle)
            .where(
                BillingCycle.status == BillingCycleStatus.OPEN,
                BillingCycle.period_start == period_start,
            )
        )
        result = await self.session.execute(open_cycles_query)
        open_cycles = result.scalars().all()

        invoiced_count = 0

        for cycle in open_cycles:
            try:
                invoice = await self._generate_invoice_for_cycle(cycle)
                if invoice:
                    invoiced_count += 1
            except Exception as exc:
                logger.exception(
                    "billing_invoice_generation_failed",
                    apartment_id=str(cycle.apartment_id),
                    cycle_id=str(cycle.id),
                    error=str(exc),
                )
                # Continue processing other apartments

        logger.info(
            "monthly_invoices_generated",
            period=period_start.isoformat(),
            invoiced=invoiced_count,
            total_cycles=len(open_cycles),
        )
        return invoiced_count

    async def _generate_invoice_for_cycle(
        self, cycle: BillingCycle
    ) -> Invoice | None:
        """Generate a single invoice for a billing cycle."""
        # Strict Idempotency guard: do not regenerate if cycle already invoiced or invoice exists
        if cycle.status == BillingCycleStatus.INVOICED:
            logger.info("cycle_already_invoiced", cycle_id=str(cycle.id))
            return None

        existing_inv_stmt = select(Invoice).where(Invoice.billing_cycle_id == cycle.id)
        existing_inv = (await self.session.execute(existing_inv_stmt)).scalar_one_or_none()
        if existing_inv:
            logger.info("invoice_already_exists_for_cycle", cycle_id=str(cycle.id))
            return existing_inv

        # Fetch apartment info with floor for management fee calculation & building rate lookup
        apt_query = (
            select(Apartment)
            .options(selectinload(Apartment.floor))
            .where(Apartment.id == cycle.apartment_id)
        )
        apt_result = await self.session.execute(apt_query)
        apartment = apt_result.scalar_one_or_none()
        if not apartment:
            logger.warning(
                "billing_apartment_not_found",
                apartment_id=str(cycle.apartment_id),
            )
            return None

        # Look up building-level custom rates with effective_date <= cycle.period_start
        water_price = float(settings.billing_water_price_per_m3)
        mgmt_fee_rate = float(settings.billing_management_fee_per_sqm)
        parking_fee_rate = float(settings.billing_parking_fee_per_slot)

        building_id = apartment.floor.building_id if apartment.floor else None
        if building_id:
            rate_stmt = (
                select(BillingRate)
                .where(
                    BillingRate.building_id == building_id,
                    BillingRate.effective_date <= cycle.period_start,
                )
                .order_by(BillingRate.effective_date.desc(), BillingRate.created_at.desc())
                .limit(1)
            )
            custom_rate = (await self.session.execute(rate_stmt)).scalar_one_or_none()
            if custom_rate:
                water_price = float(custom_rate.water_price_per_m3)
                mgmt_fee_rate = float(custom_rate.management_fee_per_sqm)
                parking_fee_rate = float(custom_rate.parking_fee_per_slot)

        items: list[InvoiceItem] = []
        total_amount = 0.0

        # 1. Electricity — query energy_consumption for the period
        elec_sum_stmt = (
            select(func.coalesce(func.sum(EnergyConsumption.value_kwh), 0.0))
            .where(
                EnergyConsumption.apartment_id == cycle.apartment_id,
                EnergyConsumption.timestamp >= datetime.combine(
                    cycle.period_start, datetime.min.time(), tzinfo=timezone.utc
                ),
                EnergyConsumption.timestamp < datetime.combine(
                    cycle.period_end, datetime.min.time(), tzinfo=timezone.utc
                ),
            )
        )
        kwh = float((await self.session.execute(elec_sum_stmt)).scalar_one())

        if kwh > 0:
            elec_base, elec_vat, tier_name = calculate_evn_tariff(kwh)
            elec_total = elec_base + elec_vat
            items.append(InvoiceItem(
                service_type=ServiceType.ELECTRICITY,
                description=f"Điện tháng {cycle.period_start.strftime('%m/%Y')} — {kwh:.1f} kWh ({tier_name})",
                quantity=round(kwh, 2),
                unit_price=None,  # Tiered pricing
                amount=elec_total,
                metadata_json={
                    "kwh": round(kwh, 2),
                    "base_cost": elec_base,
                    "vat_8_percent": elec_vat,
                    "tier": tier_name,
                },
            ))
            total_amount += elec_total

        # 2. Water — query water_consumption for the period
        water_sum_stmt = (
            select(func.coalesce(func.sum(WaterConsumption.value_liters), 0.0))
            .where(
                WaterConsumption.apartment_id == cycle.apartment_id,
                WaterConsumption.timestamp >= datetime.combine(
                    cycle.period_start, datetime.min.time(), tzinfo=timezone.utc
                ),
                WaterConsumption.timestamp < datetime.combine(
                    cycle.period_end, datetime.min.time(), tzinfo=timezone.utc
                ),
            )
        )
        liters = float((await self.session.execute(water_sum_stmt)).scalar_one())

        if liters > 0:
            water_cost = calculate_water_cost(liters, price_per_m3=water_price)
            m3 = liters / 1000.0
            items.append(InvoiceItem(
                service_type=ServiceType.WATER,
                description=f"Nước tháng {cycle.period_start.strftime('%m/%Y')} — {m3:.2f} m³",
                quantity=round(m3, 2),
                unit_price=water_price,
                amount=water_cost,
                metadata_json={"liters": round(liters, 2), "m3": round(m3, 2)},
            ))
            total_amount += water_cost

        # 3. Management fee — based on apartment area
        area_sqm = apartment.area_sqm or 0.0
        if area_sqm > 0:
            mgmt_fee = int(round(area_sqm * mgmt_fee_rate))
            items.append(InvoiceItem(
                service_type=ServiceType.MANAGEMENT_FEE,
                description=f"Phí quản lý tháng {cycle.period_start.strftime('%m/%Y')} — {area_sqm:.0f} m²",
                quantity=area_sqm,
                unit_price=mgmt_fee_rate,
                amount=mgmt_fee,
            ))
            total_amount += mgmt_fee

        # 4. Parking fee (fixed per apartment, configurable)
        if parking_fee_rate > 0:
            items.append(InvoiceItem(
                service_type=ServiceType.PARKING,
                description=f"Phí gửi xe tháng {cycle.period_start.strftime('%m/%Y')}",
                quantity=1,
                unit_price=parking_fee_rate,
                amount=parking_fee_rate,
            ))
            total_amount += parking_fee_rate

        # Skip if no billable items
        if not items:
            logger.info(
                "billing_no_items_for_cycle",
                apartment_id=str(cycle.apartment_id),
            )
            return None

        # Generate invoice number: INV-YYYYMM-XXXX
        seq = uuid.uuid4().hex[:4].upper()
        invoice_number = f"INV-{cycle.period_start.strftime('%Y%m')}-{seq}"

        # Due date = 15th of the month after billing period
        if cycle.period_end.month == 12:
            due = date(cycle.period_end.year + 1, 1, 15)
        else:
            due = date(cycle.period_end.year, cycle.period_end.month, 15)

        # Create invoice
        invoice = Invoice(
            apartment_id=cycle.apartment_id,
            billing_cycle_id=cycle.id,
            invoice_number=invoice_number,
            total_amount=total_amount,
            currency="VND",
            status=InvoiceStatus.PENDING,
            due_date=due,
        )
        created_invoice = await self.invoice_repo.create(invoice)

        # Add items
        for item in items:
            item.invoice_id = created_invoice.id
            item.invoice = created_invoice
            await self.invoice_repo.add_item(item)

        # Update cycle status
        cycle.status = BillingCycleStatus.INVOICED
        await self.session.flush()

        logger.info(
            "invoice_generated",
            invoice_number=invoice_number,
            apartment_id=str(cycle.apartment_id),
            total_amount=total_amount,
            items_count=len(items),
        )

        # Publish notification event: billing.invoice_created
        try:
            from app.core.kafka_bus import get_event_bus
            from app.models.notification import NotificationCategory
            from app.models.user import User

            user_stmt = select(User).where(User.apartment_id == cycle.apartment_id).limit(1)
            user_res = await self.session.execute(user_stmt)
            user = user_res.scalar_one_or_none()

            if user:
                event_bus = get_event_bus()
                event_payload = {
                    "user_id": str(user.id),
                    "category": NotificationCategory.BILLING.value,
                    "template_code": "billing.invoice_created",
                    "idempotency_key": f"invoice_created_{created_invoice.id}",
                    "context": {
                        "invoice_number": invoice_number,
                        "amount": f"{total_amount:,.0f}",
                        "due_date": due.strftime("%d/%m/%Y"),
                        "billing_period": cycle.period_start.strftime("%m/%Y"),
                        "apartment_unit": getattr(user, "apartment_unit", "căn hộ"),
                    },
                }
                await event_bus.publish(
                    topic=settings.kafka_notifications_topic,
                    value=event_payload,
                    key=str(user.id),
                )
        except Exception:
            pass

        return created_invoice

    async def check_overdue_invoices(self) -> int:
        """Mark pending invoices past their due date as overdue and notify residents.

        Returns:
            Number of invoices marked overdue.
        """
        overdue_invoices = await self.invoice_repo.get_overdue()
        count = 0
        for inv in overdue_invoices:
            inv.status = InvoiceStatus.OVERDUE
            count += 1

            # Publish overdue notification
            try:
                from app.core.kafka_bus import get_event_bus
                from app.models.notification import NotificationCategory
                from app.models.user import User

                u_stmt = select(User).where(User.apartment_id == inv.apartment_id).limit(1)
                u_res = await self.session.execute(u_stmt)
                user = u_res.scalar_one_or_none()
                if user:
                    event_bus = get_event_bus()
                    event_payload = {
                        "user_id": str(user.id),
                        "category": NotificationCategory.BILLING.value,
                        "template_code": "billing.overdue",
                        "idempotency_key": f"overdue_{inv.id}_{date.today()}",
                        "context": {
                            "invoice_number": inv.invoice_number,
                            "amount": f"{inv.total_amount:,.0f}",
                            "due_date": inv.due_date.strftime("%d/%m/%Y") if inv.due_date else "đã qua",
                            "apartment_unit": getattr(user, "apartment_unit", ""),
                        },
                    }
                    await event_bus.publish(
                        topic=settings.kafka_notifications_topic,
                        value=event_payload,
                        key=str(user.id),
                    )
            except Exception:
                pass

        if count > 0:
            await self.session.flush()
            logger.info("invoices_marked_overdue", count=count)

        return count

    async def send_due_date_reminders(self, days_ahead: int = 3) -> int:
        """Send payment reminder notifications for invoices approaching due date."""
        from datetime import timedelta
        from app.core.kafka_bus import get_event_bus
        from app.models.notification import NotificationCategory
        from app.models.user import User

        target_due_date = date.today() + timedelta(days=days_ahead)
        stmt = select(Invoice).where(
            Invoice.status == InvoiceStatus.PENDING,
            Invoice.due_date == target_due_date,
        )
        res = await self.session.execute(stmt)
        invoices = res.scalars().all()

        count = 0
        event_bus = get_event_bus()
        for inv in invoices:
            u_stmt = select(User).where(User.apartment_id == inv.apartment_id).limit(1)
            u_res = await self.session.execute(u_stmt)
            user = u_res.scalar_one_or_none()
            if not user:
                continue

            event_payload = {
                "user_id": str(user.id),
                "category": NotificationCategory.BILLING.value,
                "template_code": "billing.payment_due_soon",
                "idempotency_key": f"due_reminder_{inv.id}_{target_due_date}",
                "context": {
                    "invoice_number": inv.invoice_number,
                    "amount": f"{inv.total_amount:,.0f}",
                    "due_date": inv.due_date.strftime("%d/%m/%Y") if inv.due_date else "",
                    "apartment_unit": getattr(user, "apartment_unit", ""),
                },
            }
            await event_bus.publish(
                topic=settings.kafka_notifications_topic,
                value=event_payload,
                key=str(user.id),
            )
            count += 1

        logger.info("due_reminders_sent", count=count, target_due_date=str(target_due_date))
        return count

