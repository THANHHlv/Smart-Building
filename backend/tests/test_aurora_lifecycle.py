"""Verify physical PostgreSQL sessions disappear after NullPool checkin."""

from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.core.config import Settings
from app.core.database import create_database_engine
from tests.conftest import TEST_DATABASE_URL, test_engine


@pytest.mark.asyncio
async def test_null_pool_releases_postgres_connection_after_transaction():
    url = make_url(TEST_DATABASE_URL)
    name = f"aurora-idle-test-{uuid4().hex}"
    config = Settings(_env_file=None, postgres_host=url.host, postgres_port=url.port or 5432,
                      postgres_user=url.username, postgres_password=url.password or "",
                      postgres_db=url.database, postgres_pool_mode="null")
    engine = create_database_engine(config, connect_args={"server_settings": {"application_name": name}})
    factory = async_sessionmaker(engine)
    try:
        async with test_engine.connect() as observer:
            async with factory() as session:
                await session.execute(text("SELECT 1"))
                assert await observer.scalar(text(
                    "SELECT count(*) FROM pg_stat_activity WHERE application_name = :name"
                ), {"name": name}) == 1
                await observer.rollback()  # Release the statistics snapshot.
                await session.commit()
            assert await observer.scalar(text(
                "SELECT count(*) FROM pg_stat_activity WHERE application_name = :name"
            ), {"name": name}) == 0
            await observer.rollback()
            # A later request establishes a new connection and still works.
            async with factory() as session:
                assert await session.scalar(text("SELECT 42")) == 42
            assert await observer.scalar(text(
                "SELECT count(*) FROM pg_stat_activity WHERE application_name = :name"
            ), {"name": name}) == 0
    finally:
        await engine.dispose()
