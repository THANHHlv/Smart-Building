"""PaymentMethod repository — database operations for saved payment methods."""

from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.payment_method import PaymentMethod
from app.repositories.base import BaseRepository


class PaymentMethodRepository(BaseRepository[PaymentMethod]):
    """Repository for PaymentMethod CRUD."""

    def __init__(self, session: AsyncSession):
        super().__init__(PaymentMethod, session)

    async def get_active_by_user(self, user_id: UUID) -> list[PaymentMethod]:
        """Get all active payment methods for a user."""
        query = (
            select(PaymentMethod)
            .where(
                PaymentMethod.user_id == user_id,
                PaymentMethod.is_active.is_(True),
            )
            .order_by(PaymentMethod.is_default.desc(), PaymentMethod.created_at.desc())
        )
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def get_default_for_user(self, user_id: UUID) -> PaymentMethod | None:
        """Get the default payment method for a user."""
        query = select(PaymentMethod).where(
            PaymentMethod.user_id == user_id,
            PaymentMethod.is_active.is_(True),
            PaymentMethod.is_default.is_(True),
        )
        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    async def clear_default_for_user(self, user_id: UUID) -> None:
        """Unset is_default on all payment methods for a user."""
        stmt = (
            update(PaymentMethod)
            .where(
                PaymentMethod.user_id == user_id,
                PaymentMethod.is_default.is_(True),
            )
            .values(is_default=False)
        )
        await self.session.execute(stmt)
        await self.session.flush()
