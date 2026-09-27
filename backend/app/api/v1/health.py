"""Health and readiness check endpoints."""

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.logging import get_logger
from app.schemas.common import HealthResponse, ReadinessResponse

router = APIRouter(tags=["Health"])
logger = get_logger(__name__)


@router.get("/health", response_model=HealthResponse)
async def health_check():
    """Liveness probe — indicates the process is alive."""
    return HealthResponse(
        status="healthy",
        service="smart-building-backend",
    )


@router.get("/ready", response_model=ReadinessResponse)
async def readiness_check(response: Response, db: AsyncSession = Depends(get_db)):
    """Readiness probe — checks database connectivity."""
    db_status = "unavailable"
    try:
        await db.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception as exc:
        logger.warning("readiness_database_unavailable", error_type=type(exc).__name__)
        db_status = "unavailable"

    overall = "ready" if db_status == "connected" else "not_ready"
    if overall != "ready":
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    return ReadinessResponse(
        status=overall,
        database=db_status,
    )
