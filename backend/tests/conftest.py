"""
Test configuration and fixtures.

Uses PostgreSQL (via Docker Compose) for accurate test behavior.
"""

from collections.abc import AsyncGenerator

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.database import get_db
from app.main import app
from app.models.base import Base


import os
from sqlalchemy.engine import URL

from app.core.config import get_settings

settings = get_settings()

TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL",
    URL.create(
        drivername="postgresql+asyncpg",
        username=settings.postgres_user,
        password=settings.postgres_password,
        host=settings.postgres_host,
        port=settings.postgres_port,
        database="smart_building_test",
    ).render_as_string(hide_password=False),
)

from sqlalchemy.pool import NullPool

test_engine = create_async_engine(TEST_DATABASE_URL, poolclass=NullPool, echo=False)
testing_session_factory = async_sessionmaker(
    test_engine, class_=AsyncSession, expire_on_commit=False
)


@pytest_asyncio.fixture(autouse=True)
async def setup_database():
    """Create tables before each test, drop after."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    """Provide a test HTTP client with overridden DB dependency."""

    async def override_get_db():
        async with testing_session_factory() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()
