"""Invoice repository — database operations for invoices and invoice items."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.invoice import Invoice, InvoiceStatus
from app.models.invoice_item import InvoiceItem
from app.repositories.base import BaseRepository


class InvoiceRepository(BaseRepository[Invoice]):
    """Repository for Invoice CRUD and queries."""

    def __init__(self, session: AsyncSession):
        super().__init__(Invoice, session)

    async def get_by_apartment(
        self,
        apartment_id: UUID,
        status: str | None = None,
        offset: int = 0,
        limit: int = 20,
    ) -> list[Invoice]:
        """Get invoices for an apartment, optionally filtered by status."""
        query = (
            select(Invoice)
            .options(selectinload(Invoice.items), selectinload(Invoice.transactions))
            .where(Invoice.apartment_id == apartment_id)
        )
        if status:
            query = query.where(Invoice.status == status)
        query = query.order_by(Invoice.created_at.desc()).offset(offset).limit(limit)
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def get_detail(self, invoice_id: UUID) -> Invoice | None:
        """Get a single invoice with items and transactions eagerly loaded."""
        query = (
            select(Invoice)
            .options(selectinload(Invoice.items), selectinload(Invoice.transactions))
            .where(Invoice.id == invoice_id)
        )
        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    async def get_by_number(self, invoice_number: str) -> Invoice | None:
        """Find invoice by its human-readable number."""
        query = select(Invoice).where(Invoice.invoice_number == invoice_number)
        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    async def get_overdue(self) -> list[Invoice]:
        """Find all invoices past due date that are still pending."""
        from datetime import date

        query = (
            select(Invoice)
            .where(
                Invoice.status == InvoiceStatus.PENDING,
                Invoice.due_date < date.today(),
            )
        )
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def add_item(self, item: InvoiceItem) -> InvoiceItem:
        """Add a line item to an invoice."""
        self.session.add(item)
        await self.session.flush()
        await self.session.refresh(item)
        return item
