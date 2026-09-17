"""Maintenance Ticket API — resident support requests and facility maintenance dispatch."""

import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user, require_admin
from app.core.database import get_db
from app.models.apartment import Apartment
from app.models.floor import Floor
from app.models.maintenance import MaintenanceTicket
from app.models.user import User
from app.schemas.maintenance import (
    MaintenanceTicketCreate,
    MaintenanceTicketResponse,
    MaintenanceTicketUpdate,
)

router = APIRouter(prefix="/maintenance", tags=["Maintenance & Support"])


@router.post("", response_model=MaintenanceTicketResponse, status_code=status.HTTP_201_CREATED)
async def create_maintenance_ticket(
    payload: MaintenanceTicketCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    apartment_id: uuid.UUID | None = None,
):
    """Submit a maintenance or repair ticket. Resident defaults to own apartment."""
    target_apt_id = current_user.apartment_id
    if current_user.role == "admin" and apartment_id:
        target_apt_id = apartment_id

    if not target_apt_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tài khoản của bạn chưa được gán căn hộ để gửi yêu cầu hỗ trợ",
        )

    # Verify apartment
    apt_stmt = (
        select(Apartment)
        .options(selectinload(Apartment.floor).selectinload(Floor.building))
        .where(Apartment.id == target_apt_id)
    )
    apartment = (await db.execute(apt_stmt)).scalar_one_or_none()
    if not apartment:
        raise HTTPException(status_code=404, detail="Apartment not found")

    ticket = MaintenanceTicket(
        apartment_id=target_apt_id,
        user_id=current_user.id,
        title=payload.title,
        description=payload.description,
        category=payload.category,
        urgency=payload.urgency,
        status="open",
        technician_notes=None,
        resolved_at=None,
    )
    db.add(ticket)
    await db.commit()
    await db.refresh(ticket)

    apt_unit = apartment.unit_number
    bld_name = apartment.floor.building.name if apartment.floor and apartment.floor.building else "Skyline Tower"

    return MaintenanceTicketResponse(
        id=ticket.id,
        apartment_id=ticket.apartment_id,
        apartment_unit=apt_unit,
        building_name=bld_name,
        user_id=ticket.user_id,
        resident_name=current_user.full_name or "Cư Dân",
        title=ticket.title,
        description=ticket.description,
        category=ticket.category,
        urgency=ticket.urgency,
        status=ticket.status,
        technician_notes=ticket.technician_notes,
        resolved_at=ticket.resolved_at,
        created_at=ticket.created_at,
        updated_at=ticket.updated_at,
    )


@router.get("", response_model=list[MaintenanceTicketResponse])
async def list_maintenance_tickets(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    status_filter: str | None = Query(default=None, alias="status"),
    category_filter: str | None = Query(default=None, alias="category"),
):
    """List tickets: Resident sees only their apartment tickets; Admin sees all building tickets."""
    stmt = (
        select(MaintenanceTicket)
        .options(
            selectinload(MaintenanceTicket.apartment)
            .selectinload(Apartment.floor)
            .selectinload(Floor.building),
            selectinload(MaintenanceTicket.user),
        )
        .order_by(MaintenanceTicket.created_at.desc())
    )

    if current_user.role != "admin":
        if not current_user.apartment_id:
            return []
        stmt = stmt.where(MaintenanceTicket.apartment_id == current_user.apartment_id)

    if status_filter:
        stmt = stmt.where(MaintenanceTicket.status == status_filter)

    if category_filter:
        stmt = stmt.where(MaintenanceTicket.category == category_filter)

    result = await db.execute(stmt)
    tickets = result.scalars().all()

    items = []
    for t in tickets:
        apt_unit = t.apartment.unit_number if t.apartment else None
        bld_name = (
            t.apartment.floor.building.name
            if t.apartment and t.apartment.floor and t.apartment.floor.building
            else None
        )
        res_name = t.user.full_name if t.user else None

        items.append(
            MaintenanceTicketResponse(
                id=t.id,
                apartment_id=t.apartment_id,
                apartment_unit=apt_unit,
                building_name=bld_name,
                user_id=t.user_id,
                resident_name=res_name,
                title=t.title,
                description=t.description,
                category=t.category,
                urgency=t.urgency,
                status=t.status,
                technician_notes=t.technician_notes,
                resolved_at=t.resolved_at,
                created_at=t.created_at,
                updated_at=t.updated_at,
            )
        )

    return items


@router.put("/{ticket_id}", response_model=MaintenanceTicketResponse)
async def update_maintenance_ticket(
    ticket_id: uuid.UUID,
    payload: MaintenanceTicketUpdate,
    _admin: Annotated[User, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Update ticket status or add technician notes. Admin only."""
    stmt = (
        select(MaintenanceTicket)
        .options(
            selectinload(MaintenanceTicket.apartment)
            .selectinload(Apartment.floor)
            .selectinload(Floor.building),
            selectinload(MaintenanceTicket.user),
        )
        .where(MaintenanceTicket.id == ticket_id)
    )
    ticket = (await db.execute(stmt)).scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail="Maintenance ticket not found")

    if payload.status:
        ticket.status = payload.status
        if payload.status == "resolved":
            ticket.resolved_at = datetime.now(timezone.utc)
        elif payload.status != "resolved":
            ticket.resolved_at = None

    if payload.technician_notes is not None:
        ticket.technician_notes = payload.technician_notes

    await db.commit()

    fetch_stmt = (
        select(MaintenanceTicket)
        .options(
            selectinload(MaintenanceTicket.apartment)
            .selectinload(Apartment.floor)
            .selectinload(Floor.building),
            selectinload(MaintenanceTicket.user),
        )
        .where(MaintenanceTicket.id == ticket_id)
    )
    ticket_refreshed = (await db.execute(fetch_stmt)).scalar_one()

    apt_unit = ticket_refreshed.apartment.unit_number if ticket_refreshed.apartment else None
    bld_name = (
        ticket_refreshed.apartment.floor.building.name
        if ticket_refreshed.apartment and ticket_refreshed.apartment.floor and ticket_refreshed.apartment.floor.building
        else None
    )
    res_name = ticket_refreshed.user.full_name if ticket_refreshed.user else None


    return MaintenanceTicketResponse(
        id=ticket.id,
        apartment_id=ticket.apartment_id,
        apartment_unit=apt_unit,
        building_name=bld_name,
        user_id=ticket.user_id,
        resident_name=res_name,
        title=ticket.title,
        description=ticket.description,
        category=ticket.category,
        urgency=ticket.urgency,
        status=ticket.status,
        technician_notes=ticket.technician_notes,
        resolved_at=ticket.resolved_at,
        created_at=ticket.created_at,
        updated_at=ticket.updated_at,
    )
