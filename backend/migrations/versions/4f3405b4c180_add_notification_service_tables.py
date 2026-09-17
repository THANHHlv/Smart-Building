"""add_notification_service_tables

Revision ID: 4f3405b4c180
Revises: 3e2304a3b079
Create Date: 2026-09-17 15:30:00.000000
"""

from typing import Sequence, Union
import uuid

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = '4f3405b4c180'
down_revision: Union[str, None] = '3e2304a3b079'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. notification_templates
    op.create_table(
        'notification_templates',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('code', sa.String(length=100), nullable=False),
        sa.Column(
            'channel',
            sa.Enum('IN_APP', 'PUSH', 'SMS', 'ZALO', 'EMAIL', name='notification_channel', native_enum=False),
            nullable=False,
        ),
        sa.Column('title_template', sa.String(length=255), nullable=False),
        sa.Column('body_template', sa.Text(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('code', 'channel', name='uq_notification_templates_code_channel'),
    )
    op.create_index('ix_notification_templates_code', 'notification_templates', ['code'], unique=False)

    # 2. notification_preferences
    op.create_table(
        'notification_preferences',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column(
            'category',
            sa.Enum('BILLING', 'ALERT', 'ANNOUNCEMENT', 'MAINTENANCE', name='notification_category', native_enum=False),
            nullable=False,
        ),
        sa.Column(
            'channel',
            sa.Enum('IN_APP', 'PUSH', 'SMS', 'ZALO', 'EMAIL', name='notification_channel', native_enum=False),
            nullable=False,
        ),
        sa.Column('is_enabled', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'category', 'channel', name='uq_user_category_channel'),
    )
    op.create_index('ix_notification_preferences_user_category', 'notification_preferences', ['user_id', 'category'], unique=False)

    # 3. notifications
    op.create_table(
        'notifications',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column(
            'category',
            sa.Enum('BILLING', 'ALERT', 'ANNOUNCEMENT', 'MAINTENANCE', name='notification_category', native_enum=False),
            nullable=False,
        ),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column(
            'channel',
            sa.Enum('IN_APP', 'PUSH', 'SMS', 'ZALO', 'EMAIL', name='notification_channel', native_enum=False),
            nullable=False,
        ),
        sa.Column(
            'status',
            sa.Enum('PENDING', 'SENT', 'DELIVERED', 'FAILED', 'READ', name='notification_status', native_enum=False),
            nullable=False,
            server_default='PENDING',
        ),
        sa.Column('idempotency_key', sa.String(length=120), nullable=True),
        sa.Column('data_json', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('read_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_notifications_user_created', 'notifications', ['user_id', 'created_at'], unique=False)
    op.create_index('ix_notifications_user_status', 'notifications', ['user_id', 'status'], unique=False)
    op.create_index('ix_notifications_idempotency_key', 'notifications', ['idempotency_key'], unique=False)

    # 4. notification_delivery_log
    op.create_table(
        'notification_delivery_log',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('notification_id', sa.Uuid(), nullable=False),
        sa.Column(
            'channel',
            sa.Enum('IN_APP', 'PUSH', 'SMS', 'ZALO', 'EMAIL', name='notification_channel', native_enum=False),
            nullable=False,
        ),
        sa.Column('provider', sa.String(length=50), nullable=False),
        sa.Column(
            'status',
            sa.Enum('SENT', 'DELIVERED', 'FAILED', 'RETRYING', name='delivery_status', native_enum=False),
            nullable=False,
            server_default='SENT',
        ),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('sent_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('retry_count', sa.Integer(), nullable=False, server_default=sa.text('0')),
        sa.ForeignKeyConstraint(['notification_id'], ['notifications.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_delivery_log_notification_id', 'notification_delivery_log', ['notification_id'], unique=False)
    op.create_index('ix_delivery_log_sent_at', 'notification_delivery_log', ['sent_at'], unique=False)

    # 5. Seed default notification templates
    templates_table = sa.table(
        'notification_templates',
        sa.column('id', sa.Uuid),
        sa.column('code', sa.String),
        sa.column('channel', sa.String),
        sa.column('title_template', sa.String),
        sa.column('body_template', sa.Text),
        sa.column('is_active', sa.Boolean),
    )

    seed_templates = [
        # Billing due soon
        {
            'id': uuid.uuid4(),
            'code': 'billing.payment_due_soon',
            'channel': 'in_app',
            'title_template': 'Nhắc hạn thanh toán hóa đơn {invoice_number}',
            'body_template': 'Hóa đơn {invoice_number} số tiền {amount} đ sẽ đến hạn ngày {due_date}. Quý cư dân vui lòng kiểm tra và thanh toán.',
            'is_active': True,
        },
        {
            'id': uuid.uuid4(),
            'code': 'billing.payment_due_soon',
            'channel': 'zalo',
            'title_template': 'Ban Quản Lý The Oasis: Nhắc hạn hóa đơn {invoice_number}',
            'body_template': 'Kính gửi cư dân {apartment_unit}, hóa đơn dịch vụ {invoice_number} ({amount} đ) có hạn thanh toán vào ngày {due_date}. Nhấp để thanh toán online.',
            'is_active': True,
        },
        {
            'id': uuid.uuid4(),
            'code': 'billing.payment_due_soon',
            'channel': 'sms',
            'title_template': 'THE OASIS - Nhac han hoa don',
            'body_template': 'OASIS: Hoa don {invoice_number} so tien {amount}d den han ngay {due_date}. Vui long thanh toan som.',
            'is_active': True,
        },
        # Billing invoice created
        {
            'id': uuid.uuid4(),
            'code': 'billing.invoice_created',
            'channel': 'in_app',
            'title_template': 'Hóa đơn dịch vụ mới {invoice_number}',
            'body_template': 'Hóa đơn kỳ {billing_period} cho căn hộ {apartment_unit} đã được phát hành với tổng số tiền {amount} đ. Hạn thanh toán: {due_date}.',
            'is_active': True,
        },
        {
            'id': uuid.uuid4(),
            'code': 'billing.invoice_created',
            'channel': 'zalo',
            'title_template': 'Hóa đơn dịch vụ kỳ {billing_period} - Căn {apartment_unit}',
            'body_template': 'Ban Quản Lý xin gửi hóa đơn {invoice_number} tổng cộng {amount} đ (hạn: {due_date}). Chi tiết xem tại cổng cư dân.',
            'is_active': True,
        },
        # Billing overdue
        {
            'id': uuid.uuid4(),
            'code': 'billing.overdue',
            'channel': 'in_app',
            'title_template': 'CẢNH BÁO: Hóa đơn {invoice_number} đã quá hạn',
            'body_template': 'Hóa đơn {invoice_number} ({amount} đ) đã quá hạn từ ngày {due_date}. Quý cư dân vui lòng thanh toán ngay để tránh áp dụng lãi chậm nộp.',
            'is_active': True,
        },
        {
            'id': uuid.uuid4(),
            'code': 'billing.overdue',
            'channel': 'zalo',
            'title_template': 'CẢNH BÁO QUÁ HẠN: Hóa đơn {invoice_number}',
            'body_template': 'Kính gửi cư dân căn {apartment_unit}, hóa đơn {invoice_number} ({amount} đ) đã quá hạn ngày {due_date}. Vui lòng thanh toán để duy trì dịch vụ.',
            'is_active': True,
        },
        # Alert anomaly
        {
            'id': uuid.uuid4(),
            'code': 'alert.anomaly_detected',
            'channel': 'in_app',
            'title_template': 'Cảnh báo cảm biến: {alert_title}',
            'body_template': 'Hệ thống phát hiện bất thường tại thiết bị {device_name}: {message}. Đội kỹ thuật đang giám sát.',
            'is_active': True,
        },
        {
            'id': uuid.uuid4(),
            'code': 'alert.anomaly_detected',
            'channel': 'zalo',
            'title_template': 'THE OASIS - Cảnh báo khẩn cấp: {alert_title}',
            'body_template': 'Phát hiện sự cố kỹ thuật tại căn hộ/khu vực {apartment_unit}: {message}. Liên hệ hotline BQL nếu cần hỗ trợ khẩn cấp.',
            'is_active': True,
        },
        # Maintenance ticket updated
        {
            'id': uuid.uuid4(),
            'code': 'maintenance.ticket_updated',
            'channel': 'in_app',
            'title_template': 'Cập nhật phiếu sự cố #{ticket_id}',
            'body_template': 'Phiếu hỗ trợ kỹ thuật "{ticket_title}" đã được chuyển sang trạng thái: {status}.',
            'is_active': True,
        },
        {
            'id': uuid.uuid4(),
            'code': 'maintenance.ticket_updated',
            'channel': 'zalo',
            'title_template': 'THE OASIS: Tiến độ xử lý sự cố #{ticket_id}',
            'body_template': 'Phiếu yêu cầu "{ticket_title}" của căn {apartment_unit} đã được kỹ thuật viên cập nhật: {status}.',
            'is_active': True,
        },
        # Announcement general
        {
            'id': uuid.uuid4(),
            'code': 'announcement.general',
            'channel': 'in_app',
            'title_template': '{title}',
            'body_template': '{message}',
            'is_active': True,
        },
        {
            'id': uuid.uuid4(),
            'code': 'announcement.general',
            'channel': 'zalo',
            'title_template': 'Thông báo BQL The Oasis: {title}',
            'body_template': '{message}',
            'is_active': True,
        },
    ]
    op.bulk_insert(templates_table, seed_templates)


def downgrade() -> None:
    op.drop_table('notification_delivery_log')
    op.drop_table('notifications')
    op.drop_table('notification_preferences')
    op.drop_table('notification_templates')
