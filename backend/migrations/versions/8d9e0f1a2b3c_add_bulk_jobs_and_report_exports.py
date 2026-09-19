"""Add bulk_jobs, report_exports, and billing_rates tables.

Revision ID: 8d9e0f1a2b3c
Revises: 7c8d9e0f1a2b
Create Date: 2026-09-18 11:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8d9e0f1a2b3c'
down_revision: Union[str, None] = '7c8d9e0f1a2b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. bulk_jobs
    op.create_table(
        'bulk_jobs',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('job_type', sa.String(length=50), nullable=False, comment="invoice_generation | overdue_reminders | manual_confirmations_approval"),
        sa.Column('status', sa.String(length=20), server_default='pending', nullable=False, comment="pending | processing | completed | failed"),
        sa.Column('total_items', sa.Integer(), server_default='0', nullable=False),
        sa.Column('processed_items', sa.Integer(), server_default='0', nullable=False),
        sa.Column('failed_items', sa.Integer(), server_default='0', nullable=False),
        sa.Column('created_by', sa.Uuid(), nullable=True),
        sa.Column('params', sa.JSON(), server_default='{}', nullable=False),
        sa.Column('error_summary', sa.JSON(), server_default='[]', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('finished_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], name=op.f('fk_bulk_jobs_created_by_users'), ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_bulk_jobs')),
    )
    op.create_index(op.f('ix_bulk_jobs_job_type'), 'bulk_jobs', ['job_type'], unique=False)
    op.create_index(op.f('ix_bulk_jobs_status'), 'bulk_jobs', ['status'], unique=False)
    op.create_index(op.f('ix_bulk_jobs_created_at'), 'bulk_jobs', ['created_at'], unique=False)

    # 2. report_exports
    op.create_table(
        'report_exports',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('report_type', sa.String(length=50), nullable=False, comment="collection | overdue | tickets | reconciliation"),
        sa.Column('params', sa.JSON(), server_default='{}', nullable=False),
        sa.Column('format', sa.String(length=10), server_default='xlsx', nullable=False, comment="xlsx | pdf | csv"),
        sa.Column('status', sa.String(length=20), server_default='pending', nullable=False, comment="pending | processing | completed | failed"),
        sa.Column('file_url', sa.String(length=1024), nullable=True),
        sa.Column('file_size_bytes', sa.BigInteger(), server_default='0', nullable=False),
        sa.Column('requested_by', sa.Uuid(), nullable=True),
        sa.Column('requested_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['requested_by'], ['users.id'], name=op.f('fk_report_exports_requested_by_users'), ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_report_exports')),
    )
    op.create_index(op.f('ix_report_exports_report_type'), 'report_exports', ['report_type'], unique=False)
    op.create_index(op.f('ix_report_exports_status'), 'report_exports', ['status'], unique=False)
    op.create_index(op.f('ix_report_exports_requested_at'), 'report_exports', ['requested_at'], unique=False)
    op.create_index(op.f('ix_report_exports_expires_at'), 'report_exports', ['expires_at'], unique=False)

    # 3. billing_rates
    op.create_table(
        'billing_rates',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('building_id', sa.Uuid(), nullable=False),
        sa.Column('water_price_per_m3', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('management_fee_per_sqm', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('parking_fee_per_slot', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('effective_date', sa.Date(), nullable=False),
        sa.Column('created_by', sa.Uuid(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['building_id'], ['buildings.id'], name=op.f('fk_billing_rates_building_id_buildings'), ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], name=op.f('fk_billing_rates_created_by_users'), ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_billing_rates')),
    )
    op.create_index(op.f('ix_billing_rates_building_id'), 'billing_rates', ['building_id'], unique=False)
    op.create_index(op.f('ix_billing_rates_effective_date'), 'billing_rates', ['effective_date'], unique=False)
    op.create_index('ix_billing_rates_lookup', 'billing_rates', ['building_id', 'effective_date'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_billing_rates_lookup', table_name='billing_rates')
    op.drop_index(op.f('ix_billing_rates_effective_date'), table_name='billing_rates')
    op.drop_index(op.f('ix_billing_rates_building_id'), table_name='billing_rates')
    op.drop_table('billing_rates')

    op.drop_index(op.f('ix_report_exports_expires_at'), table_name='report_exports')
    op.drop_index(op.f('ix_report_exports_requested_at'), table_name='report_exports')
    op.drop_index(op.f('ix_report_exports_status'), table_name='report_exports')
    op.drop_index(op.f('ix_report_exports_report_type'), table_name='report_exports')
    op.drop_table('report_exports')

    op.drop_index(op.f('ix_bulk_jobs_created_at'), table_name='bulk_jobs')
    op.drop_index(op.f('ix_bulk_jobs_status'), table_name='bulk_jobs')
    op.drop_index(op.f('ix_bulk_jobs_job_type'), table_name='bulk_jobs')
    op.drop_table('bulk_jobs')
