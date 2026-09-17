"""Pydantic schemas for Resident 'My Services' API."""

import uuid
from datetime import date, datetime
from pydantic import BaseModel, ConfigDict, Field


class MyServiceItem(BaseModel):
    id: uuid.UUID
    name: str
    service_type: str
    is_recurring: bool
    status: str
    started_at: datetime
    auto_pay_enabled: bool
    unit: str
    default_price: float | None = None

    model_config = ConfigDict(from_attributes=True)


class InvoiceSummary(BaseModel):
    total_overdue: float = 0.0
    total_due_soon: float = 0.0
    total_unpaid: float = 0.0
    overdue_count: int = 0
    due_soon_count: int = 0
    nearest_due_date: date | None = None


class BreakdownItem(BaseModel):
    service_type: str
    description: str
    quantity: float | None = None
    unit_price: float | None = None
    amount: float
    formula: str | None = None


class InvoiceBreakdownResponse(BaseModel):
    invoice_id: uuid.UUID
    invoice_number: str
    status: str
    due_date: date
    total_amount: float
    items: list[BreakdownItem]


class ManualConfirmRequest(BaseModel):
    method: str = Field(..., description="cash or bank_transfer")
    note: str | None = None


class ReminderSettingsRequest(BaseModel):
    app_enabled: bool = True
    zalo_enabled: bool = False
    sms_enabled: bool = False
