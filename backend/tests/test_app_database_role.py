"""Verify runtime grants using the isolated PostgreSQL test database."""

from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

from scripts.provision_app_role import provision_app_role, quote_identifier, validate_app_role
from tests.conftest import test_engine


@pytest.mark.asyncio
async def test_runtime_role_can_write_data_but_cannot_change_schema_or_migrations():
    role = "smart_building_test_" + uuid4().hex
    target = quote_identifier(role)
    async with test_engine.connect() as connection:
        async with connection.begin():
            await connection.execute(text("CREATE TABLE alembic_version (version_num varchar(32) PRIMARY KEY)"))
            await connection.execute(text("INSERT INTO alembic_version VALUES ('test_head')"))
            await provision_app_role(connection, role, iam=False)
            # Repeat provisioning must preserve exactly the same runtime grants.
            await provision_app_role(connection, role, iam=False)
            await validate_app_role(connection, role, iam=False)
            await connection.execute(text(f"SET LOCAL ROLE {target}"))
            assert await connection.scalar(text("SELECT version_num FROM alembic_version")) == "test_head"
            building_id = uuid4()
            await connection.execute(text(
                "INSERT INTO buildings (id, name, address, total_floors, is_active) "
                "VALUES (:id, 'Role test', 'Test', 1, true)"
            ), {"id": building_id})
            await connection.execute(text("UPDATE buildings SET name = 'Updated' WHERE id = :id"), {"id": building_id})
            assert await connection.scalar(text("SELECT name FROM buildings WHERE id = :id"), {"id": building_id}) == "Updated"
            await connection.execute(text("DELETE FROM buildings WHERE id = :id"), {"id": building_id})
            for sql in (
                "CREATE TABLE public.forbidden_runtime_table (id integer)",
                "UPDATE alembic_version SET version_num = 'forbidden'",
                "TRUNCATE TABLE buildings",
                "ALTER TABLE buildings ADD COLUMN forbidden integer",
            ):
                async with connection.begin_nested() as savepoint:
                    with pytest.raises(DBAPIError) as failure:
                        await connection.execute(text(sql))
                    assert failure.value.orig.sqlstate == "42501", sql
                    await savepoint.rollback()
            await connection.execute(text("RESET ROLE"))
            await connection.execute(text(f"DROP OWNED BY {target}"))
            await connection.execute(text(f"DROP ROLE {target}"))
            await connection.execute(text("DROP TABLE alembic_version"))


@pytest.mark.asyncio
async def test_provisioner_refuses_to_reuse_an_unmanaged_role():
    role = "smart_building_test_" + uuid4().hex
    target = quote_identifier(role)
    async with test_engine.connect() as connection:
        # Roll back the role creation together with the attempted provisioning.
        transaction = await connection.begin()
        try:
            await connection.execute(text(f"CREATE ROLE {target} LOGIN"))
            with pytest.raises(RuntimeError, match="Refusing to reuse"):
                await provision_app_role(connection, role, iam=False)
        finally:
            await transaction.rollback()
