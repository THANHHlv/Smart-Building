"""Payment Methods API — manage saved payment methods for a user."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.core.logging import get_logger
from app.models.payment_method import PaymentMethod, PaymentProvider
from app.models.user import User
from app.repositories.payment_method_repo import PaymentMethodRepository
from app.schemas.payment import PaymentMethodCreate, PaymentMethodResponse

router = APIRouter(prefix="/payment-methods", tags=["Payment Methods"])
logger = get_logger(__name__)


@router.get("", response_model=list[PaymentMethodResponse])
async def list_payment_methods(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """List all active payment methods for the current user."""
    repo = PaymentMethodRepository(db)
    methods = await repo.get_active_by_user(current_user.id)
    return [PaymentMethodResponse.model_validate(m) for m in methods]


@router.post("", response_model=PaymentMethodResponse, status_code=status.HTTP_201_CREATED)
async def create_payment_method(
    body: PaymentMethodCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Save a new tokenized payment method.

    The token_reference must be a gateway-issued token, never a raw card number.
    """
    # Validate provider
    try:
        provider = PaymentProvider(body.provider)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Nhà cung cấp thanh toán không hợp lệ: {body.provider}",
        )

    repo = PaymentMethodRepository(db)

    # If setting as default, clear existing defaults first
    if body.is_default:
        await repo.clear_default_for_user(current_user.id)

    method = PaymentMethod(
        user_id=current_user.id,
        provider=provider,
        token_reference=body.token_reference,
        display_name=body.display_name,
        is_default=body.is_default,
    )
    created = await repo.create(method)

    logger.info(
        "payment_method_created",
        user_id=str(current_user.id),
        provider=provider.value,
        # DO NOT log token_reference
    )

    return PaymentMethodResponse.model_validate(created)


@router.delete("/{method_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_payment_method(
    method_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Soft-delete a payment method (mark as inactive)."""
    repo = PaymentMethodRepository(db)
    method = await repo.get_by_id(method_id)

    if not method:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Phương thức thanh toán không tồn tại",
        )

    if method.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bạn không có quyền xoá phương thức thanh toán này",
        )

    await repo.soft_delete(method)

    logger.info(
        "payment_method_deleted",
        method_id=str(method_id),
        user_id=str(current_user.id),
    )
