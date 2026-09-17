"""Invoice API endpoints — view and pay invoices."""

import math
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import fetch_user_permissions, get_current_user, require_resident
from app.core.database import get_db
from app.core.logging import get_logger
from app.models.user import User
from app.schemas.common import PaginatedResponse
from app.schemas.payment import (
    InvoiceDetail,
    InvoiceListItem,
    PayInvoiceRequest,
    PayInvoiceResponse,
)
from app.services.payment_service import ConflictError, PaymentService

router = APIRouter(prefix="/invoices", tags=["Invoices & Billing"])
logger = get_logger(__name__)


@router.get("", response_model=PaginatedResponse)
async def list_invoices(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    status_filter: str | None = None,
    page: int = 1,
    page_size: int = 20,
):
    """List invoices:

    - Residents see only their own apartment's invoices.
    - Accountants/Admins (with 'invoice.read') can view all invoices.
    - Technicians (without 'invoice.read') are denied access (HTTP 403).
    """
    user_perms = await fetch_user_permissions(current_user, db)
    can_read_all = "invoice.read" in user_perms or "*" in user_perms

    # Least privilege check: technician or non-privileged user without apartment
    if not can_read_all and not current_user.apartment_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bạn không có quyền truy cập thông tin hóa đơn",
        )

    service = PaymentService(db)
    apartment_id = None if can_read_all else current_user.apartment_id

    offset = (page - 1) * page_size
    invoices = await service.get_invoices(
        apartment_id=apartment_id,
        status=status_filter,
        offset=offset,
        limit=page_size,
    )

    items = [InvoiceListItem.model_validate(inv) for inv in invoices]

    return PaginatedResponse(
        items=items,
        total=len(items),
        page=page,
        page_size=page_size,
        total_pages=max(1, math.ceil(len(items) / page_size)) if items else 0,
    )


@router.get("/{invoice_id}", response_model=InvoiceDetail)
async def get_invoice(
    invoice_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get detailed invoice with line items and transaction history."""
    service = PaymentService(db)
    invoice = await service.get_invoice_detail(invoice_id)

    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy hoá đơn",
        )

    user_perms = await fetch_user_permissions(current_user, db)
    can_read_all = "invoice.read" in user_perms or "*" in user_perms

    # Negative test & IDOR protection: resident cannot view another apartment's invoice; technician has no access
    if not can_read_all and invoice.apartment_id != current_user.apartment_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bạn không có quyền xem hoá đơn này",
        )

    return InvoiceDetail.model_validate(invoice)


@router.post("/{invoice_id}/pay", response_model=PayInvoiceResponse)
async def pay_invoice(
    invoice_id: UUID,
    request: Request,
    body: PayInvoiceRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    idempotency_key: Annotated[str, Header(alias="Idempotency-Key")],
):
    """Initiate payment for an invoice.

    Requires the Idempotency-Key header to prevent double-charges on retry.
    Returns a payment URL for redirecting the user to the payment gateway.
    """
    if not current_user.apartment_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tài khoản chưa được gán căn hộ",
        )

    # Get client IP for VNPay
    client_ip = request.client.host if request.client else "127.0.0.1"

    service = PaymentService(db)

    try:
        result = await service.initiate_payment(
            invoice_id=invoice_id,
            user_id=current_user.id,
            apartment_id=current_user.apartment_id,
            idempotency_key=idempotency_key,
            ip_address=client_ip,
            return_url=body.return_url,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )
    except PermissionError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(exc),
        )
    except ConflictError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        )

    return PayInvoiceResponse(
        transaction_id=result["transaction_id"],
        payment_url=result["payment_url"],
        provider=result["provider"],
    )
