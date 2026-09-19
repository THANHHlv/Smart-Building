"""Add service requests, amenities, and community announcements tables.

Revision ID: 7c8d9e0f1a2b
Revises: 6b7c8d9e0f1a
Create Date: 2026-09-18 00:15:00.000000

"""
import uuid
from datetime import datetime, timezone
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '7c8d9e0f1a2b'
down_revision: Union[str, None] = '6b7c8d9e0f1a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. service_requests
    op.create_table(
        'service_requests',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('ticket_id', sa.Uuid(), nullable=False),
        sa.Column('request_type', sa.String(length=50), nullable=False, comment="cleaning | periodic_maintenance | vehicle_registration | access_card | other"),
        sa.Column('scheduled_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('scheduled_slot', sa.String(length=50), nullable=True),
        sa.Column('notes', sa.JSON(), server_default='{}', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['ticket_id'], ['tickets.id'], name=op.f('fk_service_requests_ticket_id_tickets'), ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_service_requests')),
        sa.UniqueConstraint('ticket_id', name=op.f('uq_service_requests_ticket_id')),
    )
    op.create_index(op.f('ix_service_requests_request_type'), 'service_requests', ['request_type'], unique=False)
    op.create_index(op.f('ix_service_requests_ticket_id'), 'service_requests', ['ticket_id'], unique=False)

    # 2. amenities
    op.create_table(
        'amenities',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('building_id', sa.Uuid(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('capacity', sa.Integer(), server_default='1', nullable=False),
        sa.Column('available_slots', sa.JSON(), server_default='[]', nullable=False),
        sa.Column('requires_approval', sa.Boolean(), server_default=sa.text('false'), nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('true'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['building_id'], ['buildings.id'], name=op.f('fk_amenities_building_id_buildings'), ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_amenities')),
    )
    op.create_index(op.f('ix_amenities_building_id'), 'amenities', ['building_id'], unique=False)
    op.create_index(op.f('ix_amenities_is_active'), 'amenities', ['is_active'], unique=False)

    # 3. amenity_bookings
    op.create_table(
        'amenity_bookings',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('amenity_id', sa.Uuid(), nullable=False),
        sa.Column('apartment_id', sa.Uuid(), nullable=False),
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column('booking_date', sa.Date(), nullable=False),
        sa.Column('time_slot', sa.String(length=50), nullable=False),
        sa.Column('status', sa.String(length=20), server_default='confirmed', nullable=False, comment="pending | confirmed | cancelled | completed"),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['amenity_id'], ['amenities.id'], name=op.f('fk_amenity_bookings_amenity_id_amenities'), ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['apartment_id'], ['apartments.id'], name=op.f('fk_amenity_bookings_apartment_id_apartments'), ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_amenity_bookings_user_id_users'), ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_amenity_bookings')),
    )
    op.create_index(op.f('ix_amenity_bookings_amenity_id'), 'amenity_bookings', ['amenity_id'], unique=False)
    op.create_index(op.f('ix_amenity_bookings_apartment_id'), 'amenity_bookings', ['apartment_id'], unique=False)
    op.create_index(op.f('ix_amenity_bookings_booking_date'), 'amenity_bookings', ['booking_date'], unique=False)
    op.create_index(op.f('ix_amenity_bookings_status'), 'amenity_bookings', ['status'], unique=False)
    op.create_index(op.f('ix_amenity_bookings_user_id'), 'amenity_bookings', ['user_id'], unique=False)
    
    # Partial unique index to guarantee no double-booking at the DB level
    op.create_index(
        'uq_amenity_slot_active',
        'amenity_bookings',
        ['amenity_id', 'booking_date', 'time_slot'],
        unique=True,
        postgresql_where=sa.text("status IN ('pending', 'confirmed')"),
    )

    # 4. announcements
    op.create_table(
        'announcements',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('building_id', sa.Uuid(), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('category', sa.String(length=50), server_default='general', nullable=False, comment="maintenance | event | safety | general"),
        sa.Column('priority', sa.String(length=50), server_default='standard', nullable=False, comment="urgent | standard"),
        sa.Column('published_by', sa.Uuid(), nullable=True),
        sa.Column('published_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('pin_to_top', sa.Boolean(), server_default=sa.text('false'), nullable=False),
        sa.Column('image_url', sa.String(length=1024), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('true'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['building_id'], ['buildings.id'], name=op.f('fk_announcements_building_id_buildings'), ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['published_by'], ['users.id'], name=op.f('fk_announcements_published_by_users'), ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_announcements')),
    )
    op.create_index(op.f('ix_announcements_building_id'), 'announcements', ['building_id'], unique=False)
    op.create_index(op.f('ix_announcements_category'), 'announcements', ['category'], unique=False)
    op.create_index(op.f('ix_announcements_expires_at'), 'announcements', ['expires_at'], unique=False)
    op.create_index(op.f('ix_announcements_is_active'), 'announcements', ['is_active'], unique=False)
    op.create_index(op.f('ix_announcements_pin_to_top'), 'announcements', ['pin_to_top'], unique=False)
    op.create_index(op.f('ix_announcements_priority'), 'announcements', ['priority'], unique=False)
    op.create_index(op.f('ix_announcements_published_at'), 'announcements', ['published_at'], unique=False)
    op.create_index(
        'ix_announcements_feed_sort',
        'announcements',
        ['building_id', 'is_active', 'pin_to_top', 'published_at'],
        unique=False,
    )

    # 5. announcement_reads
    op.create_table(
        'announcement_reads',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('announcement_id', sa.Uuid(), nullable=False),
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column('read_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['announcement_id'], ['announcements.id'], name=op.f('fk_announcement_reads_announcement_id_announcements'), ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_announcement_reads_user_id_users'), ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_announcement_reads')),
        sa.UniqueConstraint('announcement_id', 'user_id', name='uq_announcement_user_read'),
    )
    op.create_index(op.f('ix_announcement_reads_announcement_id'), 'announcement_reads', ['announcement_id'], unique=False)
    op.create_index(op.f('ix_announcement_reads_user_id'), 'announcement_reads', ['user_id'], unique=False)


def downgrade() -> None:
    op.drop_table('announcement_reads')
    op.drop_table('announcements')
    op.drop_index('uq_amenity_slot_active', table_name='amenity_bookings')
    op.drop_table('amenity_bookings')
    op.drop_table('amenities')
    op.drop_table('service_requests')
