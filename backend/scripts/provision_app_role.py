"""Provision an IAM application login without schema or migration privileges.

Run --apply from backend with an administrative database identity. Preview is the
default; --check connects as the runtime login and only audits existing grants.
"""

import argparse
import asyncio
from pathlib import Path
import re
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import text

from app.core.config import get_settings
from app.core.database import create_database_engine
from app.models import Base

ROLE_COMMENT = "Smart Building runtime login; managed by provision_app_role.py"
ROLE_NAME = "smart_building_app"


def quote_identifier(value: str) -> str:
    return '"' + value.replace('"', '""') + '"'


def grant_statements(database: str, role: str, iam: bool = True) -> list[str]:
    if not re.fullmatch(r"smart_building_[a-z0-9_]{1,48}", role):
        raise ValueError("Role must start with smart_building_ and use lowercase letters, digits or underscores")
    target = quote_identifier(role)
    statements = [
        f"GRANT CONNECT ON DATABASE {quote_identifier(database)} TO {target}",
        f"GRANT USAGE ON SCHEMA public TO {target}",
        f"GRANT SELECT ON TABLE public.alembic_version TO {target}",
    ]
    for table in sorted(Base.metadata.tables):
        statements.append(
            f"GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.{quote_identifier(table)} TO {target}"
        )
    if iam:
        statements.append(f"GRANT rds_iam TO {target}")
    return statements


async def validate_app_role(connection, role: str, iam: bool = True) -> None:
    flags = (await connection.execute(text(
        "SELECT rolcanlogin, rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls "
        "FROM pg_roles WHERE rolname = :role"
    ), {"role": role})).mappings().one_or_none()
    if flags is None or not flags["rolcanlogin"] or any(
        flags[key] for key in ("rolsuper", "rolcreatedb", "rolcreaterole", "rolreplication", "rolbypassrls")
    ):
        raise RuntimeError("Application role is missing or has elevated role attributes")
    memberships = (await connection.execute(text(
        "SELECT parent.rolname, membership.admin_option FROM pg_auth_members membership "
        "JOIN pg_roles parent ON parent.oid = membership.roleid "
        "JOIN pg_roles member ON member.oid = membership.member WHERE member.rolname = :role"
    ), {"role": role})).all()
    if any(name != "rds_iam" or admin for name, admin in memberships):
        raise RuntimeError("Application role has unexpected role memberships")
    if iam and not any(name == "rds_iam" for name, _ in memberships):
        raise RuntimeError("Application role is not enabled for IAM authentication")
    owns_objects = await connection.scalar(text(
        "SELECT EXISTS (SELECT 1 FROM pg_class WHERE relowner = (SELECT oid FROM pg_roles WHERE rolname = :role)) "
        "OR EXISTS (SELECT 1 FROM pg_namespace WHERE nspowner = (SELECT oid FROM pg_roles WHERE rolname = :role)) "
        "OR EXISTS (SELECT 1 FROM pg_database WHERE datdba = (SELECT oid FROM pg_roles WHERE rolname = :role))"
    ), {"role": role})
    if owns_objects:
        raise RuntimeError("Application role must not own tables, schemas or databases")
    dangerous = await connection.scalar(text(
        "SELECT has_database_privilege(:role, current_database(), 'CREATE') "
        "OR has_schema_privilege(:role, 'public', 'CREATE')"
    ), {"role": role})
    if dangerous:
        raise RuntimeError("Application role inherits CREATE privileges; review PUBLIC grants before proceeding")
    tables = {table: ("SELECT", "INSERT", "UPDATE", "DELETE") for table in Base.metadata.tables}
    tables["alembic_version"] = ("SELECT",)
    for table, required in tables.items():
        for privilege in ("SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE", "REFERENCES", "TRIGGER"):
            allowed = await connection.scalar(text(
                "SELECT has_table_privilege(:role, :table, :privilege)"
            ), {"role": role, "table": f"public.{quote_identifier(table)}", "privilege": privilege})
            if allowed != (privilege in required):
                raise RuntimeError(f"Unexpected {privilege} privilege on {table}")


async def provision_app_role(connection, role: str = ROLE_NAME, iam: bool = True) -> None:
    database = await connection.scalar(text("SELECT current_database()"))
    statements = grant_statements(database, role, iam)
    existing = (await connection.execute(text(
        "SELECT shobj_description(oid, 'pg_authid') FROM pg_roles WHERE rolname = :role"
    ), {"role": role})).first()
    target = quote_identifier(role)
    if existing:
        if existing[0] != ROLE_COMMENT:
            raise RuntimeError("Refusing to reuse a role not created by this provisioner")
    else:
        await connection.execute(text(
            f"CREATE ROLE {target} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS"
        ))
        await connection.execute(text(f"COMMENT ON ROLE {target} IS '{ROLE_COMMENT}'"))
    for statement in statements:
        await connection.execute(text(statement))
    await validate_app_role(connection, role, iam)


async def main(args) -> None:
    settings = get_settings()
    if not args.apply and not args.check:
        statements = grant_statements(settings.postgres_db, args.role)
        print(f"Runtime role: {args.role}; no database changes. Use --apply to provision.")
        print(f"CREATE ROLE {quote_identifier(args.role)} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;")
        print(";\n".join(statements) + ";")
        return
    if settings.postgres_auth_mode != "iam":
        raise RuntimeError("Production provisioning requires POSTGRES_AUTH_MODE=iam")
    engine = create_database_engine(settings)
    try:
        async with engine.begin() as connection:
            if args.check and await connection.scalar(text("SELECT current_user")) != args.role:
                raise RuntimeError("--check must connect as the runtime login being verified")
            # A stale/missing schema must not receive grants or change the application login.
            from alembic.config import Config
            from alembic.script import ScriptDirectory

            expected = set(ScriptDirectory.from_config(Config("alembic.ini")).get_heads())
            actual = set((await connection.execute(text("SELECT version_num FROM alembic_version"))).scalars())
            if actual != expected:
                raise RuntimeError("Migration head mismatch; no role changes applied")
            if args.apply:
                await provision_app_role(connection, args.role)
            else:
                await validate_app_role(connection, args.role)
        print(f"Runtime grants verified for {args.role}; deployment configuration has not been switched.")
    finally:
        await engine.dispose()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--role", default=ROLE_NAME)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--apply", action="store_true")
    mode.add_argument("--check", action="store_true")
    asyncio.run(main(parser.parse_args()))
