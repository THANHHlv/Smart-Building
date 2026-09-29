"""Connection-only retries must never replay an application transaction."""

import asyncio
import ssl
from unittest.mock import AsyncMock, MagicMock

import asyncpg
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.pool import NullPool

from app.core.config import Settings
from app.core import database
from app.main import app


def iam_config(**kwargs):
    return Settings(_env_file=None, postgres_auth_mode="iam",
                    postgres_ssl_root_cert="certs/AmazonRootCA1.pem", **kwargs)


def creator(monkeypatch, **kwargs):
    capture = MagicMock()
    monkeypatch.setattr(database, "create_async_engine", capture)
    database.create_database_engine(iam_config(**kwargs), pool_size=20, max_overflow=10,
                                    pool_pre_ping=True, pool_recycle=300)
    options = capture.call_args.kwargs
    assert options["poolclass"] is NullPool
    assert "pool_size" not in options
    assert "pool_recycle" not in options
    return options["async_creator"]


def mock_tokens(monkeypatch, returncode=0):
    process = MagicMock(returncode=returncode)
    process.communicate = AsyncMock(return_value=(b"synthetic-test-token", None))
    subprocess = AsyncMock(return_value=process)
    monkeypatch.setattr(database.asyncio, "create_subprocess_exec", subprocess)
    return subprocess, process


@pytest.mark.asyncio
async def test_idle_pool_selection():
    for mode, auth, null in [("auto", "iam", True), ("auto", "password", False),
                              ("null", "password", True), ("pooled", "iam", False)]:
        engine = database.create_database_engine(
            Settings(_env_file=None, postgres_auth_mode=auth, postgres_pool_mode=mode,
                     postgres_ssl_root_cert="certs/AmazonRootCA1.pem"))
        assert isinstance(engine.pool, NullPool) is null
        await engine.dispose()


@pytest.mark.asyncio
@pytest.mark.parametrize("error", [TimeoutError(), ConnectionResetError(),
                                    asyncpg.CannotConnectNowError(), asyncpg.TooManyConnectionsError()])
async def test_fresh_token_per_connection_and_retry(monkeypatch, error):
    connect = creator(monkeypatch)
    tokens, _ = mock_tokens(monkeypatch)
    native = AsyncMock(side_effect=[error, object(), object()])
    monkeypatch.setattr(database.asyncpg, "connect", native)
    monkeypatch.setattr(database.asyncio, "sleep", AsyncMock())
    await connect()
    await connect()
    assert native.await_count == tokens.await_count == 3
    assert native.call_args.kwargs["timeout"] == 35
    context = native.call_args.kwargs["ssl"]
    assert context.check_hostname
    assert context.verify_mode == ssl.CERT_REQUIRED


@pytest.mark.asyncio
@pytest.mark.parametrize("error", [asyncpg.InvalidPasswordError(),
                                    asyncpg.InvalidAuthorizationSpecificationError(),
                                    ssl.SSLCertVerificationError(), asyncpg.UndefinedTableError()])
async def test_auth_tls_and_sql_errors_not_retried(monkeypatch, error):
    connect = creator(monkeypatch)
    tokens, _ = mock_tokens(monkeypatch)
    native = AsyncMock(side_effect=error)
    monkeypatch.setattr(database.asyncpg, "connect", native)
    with pytest.raises(type(error)):
        await connect()
    assert tokens.await_count == native.await_count == 1


@pytest.mark.asyncio
async def test_retry_exhaustion_is_bounded_and_sanitized(monkeypatch):
    connect = creator(monkeypatch)
    mock_tokens(monkeypatch)
    native = AsyncMock(side_effect=ConnectionResetError("sensitive error text"))
    monkeypatch.setattr(database.asyncpg, "connect", native)
    monkeypatch.setattr(database.asyncio, "sleep", AsyncMock())
    with pytest.raises(database.DatabaseConnectionUnavailable) as caught:
        await connect()
    assert native.await_count == 3
    assert "sensitive" not in str(caught.value)


@pytest.mark.asyncio
async def test_total_deadline_interrupts_connect(monkeypatch):
    connect = creator(monkeypatch, postgres_connect_budget_seconds=0.02)
    mock_tokens(monkeypatch)
    async def pending(**kwargs):
        await asyncio.Event().wait()
    monkeypatch.setattr(database.asyncpg, "connect", pending)
    with pytest.raises(database.DatabaseConnectionUnavailable, match="timed out"):
        await asyncio.wait_for(connect(), timeout=1)


@pytest.mark.asyncio
async def test_token_process_cleaned_up_on_cancellation(monkeypatch):
    connect = creator(monkeypatch)
    _, process = mock_tokens(monkeypatch)
    process.returncode = None
    started = asyncio.Event()
    async def wait_for_token():
        started.set()
        await asyncio.Event().wait()
    calls = 0
    async def communicate():
        nonlocal calls
        calls += 1
        if calls == 1:
            return await wait_for_token()
        return b"", None
    process.communicate.side_effect = communicate
    task = asyncio.create_task(connect())
    await started.wait()
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task
    process.kill.assert_called_once()
    assert calls == 2


@pytest.mark.asyncio
async def test_cli_auth_failure_does_not_connect_or_retry(monkeypatch):
    connect = creator(monkeypatch)
    tokens, _ = mock_tokens(monkeypatch, returncode=1)
    native = AsyncMock()
    monkeypatch.setattr(database.asyncpg, "connect", native)
    with pytest.raises(RuntimeError, match="IAM token generation failed"):
        await connect()
    assert tokens.await_count == 1
    native.assert_not_awaited()


@pytest.mark.asyncio
async def test_liveness_metrics_do_not_connect_and_resume_failure_returns_503(monkeypatch):
    factory = MagicMock(side_effect=AssertionError("must not connect"))
    monkeypatch.setattr(database, "async_session_factory", factory)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        for path in ("/health", "/metrics"):
            assert (await client.get(path)).status_code == 200
    factory.assert_not_called()
    from app.main import create_app
    isolated = create_app()
    @isolated.get("/connection-test")
    async def failing():
        raise database.DatabaseConnectionUnavailable("Database connection unavailable")
    async with AsyncClient(transport=ASGITransport(app=isolated), base_url="http://test") as client:
        response = await client.get("/connection-test")
    assert response.status_code == 503
    assert "temporarily unavailable" in response.json()["detail"]


@pytest.mark.asyncio
async def test_commit_failure_not_replayed(monkeypatch):
    session = AsyncMock()
    session.__aenter__.return_value = session
    session.commit.side_effect = ConnectionResetError("commit outcome unknown")
    factory = MagicMock(return_value=session)
    monkeypatch.setattr(database, "async_session_factory", factory)
    dependency = database.get_db()
    assert await dependency.__anext__() is session
    with pytest.raises(ConnectionResetError):
        await dependency.__anext__()
    assert session.commit.await_count == 1
    assert factory.call_count == 1
    session.rollback.assert_awaited_once()
    session.close.assert_awaited_once()


@pytest.mark.asyncio
@pytest.mark.parametrize("fails", [False, True])
async def test_readiness_rolls_back_without_committing(fails):
    from fastapi import Response
    from app.api.v1.health import readiness_check
    session = AsyncMock()
    if fails:
        session.execute.side_effect = ConnectionError("unavailable")
    response = Response()
    result = await readiness_check(response, session)
    assert result.database == ("unavailable" if fails else "connected")
    assert response.status_code == (503 if fails else 200)
    session.rollback.assert_awaited_once()
    session.commit.assert_not_awaited()


@pytest.mark.asyncio
async def test_startup_does_not_touch_database_and_business_crons_remain(monkeypatch):
    from apscheduler.schedulers import asyncio as scheduler_module
    from app import main
    from app.core import kafka_bus
    from app.services import notification_consumer, ticket_consumer, billing_engine
    scheduler = MagicMock()
    monkeypatch.setattr(scheduler_module, "AsyncIOScheduler", MagicMock(return_value=scheduler))
    for module, getter in [(kafka_bus, "get_event_bus"),
                           (notification_consumer, "get_notification_consumer"),
                           (ticket_consumer, "get_ticket_consumer")]:
        monkeypatch.setattr(module, getter, MagicMock(return_value=AsyncMock()))
    session = AsyncMock()
    session.__aenter__.return_value = session
    factory = MagicMock(return_value=session)
    monkeypatch.setattr(database, "async_session_factory", factory)
    billing = MagicMock()
    billing.generate_monthly_invoices = AsyncMock(return_value=0)
    billing.check_overdue_invoices = AsyncMock(return_value=0)
    monkeypatch.setattr(billing_engine, "BillingEngine", MagicMock(return_value=billing))
    async with main.lifespan(app):
        factory.assert_not_called()
        jobs = scheduler.add_job.call_args_list
        assert len(jobs) == 2
        assert jobs[0].args[1] == jobs[1].args[1] == "cron"
        assert jobs[0].kwargs["day"] == main.settings.billing_engine_cron_day
        assert jobs[0].kwargs["hour"] == main.settings.billing_engine_cron_hour
        assert jobs[1].kwargs["hour"] == 8
        for job in jobs:
            await job.args[0]()
    assert session.commit.await_count == 2
    billing.generate_monthly_invoices.assert_awaited_once()
    billing.check_overdue_invoices.assert_awaited_once()
