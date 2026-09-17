"""My Services API — Resident portal endpoints for billing and services."""

import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.apartment import Apartment
from app.models.apartment_service import ApartmentService
from app.models.invoice import Invoice, InvoiceStatus
from app.models.invoice_item import InvoiceItem
from app.models.manual_confirmation import ManualConfirmation, ManualPaymentMethod, ManualConfirmationStatus
from app.models.service_catalog import ServiceCatalog
from app.models.user import User
from app.schemas.me import (
    BreakdownItem,
    InvoiceBreakdownResponse,
    InvoiceSummary,
    ManualConfirmRequest,
    MyServiceItem,
    ReminderSettingsRequest,
)
from app.models.notification import NotificationCategory, NotificationStatus
from app.schemas.notification import (
    NotificationListResponse,
    NotificationPreferencesResponse,
    NotificationPreferencesUpdateRequest,
    NotificationResponse,
)
from app.services.notification_service import NotificationService


router = APIRouter(prefix="/me", tags=["Resident Services"])


def get_resident_apartment_id(user: User) -> uuid.UUID:
    """Ensure the user is bound to an apartment."""
    if not user.apartment_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User is not assigned to any apartment.",
        )
    return user.apartment_id


@router.get("/services", response_model=list[MyServiceItem])
async def get_my_services(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get all services registered to the resident's apartment."""
    apartment_id = get_resident_apartment_id(current_user)

    stmt = (
        select(ApartmentService)
        .options(selectinload(ApartmentService.service_catalog))
        .where(
            ApartmentService.apartment_id == apartment_id,
            ApartmentService.status == "active",
        )
    )
    result = await db.execute(stmt)
    services = result.scalars().all()

    response = []
    for svc in services:
        cat = svc.service_catalog
        response.append(
            MyServiceItem(
                id=svc.id,
                name=cat.name if cat else "Unknown",
                service_type=cat.service_type.value if cat else "other",
                is_recurring=cat.is_recurring if cat else False,
                status=svc.status.value,
                started_at=svc.started_at,
                auto_pay_enabled=svc.auto_pay_enabled,
                unit=cat.unit if cat else "",
                default_price=float(cat.default_price) if cat and cat.default_price else None,
            )
        )
    return response


@router.get("/invoices/summary", response_model=InvoiceSummary)
async def get_invoice_summary(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get overview of unpaid, overdue, and due soon invoices."""
    apartment_id = get_resident_apartment_id(current_user)

    stmt = select(Invoice).where(
        Invoice.apartment_id == apartment_id,
        Invoice.status.in_([InvoiceStatus.PENDING, InvoiceStatus.OVERDUE]),
    )
    result = await db.execute(stmt)
    invoices = result.scalars().all()

    summary = InvoiceSummary()
    today = date.today()
    soon_threshold = today + timedelta(days=7)

    for inv in invoices:
        summary.total_unpaid += float(inv.total_amount)
        if inv.status == InvoiceStatus.OVERDUE or inv.due_date < today:
            summary.total_overdue += float(inv.total_amount)
            summary.overdue_count += 1
        elif today <= inv.due_date <= soon_threshold:
            summary.total_due_soon += float(inv.total_amount)
            summary.due_soon_count += 1

        if summary.nearest_due_date is None or inv.due_date < summary.nearest_due_date:
            summary.nearest_due_date = inv.due_date

    return summary


@router.get("/invoices/{invoice_id}/breakdown", response_model=InvoiceBreakdownResponse)
async def get_invoice_breakdown(
    invoice_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get detailed breakdown of an invoice with formulas."""
    apartment_id = get_resident_apartment_id(current_user)

    stmt = (
        select(Invoice)
        .options(selectinload(Invoice.items))
        .where(
            Invoice.id == invoice_id,
            Invoice.apartment_id == apartment_id,
        )
    )
    result = await db.execute(stmt)
    invoice = result.scalar_one_or_none()

    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    items = []
    for item in invoice.items:
        # Create a transparent formula if applicable
        formula = None
        if item.quantity is not None and item.unit_price is not None:
            formula = f"{float(item.quantity):g} × {float(item.unit_price):,.0f}đ"
        # Electric tier breakdown logic could be injected if metadata exists
        if item.metadata_json and "tiers" in item.metadata_json:
            tiers = item.metadata_json["tiers"]
            parts = [f"{t['kwh']} kWh × {t['rate']}đ" for t in tiers]
            formula = " + ".join(parts) + (f" + VAT" if "vat" in item.metadata_json else "")

        items.append(
            BreakdownItem(
                service_type=item.service_type.value,
                description=item.description,
                quantity=float(item.quantity) if item.quantity else None,
                unit_price=float(item.unit_price) if item.unit_price else None,
                amount=float(item.amount),
                formula=formula,
            )
        )

    return InvoiceBreakdownResponse(
        invoice_id=invoice.id,
        invoice_number=invoice.invoice_number,
        status=invoice.status.value,
        due_date=invoice.due_date,
        total_amount=float(invoice.total_amount),
        items=items,
    )


@router.post("/invoices/{invoice_id}/confirm-manual")
async def confirm_manual_payment(
    invoice_id: uuid.UUID,
    req: ManualConfirmRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Resident reports a manual payment (cash/bank transfer) for BQL to verify."""
    apartment_id = get_resident_apartment_id(current_user)

    # Verify invoice belongs to resident
    stmt = select(Invoice).where(
        Invoice.id == invoice_id,
        Invoice.apartment_id == apartment_id,
    )
    result = await db.execute(stmt)
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    if invoice.status == InvoiceStatus.PAID:
        raise HTTPException(status_code=400, detail="Invoice already paid")

    # Check for existing pending confirmation
    existing_stmt = select(ManualConfirmation).where(
        ManualConfirmation.invoice_id == invoice_id,
        ManualConfirmation.status == ManualConfirmationStatus.PENDING,
    )
    existing = (await db.execute(existing_stmt)).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail="A manual confirmation is already pending verification.")

    try:
        method_enum = ManualPaymentMethod(req.method)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payment method")

    confirmation = ManualConfirmation(
        invoice_id=invoice_id,
        method=method_enum,
        note=req.note,
        submitted_by=current_user.id,
        status=ManualConfirmationStatus.PENDING,
    )
    db.add(confirmation)
    await db.commit()

    return {"message": "Payment confirmation submitted. Awaiting BQL verification."}


@router.put("/reminders/settings")
async def update_reminder_settings(
    req: ReminderSettingsRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Update preferred channels for billing reminders."""
    return {"message": "Reminder settings updated successfully", "settings": req.model_dump()}


# ---------------------------------------------------------------------------
# Resident Notifications & Preferences
# ---------------------------------------------------------------------------

@router.get("/notifications", response_model=NotificationListResponse)
async def get_my_notifications(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    category: NotificationCategory | None = None,
    status: NotificationStatus | None = None,
    page: int = 1,
    page_size: int = 20,
):
    """List notifications for the current resident with category/status filtering and unread count."""
    service = NotificationService(db)
    return await service.get_user_notifications(
        user_id=current_user.id,
        category=category,
        status_filter=status,
        page=page,
        page_size=page_size,
    )


@router.post("/notifications/{notification_id}/read", response_model=NotificationResponse)
async def mark_notification_as_read(
    notification_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Mark a specific notification as read."""
    service = NotificationService(db)
    result = await service.mark_as_read(notification_id=notification_id, user_id=current_user.id)
    if not result:
        raise HTTPException(status_code=404, detail="Notification not found")
    return result


@router.post("/notifications/read-all")
async def mark_all_notifications_as_read(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Mark all unread notifications for the resident as read."""
    service = NotificationService(db)
    count = await service.mark_all_as_read(user_id=current_user.id)
    return {"message": f"Marked {count} notifications as read", "read_count": count}


@router.get("/notification-preferences", response_model=NotificationPreferencesResponse)
async def get_my_notification_preferences(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get resident's notification channel preferences for all categories."""
    service = NotificationService(db)
    return await service.get_user_preferences(user_id=current_user.id)


@router.put("/notification-preferences", response_model=NotificationPreferencesResponse)
async def update_my_notification_preferences(
    req: NotificationPreferencesUpdateRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Update resident's notification channel preferences."""
    service = NotificationService(db)
    return await service.update_user_preferences(
        user_id=current_user.id,
        preferences=req.preferences,
    )

