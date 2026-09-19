"""Service Request and Amenity Booking domain service."""

import datetime
import uuid
from typing import Sequence

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.apartment import Apartment
from app.models.service_request import Amenity, AmenityBooking, ServiceRequest
from app.models.ticket import (
    Technician,
    Ticket,
    TicketCategory,
    TicketPriority,
    TicketSource,
    TicketStatus,
    TicketStatusHistory,
)
from app.models.user import User
from app.schemas.amenity import (
    AmenityBookingCreate,
    AmenityBookingResponse,
    AmenityResponse,
    AmenitySlotsResponse,
    AmenitySlotStatus,
)
from app.schemas.service_request import ServiceRequestCreate, ServiceRequestResponse


class ServiceRequestService:
    """Handles non-incident service requests and community amenity reservations."""

    def __init__(self, session: AsyncSession):
        self.session = session

    # -------------------------------------------------------------------------
    # Part A.1: Service Requests (Extending Tickets)
    # -------------------------------------------------------------------------

    async def create_service_request(
        self, user: User, payload: ServiceRequestCreate
    ) -> ServiceRequestResponse:
        """Create a proactive service request, creating a ticket in the same transaction."""
        if user.role != "admin":
            if payload.apartment_id and user.apartment_id and payload.apartment_id != user.apartment_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Bạn không có quyền gửi yêu cầu dịch vụ cho căn hộ khác.",
                )
            apartment_id = user.apartment_id
        else:
            apartment_id = payload.apartment_id or user.apartment_id

        if not apartment_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Yêu cầu dịch vụ cần liên kết với một căn hộ cụ thể.",
            )

        # 1. Create underlying Ticket in Ticket System
        ticket_id = uuid.uuid4()
        ticket = Ticket(
            id=ticket_id,
            source=TicketSource.RESIDENT_REPORT,
            apartment_id=apartment_id,
            category=payload.request_type,
            priority=TicketPriority.MEDIUM,
            status=TicketStatus.OPEN,
            title=payload.title,
            description=payload.description,
            created_by=user.id,
        )
        self.session.add(ticket)

        # Initial audit history for ticket
        history = TicketStatusHistory(
            id=uuid.uuid4(),
            ticket_id=ticket_id,
            from_status=None,
            to_status=TicketStatus.OPEN.value,
            changed_by=user.id,
            note=f"Tạo yêu cầu dịch vụ tự phục vụ: {payload.request_type}",
        )
        self.session.add(history)
        await self.session.flush()

        # 2. Create ServiceRequest extension record
        sr_id = uuid.uuid4()
        service_req = ServiceRequest(
            id=sr_id,
            ticket_id=ticket_id,
            request_type=payload.request_type,
            scheduled_at=payload.scheduled_at,
            scheduled_slot=payload.scheduled_slot,
            notes=payload.notes,
        )
        self.session.add(service_req)
        await self.session.commit()

        # 3. Load apartment info for response
        apt_stmt = select(Apartment).where(Apartment.id == apartment_id)
        apt = (await self.session.execute(apt_stmt)).scalar_one_or_none()
        apt_unit = apt.unit_number if apt else None

        return ServiceRequestResponse(
            id=sr_id,
            ticket_id=ticket_id,
            request_type=service_req.request_type,
            scheduled_at=service_req.scheduled_at,
            scheduled_slot=service_req.scheduled_slot,
            notes=service_req.notes,
            created_at=service_req.created_at,
            updated_at=service_req.updated_at,
            ticket_status=ticket.status.value,
            ticket_title=ticket.title,
            ticket_description=ticket.description,
            ticket_priority=ticket.priority.value,
            apartment_unit=apt_unit,
            technician_name=None,
            rating=None,
            rating_comment=None,
        )

    async def list_resident_service_requests(
        self, user: User
    ) -> list[ServiceRequestResponse]:
        """List all service requests submitted by or for the resident's apartment."""
        stmt = (
            select(ServiceRequest)
            .join(Ticket, ServiceRequest.ticket_id == Ticket.id)
            .options(
                selectinload(ServiceRequest.ticket).selectinload(Ticket.apartment),
                selectinload(ServiceRequest.ticket).selectinload(Ticket.technician).selectinload(Technician.user),
            )
        )

        if user.apartment_id:
            stmt = stmt.where(
                (Ticket.created_by == user.id) | (Ticket.apartment_id == user.apartment_id)
            )
        else:
            stmt = stmt.where(Ticket.created_by == user.id)

        stmt = stmt.order_by(ServiceRequest.created_at.desc())
        result = await self.session.execute(stmt)
        requests = result.scalars().all()

        items: list[ServiceRequestResponse] = []
        for r in requests:
            t = r.ticket
            apt_unit = t.apartment.unit_number if t and t.apartment else None
            tech_name = (
                t.technician.user.full_name
                if t and t.technician and t.technician.user
                else None
            )

            items.append(
                ServiceRequestResponse(
                    id=r.id,
                    ticket_id=r.ticket_id,
                    request_type=r.request_type,
                    scheduled_at=r.scheduled_at,
                    scheduled_slot=r.scheduled_slot,
                    notes=r.notes,
                    created_at=r.created_at,
                    updated_at=r.updated_at,
                    ticket_status=t.status.value if t else "open",
                    ticket_title=t.title if t else "",
                    ticket_description=t.description if t else "",
                    ticket_priority=t.priority.value if t else "medium",
                    apartment_unit=apt_unit,
                    technician_name=tech_name,
                    rating=t.rating if t else None,
                    rating_comment=t.rating_comment if t else None,
                )
            )
        return items

    # -------------------------------------------------------------------------
    # Part A.2: Community Amenities & Slot Bookings
    # -------------------------------------------------------------------------

    async def list_amenities(self, building_id: uuid.UUID | None = None) -> list[AmenityResponse]:
        """List active amenities in the building."""
        stmt = select(Amenity).where(Amenity.is_active.is_(True))
        if building_id:
            stmt = stmt.where(Amenity.building_id == building_id)
        stmt = stmt.order_by(Amenity.name.asc())

        result = await self.session.execute(stmt)
        amenities = result.scalars().all()
        return [AmenityResponse.model_validate(a) for a in amenities]

    async def get_available_slots(
        self,
        amenity_id: uuid.UUID,
        booking_date: datetime.date,
        current_user_id: uuid.UUID | None = None,
    ) -> AmenitySlotsResponse:
        """Calculate real-time slot availability for an amenity on a specific date."""
        amenity = (await self.session.execute(
            select(Amenity).where(Amenity.id == amenity_id, Amenity.is_active.is_(True))
        )).scalar_one_or_none()

        if not amenity:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Không tìm thấy tiện ích yêu cầu.",
            )

        # Query active bookings for the specified date
        stmt_bookings = (
            select(AmenityBooking)
            .where(
                AmenityBooking.amenity_id == amenity_id,
                AmenityBooking.booking_date == booking_date,
                AmenityBooking.status.in_(["pending", "confirmed"]),
            )
        )
        res_bookings = await self.session.execute(stmt_bookings)
        active_bookings = {b.time_slot: b for b in res_bookings.scalars().all()}

        slot_statuses: list[AmenitySlotStatus] = []
        for slot in amenity.available_slots:
            booking = active_bookings.get(slot)
            if booking:
                slot_statuses.append(
                    AmenitySlotStatus(
                        time_slot=slot,
                        is_available=False,
                        booking_id=booking.id,
                        status=booking.status,
                        is_own_booking=(booking.user_id == current_user_id if current_user_id else False),
                    )
                )
            else:
                slot_statuses.append(
                    AmenitySlotStatus(
                        time_slot=slot,
                        is_available=True,
                        booking_id=None,
                        status=None,
                        is_own_booking=False,
                    )
                )

        return AmenitySlotsResponse(
            amenity_id=amenity.id,
            amenity_name=amenity.name,
            capacity=amenity.capacity,
            requires_approval=amenity.requires_approval,
            booking_date=booking_date,
            slots=slot_statuses,
        )

    async def create_amenity_booking(
        self,
        amenity_id: uuid.UUID,
        user: User,
        payload: AmenityBookingCreate,
    ) -> AmenityBookingResponse:
        """Book an amenity slot with strict DB-level and pessimistic lock concurrency protection."""
        if user.role != "admin":
            if payload.apartment_id and user.apartment_id and payload.apartment_id != user.apartment_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Bạn không có quyền đặt tiện ích cho căn hộ khác.",
                )
            apartment_id = user.apartment_id
        else:
            apartment_id = payload.apartment_id or user.apartment_id

        if not apartment_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cần liên kết căn hộ để đặt tiện ích tòa nhà.",
            )

        # 1. Pessimistic row locking on the amenity record to serialize concurrent bookings
        stmt_lock = select(Amenity).where(Amenity.id == amenity_id).with_for_update()
        amenity_res = await self.session.execute(stmt_lock)
        amenity = amenity_res.scalar_one_or_none()
        if not amenity or not amenity.is_active:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Không tìm thấy tiện ích hoặc tiện ích đang tạm ngưng hoạt động.",
            )

        # 2. Check if time_slot is valid
        if payload.time_slot not in amenity.available_slots:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Khung giờ '{payload.time_slot}' không thuộc lịch hoạt động của tiện ích.",
            )

        # 3. Check for existing active booking within current locked transaction
        stmt_check = select(AmenityBooking).where(
            AmenityBooking.amenity_id == amenity_id,
            AmenityBooking.booking_date == payload.booking_date,
            AmenityBooking.time_slot == payload.time_slot,
            AmenityBooking.status.in_(["pending", "confirmed"]),
        )
        existing = (await self.session.execute(stmt_check)).scalar_one_or_none()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Khung giờ '{payload.time_slot}' ngày {payload.booking_date} đã có người đặt trước. Vui lòng chọn khung giờ khác.",
            )

        # 4. Insert booking
        booking_status = "pending" if amenity.requires_approval else "confirmed"
        booking_id = uuid.uuid4()
        booking = AmenityBooking(
            id=booking_id,
            amenity_id=amenity_id,
            apartment_id=apartment_id,
            user_id=user.id,
            booking_date=payload.booking_date,
            time_slot=payload.time_slot,
            status=booking_status,
            notes=payload.notes,
        )
        self.session.add(booking)

        # 5. Commit with IntegrityError catch for double-booking race condition
        try:
            await self.session.commit()
        except IntegrityError as exc:
            await self.session.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Khung giờ '{payload.time_slot}' ngày {payload.booking_date} vừa được đặt bởi cư dân khác. Vui lòng chọn khung giờ khác.",
            ) from exc

        # 6. Load apartment and user details for response
        apt = (await self.session.execute(select(Apartment).where(Apartment.id == apartment_id))).scalar_one_or_none()
        return AmenityBookingResponse(
            id=booking.id,
            amenity_id=amenity.id,
            amenity_name=amenity.name,
            apartment_id=apartment_id,
            apartment_unit=apt.unit_number if apt else None,
            user_id=user.id,
            user_name=user.full_name,
            booking_date=booking.booking_date,
            time_slot=booking.time_slot,
            status=booking.status,
            notes=booking.notes,
            created_at=booking.created_at,
        )

    async def cancel_amenity_booking(self, booking_id: uuid.UUID, user: User) -> dict[str, str]:
        """Cancel an existing booking, releasing the slot."""
        stmt = select(AmenityBooking).where(AmenityBooking.id == booking_id)
        booking = (await self.session.execute(stmt)).scalar_one_or_none()

        if not booking:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Không tìm thấy lịch đặt tiện ích.",
            )

        # Permission check: Resident can only cancel their own booking; admin can cancel any
        if user.role != "admin" and booking.user_id != user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Bạn không có quyền huỷ lịch đặt của cư dân khác.",
            )

        if booking.status == "cancelled":
            return {"message": "Lịch đặt đã được huỷ trước đó."}

        booking.status = "cancelled"
        await self.session.commit()
        return {"message": "Đã huỷ lịch đặt tiện ích thành công. Khung giờ đã được giải phóng."}

    async def list_user_amenity_bookings(self, user: User) -> list[AmenityBookingResponse]:
        """List all upcoming and past amenity reservations for the current resident."""
        stmt = (
            select(AmenityBooking)
            .options(
                selectinload(AmenityBooking.amenity),
                selectinload(AmenityBooking.apartment),
                selectinload(AmenityBooking.user),
            )
            .where((AmenityBooking.user_id == user.id) | (AmenityBooking.apartment_id == user.apartment_id))
            .order_by(AmenityBooking.booking_date.desc(), AmenityBooking.created_at.desc())
        )
        res = await self.session.execute(stmt)
        bookings = res.scalars().all()

        return [
            AmenityBookingResponse(
                id=b.id,
                amenity_id=b.amenity_id,
                amenity_name=b.amenity.name if b.amenity else "Tiện ích",
                apartment_id=b.apartment_id,
                apartment_unit=b.apartment.unit_number if b.apartment else None,
                user_id=b.user_id,
                user_name=b.user.full_name if b.user else None,
                booking_date=b.booking_date,
                time_slot=b.time_slot,
                status=b.status,
                notes=b.notes,
                created_at=b.created_at,
            )
            for b in bookings
        ]
