"""Billing repository — database operations for billing cycles."""

from datetime import date
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.billing_cycle import BillingCycle, BillingCycleStatus
from app.repositories.base import BaseRepository


class BillingRepository(BaseRepository[BillingCycle]):
    """Repository for BillingCycle CRUD and queries."""

    def __init__(self, session: AsyncSession):
        super().__init__(BillingCycle, session)

    async def get_by_apartment_and_period(
        self, apartment_id: UUID, period_start: date
    ) -> BillingCycle | None:
        """Find a billing cycle for a specific apartment and period start date."""
        query = select(BillingCycle).where(
            BillingCycle.apartment_id == apartment_id,
            BillingCycle.period_start == period_start,
        )
        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    async def get_open_cycles(self) -> list[BillingCycle]:
        """Get all billing cycles that are in OPEN status (ready for calculation)."""
        query = (
            select(BillingCycle)
            .where(BillingCycle.status == BillingCycleStatus.OPEN)
            .order_by(BillingCycle.period_start)
        )
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def get_current_for_apartment(
        self, apartment_id: UUID
    ) -> BillingCycle | None:
        """Get the most recent billing cycle for an apartment."""
        query = (
            select(BillingCycle)
            .where(BillingCycle.apartment_id == apartment_id)
            .order_by(BillingCycle.period_start.desc())
            .limit(1)
        )
        result = await self.session.execute(query)
        return result.scalar_one_or_none()
