"""Service Requests API endpoints (Self-service requests extending tickets)."""

from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.service_request import ServiceRequestCreate, ServiceRequestResponse
from app.services.service_request_service import ServiceRequestService

router = APIRouter(tags=["Self-Service Requests"])


@router.post(
    "/service-requests",
    response_model=ServiceRequestResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Cư dân tạo yêu cầu dịch vụ tự phục vụ",
)
async def create_service_request(
    payload: ServiceRequestCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Cư dân gửi yêu cầu dọn vệ sinh, bảo trì định kỳ, gửi xe hoặc cấp lại thẻ."""
    service = ServiceRequestService(db)
    return await service.create_service_request(current_user, payload)


@router.get(
    "/me/service-requests",
    response_model=list[ServiceRequestResponse],
    summary="Danh sách yêu cầu dịch vụ của cư dân",
)
async def list_my_service_requests(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Xem danh sách và tiến độ xử lý các yêu cầu dịch vụ tự phục vụ của căn hộ."""
    service = ServiceRequestService(db)
    return await service.list_resident_service_requests(current_user)
