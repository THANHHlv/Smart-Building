"""Unit tests deliberately do not provision the integration database."""

import pytest_asyncio


@pytest_asyncio.fixture(autouse=True)
async def setup_database():
    yield
