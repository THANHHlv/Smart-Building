"""
Smart Building Platform — FastAPI Application.

Entry point for the backend service.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.health import router as health_router
from app.api.v1.router import api_v1_router
from app.core.config import get_settings
from app.core.logging import get_logger, setup_logging

settings = get_settings()
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown events."""
    setup_logging()
    logger.info(
        "application_starting",
        app_name=settings.app_name,
        environment=settings.app_env,
    )

    # --- APScheduler: Billing Engine Jobs ---
    scheduler = None
    try:
        from apscheduler.schedulers.asyncio import AsyncIOScheduler
        from app.services.billing_engine import BillingEngine
        from app.core.database import async_session_factory

        scheduler = AsyncIOScheduler()

        async def run_billing_engine():
            """Scheduled job: generate monthly invoices."""
            async with async_session_factory() as session:
                try:
                    engine = BillingEngine(session)
                    count = await engine.generate_monthly_invoices()
                    await session.commit()
                    logger.info("scheduled_billing_complete", invoices_generated=count)
                except Exception:
                    await session.rollback()
                    logger.exception("scheduled_billing_failed")

        async def run_overdue_check():
            """Scheduled job: mark overdue invoices."""
            async with async_session_factory() as session:
                try:
                    engine = BillingEngine(session)
                    count = await engine.check_overdue_invoices()
                    await session.commit()
                    logger.info("scheduled_overdue_check_complete", marked_overdue=count)
                except Exception:
                    await session.rollback()
                    logger.exception("scheduled_overdue_check_failed")

        # Monthly invoice generation: 1st of each month at configured hour
        scheduler.add_job(
            run_billing_engine,
            "cron",
            day=settings.billing_engine_cron_day,
            hour=settings.billing_engine_cron_hour,
            id="billing_engine",
            replace_existing=True,
        )
        # Daily overdue check at 8 AM
        scheduler.add_job(
            run_overdue_check,
            "cron",
            hour=8,
            id="overdue_check",
            replace_existing=True,
        )
        scheduler.start()
        logger.info("billing_scheduler_started")
    except ImportError:
        logger.warning(
            "apscheduler_not_installed",
            detail="APScheduler not installed, skipping billing engine scheduler",
        )
    except Exception:
        logger.exception("billing_scheduler_init_failed")

    # --- Messaging & Event Consumers (Notifications & Tickets) ---
    event_bus = None
    notification_consumer = None
    ticket_consumer = None
    try:
        from app.core.kafka_bus import get_event_bus
        from app.services.notification_consumer import get_notification_consumer
        from app.services.ticket_consumer import get_ticket_consumer

        event_bus = get_event_bus()
        await event_bus.start()

        notification_consumer = get_notification_consumer()
        await notification_consumer.start()

        ticket_consumer = get_ticket_consumer()
        await ticket_consumer.start()
        logger.info("event_pipeline_and_consumers_started")
    except Exception:
        logger.exception("event_pipeline_startup_failed")

    yield

    if ticket_consumer is not None:
        await ticket_consumer.stop()
    if notification_consumer is not None:
        await notification_consumer.stop()
    if event_bus is not None:
        await event_bus.stop()
    if scheduler is not None:
        scheduler.shutdown(wait=False)
    logger.info("application_stopping")



def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(
        title="Smart Building Platform",
        description="REST API for smart building IoT monitoring and management",
        version="0.1.0",
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan,
    )

    # --- CORS ---
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # --- Global exception handler ---
    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        logger.exception(
            "unhandled_exception",
            path=request.url.path,
            method=request.method,
            error=str(exc),
        )
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error"},
        )

    # --- Routers ---
    app.include_router(health_router)
    app.include_router(api_v1_router)

    # --- Static File Serving for Attachments ---
    from pathlib import Path
    from fastapi.staticfiles import StaticFiles

    uploads_dir = Path(settings.ticket_uploads_dir)
    uploads_dir.mkdir(parents=True, exist_ok=True)
    app.mount("/uploads/tickets", StaticFiles(directory=str(uploads_dir)), name="ticket_uploads")


    # --- Prometheus Metrics ---
    try:
        from prometheus_client import CONTENT_TYPE_LATEST, generate_latest
        from fastapi.responses import Response

        @app.get("/metrics")
        @app.get("/metrics/")
        def prometheus_metrics():
            return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)
    except ImportError:
        logger.warning("prometheus_client_not_installed")

    return app


app = create_app()
