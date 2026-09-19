"""Admin Report Exports API endpoints."""

import os
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_role
from app.core.database import get_db
from app.models.user import User
from app.schemas.report_export import (
    CollectionReportRequest,
    OverdueReportRequest,
    ReconciliationReportRequest,
    ReportExportResponse,
    TicketsReportRequest,
)
from app.services.report_export_service import ReportExportService

router = APIRouter(prefix="/admin/reports", tags=["Admin Report Exports"])


@router.post(
    "/collection",
    response_model=ReportExportResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Xuất báo cáo thu phí theo tháng",
)
async def export_collection_report(
    payload: CollectionReportRequest,
    current_user: Annotated[User, Depends(require_role("accountant", "building_admin", "super_admin"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Báo cáo tổng thu, số tiền đã phát hành vs đã thu theo từng loại dịch vụ."""
    service = ReportExportService(db)
    return await service.queue_report_export(
        report_type="collection",
        params=payload.model_dump(mode="json"),
        file_format=payload.format,
        user_id=current_user.id,
    )


@router.post(
    "/overdue",
    response_model=ReportExportResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Xuất báo cáo công nợ căn hộ",
)
async def export_overdue_report(
    payload: OverdueReportRequest,
    current_user: Annotated[User, Depends(require_role("accountant", "building_admin", "super_admin"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Báo cáo danh sách căn hộ nợ, số ngày quá hạn và tiền nợ để BQL đôn đốc thu nợ."""
    service = ReportExportService(db)
    return await service.queue_report_export(
        report_type="overdue",
        params=payload.model_dump(mode="json"),
        file_format=payload.format,
        user_id=current_user.id,
    )


@router.post(
    "/tickets",
    response_model=ReportExportResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Xuất báo cáo bảo trì & ticket",
)
async def export_tickets_report(
    payload: TicketsReportRequest,
    current_user: Annotated[User, Depends(require_role("accountant", "building_admin", "super_admin"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Báo cáo thống kê sự cố kỹ thuật, thời gian xử lý trung bình và đánh giá hài lòng của cư dân."""
    service = ReportExportService(db)
    return await service.queue_report_export(
        report_type="tickets",
        params=payload.model_dump(mode="json"),
        file_format=payload.format,
        user_id=current_user.id,
    )


@router.post(
    "/reconciliation",
    response_model=ReportExportResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Xuất báo cáo đối soát giao dịch",
)
async def export_reconciliation_report(
    payload: ReconciliationReportRequest,
    current_user: Annotated[User, Depends(require_role("accountant", "building_admin", "super_admin"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Báo cáo danh sách chi tiết giao dịch qua từng cổng thanh toán để đối soát với sao kê ngân hàng."""
    service = ReportExportService(db)
    return await service.queue_report_export(
        report_type="reconciliation",
        params=payload.model_dump(mode="json"),
        file_format=payload.format,
        user_id=current_user.id,
    )


@router.get(
    "/{export_id}/download",
    summary="Tải về tệp báo cáo đã xuất",
)
async def download_report_file(
    export_id: UUID,
    _current_user: Annotated[User, Depends(require_role("accountant", "building_admin", "super_admin"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Tải tệp báo cáo Excel (.xlsx) đã tạo về máy trạm của kế toán/BQL."""
    service = ReportExportService(db)
    report = await service.get_report_export(export_id=export_id)

    filename = f"{report.report_type}_{report.id.hex[:8]}.xlsx"
    filepath = os.path.join("uploads", "reports", filename)

    if not os.path.exists(filepath):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tệp báo cáo không còn tồn tại trên máy chủ hoặc đã hết hạn.",
        )

    return FileResponse(
        path=filepath,
        filename=filename,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
