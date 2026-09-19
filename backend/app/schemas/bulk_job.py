"""Schemas for Bulk Operations and Billing Rates."""

import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class BulkInvoiceGenerateRequest(BaseModel):
    """Request payload for mass invoice generation across apartments."""

    building_id: UUID | None = Field(default=None, description="Tòa nhà cần phát hành, để trống cho tất cả")
    target_date: datetime.date | None = Field(default=None, description="Kỳ tính phí cần phát hành (mặc định tháng hiện tại)")


class BulkReminderSendRequest(BaseModel):
    """Request payload for mass overdue payment reminder notifications."""

    building_id: UUID | None = Field(default=None, description="Lọc theo tòa nhà")
    min_overdue_days: int = Field(default=5, ge=1, description="Số ngày quá hạn tối thiểu để gửi nhắc nhở")
    apartment_ids: list[UUID] | None = Field(default=None, description="Danh sách căn hộ cụ thể (nếu chọn thủ công trên UI)")


class BulkApprovalRequest(BaseModel):
    """Request payload for approving multiple manual payment confirmations."""

    confirmation_ids: list[UUID] = Field(..., min_length=1, description="Danh sách ID xác nhận thanh toán cần duyệt")
    note: str | None = Field(default=None, description="Ghi chú duyệt hàng loạt của kế toán")


class BillingRateUpdateRequest(BaseModel):
    """Request payload for updating tariff schedules with an effective date."""

    building_id: UUID = Field(..., description="Tòa nhà áp dụng biểu giá mới")
    water_price_per_m3: float = Field(..., ge=0, description="Đơn giá nước (VND/m³)")
    management_fee_per_sqm: float = Field(..., ge=0, description="Đơn giá phí quản lý (VND/m² diện tích thông thủy)")
    parking_fee_per_slot: float = Field(default=120000.0, ge=0, description="Đơn giá phí gửi xe cố định mỗi slot (VND/slot)")
    effective_date: datetime.date = Field(..., description="Ngày bắt đầu có hiệu lực của biểu giá")
    note: str | None = Field(default=None, description="Ghi chú điều chỉnh biểu giá")


class BulkJobResponse(BaseModel):
    """Status and progress metadata for an asynchronous bulk job."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    job_type: str
    status: str
    total_items: int
    processed_items: int
    failed_items: int
    created_by: UUID | None
    created_at: datetime.datetime
    finished_at: datetime.datetime | None
    error_summary: list[Any] = Field(default_factory=list)


class BillingRateResponse(BaseModel):
    """Response payload for a versioned billing rate schedule."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    building_id: UUID
    water_price_per_m3: float
    management_fee_per_sqm: float
    parking_fee_per_slot: float
    effective_date: datetime.date
    created_at: datetime.datetime
