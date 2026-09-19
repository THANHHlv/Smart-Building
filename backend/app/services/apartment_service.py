"""Apartment service — business logic for apartments."""

import math
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.models.apartment import Apartment
from app.repositories.apartment_repo import ApartmentRepository
from app.schemas.apartment import ApartmentCreate, ApartmentUpdate
from app.schemas.common import PaginatedResponse

logger = get_logger(__name__)


class ApartmentService:
    """Business logic for apartment management."""

    def __init__(self, session: AsyncSession):
        self.repo = ApartmentRepository(session)

    async def create(self, data: ApartmentCreate) -> Apartment:
        """Create a new apartment."""
        # Check for duplicate unit_number on the same floor
        stmt = select(Apartment).where(
            Apartment.floor_id == data.floor_id,
            Apartment.unit_number == data.unit_number,
            Apartment.is_active.is_(True),
        )
        existing = (await self.repo.session.execute(stmt)).scalar_one_or_none()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Căn hộ số {data.unit_number} đã tồn tại trên tầng này.",
            )

        apartment = Apartment(**data.model_dump())
        result = await self.repo.create(apartment)
        logger.info(
            "apartment_created",
            apartment_id=str(result.id),
            unit_number=result.unit_number,
        )
        return result

    async def get_by_id(self, id: UUID) -> Apartment | None:
        """Get an apartment by ID."""
        return await self.repo.get_by_id(id)

    async def list(
        self,
        page: int = 1,
        page_size: int = 20,
        floor_id: UUID | None = None,
    ) -> PaginatedResponse:
        """List apartments with pagination and optional floor filter."""
        offset = (page - 1) * page_size
        filters = [Apartment.is_active.is_(True)]
        if floor_id:
            filters.append(Apartment.floor_id == floor_id)

        items = await self.repo.get_all(offset=offset, limit=page_size, filters=filters)
        total = await self.repo.count(filters=filters)
        return PaginatedResponse(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=math.ceil(total / page_size) if page_size > 0 else 0,
        )

    async def update(self, id: UUID, data: ApartmentUpdate) -> Apartment | None:
        """Update an apartment."""
        apartment = await self.repo.get_by_id(id)
        if not apartment:
            return None
        update_data = data.model_dump(exclude_unset=True)
        if not update_data:
            return apartment

        if "unit_number" in update_data or "floor_id" in update_data:
            target_floor_id = update_data.get("floor_id", apartment.floor_id)
            target_unit = update_data.get("unit_number", apartment.unit_number)
            stmt = select(Apartment).where(
                Apartment.floor_id == target_floor_id,
                Apartment.unit_number == target_unit,
                Apartment.id != id,
                Apartment.is_active.is_(True),
            )
            existing = (await self.repo.session.execute(stmt)).scalar_one_or_none()
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Căn hộ số {target_unit} đã tồn tại trên tầng này.",
                )

        result = await self.repo.update(apartment, update_data)
        logger.info("apartment_updated", apartment_id=str(id))
        return result

    async def delete(self, id: UUID) -> Apartment | None:
        """Soft-delete an apartment."""
        apartment = await self.repo.get_by_id(id)
        if not apartment:
            return None
        result = await self.repo.soft_delete(apartment)
        logger.info("apartment_deleted", apartment_id=str(id))
        return result
