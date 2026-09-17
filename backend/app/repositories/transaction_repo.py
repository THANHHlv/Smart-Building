"""Transaction repository — database operations for payment transactions."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.payment_audit_log import PaymentAuditLog
from app.models.transaction import Transaction
from app.repositories.base import BaseRepository


class TransactionRepository(BaseRepository[Transaction]):
    """Repository for Transaction CRUD and lookups."""

    def __init__(self, session: AsyncSession):
        super().__init__(Transaction, session)

    async def get_by_idempotency_key(self, key: str) -> Transaction | None:
        """Find a transaction by its idempotency key."""
        query = select(Transaction).where(Transaction.idempotency_key == key)
        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    async def get_by_provider_txn_id(self, provider_txn_id: str) -> Transaction | None:
        """Find a transaction by the payment provider's transaction ID."""
        query = select(Transaction).where(
            Transaction.provider_txn_id == provider_txn_id
        )
        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    async def get_by_invoice(self, invoice_id: UUID) -> list[Transaction]:
        """Get all transactions for an invoice."""
        query = (
            select(Transaction)
            .where(Transaction.invoice_id == invoice_id)
            .order_by(Transaction.created_at.desc())
        )
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def add_audit_log(self, log_entry: PaymentAuditLog) -> PaymentAuditLog:
        """Append an immutable audit log entry."""
        self.session.add(log_entry)
        await self.session.flush()
        await self.session.refresh(log_entry)
        return log_entry
