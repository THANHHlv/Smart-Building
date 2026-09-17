"""Payment & Billing Pydantic schemas — request/response models.

These schemas form the public API contract. Never expose SQLAlchemy
models directly to API clients.
"""

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Service Catalog
# ---------------------------------------------------------------------------

class ServiceCatalogItem(BaseModel):
    """A billable service available in the building."""

    code: str
    name: str
    description: str
    unit: str | None = None
    unit_price: float | None = None
    is_metered: bool = False


# ---------------------------------------------------------------------------
# Invoice Items
# ---------------------------------------------------------------------------

class InvoiceItemResponse(BaseModel):
    """Single line item on an invoice."""

    model_config = {"from_attributes": True}

    id: UUID
    service_type: str
    description: str
    quantity: float | None = None
    unit_price: float | None = None
    amount: float
    metadata_json: dict | None = None


# ---------------------------------------------------------------------------
# Transactions
# ---------------------------------------------------------------------------

class TransactionResponse(BaseModel):
    """Payment transaction history entry."""

    model_config = {"from_attributes": True}

    id: UUID
    provider: str
    provider_txn_id: str | None = None
    amount: float
    currency: str = "VND"
    status: str
    provider_response_code: str | None = None
    provider_message: str | None = None
    created_at: datetime


# ---------------------------------------------------------------------------
# Invoices
# ---------------------------------------------------------------------------

class InvoiceListItem(BaseModel):
    """Summary view of an invoice for list endpoints."""

    model_config = {"from_attributes": True}

    id: UUID
    invoice_number: str
    apartment_id: UUID
    total_amount: float
    currency: str = "VND"
    status: str
    due_date: date
    paid_at: datetime | None = None
    created_at: datetime


class InvoiceDetail(BaseModel):
    """Detailed invoice with line items and transactions."""

    model_config = {"from_attributes": True}

    id: UUID
    invoice_number: str
    apartment_id: UUID
    billing_cycle_id: UUID
    total_amount: float
    currency: str = "VND"
    status: str
    due_date: date
    paid_at: datetime | None = None
    notes: str | None = None
    created_at: datetime
    updated_at: datetime
    items: list[InvoiceItemResponse] = []
    transactions: list[TransactionResponse] = []


# ---------------------------------------------------------------------------
# Payment Initiation
# ---------------------------------------------------------------------------

class PayInvoiceRequest(BaseModel):
    """Request body for initiating a payment."""

    return_url: str | None = Field(
        default=None,
        description="URL to redirect after payment completion",
    )


class PayInvoiceResponse(BaseModel):
    """Response containing the payment gateway redirect URL."""

    transaction_id: UUID
    payment_url: str
    provider: str


# ---------------------------------------------------------------------------
# Payment Methods
# ---------------------------------------------------------------------------

class PaymentMethodCreate(BaseModel):
    """Request body for saving a new payment method."""

    provider: str
    token_reference: str
    display_name: str = "Phương thức thanh toán"
    is_default: bool = False


class PaymentMethodResponse(BaseModel):
    """Saved payment method (token only, never raw credentials)."""

    model_config = {"from_attributes": True}

    id: UUID
    provider: str
    display_name: str
    is_default: bool
    is_active: bool
    created_at: datetime


# ---------------------------------------------------------------------------
# Billing Cycle
# ---------------------------------------------------------------------------

class BillingCycleResponse(BaseModel):
    """Billing cycle summary."""

    model_config = {"from_attributes": True}

    id: UUID
    apartment_id: UUID
    period_start: date
    period_end: date
    status: str
    created_at: datetime


# ---------------------------------------------------------------------------
# Webhook (internal)
# ---------------------------------------------------------------------------

class WebhookResult(BaseModel):
    """Parsed result from a payment gateway webhook callback."""

    provider_txn_id: str
    status: str  # Maps to TransactionStatus value
    response_code: str
    message: str
    amount: float | None = None
    raw_data: dict | None = None
