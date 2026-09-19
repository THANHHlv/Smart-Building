"""Report Export domain service — generates Excel (.xlsx) and CSV reports."""

import datetime
import os
import uuid
from typing import Any
from uuid import UUID

from fastapi import HTTPException, status
from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import get_settings
from app.core.database import async_session_factory
from app.core.logging import get_logger
from app.models.apartment import Apartment
from app.models.building import Building
from app.models.floor import Floor
from app.models.invoice import Invoice, InvoiceStatus
from app.models.invoice_item import InvoiceItem, ServiceType
from app.models.notification import NotificationCategory, NotificationChannel
from app.models.report_export import ReportExport
from app.models.ticket import Ticket, TicketStatus
from app.models.transaction import Transaction, TransactionStatus
from app.models.user import User
from app.schemas.notification import NotificationEventPayload
from app.schemas.report_export import ReportExportResponse
from app.services.notification_service import NotificationService

logger = get_logger(__name__)
settings = get_settings()

REPORTS_DIR = os.path.join("uploads", "reports")
os.makedirs(REPORTS_DIR, exist_ok=True)


# Styling utilities for openpyxl
HEADER_FILL = PatternFill(start_color="334D3D", end_color="334D3D", fill_type="solid")  # Biophilic Dark Green
HEADER_FONT = Font(name="Segoe UI", size=11, bold=True, color="FFFFFF")
TITLE_FONT = Font(name="Segoe UI", size=15, bold=True, color="2D2825")
SUBTITLE_FONT = Font(name="Segoe UI", size=10, italic=True, color="666666")
TOTAL_FILL = PatternFill(start_color="F2EFE9", end_color="F2EFE9", fill_type="solid")
BOLD_FONT = Font(name="Segoe UI", size=10, bold=True, color="2D2825")
REGULAR_FONT = Font(name="Segoe UI", size=10, color="2D2825")
THIN_BORDER = Border(
    left=Side(style="thin", color="E0DDD5"),
    right=Side(style="thin", color="E0DDD5"),
    top=Side(style="thin", color="E0DDD5"),
    bottom=Side(style="thin", color="E0DDD5"),
)


def _autofit_columns(ws) -> None:
    """Auto-adjust worksheet column widths with safety margins."""
    for col in ws.columns:
        max_len = 0
        col_letter = get_column_letter(col[0].column)
        for cell in col:
            val_str = str(cell.value or "")
            if cell.number_format and "đ" in cell.number_format:
                val_str += " đ"
            max_len = max(max_len, len(val_str))
        ws.column_dimensions[col_letter].width = max(max_len + 4, 12)


class ReportExportService:
    """Generates structured periodic Excel/CSV reports for building management."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_report_export(self, export_id: UUID) -> ReportExport:
        """Fetch report export metadata by ID."""
        stmt = select(ReportExport).where(ReportExport.id == export_id)
        report = (await self.session.execute(stmt)).scalar_one_or_none()
        if not report:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Không tìm thấy báo cáo với mã {export_id}",
            )
        return report

    async def queue_report_export(
        self,
        report_type: str,
        params: dict[str, Any],
        file_format: str,
        user_id: UUID | None,
    ) -> ReportExportResponse:
        """Create a report export task, execute generation, and return download descriptor."""
        export_id = uuid.uuid4()
        now = datetime.datetime.now(datetime.timezone.utc)
        expires_at = now + datetime.timedelta(days=7)  # Retain for 7 days

        report = ReportExport(
            id=export_id,
            report_type=report_type,
            params=params,
            format=file_format,
            status="pending",
            file_url=None,
            requested_by=user_id,
            requested_at=now,
            expires_at=expires_at,
        )
        self.session.add(report)
        await self.session.commit()

        # Generate synchronously or background (here we generate directly to produce instant download)
        try:
            file_url, file_size = await self._generate_report_file(export_id, report_type, params, file_format)
            report.status = "completed"
            report.file_url = file_url
            report.file_size_bytes = file_size
            await self.session.commit()

            # Notify user
            if user_id:
                notif_service = NotificationService(self.session)
                type_labels = {
                    "collection": "Báo cáo thu phí tháng",
                    "overdue": "Báo cáo công nợ căn hộ",
                    "tickets": "Báo cáo bảo trì & ticket",
                    "reconciliation": "Báo cáo đối soát giao dịch",
                }
                event = NotificationEventPayload(
                    user_id=user_id,
                    category=NotificationCategory.BILLING,
                    template_code="report.ready",
                    template_data={"report_type": type_labels.get(report_type, report_type)},
                    title=f"Báo cáo sẵn sàng: {type_labels.get(report_type, report_type)}",
                    body=f"Tệp báo cáo {type_labels.get(report_type, report_type)} (.xlsx) đã được tạo thành công và sẵn sàng tải về.",
                    channels=[NotificationChannel.IN_APP],
                )
                await notif_service.dispatch(event)

        except Exception as e:
            logger.exception("report_export_failed", export_id=str(export_id), error=str(e))
            report.status = "failed"
            await self.session.commit()

        return ReportExportResponse.model_validate(report)

    # -------------------------------------------------------------------------
    # Report File Generators
    # -------------------------------------------------------------------------

    async def _generate_report_file(
        self,
        export_id: UUID,
        report_type: str,
        params: dict[str, Any],
        file_format: str,
    ) -> tuple[str, int]:
        """Dispatch to appropriate generator and save .xlsx file."""
        wb = Workbook()
        wb.remove(wb.active)  # Remove default blank sheet

        if report_type == "collection":
            await self._build_collection_report(wb, params)
        elif report_type == "overdue":
            await self._build_overdue_report(wb, params)
        elif report_type == "tickets":
            await self._build_tickets_report(wb, params)
        elif report_type == "reconciliation":
            await self._build_reconciliation_report(wb, params)
        else:
            raise ValueError(f"Loại báo cáo không hợp lệ: {report_type}")

        filename = f"{report_type}_{export_id.hex[:8]}.xlsx"
        filepath = os.path.join(REPORTS_DIR, filename)
        wb.save(filepath)

        file_size = os.path.getsize(filepath)
        file_url = f"/api/v1/admin/reports/{export_id}/download"
        return file_url, file_size

    # -------------------------------------------------------------------------
    # 1. Collection Report (Báo cáo thu phí tháng)
    # -------------------------------------------------------------------------

    async def _build_collection_report(self, wb: Workbook, params: dict[str, Any]) -> None:
        ws = wb.create_sheet(title="Tổng Hợp Thu Phí")
        ws.views.sheetView[0].showGridLines = True

        # Header Title
        ws["A1"] = "BÁO CÁO THU PHÍ DỊCH VỤ VÀ ĐIỆN NƯỚC"
        ws["A1"].font = TITLE_FONT
        ws["A2"] = f"Thời gian xuất: {datetime.datetime.now().strftime('%d/%m/%Y %H:%M')} | Dự án: Smart Building Cloud Platform"
        ws["A2"].font = SUBTITLE_FONT

        # Table headers
        headers = [
            "Mã Hóa Đơn", "Căn Hộ", "Kỳ Thu Phí", "Hạn Thanh Toán",
            "Điện (VND)", "Nước (VND)", "Phí Quản Lý (VND)", "Gửi Xe (VND)",
            "Tổng Cộng (VND)", "Trạng Thái", "Ngày Thanh Toán", "Hình Thức",
        ]
        ws.append([])  # Row 3 blank
        ws.append(headers)  # Row 4

        for col_num in range(1, len(headers) + 1):
            cell = ws.cell(row=4, column=col_num)
            cell.fill = HEADER_FILL
            cell.font = HEADER_FONT
            cell.alignment = Alignment(horizontal="center", vertical="center")

        # Query Invoices with Apartment and Items
        stmt = (
            select(Invoice)
            .options(
                selectinload(Invoice.apartment),
                selectinload(Invoice.items),
            )
            .order_by(Invoice.created_at.desc())
        )
        if params.get("building_id"):
            b_id = UUID(str(params["building_id"]))
            stmt = stmt.join(Apartment, Invoice.apartment_id == Apartment.id).join(
                Floor, Apartment.floor_id == Floor.id
            ).where(Floor.building_id == b_id)

        invoices = (await self.session.execute(stmt)).scalars().all()

        row_idx = 5
        total_elec = 0.0
        total_water = 0.0
        total_mgmt = 0.0
        total_park = 0.0
        grand_total = 0.0

        status_vi = {
            "paid": "Đã thanh toán",
            "issued": "Chờ thanh toán",
            "overdue": "Quá hạn",
            "cancelled": "Đã huỷ",
            "draft": "Bản nháp",
        }

        for inv in invoices:
            elec = sum(float(i.amount) for i in inv.items if i.service_type == ServiceType.ELECTRICITY)
            water = sum(float(i.amount) for i in inv.items if i.service_type == ServiceType.WATER)
            mgmt = sum(float(i.amount) for i in inv.items if i.service_type == ServiceType.MANAGEMENT_FEE)
            park = sum(float(i.amount) for i in inv.items if i.service_type == ServiceType.PARKING)
            total = float(inv.total_amount)

            total_elec += elec
            total_water += water
            total_mgmt += mgmt
            total_park += park
            grand_total += total

            paid_str = inv.paid_at.strftime("%d/%m/%Y") if inv.paid_at else "-"
            method_str = inv.payment_method.upper() if inv.payment_method else "-"

            row_data = [
                inv.invoice_number,
                inv.apartment.unit_number if inv.apartment else "-",
                inv.period_start.strftime("%m/%Y") if inv.period_start else "-",
                inv.due_date.strftime("%d/%m/%Y") if inv.due_date else "-",
                elec,
                water,
                mgmt,
                park,
                total,
                status_vi.get(inv.status.value, inv.status.value),
                paid_str,
                method_str,
            ]
            ws.append(row_data)

            # Apply borders and formatting
            for c_idx in range(1, len(headers) + 1):
                cell = ws.cell(row=row_idx, column=c_idx)
                cell.font = REGULAR_FONT
                cell.border = THIN_BORDER
                if c_idx in (5, 6, 7, 8, 9):
                    cell.number_format = '#,##0 "đ"'
                    cell.alignment = Alignment(horizontal="right")
                elif c_idx in (1, 2, 3, 4, 10, 11, 12):
                    cell.alignment = Alignment(horizontal="center")

            row_idx += 1

        # Summary Row
        summary_row = ["TỔNG CỘNG", "", "", "", total_elec, total_water, total_mgmt, total_park, grand_total, "", "", ""]
        ws.append(summary_row)
        for c_idx in range(1, len(headers) + 1):
            cell = ws.cell(row=row_idx, column=c_idx)
            cell.font = BOLD_FONT
            cell.fill = TOTAL_FILL
            cell.border = THIN_BORDER
            if c_idx in (5, 6, 7, 8, 9):
                cell.number_format = '#,##0 "đ"'
                cell.alignment = Alignment(horizontal="right")

        _autofit_columns(ws)

    # -------------------------------------------------------------------------
    # 2. Overdue Report (Báo cáo công nợ)
    # -------------------------------------------------------------------------

    async def _build_overdue_report(self, wb: Workbook, params: dict[str, Any]) -> None:
        ws = wb.create_sheet(title="Danh Sách Công Nợ")
        ws.views.sheetView[0].showGridLines = True

        ws["A1"] = "BÁO CÁO THEO DÕI CÔNG NỢ QUÁ HẠN"
        ws["A1"].font = TITLE_FONT
        ws["A2"] = f"Ngày xuất: {datetime.date.today().strftime('%d/%m/%Y')} | Đơn vị: Ban Quản Lý"
        ws["A2"].font = SUBTITLE_FONT

        headers = [
            "STT", "Căn Hộ", "Tên Cư Dân", "Mã Hóa Đơn", "Kỳ Tính Phí",
            "Hạn Thanh Toán", "Số Ngày Quá Hạn", "Số Tiền Nợ (VND)", "Ghi Chú Đôn Đốc"
        ]
        ws.append([])
        ws.append(headers)

        for col_num in range(1, len(headers) + 1):
            cell = ws.cell(row=4, column=col_num)
            cell.fill = HEADER_FILL
            cell.font = HEADER_FONT
            cell.alignment = Alignment(horizontal="center", vertical="center")

        today = datetime.date.today()
        min_overdue = int(params.get("min_overdue_days", 1))
        cutoff = today - datetime.timedelta(days=min_overdue)

        stmt = (
            select(Invoice)
            .options(selectinload(Invoice.apartment))
            .where(
                Invoice.status.in_([InvoiceStatus.PENDING, InvoiceStatus.OVERDUE]),
                Invoice.due_date <= cutoff,
            )
            .order_by(Invoice.due_date.asc())
        )
        if params.get("building_id"):
            b_id = UUID(str(params["building_id"]))
            stmt = stmt.join(Apartment, Invoice.apartment_id == Apartment.id).join(
                Floor, Apartment.floor_id == Floor.id
            ).where(Floor.building_id == b_id)

        overdue_invoices = (await self.session.execute(stmt)).scalars().all()

        row_idx = 5
        stt = 1
        total_debt = 0.0

        for inv in overdue_invoices:
            days = (today - inv.due_date).days if inv.due_date else min_overdue
            debt = float(inv.total_amount)
            total_debt += debt

            ws.append([
                stt,
                inv.apartment.unit_number if inv.apartment else "-",
                inv.apartment.resident_name if (inv.apartment and inv.apartment.resident_name) else "Cư dân",
                inv.invoice_number,
                inv.period_start.strftime("%m/%Y") if inv.period_start else "-",
                inv.due_date.strftime("%d/%m/%Y") if inv.due_date else "-",
                days,
                debt,
                f"Đã quá hạn {days} ngày - Cần gửi công văn" if days > 15 else "Đã gửi thông báo In-App",
            ])

            for c_idx in range(1, len(headers) + 1):
                cell = ws.cell(row=row_idx, column=c_idx)
                cell.font = REGULAR_FONT
                cell.border = THIN_BORDER
                if c_idx == 8:
                    cell.number_format = '#,##0 "đ"'
                    cell.alignment = Alignment(horizontal="right")
                elif c_idx in (1, 2, 4, 5, 6, 7):
                    cell.alignment = Alignment(horizontal="center")

            stt += 1
            row_idx += 1

        # Summary Row
        ws.append(["TỔNG NỢ CẦN THU", "", "", "", "", "", f"{stt - 1} hóa đơn", total_debt, ""])
        for c_idx in range(1, len(headers) + 1):
            cell = ws.cell(row=row_idx, column=c_idx)
            cell.font = BOLD_FONT
            cell.fill = TOTAL_FILL
            cell.border = THIN_BORDER
            if c_idx == 8:
                cell.number_format = '#,##0 "đ"'
                cell.alignment = Alignment(horizontal="right")

        _autofit_columns(ws)

    # -------------------------------------------------------------------------
    # 3. Tickets Report (Báo cáo bảo trì & ticket)
    # -------------------------------------------------------------------------

    async def _build_tickets_report(self, wb: Workbook, params: dict[str, Any]) -> None:
        ws = wb.create_sheet(title="Báo Cáo Kỹ Thuật & Ticket")
        ws.views.sheetView[0].showGridLines = True

        ws["A1"] = "BÁO CÁO XỬ LÝ SỰ CỐ & YÊU CẦU DỊCH VỤ KỸ THUẬT"
        ws["A1"].font = TITLE_FONT
        ws["A2"] = f"Thời gian xuất: {datetime.datetime.now().strftime('%d/%m/%Y %H:%M')}"
        ws["A2"].font = SUBTITLE_FONT

        headers = [
            "Mã Ticket", "Tiêu Đề", "Căn Hộ", "Phân Loại", "Ưu Tiên",
            "Trạng Thái", "Ngày Tạo", "Ngày Hoàn Tất", "Đánh Giá (Sao)", "Nhận Xét Cư Dân"
        ]
        ws.append([])
        ws.append(headers)

        for col_num in range(1, len(headers) + 1):
            cell = ws.cell(row=4, column=col_num)
            cell.fill = HEADER_FILL
            cell.font = HEADER_FONT
            cell.alignment = Alignment(horizontal="center", vertical="center")

        stmt = select(Ticket).options(selectinload(Ticket.apartment)).order_by(Ticket.created_at.desc())
        tickets = (await self.session.execute(stmt)).scalars().all()

        row_idx = 5
        for t in tickets:
            rating_str = f"{t.rating} ⭐" if t.rating else "-"
            resolved_str = t.resolved_at.strftime("%d/%m/%Y %H:%M") if t.resolved_at else "-"

            ws.append([
                str(t.id)[:8].upper(),
                t.title,
                t.apartment.unit_number if t.apartment else "-",
                t.category,
                t.priority.value if hasattr(t.priority, "value") else str(t.priority),
                t.status.value if hasattr(t.status, "value") else str(t.status),
                t.created_at.strftime("%d/%m/%Y %H:%M") if t.created_at else "-",
                resolved_str,
                rating_str,
                t.rating_comment or "-",
            ])

            for c_idx in range(1, len(headers) + 1):
                cell = ws.cell(row=row_idx, column=c_idx)
                cell.font = REGULAR_FONT
                cell.border = THIN_BORDER
                if c_idx in (1, 3, 4, 5, 6, 7, 8, 9):
                    cell.alignment = Alignment(horizontal="center")

            row_idx += 1

        _autofit_columns(ws)

    # -------------------------------------------------------------------------
    # 4. Reconciliation Report (Đối soát giao dịch)
    # -------------------------------------------------------------------------

    async def _build_reconciliation_report(self, wb: Workbook, params: dict[str, Any]) -> None:
        ws = wb.create_sheet(title="Đối Soát Giao Dịch")
        ws.views.sheetView[0].showGridLines = True

        ws["A1"] = "BÁO CÁO ĐỐI SOÁT GIAO DỊCH THANH TOÁN"
        ws["A1"].font = TITLE_FONT
        ws["A2"] = f"Dữ liệu sao kê giao dịch tính đến {datetime.datetime.now().strftime('%d/%m/%Y %H:%M')}"
        ws["A2"].font = SUBTITLE_FONT

        headers = [
            "Mã GD Hệ Thống", "Mã Đối Soát (Gateway Ref)", "Cổng Thanh Toán",
            "Mã Hóa Đơn", "Số Tiền (VND)", "Trạng Thái", "Thời Gian GD"
        ]
        ws.append([])
        ws.append(headers)

        for col_num in range(1, len(headers) + 1):
            cell = ws.cell(row=4, column=col_num)
            cell.fill = HEADER_FILL
            cell.font = HEADER_FONT
            cell.alignment = Alignment(horizontal="center", vertical="center")

        stmt = select(Transaction).options(selectinload(Transaction.invoice)).order_by(Transaction.created_at.desc())
        if params.get("gateway"):
            stmt = stmt.where(Transaction.payment_provider == params["gateway"])

        txns = (await self.session.execute(stmt)).scalars().all()

        row_idx = 5
        total_reconciled = 0.0

        for tx in txns:
            amt = float(tx.amount)
            if tx.status == TransactionStatus.SUCCESS:
                total_reconciled += amt

            inv_no = tx.invoice.invoice_number if tx.invoice else "-"
            prov_str = tx.payment_provider.value if hasattr(tx.payment_provider, "value") else str(tx.payment_provider)
            status_str = tx.status.value if hasattr(tx.status, "value") else str(tx.status)

            ws.append([
                str(tx.id)[:8].upper(),
                tx.gateway_transaction_id or "-",
                prov_str.upper(),
                inv_no,
                amt,
                status_str.upper(),
                tx.created_at.strftime("%d/%m/%Y %H:%M") if tx.created_at else "-",
            ])

            for c_idx in range(1, len(headers) + 1):
                cell = ws.cell(row=row_idx, column=c_idx)
                cell.font = REGULAR_FONT
                cell.border = THIN_BORDER
                if c_idx == 5:
                    cell.number_format = '#,##0 "đ"'
                    cell.alignment = Alignment(horizontal="right")
                elif c_idx in (1, 2, 3, 4, 6, 7):
                    cell.alignment = Alignment(horizontal="center")

            row_idx += 1

        # Summary Row
        ws.append(["TỔNG GIAO DỊCH THÀNH CÔNG", "", "", "", total_reconciled, "", ""])
        for c_idx in range(1, len(headers) + 1):
            cell = ws.cell(row=row_idx, column=c_idx)
            cell.font = BOLD_FONT
            cell.fill = TOTAL_FILL
            cell.border = THIN_BORDER
            if c_idx == 5:
                cell.number_format = '#,##0 "đ"'
                cell.alignment = Alignment(horizontal="right")

        _autofit_columns(ws)
