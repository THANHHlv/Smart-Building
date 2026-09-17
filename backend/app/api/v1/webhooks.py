"""Webhook API — payment provider IPN/callback handler.

SECURITY:
- This endpoint is PUBLIC (no JWT authentication required).
- Signature verification MUST happen before any business logic.
- Rate limiting should be applied more strictly than regular endpoints.
- Sensitive payload data (card numbers, tokens) must NEVER be logged.
"""

from fastapi import APIRouter, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import Depends

from app.core.database import get_db
from app.core.logging import get_logger
from app.services.payment_service import PaymentService

router = APIRouter(prefix="/webhooks", tags=["Webhooks (Payment)"])
logger = get_logger(__name__)


@router.post("/payment/{provider}")
async def handle_payment_webhook(
    provider: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Handle payment provider webhook/IPN callback.

    This endpoint:
    1. Verifies the cryptographic signature BEFORE processing
    2. Parses the payload into internal schema
    3. Updates transaction and invoice status
    4. Records an immutable audit log entry

    Supported providers: vnpay, momo, zalopay, stripe
    """
    # Get client IP for audit
    client_ip = request.client.host if request.client else None

    # Parse payload — VNPay sends as query params on GET or form data on POST
    if request.method == "GET":
        payload = dict(request.query_params)
    else:
        # Try form data first (VNPay IPN), then JSON
        content_type = request.headers.get("content-type", "")
        if "form" in content_type:
            form = await request.form()
            payload = dict(form)
        else:
            try:
                payload = await request.json()
            except Exception:
                payload = dict(request.query_params)

    if not payload:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Empty webhook payload",
        )

    logger.info(
        "webhook_received",
        provider=provider,
        ip_address=client_ip,
        # DO NOT log the actual payload — may contain sensitive data
    )

    service = PaymentService(db)

    try:
        result = await service.process_webhook(
            provider=provider,
            payload=payload,
            ip_address=client_ip,
        )
    except ValueError as exc:
        # Signature verification failed
        logger.warning(
            "webhook_rejected",
            provider=provider,
            reason=str(exc),
            ip_address=client_ip,
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid webhook signature",
        )

    # VNPay expects a specific response format
    if provider == "vnpay":
        return {"RspCode": "00", "Message": "Confirm Success"}

    return {"status": "ok", "result": result}
