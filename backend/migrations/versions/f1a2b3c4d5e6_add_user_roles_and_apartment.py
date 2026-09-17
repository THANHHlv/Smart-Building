"""add_user_roles_and_apartment

Revision ID: f1a2b3c4d5e6
Revises: e099c00027ff
Create Date: 2026-09-08 15:30:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'f1a2b3c4d5e6'
down_revision: Union[str, None] = 'e099c00027ff'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add role column with default 'resident'
    op.add_column('users', sa.Column('role', sa.String(length=50), nullable=False, server_default='resident'))
    # Add apartment_id column with foreign key to apartments
    op.add_column('users', sa.Column('apartment_id', sa.Uuid(), nullable=True))
    op.create_foreign_key('fk_users_apartment_id', 'users', 'apartments', ['apartment_id'], ['id'], ondelete='SET NULL')
    op.create_index('ix_users_email', 'users', ['email'], unique=True)


def downgrade() -> None:
    op.drop_index('ix_users_email', table_name='users')
    op.drop_constraint('fk_users_apartment_id', 'users', type_='foreignkey')
    op.drop_column('users', 'apartment_id')
    op.drop_column('users', 'role')
