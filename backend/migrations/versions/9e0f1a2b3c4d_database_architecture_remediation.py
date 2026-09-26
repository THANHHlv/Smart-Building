"""Database architecture remediation — constraints, numeric precision, and indexes.

Revision ID: 9e0f1a2b3c4d
Revises: 8d9e0f1a2b3c
Create Date: 2026-09-19 22:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "9e0f1a2b3c4d"
down_revision: Union[str, None] = "8d9e0f1a2b3c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. apartments — UNIQUE(floor_id, unit_number) + Float -> Numeric(8, 2)
    op.create_unique_constraint(
        "uq_apartment_floor_unit",
        "apartments",
        ["floor_id", "unit_number"],
    )
    op.alter_column(
        "apartments",
        "area_sqm",
        existing_type=sa.Float(),
        type_=sa.Numeric(precision=8, scale=2),
        existing_nullable=True,
    )

    # 2. energy_consumption & water_consumption — Float -> Numeric(12, 4)
    op.alter_column(
        "energy_consumption",
        "value_kwh",
        existing_type=sa.Float(),
        type_=sa.Numeric(precision=12, scale=4),
        existing_nullable=False,
    )
    op.alter_column(
        "water_consumption",
        "value_liters",
        existing_type=sa.Float(),
        type_=sa.Numeric(precision=12, scale=4),
        existing_nullable=False,
    )

    # 3. billing_cycles — FK RESTRICT + CHECK period_end > period_start
    op.drop_constraint(
        "billing_cycles_apartment_id_fkey",
        "billing_cycles",
        type_="foreignkey",
    )
    op.create_foreign_key(
        "billing_cycles_apartment_id_fkey",
        "billing_cycles",
        "apartments",
        ["apartment_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_check_constraint(
        "ck_billing_cycle_period_range",
        "billing_cycles",
        "period_end > period_start",
    )

    # 4. invoices — FK RESTRICT + CHECK total_amount >= 0
    op.drop_constraint(
        "invoices_apartment_id_fkey",
        "invoices",
        type_="foreignkey",
    )
    op.create_foreign_key(
        "invoices_apartment_id_fkey",
        "invoices",
        "apartments",
        ["apartment_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_check_constraint(
        "ck_invoices_total_amount_positive",
        "invoices",
        "total_amount >= 0",
    )

    # 5. transactions — CHECK amount > 0
    op.create_check_constraint(
        "ck_transactions_amount_positive",
        "transactions",
        "amount > 0",
    )

    # 6. alerts — Missing indexes for dashboard / resident portal
    op.create_index(
        "ix_alerts_device_id",
        "alerts",
        ["device_id"],
        unique=False,
    )
    op.create_index(
        "ix_alerts_apartment_id",
        "alerts",
        ["apartment_id"],
        unique=False,
    )
    op.create_index(
        "ix_alerts_status",
        "alerts",
        ["status"],
        unique=False,
    )

    # 7. sensor_readings — Composite index for dashboard metric time-series
    op.create_index(
        "ix_sensor_readings_metric_timestamp",
        "sensor_readings",
        ["metric", "timestamp"],
        unique=False,
    )

    # 8. tickets — CHECK rating BETWEEN 1 AND 5
    op.create_check_constraint(
        "ck_ticket_rating_range",
        "tickets",
        "rating BETWEEN 1 AND 5",
    )

    # 9. maintenance_tickets — CHECK on urgency and status valid values
    op.create_check_constraint(
        "ck_maintenance_urgency",
        "maintenance_tickets",
        "urgency IN ('low', 'medium', 'high', 'critical')",
    )
    op.create_check_constraint(
        "ck_maintenance_status",
        "maintenance_tickets",
        "status IN ('open', 'in_progress', 'resolved', 'cancelled')",
    )

    # 10. notifications — Unique partial index for idempotency
    op.drop_index("ix_notifications_idempotency_key", table_name="notifications")
    op.create_index(
        "ix_notifications_idempotency_key",
        "notifications",
        ["idempotency_key", "channel"],
        unique=True,
        postgresql_where=sa.text("idempotency_key IS NOT NULL"),
    )


def downgrade() -> None:
    # 10. notifications
    op.drop_index("ix_notifications_idempotency_key", table_name="notifications")
    op.create_index(
        "ix_notifications_idempotency_key",
        "notifications",
        ["idempotency_key"],
        unique=False,
    )

    # 9. maintenance_tickets
    op.drop_constraint("ck_maintenance_status", "maintenance_tickets", type_="check")
    op.drop_constraint("ck_maintenance_urgency", "maintenance_tickets", type_="check")

    # 8. tickets
    op.drop_constraint("ck_ticket_rating_range", "tickets", type_="check")

    # 7. sensor_readings
    op.drop_index("ix_sensor_readings_metric_timestamp", table_name="sensor_readings")

    # 6. alerts
    op.drop_index("ix_alerts_status", table_name="alerts")
    op.drop_index("ix_alerts_apartment_id", table_name="alerts")
    op.drop_index("ix_alerts_device_id", table_name="alerts")

    # 5. transactions
    op.drop_constraint("ck_transactions_amount_positive", "transactions", type_="check")

    # 4. invoices
    op.drop_constraint("ck_invoices_total_amount_positive", "invoices", type_="check")
    op.drop_constraint("invoices_apartment_id_fkey", "invoices", type_="foreignkey")
    op.create_foreign_key(
        "invoices_apartment_id_fkey",
        "invoices",
        "apartments",
        ["apartment_id"],
        ["id"],
        ondelete="CASCADE",
    )

    # 3. billing_cycles
    op.drop_constraint("ck_billing_cycle_period_range", "billing_cycles", type_="check")
    op.drop_constraint("billing_cycles_apartment_id_fkey", "billing_cycles", type_="foreignkey")
    op.create_foreign_key(
        "billing_cycles_apartment_id_fkey",
        "billing_cycles",
        "apartments",
        ["apartment_id"],
        ["id"],
        ondelete="CASCADE",
    )

    # 2. energy_consumption & water_consumption
    op.alter_column(
        "water_consumption",
        "value_liters",
        existing_type=sa.Numeric(precision=12, scale=4),
        type_=sa.Float(),
        existing_nullable=False,
    )
    op.alter_column(
        "energy_consumption",
        "value_kwh",
        existing_type=sa.Numeric(precision=12, scale=4),
        type_=sa.Float(),
        existing_nullable=False,
    )

    # 1. apartments
    op.alter_column(
        "apartments",
        "area_sqm",
        existing_type=sa.Numeric(precision=8, scale=2),
        type_=sa.Float(),
        existing_nullable=True,
    )
    op.drop_constraint("uq_apartment_floor_unit", "apartments", type_="unique")
