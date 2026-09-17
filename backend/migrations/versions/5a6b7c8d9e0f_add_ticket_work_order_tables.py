"""add_ticket_work_order_tables

Revision ID: 5a6b7c8d9e0f
Revises: 4f3405b4c180
Create Date: 2026-09-17 22:35:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = '5a6b7c8d9e0f'
down_revision: Union[str, None] = '4f3405b4c180'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. technicians
    op.create_table(
        'technicians',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column('specialties', sa.JSON(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('phone_number', sa.String(length=50), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id'),
    )
    op.create_index('ix_technicians_user_id', 'technicians', ['user_id'], unique=False)
    op.create_index('ix_technicians_is_active', 'technicians', ['is_active'], unique=False)

    # 2. tickets
    op.create_table(
        'tickets',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column(
            'source',
            sa.Enum('ai_anomaly', 'resident_report', 'manual_admin', name='ticket_source', native_enum=False),
            nullable=False,
            server_default='resident_report',
        ),
        sa.Column('apartment_id', sa.Uuid(), nullable=True),
        sa.Column('device_id', sa.Uuid(), nullable=True),
        sa.Column('category', sa.String(length=50), nullable=False, server_default='general'),
        sa.Column(
            'priority',
            sa.Enum('low', 'medium', 'high', 'critical', name='ticket_priority', native_enum=False),
            nullable=False,
            server_default='medium',
        ),
        sa.Column(
            'status',
            sa.Enum('open', 'assigned', 'in_progress', 'resolved', 'closed', 'reopened', name='ticket_status', native_enum=False),
            nullable=False,
            server_default='open',
        ),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('created_by', sa.Uuid(), nullable=True),
        sa.Column('assigned_to', sa.Uuid(), nullable=True),
        sa.Column('due_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('closed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('rating', sa.Integer(), nullable=True),
        sa.Column('rating_comment', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['apartment_id'], ['apartments.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['device_id'], ['devices.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['assigned_to'], ['technicians.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_tickets_apartment_id', 'tickets', ['apartment_id'], unique=False)
    op.create_index('ix_tickets_device_id', 'tickets', ['device_id'], unique=False)
    op.create_index('ix_tickets_status', 'tickets', ['status'], unique=False)
    op.create_index('ix_tickets_priority', 'tickets', ['priority'], unique=False)
    op.create_index('ix_tickets_category', 'tickets', ['category'], unique=False)
    op.create_index('ix_tickets_assigned_to', 'tickets', ['assigned_to'], unique=False)
    op.create_index('ix_tickets_created_at', 'tickets', ['created_at'], unique=False)
    op.create_index('ix_tickets_due_at', 'tickets', ['due_at'], unique=False)

    # 3. ticket_attachments
    op.create_table(
        'ticket_attachments',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('ticket_id', sa.Uuid(), nullable=False),
        sa.Column('file_url', sa.String(length=1024), nullable=False),
        sa.Column('file_name', sa.String(length=255), nullable=False),
        sa.Column('file_size', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('mime_type', sa.String(length=100), nullable=False, server_default='image/jpeg'),
        sa.Column('uploaded_by', sa.Uuid(), nullable=True),
        sa.Column('uploaded_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['ticket_id'], ['tickets.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['uploaded_by'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_ticket_attachments_ticket_id', 'ticket_attachments', ['ticket_id'], unique=False)

    # 4. ticket_comments
    op.create_table(
        'ticket_comments',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('ticket_id', sa.Uuid(), nullable=False),
        sa.Column('author_id', sa.Uuid(), nullable=True),
        sa.Column('comment', sa.Text(), nullable=False),
        sa.Column('is_internal', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['ticket_id'], ['tickets.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['author_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_ticket_comments_ticket_id', 'ticket_comments', ['ticket_id'], unique=False)
    op.create_index('ix_ticket_comments_created_at', 'ticket_comments', ['created_at'], unique=False)

    # 5. ticket_status_history (append-only)
    op.create_table(
        'ticket_status_history',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('ticket_id', sa.Uuid(), nullable=False),
        sa.Column('from_status', sa.String(length=50), nullable=True),
        sa.Column('to_status', sa.String(length=50), nullable=False),
        sa.Column('changed_by', sa.Uuid(), nullable=True),
        sa.Column('changed_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('note', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['ticket_id'], ['tickets.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['changed_by'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_ticket_status_history_ticket_id', 'ticket_status_history', ['ticket_id'], unique=False)
    op.create_index('ix_ticket_status_history_changed_at', 'ticket_status_history', ['changed_at'], unique=False)


def downgrade() -> None:
    op.drop_table('ticket_status_history')
    op.drop_table('ticket_comments')
    op.drop_table('ticket_attachments')
    op.drop_table('tickets')
    op.drop_table('technicians')
