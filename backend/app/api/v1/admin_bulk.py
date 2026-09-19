"""Admin Bulk Operations API endpoints."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_role
from app.core.database import get_db
from app.models.user import User
from app.schemas.bulk_job import (
    BillingRateResponse,
    BillingRateUpdateRequest,
    BulkApprovalRequest,
    BulkInvoiceGenerateRequest,
    BulkJobResponse,
    BulkReminderSendRequest,
)
from app.services.bulk_job_service import BulkJobService

router = APIRouter(prefix="/admin", tags=["Admin Bulk Operations"])


@router.post(
    "/bulk/invoices/generate",
    response_model=BulkJobResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Phát hành hóa đơn hàng loạt (Background Job)",
)
async def generate_bulk_invoices(
    payload: BulkInvoiceGenerateRequest,
    current_user: Annotated[User, Depends(require_role("accountant", "building_admin", "super_admin"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Kế toán/BQL phát hành hóa đơn cho toàn bộ căn hộ trong kỳ. Tác vụ chạy nền bất đồng bộ."""
    service = BulkJobService(db)
    return await service.start_bulk_invoice_generation(payload=payload, user_id=current_user.id)


@router.post(
    "/bulk/reminders/send",
    response_model=BulkJobResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Gửi thông báo nhắc nợ hàng loạt (Background Job)",
)
async def send_bulk_reminders(
    payload: BulkReminderSendRequest,
    current_user: Annotated[User, Depends(require_role("accountant", "building_admin", "super_admin"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Gửi thông báo nhắc hạn thanh toán tức thì qua In-App cho nhóm căn hộ nợ quá hạn."""
    service = BulkJobService(db)
    return await service.start_bulk_reminders(payload=payload, user_id=current_user.id)


@router.post(
    "/bulk/manual-confirmations/approve",
    response_model=BulkJobResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Duyệt hàng loạt thanh toán thủ công (Background Job)",
)
async def approve_bulk_manual_confirmations(
    payload: BulkApprovalRequest,
    current_user: Annotated[User, Depends(require_role("accountant", "building_admin", "super_admin"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Kế toán chọn nhiều phiếu thanh toán tiền mặt/chuyển khoản và duyệt đồng loạt."""
    service = BulkJobService(db)
    return await service.start_bulk_manual_approval(payload=payload, user_id=current_user.id)


@router.patch(
    "/billing-rates",
    response_model=BillingRateResponse,
    summary="Cập nhật đơn giá dịch vụ với ngày hiệu lực",
)
async def update_billing_rates(
    payload: BillingRateUpdateRequest,
    current_user: Annotated[User, Depends(require_role("accountant", "building_admin", "super_admin"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Điều chỉnh đơn giá nước, phí quản lý, gửi xe. Chỉ áp dụng cho kỳ tính phí từ ngày hiệu lực trở đi."""
    service = BulkJobService(db)
    return await service.update_billing_rates(payload=payload, user_id=current_user.id)


@router.get(
    "/bulk-jobs/{job_id}",
    response_model=BulkJobResponse,
    summary="Theo dõi tiến độ công việc nền",
)
async def get_bulk_job_progress(
    job_id: UUID,
    _current_user: Annotated[User, Depends(require_role("accountant", "building_admin", "super_admin"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Truy vấn trạng thái, số lượng xử lý và lỗi của một bulk job."""
    service = BulkJobService(db)
    return await service.get_job_status(job_id=job_id)
