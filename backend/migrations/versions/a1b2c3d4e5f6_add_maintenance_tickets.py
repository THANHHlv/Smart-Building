"""add_maintenance_tickets

Revision ID: a1b2c3d4e5f6
Revises: f1a2b3c4d5e6
Create Date: 2026-09-09 10:30:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'f1a2b3c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'maintenance_tickets',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('apartment_id', sa.Uuid(), nullable=False),
        sa.Column('user_id', sa.Uuid(), nullable=True),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('category', sa.String(length=50), nullable=False, server_default='general'),
        sa.Column('urgency', sa.String(length=50), nullable=False, server_default='medium'),
        sa.Column('status', sa.String(length=50), nullable=False, server_default='open'),
        sa.Column('technician_notes', sa.Text(), nullable=True),
        sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['apartment_id'], ['apartments.id'], name='fk_maintenance_apartment_id', ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], name='fk_maintenance_user_id', ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_maintenance_apartment_id', 'maintenance_tickets', ['apartment_id'])
    op.create_index('ix_maintenance_user_id', 'maintenance_tickets', ['user_id'])
    op.create_index('ix_maintenance_status', 'maintenance_tickets', ['status'])
    op.create_index('ix_maintenance_created_at', 'maintenance_tickets', ['created_at'])


def downgrade() -> None:
    op.drop_index('ix_maintenance_created_at', table_name='maintenance_tickets')
    op.drop_index('ix_maintenance_status', table_name='maintenance_tickets')
    op.drop_index('ix_maintenance_user_id', table_name='maintenance_tickets')
    op.drop_index('ix_maintenance_apartment_id', table_name='maintenance_tickets')
    op.drop_table('maintenance_tickets')
