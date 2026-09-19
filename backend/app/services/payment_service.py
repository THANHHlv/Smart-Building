"""Payment service — business logic for invoices, transactions, and payment flow.

Coordinates between repositories, the payment gateway abstraction layer,
and the audit log. Never accesses sensor_readings or IoT tables directly.
"""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.models.invoice import Invoice, InvoiceStatus
from app.models.payment_audit_log import PaymentAuditLog
from app.models.payment_method import PaymentProvider
from app.models.transaction import Transaction, TransactionStatus
from app.repositories.invoice_repo import InvoiceRepository
from app.repositories.transaction_repo import TransactionRepository
from app.services.payment_gateway import get_payment_gateway

logger = get_logger(__name__)


class PaymentService:
    """Business logic for payment operations.

    Principle: This service only touches billing/payment tables.
    It has NO direct access to sensor_readings or device tables.
    """

    def __init__(self, session: AsyncSession):
        self.session = session
        self.invoice_repo = InvoiceRepository(session)
        self.txn_repo = TransactionRepository(session)
        self.gateway = get_payment_gateway()

    async def get_invoices(
        self,
        apartment_id: UUID | None = None,
        status: str | None = None,
        offset: int = 0,
        limit: int = 20,
    ) -> list[Invoice]:
        """Get invoices for an apartment (or all apartments if None) with optional status filter."""
        return await self.invoice_repo.get_by_apartment(
            apartment_id=apartment_id,
            status=status,
            offset=offset,
            limit=limit,
        )

    async def get_invoice_detail(self, invoice_id: UUID) -> Invoice | None:
        """Get full invoice detail with items and transactions."""
        return await self.invoice_repo.get_detail(invoice_id)

    async def initiate_payment(
        self,
        invoice_id: UUID,
        user_id: UUID,
        apartment_id: UUID,
        idempotency_key: str,
        ip_address: str,
        return_url: str | None = None,
    ) -> dict:
        """Initiate a payment for an invoice.

        Returns dict with transaction_id, payment_url, and provider.

        Raises:
            ValueError: If invoice not found, not payable, or wrong apartment.
            ConflictError: If idempotency_key already used.
        """
        # 1. Validate invoice exists and belongs to user's apartment
        invoice = await self.invoice_repo.get_detail(invoice_id)
        if not invoice:
            raise ValueError("Invoice not found")

        if invoice.apartment_id != apartment_id:
            raise PermissionError("Invoice does not belong to your apartment")

        if invoice.status not in (InvoiceStatus.PENDING, InvoiceStatus.OVERDUE):
            raise ValueError(
                f"Invoice cannot be paid — current status: {invoice.status.value}"
            )

        # 2. Check idempotency key (prevent double-charge)
        existing_txn = await self.txn_repo.get_by_idempotency_key(idempotency_key)
        if existing_txn:
            # Return the existing transaction result instead of creating new
            logger.info(
                "payment_idempotency_hit",
                idempotency_key=idempotency_key,
                existing_txn_id=str(existing_txn.id),
            )
            if existing_txn.status == TransactionStatus.PENDING:
                # Re-generate payment URL for the same pending transaction
                payment_url = await self.gateway.create_payment_url(
                    transaction_id=str(existing_txn.id),
                    amount=float(invoice.total_amount),
                    description=f"Thanh toán hoá đơn {invoice.invoice_number}",
                    return_url=return_url or "",
                    ip_address=ip_address,
                )
                return {
                    "transaction_id": existing_txn.id,
                    "payment_url": payment_url,
                    "provider": self.gateway.provider_name,
                }
            raise ConflictError(
                f"Idempotency key already used for transaction {existing_txn.id}"
            )

        # 3. Create transaction record
        transaction = Transaction(
            invoice_id=invoice_id,
            provider=PaymentProvider(self.gateway.provider_name),
            idempotency_key=idempotency_key,
            amount=float(invoice.total_amount),
            currency=invoice.currency,
            status=TransactionStatus.PENDING,
        )
        await self.txn_repo.create(transaction)

        # 4. Record audit log
        await self._audit_log(
            transaction_id=transaction.id,
            event_type="payment_initiated",
            new_status=TransactionStatus.PENDING.value,
            actor=str(user_id),
            ip_address=ip_address,
        )

        # 5. Generate payment URL from gateway
        payment_url = await self.gateway.create_payment_url(
            transaction_id=str(transaction.id),
            amount=float(invoice.total_amount),
            description=f"Thanh toán hoá đơn {invoice.invoice_number}",
            return_url=return_url or "",
            ip_address=ip_address,
        )

        logger.info(
            "payment_initiated",
            invoice_id=str(invoice_id),
            transaction_id=str(transaction.id),
            amount=float(invoice.total_amount),
        )

        return {
            "transaction_id": transaction.id,
            "payment_url": payment_url,
            "provider": self.gateway.provider_name,
        }

    async def process_webhook(
        self,
        provider: str,
        payload: dict,
        ip_address: str | None = None,
    ) -> dict:
        """Process a payment gateway webhook/IPN callback.

        1. Verify signature FIRST (reject if invalid)
        2. Parse payload
        3. Find and update transaction
        4. Update invoice if payment succeeded
        5. Record audit trail

        Returns dict with processing result.
        """
        gateway = self.gateway

        # 1. Verify signature — MUST happen before any business logic
        signature = payload.get("vnp_SecureHash", "")
        if not gateway.verify_webhook_signature(payload, signature):
            logger.warning(
                "webhook_signature_invalid",
                provider=provider,
                ip_address=ip_address,
            )
            raise ValueError("Invalid webhook signature")

        # 2. Parse the verified payload
        result = gateway.parse_webhook_payload(payload)

        # 3. Find the transaction by reference
        txn_ref = payload.get("vnp_TxnRef", "")
        transaction = await self.txn_repo.get_by_id(UUID(txn_ref)) if txn_ref else None

        if not transaction:
            logger.warning(
                "webhook_transaction_not_found",
                provider_txn_id=result.provider_txn_id,
                txn_ref=txn_ref,
            )
            return {"status": "transaction_not_found"}

        # 4. Skip if already in a terminal state (idempotent webhook)
        if transaction.status in (
            TransactionStatus.SUCCESS,
            TransactionStatus.REFUNDED,
        ):
            logger.info(
                "webhook_already_processed",
                transaction_id=str(transaction.id),
                current_status=transaction.status.value,
            )
            return {"status": "already_processed"}

        # 5. Update transaction status
        old_status = transaction.status.value
        new_status = TransactionStatus(result.status)

        # 5.1 Verify amount matches expected transaction amount (prevent price tampering)
        if new_status == TransactionStatus.SUCCESS and abs(result.amount - float(transaction.amount)) >= 0.01:
            logger.warning(
                "webhook_amount_mismatch",
                transaction_id=str(transaction.id),
                expected_amount=float(transaction.amount),
                received_amount=result.amount,
                provider=provider,
            )
            transaction.status = TransactionStatus.FAILED
            transaction.provider_response_code = result.response_code
            transaction.provider_message = (
                f"Lỗi sai lệch số tiền: Hoá đơn yêu cầu {float(transaction.amount):,.0f}đ, "
                f"cổng thanh toán phản hồi {result.amount:,.0f}đ"
            )
            await self.session.flush()
            await self._audit_log(
                transaction_id=transaction.id,
                event_type="webhook_amount_mismatch",
                old_status=old_status,
                new_status=TransactionStatus.FAILED.value,
                actor="webhook",
                ip_address=ip_address,
                metadata={
                    "expected_amount": float(transaction.amount),
                    "received_amount": result.amount,
                    "provider": provider,
                },
            )
            return {
                "status": "amount_mismatch",
                "transaction_id": str(transaction.id),
                "expected": float(transaction.amount),
                "received": result.amount,
            }

        transaction.status = new_status
        transaction.provider_txn_id = result.provider_txn_id
        transaction.provider_response_code = result.response_code
        transaction.provider_message = result.message
        await self.session.flush()

        # 6. If payment succeeded, update invoice
        if new_status == TransactionStatus.SUCCESS:
            invoice = await self.invoice_repo.get_by_id(transaction.invoice_id)
            if invoice and invoice.status != InvoiceStatus.PAID:
                invoice.status = InvoiceStatus.PAID
                invoice.paid_at = datetime.now(timezone.utc)
                await self.session.flush()
                logger.info(
                    "invoice_marked_paid",
                    invoice_id=str(invoice.id),
                    invoice_number=invoice.invoice_number,
                )

        # 7. Audit log
        await self._audit_log(
            transaction_id=transaction.id,
            event_type="webhook_processed",
            old_status=old_status,
            new_status=new_status.value,
            actor="webhook",
            ip_address=ip_address,
            metadata={
                "provider": provider,
                "response_code": result.response_code,
                # DO NOT store raw card data or tokens here
            },
        )

        logger.info(
            "webhook_processed",
            transaction_id=str(transaction.id),
            old_status=old_status,
            new_status=new_status.value,
        )

        return {
            "status": "processed",
            "transaction_id": str(transaction.id),
            "new_status": new_status.value,
        }

    async def _audit_log(
        self,
        transaction_id: UUID,
        event_type: str,
        old_status: str | None = None,
        new_status: str | None = None,
        actor: str = "system",
        ip_address: str | None = None,
        metadata: dict | None = None,
    ) -> None:
        """Append an immutable audit log entry."""
        log_entry = PaymentAuditLog(
            transaction_id=transaction_id,
            event_type=event_type,
            old_status=old_status,
            new_status=new_status,
            actor=actor,
            ip_address=ip_address,
            metadata_json=metadata,
        )
        await self.txn_repo.add_audit_log(log_entry)


class ConflictError(Exception):
    """Raised when an idempotency key conflict is detected."""

    pass
