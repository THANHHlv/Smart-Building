"""
Database initialization and session management.

Provides async SQLAlchemy engine and session factory.
"""

import asyncio
from collections.abc import AsyncGenerator
from pathlib import Path
import ssl

import asyncpg

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import NullPool

from app.core.config import Settings, get_settings
from app.core.logging import get_logger

settings = get_settings()
logger = get_logger(__name__)


class DatabaseConnectionUnavailable(RuntimeError):
    """A bounded connection attempt failed before any application SQL ran."""


def create_database_engine(config: Settings, **kwargs):
    """Create an engine with a fresh IAM token for each new RDS connection."""
    disconnect_idle = config.postgres_pool_mode == "null" or (
        config.postgres_pool_mode == "auto" and config.postgres_auth_mode == "iam"
    )
    if disconnect_idle:
        for option in ("pool_size", "max_overflow", "pool_timeout", "pool_recycle", "pool_pre_ping"):
            kwargs.pop(option, None)
        kwargs["poolclass"] = NullPool
    if config.postgres_auth_mode == "password":
        return create_async_engine(config.database_url, **kwargs)
    if config.postgres_auth_mode != "iam":
        raise ValueError("POSTGRES_AUTH_MODE must be 'password' or 'iam'")
    if not config.postgres_ssl_root_cert:
        raise ValueError("POSTGRES_SSL_ROOT_CERT must point to a CA certificate for IAM mode")
    ca_path = Path(config.postgres_ssl_root_cert)
    if not ca_path.is_absolute():
        ca_path = Path(__file__).resolve().parents[2] / ca_path
    if not ca_path.is_file():
        raise ValueError("POSTGRES_SSL_ROOT_CERT must point to a CA certificate for IAM mode")

    ssl_context = ssl.create_default_context(cafile=str(ca_path))

    async def generate_token():
        process = await asyncio.create_subprocess_exec(
            config.aws_cli_path,
            "rds",
            "generate-db-auth-token",
            "--hostname",
            config.postgres_host,
            "--port",
            str(config.postgres_port),
            "--username",
            config.postgres_user,
            "--region",
            config.aws_region,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.DEVNULL,
        )
        try:
            token_bytes, _ = await asyncio.wait_for(process.communicate(), timeout=15)
        except TimeoutError:
            process.kill()
            await process.communicate()
            raise RuntimeError("IAM token generation timed out") from None
        except asyncio.CancelledError:
            if process.returncode is None:
                process.kill()
            await process.communicate()
            raise
        if process.returncode != 0 or not token_bytes:
            raise RuntimeError("IAM token generation failed; check AWS CLI login")
        return token_bytes.decode("utf-8").strip()

    async def connect_with_iam():
        # Retry connection establishment only. Never replay queries or commits.
        try:
            async with asyncio.timeout(config.postgres_connect_budget_seconds):
                for attempt in range(config.postgres_connect_attempts):
                    token = await generate_token()
                    try:
                        return await asyncpg.connect(
                            host=config.postgres_host,
                            port=config.postgres_port,
                            user=config.postgres_user,
                            database=config.postgres_db,
                            password=token,
                            ssl=ssl_context,
                            timeout=config.postgres_connect_timeout_seconds,
                            server_settings={"application_name": "smart-building-backend"},
                        )
                    except ssl.SSLError:
                        raise  # Certificate/configuration failures are not resume errors.
                    except (
                        OSError,
                        TimeoutError,
                        asyncpg.CannotConnectNowError,
                        asyncpg.TooManyConnectionsError,
                        asyncpg.ConnectionDoesNotExistError,
                        asyncpg.ConnectionFailureError,
                    ) as exc:
                        if attempt + 1 == config.postgres_connect_attempts:
                            raise DatabaseConnectionUnavailable("Database connection unavailable") from None
                        logger.warning("rds_connection_retry", attempt=attempt + 1, error_type=type(exc).__name__)
                        await asyncio.sleep(attempt + 1)
        except TimeoutError:
            raise DatabaseConnectionUnavailable("Database connection timed out") from None

    return create_async_engine(config.database_url, async_creator=connect_with_iam, **kwargs)


engine = create_database_engine(
    settings,
    echo=settings.is_development and settings.postgres_auth_mode != "iam",
    pool_size=20,
    max_overflow=10,
    pool_pre_ping=True,
    pool_recycle=300,
)

async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency that provides an async database session.

    The session is automatically closed after the request completes.
    """
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
