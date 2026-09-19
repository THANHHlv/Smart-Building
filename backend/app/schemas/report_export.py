"""Schemas for periodic report export operations."""

import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class CollectionReportRequest(BaseModel):
    """Filter parameters for Monthly Collection Report."""

    building_id: UUID | None = Field(default=None, description="Lọc theo tòa nhà")
    start_date: datetime.date | None = Field(default=None, description="Từ ngày (mặc định đầu tháng hiện tại)")
    end_date: datetime.date | None = Field(default=None, description="Đến ngày (mặc định ngày hiện tại)")
    format: str = Field(default="xlsx", pattern="^(xlsx|pdf|csv)$", description="Định dạng tệp")


class OverdueReportRequest(BaseModel):
    """Filter parameters for Overdue Debt Report."""

    building_id: UUID | None = Field(default=None, description="Lọc theo tòa nhà")
    min_overdue_days: int = Field(default=1, ge=0, description="Số ngày quá hạn tối thiểu")
    format: str = Field(default="xlsx", pattern="^(xlsx|pdf|csv)$", description="Định dạng tệp")


class TicketsReportRequest(BaseModel):
    """Filter parameters for Maintenance and Support Tickets Report."""

    building_id: UUID | None = Field(default=None, description="Lọc theo tòa nhà")
    start_date: datetime.date | None = Field(default=None, description="Từ ngày")
    end_date: datetime.date | None = Field(default=None, description="Đến ngày")
    format: str = Field(default="xlsx", pattern="^(xlsx|pdf|csv)$", description="Định dạng tệp")


class ReconciliationReportRequest(BaseModel):
    """Filter parameters for Payment Gateway Reconciliation Report."""

    building_id: UUID | None = Field(default=None, description="Lọc theo tòa nhà")
    start_date: datetime.date | None = Field(default=None, description="Từ ngày")
    end_date: datetime.date | None = Field(default=None, description="Đến ngày")
    gateway: str | None = Field(default=None, description="Lọc theo cổng thanh toán (vnpay, momo, bank_transfer, cash)")
    format: str = Field(default="xlsx", pattern="^(xlsx|pdf|csv)$", description="Định dạng tệp")


class ReportExportResponse(BaseModel):
    """Response model representing a generated or queued report export."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    report_type: str
    params: dict[str, Any] = Field(default_factory=dict)
    format: str
    status: str
    file_url: str | None
    file_size_bytes: int = 0
    requested_by: UUID | None
    requested_at: datetime.datetime
    expires_at: datetime.datetime | None
