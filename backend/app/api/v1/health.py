"""Health and readiness check endpoints."""

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.common import HealthResponse, ReadinessResponse

router = APIRouter(tags=["Health"])


@router.get("/health", response_model=HealthResponse)
async def health_check():
    """Liveness probe — indicates the process is alive."""
    return HealthResponse(
        status="healthy",
        service="smart-building-backend",
    )


@router.get("/ready", response_model=ReadinessResponse)
async def readiness_check(db: AsyncSession = Depends(get_db)):
    """Readiness probe — checks database connectivity."""
    db_status = "unavailable"
    try:
        await db.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception:
        db_status = "unavailable"

    overall = "ready" if db_status == "connected" else "not_ready"

    return ReadinessResponse(
        status=overall,
        database=db_status,
    )
