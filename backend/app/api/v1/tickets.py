"""Ticket / Work Order System API endpoints."""

import os
from pathlib import Path
from typing import Annotated
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_admin, require_permission
from app.core.config import get_settings
from app.core.database import get_db
from app.core.logging import get_logger
from app.models.user import User
from app.schemas.ticket import (
    CategorySlaStat,
    SlaReportResponse,
    TechnicianResponse,
    TicketAssign,
    TicketAttachmentResponse,
    TicketCommentCreate,
    TicketCommentResponse,
    TicketCreate,
    TicketDetailResponse,
    TicketRatingRequest,
    TicketReopenRequest,
    TicketResponse,
    TicketStatusUpdate,
)
from app.services.ticket_service import TicketService

logger = get_logger(__name__)
settings = get_settings()

router = APIRouter(prefix="/tickets", tags=["Tickets & Work Orders"])
admin_router = APIRouter(prefix="/admin/tickets", tags=["Tickets Admin & SLA"])

ALLOWED_MIME_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/jpg",
    "application/pdf",
}
MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB


# ---------------------------------------------------------------------------
# Ticket CRUD & Operations
# ---------------------------------------------------------------------------

@router.post("", response_model=TicketResponse, status_code=status.HTTP_201_CREATED)
async def create_ticket(
    payload: TicketCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Create a new maintenance or repair ticket. Resident defaults to their own apartment."""
    service = TicketService(db)

    # Resident validation: must have apartment
    if current_user.role != "admin" and not current_user.apartment_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tài khoản của bạn chưa được gán căn hộ để gửi yêu cầu hỗ trợ",
        )

    try:
        ticket = await service.create_ticket(payload, creator=current_user)
        # Reload with relationships
        full_ticket = await service.get_ticket_by_id(ticket.id)
        return TicketService.to_response(full_ticket or ticket)
    except Exception as exc:
        logger.exception("create_ticket_failed")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.get("", response_model=list[TicketResponse])
async def list_tickets(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    status: str | None = Query(default=None, description="Filter by status: open, assigned, in_progress, resolved, closed, reopened"),
    category: str | None = Query(default=None, description="Filter by category: electrical, water, elevator, hvac, etc."),
    priority: str | None = Query(default=None, description="Filter by priority: low, medium, high, critical"),
    apartment_id: UUID | None = Query(default=None, description="Admin filter by apartment ID"),
    technician_id: UUID | None = Query(default=None, description="Admin filter by assigned technician ID"),
    limit: int = Query(default=100, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
):
    """List tickets: Residents see only their apartment tickets; Admin/Tech see all building tickets."""
    service = TicketService(db)
    tickets = await service.list_tickets(
        user=current_user,
        status_filter=status,
        category_filter=category,
        priority_filter=priority,
        apartment_id=apartment_id,
        technician_id=technician_id,
        limit=limit,
        offset=offset,
    )
    return [TicketService.to_response(t) for t in tickets]


@router.get("/technicians", response_model=list[TechnicianResponse])
async def list_technicians(
    _user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """List all active technicians available for ticket assignment."""
    service = TicketService(db)
    technicians = await service.list_technicians()

    items = []
    for tech in technicians:
        items.append(
            TechnicianResponse(
                id=tech.id,
                user_id=tech.user_id,
                full_name=tech.user.full_name or tech.user.email,
                email=tech.user.email,
                phone_number=tech.phone_number,
                specialties=tech.specialties or [],
                is_active=tech.is_active,
                active_ticket_count=len(
                    [
                        t
                        for t in (tech.assigned_tickets or [])
                        if t.status in ("assigned", "in_progress", "reopened")
                    ]
                )
                if hasattr(tech, "assigned_tickets") and tech.assigned_tickets
                else 0,
            )
        )
    return items


@router.get("/{ticket_id}", response_model=TicketDetailResponse)
async def get_ticket_detail(
    ticket_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get ticket detail with attachments, comments, and audit status history."""
    service = TicketService(db)
    ticket = await service.get_ticket_by_id(ticket_id)
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy phiếu yêu cầu")

    # Resident security check: cannot view other apartments' tickets
    if current_user.role != "admin" and current_user.role != "technician":
        if ticket.apartment_id and current_user.apartment_id != ticket.apartment_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Không có quyền xem yêu cầu này")

    include_internal = current_user.role in ("admin", "technician")
    return TicketService.to_detail_response(ticket, include_internal=include_internal)


@router.patch("/{ticket_id}/assign", response_model=TicketResponse)
async def assign_technician(
    ticket_id: UUID,
    payload: TicketAssign,
    current_user: Annotated[User, Depends(require_permission("ticket.assign"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Assign technician to ticket. Admin only."""
    service = TicketService(db)
    try:
        ticket = await service.assign_technician(
            ticket_id=ticket_id,
            technician_id=payload.technician_id,
            assigned_by=current_user,
            note=payload.note,
        )
        full_ticket = await service.get_ticket_by_id(ticket.id)
        return TicketService.to_response(full_ticket or ticket)
    except ValueError as val_err:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(val_err))


@router.patch("/{ticket_id}/status", response_model=TicketResponse)
async def update_ticket_status(
    ticket_id: UUID,
    payload: TicketStatusUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Transition ticket state machine status with strict validation and audit note."""
    service = TicketService(db)
    ticket_obj = await service.get_ticket_by_id(ticket_id)
    if not ticket_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy phiếu yêu cầu")

    # Authorization & boundary check
    if current_user.role not in ("admin", "technician"):
        # Resident can only interact with their own apartment's ticket
        if ticket_obj.apartment_id and current_user.apartment_id and ticket_obj.apartment_id != current_user.apartment_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Không có quyền cập nhật trạng thái yêu cầu của căn hộ khác")
        # Resident can only transition from RESOLVED to CLOSED (resident acceptance confirmation)
        if payload.status.lower() != "closed":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cư dân chỉ được phép đóng phiếu đã hoàn thành (closed). Các chuyển đổi trạng thái kỹ thuật yêu cầu kỹ thuật viên hoặc quản trị viên."
            )

    try:
        ticket = await service.update_status(
            ticket_id=ticket_id,
            new_status_str=payload.status,
            user=current_user,
            note=payload.note,
        )
        full_ticket = await service.get_ticket_by_id(ticket.id)
        return TicketService.to_response(full_ticket or ticket)
    except ValueError as val_err:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(val_err))


@router.post("/{ticket_id}/comments", response_model=TicketCommentResponse)
async def add_ticket_comment(
    ticket_id: UUID,
    payload: TicketCommentCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Add a message or internal note to the ticket conversation."""
    service = TicketService(db)
    try:
        comment = await service.add_comment(
            ticket_id=ticket_id,
            user=current_user,
            comment_text=payload.comment,
            is_internal=payload.is_internal,
        )
        return TicketCommentResponse(
            id=comment.id,
            ticket_id=comment.ticket_id,
            author_id=comment.author_id,
            author_name=current_user.full_name or current_user.email,
            author_role=current_user.role,
            comment=comment.comment,
            is_internal=comment.is_internal,
            created_at=comment.created_at,
        )
    except ValueError as val_err:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(val_err))


@router.post("/{ticket_id}/attachments", response_model=TicketAttachmentResponse)
async def upload_attachment(
    ticket_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    file: UploadFile = File(...),
):
    """Upload photo or diagnostic file for the ticket (max 5MB, jpeg/png/webp/pdf)."""
    # 1. Validate content type
    content_type = file.content_type or "application/octet-stream"
    if content_type.lower() not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Định dạng file không hỗ trợ ({content_type}). Cho phép: JPG, PNG, WEBP, PDF",
        )

    # 2. Read and validate file size
    contents = await file.read()
    file_size = len(contents)
    if file_size > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Kích thước file vượt quá giới hạn 5MB (hiện tại: {round(file_size / (1024 * 1024), 2)}MB)",
        )

    # 3. Save to uploads directory
    uploads_dir = Path(settings.ticket_uploads_dir)
    uploads_dir.mkdir(parents=True, exist_ok=True)

    file_ext = Path(file.filename or "photo.jpg").suffix or ".jpg"
    unique_filename = f"{uuid4().hex}{file_ext}"
    dest_path = uploads_dir / unique_filename

    with open(dest_path, "wb") as f:
        f.write(contents)

    file_url = f"/uploads/tickets/{unique_filename}"

    service = TicketService(db)
    try:
        att = await service.add_attachment(
            ticket_id=ticket_id,
            user=current_user,
            file_url=file_url,
            file_name=file.filename or unique_filename,
            file_size=file_size,
            mime_type=content_type,
        )
        return TicketAttachmentResponse(
            id=att.id,
            ticket_id=att.ticket_id,
            file_url=att.file_url,
            file_name=att.file_name,
            file_size=att.file_size,
            mime_type=att.mime_type,
            uploaded_by=att.uploaded_by,
            uploaded_at=att.uploaded_at,
        )
    except ValueError as val_err:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(val_err))


@router.post("/{ticket_id}/rate", response_model=TicketResponse)
async def rate_ticket(
    ticket_id: UUID,
    payload: TicketRatingRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Resident rates completed work order quality (1-5 stars)."""
    service = TicketService(db)
    try:
        ticket = await service.rate_ticket(
            ticket_id=ticket_id,
            resident=current_user,
            rating=payload.rating,
            rating_comment=payload.rating_comment,
        )
        full_ticket = await service.get_ticket_by_id(ticket.id)
        return TicketService.to_response(full_ticket or ticket)
    except ValueError as val_err:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(val_err))


@router.post("/{ticket_id}/reopen", response_model=TicketResponse)
async def reopen_ticket(
    ticket_id: UUID,
    payload: TicketReopenRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Resident reopens an unsatisfactory resolved ticket."""
    service = TicketService(db)
    try:
        ticket = await service.reopen_ticket(
            ticket_id=ticket_id,
            resident=current_user,
            reason=payload.reason,
        )
        full_ticket = await service.get_ticket_by_id(ticket.id)
        return TicketService.to_response(full_ticket or ticket)
    except ValueError as val_err:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(val_err))


# ---------------------------------------------------------------------------
# Admin SLA Report Endpoint
# ---------------------------------------------------------------------------

@admin_router.get("/sla-report", response_model=SlaReportResponse)
async def get_admin_sla_report(
    _admin: Annotated[User, Depends(require_permission("admin.dashboard.read"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get MTTR and SLA resolution statistics grouped by category."""
    service = TicketService(db)
    return await service.get_sla_report()
