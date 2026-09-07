"""
Generic CRUD repository.

Provides reusable database operations for all entities.
"""

from typing import Any, Generic, TypeVar
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.base import Base

ModelType = TypeVar("ModelType", bound=Base)


class BaseRepository(Generic[ModelType]):
    """Generic repository with CRUD operations."""

    def __init__(self, model: type[ModelType], session: AsyncSession):
        self.model = model
        self.session = session

    async def get_by_id(self, id: UUID) -> ModelType | None:
        """Get a single record by ID."""
        result = await self.session.execute(
            select(self.model).where(self.model.id == id)
        )
        return result.scalar_one_or_none()

    async def get_all(
        self,
        offset: int = 0,
        limit: int = 20,
        filters: list | None = None,
        order_by: Any | None = None,
    ) -> list[ModelType]:
        """Get paginated list of records with optional filters."""
        query = select(self.model)

        if filters:
            for f in filters:
                query = query.where(f)

        if order_by is not None:
            query = query.order_by(order_by)
        else:
            # Default: order by created_at desc if the column exists
            if hasattr(self.model, "created_at"):
                query = query.order_by(self.model.created_at.desc())

        query = query.offset(offset).limit(limit)
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def count(self, filters: list | None = None) -> int:
        """Count records with optional filters."""
        query = select(func.count()).select_from(self.model)
        if filters:
            for f in filters:
                query = query.where(f)
        result = await self.session.execute(query)
        return result.scalar_one()

    async def create(self, obj: ModelType) -> ModelType:
        """Create a new record."""
        self.session.add(obj)
        await self.session.flush()
        await self.session.refresh(obj)
        return obj

    async def update(self, obj: ModelType, data: dict) -> ModelType:
        """Update a record with the given data dict."""
        for key, value in data.items():
            if value is not None:
                setattr(obj, key, value)
        await self.session.flush()
        await self.session.refresh(obj)
        return obj

    async def delete(self, obj: ModelType) -> None:
        """Hard delete a record."""
        await self.session.delete(obj)
        await self.session.flush()

    async def soft_delete(self, obj: ModelType) -> ModelType:
        """Soft delete by setting is_active = False."""
        if hasattr(obj, "is_active"):
            obj.is_active = False
            await self.session.flush()
            await self.session.refresh(obj)
        return obj
