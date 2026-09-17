"""Add RBAC tables and initial seed data.

Revision ID: 6b7c8d9e0f1a
Revises: 5a6b7c8d9e0f
Create Date: 2026-09-17 23:00:00.000000

"""
import uuid
from datetime import datetime
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '6b7c8d9e0f1a'
down_revision: Union[str, None] = '5a6b7c8d9e0f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create tables
    op.create_table(
        'roles',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('name', sa.String(length=50), nullable=False),
        sa.Column('description', sa.String(length=255), nullable=True),
        sa.Column('is_system', sa.Boolean(), server_default=sa.text('true'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_roles')),
        sa.UniqueConstraint('name', name=op.f('uq_roles_name')),
    )
    op.create_index(op.f('ix_roles_name'), 'roles', ['name'], unique=True)

    op.create_table(
        'permissions',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('code', sa.String(length=100), nullable=False),
        sa.Column('description', sa.String(length=255), nullable=True),
        sa.Column('module', sa.String(length=50), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_permissions')),
        sa.UniqueConstraint('code', name=op.f('uq_permissions_code')),
    )
    op.create_index(op.f('ix_permissions_code'), 'permissions', ['code'], unique=True)
    op.create_index(op.f('ix_permissions_module'), 'permissions', ['module'], unique=False)

    op.create_table(
        'role_permissions',
        sa.Column('role_id', sa.Uuid(), nullable=False),
        sa.Column('permission_id', sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(['permission_id'], ['permissions.id'], name=op.f('fk_role_permissions_permission_id_permissions'), ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['role_id'], ['roles.id'], name=op.f('fk_role_permissions_role_id_roles'), ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('role_id', 'permission_id', name=op.f('pk_role_permissions')),
    )

    op.create_table(
        'user_roles',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column('role_id', sa.Uuid(), nullable=False),
        sa.Column('building_id', sa.Uuid(), nullable=True),
        sa.Column('granted_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('granted_by', sa.Uuid(), nullable=True),
        sa.ForeignKeyConstraint(['building_id'], ['buildings.id'], name=op.f('fk_user_roles_building_id_buildings'), ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['granted_by'], ['users.id'], name=op.f('fk_user_roles_granted_by_users'), ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['role_id'], ['roles.id'], name=op.f('fk_user_roles_role_id_roles'), ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_user_roles_user_id_users'), ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_user_roles')),
        sa.UniqueConstraint('user_id', 'role_id', 'building_id', name='uq_user_role_building'),
    )
    op.create_index(op.f('ix_user_roles_building_id'), 'user_roles', ['building_id'], unique=False)
    op.create_index(op.f('ix_user_roles_role_id'), 'user_roles', ['role_id'], unique=False)
    op.create_index(op.f('ix_user_roles_user_id'), 'user_roles', ['user_id'], unique=False)

    # 2. Seed default roles
    roles_data = [
        {"id": uuid.uuid4(), "name": "super_admin", "description": "Quản trị viên toàn hệ thống — toàn quyền mọi tính năng và tòa nhà"},
        {"id": uuid.uuid4(), "name": "building_admin", "description": "Quản lý tòa nhà — phụ trách vận hành, phân công phiếu và duyệt thu phí"},
        {"id": uuid.uuid4(), "name": "accountant", "description": "Kế toán BQL — quản lý hóa đơn, đối soát giao dịch và theo dõi công nợ"},
        {"id": uuid.uuid4(), "name": "technician", "description": "Kỹ thuật viên — tiếp nhận phiếu việc, cập nhật tiến độ và kiểm tra thiết bị"},
        {"id": uuid.uuid4(), "name": "resident", "description": "Cư dân căn hộ — báo sự cố, xem tiện ích và thanh toán hóa đơn căn hộ mình"},
    ]
    roles_table = sa.table(
        'roles',
        sa.column('id', sa.Uuid),
        sa.column('name', sa.String),
        sa.column('description', sa.String),
        sa.column('is_system', sa.Boolean),
        sa.column('created_at', sa.DateTime),
        sa.column('updated_at', sa.DateTime),
    )
    for r in roles_data:
        op.execute(
            roles_table.insert().values(
                id=r["id"],
                name=r["name"],
                description=r["description"],
                is_system=True,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
        )

    # 3. Seed default permissions
    permissions_data = [
        # User & Role
        {"id": uuid.uuid4(), "code": "user.manage", "description": "Quản lý tài khoản cư dân và gán căn hộ", "module": "user"},
        {"id": uuid.uuid4(), "code": "role.manage", "description": "Phân quyền và quản lý vai trò trong hệ thống", "module": "user"},
        # Billing & Invoices
        {"id": uuid.uuid4(), "code": "invoice.read", "description": "Xem danh sách và chi tiết hóa đơn toàn tòa nhà", "module": "billing"},
        {"id": uuid.uuid4(), "code": "invoice.manage", "description": "Tạo kỳ hóa đơn, đối soát và xác nhận thanh toán", "module": "billing"},
        {"id": uuid.uuid4(), "code": "invoice.read_own", "description": "Xem hóa đơn thuộc căn hộ của mình", "module": "billing"},
        # Tickets & Work Orders
        {"id": uuid.uuid4(), "code": "ticket.read", "description": "Xem danh sách và chi tiết phiếu công việc toàn tòa", "module": "ticket"},
        {"id": uuid.uuid4(), "code": "ticket.assign", "description": "Phân công kỹ thuật viên xử lý sự cố", "module": "ticket"},
        {"id": uuid.uuid4(), "code": "ticket.status_update", "description": "Cập nhật trạng thái tiến độ xử lý phiếu", "module": "ticket"},
        {"id": uuid.uuid4(), "code": "ticket.create_own", "description": "Tạo yêu cầu báo hỏng cho căn hộ của mình", "module": "ticket"},
        # Telemetry & Devices
        {"id": uuid.uuid4(), "code": "sensor.read", "description": "Xem dữ liệu cảm biến telemetry thô", "module": "telemetry"},
        {"id": uuid.uuid4(), "code": "device.read", "description": "Xem danh mục và trạng thái kết nối thiết bị", "module": "device"},
        {"id": uuid.uuid4(), "code": "device.write", "description": "Điều khiển bật/tắt hoặc cấu hình thiết bị", "module": "device"},
        # Admin Operations
        {"id": uuid.uuid4(), "code": "admin.dashboard.read", "description": "Xem bảng điều khiển chỉ số vận hành BQL", "module": "admin"},
        {"id": uuid.uuid4(), "code": "resident.read_own", "description": "Xem thông tin căn hộ và tiện ích của mình", "module": "resident"},
    ]
    perm_table = sa.table(
        'permissions',
        sa.column('id', sa.Uuid),
        sa.column('code', sa.String),
        sa.column('description', sa.String),
        sa.column('module', sa.String),
        sa.column('created_at', sa.DateTime),
    )
    for p in permissions_data:
        op.execute(
            perm_table.insert().values(
                id=p["id"],
                code=p["code"],
                description=p["description"],
                module=p["module"],
                created_at=datetime.utcnow(),
            )
        )

    # 4. Bind role permissions
    perm_map = {p["code"]: p["id"] for p in permissions_data}
    role_map = {r["name"]: r["id"] for r in roles_data}

    role_perms_table = sa.table(
        'role_permissions',
        sa.column('role_id', sa.Uuid),
        sa.column('permission_id', sa.Uuid),
    )

    role_matrix = {
        "super_admin": list(perm_map.keys()),  # All permissions
        "building_admin": [
            "admin.dashboard.read", "user.manage", "invoice.read", "invoice.manage",
            "ticket.read", "ticket.assign", "ticket.status_update", "sensor.read",
            "device.read", "device.write",
        ],
        "accountant": [
            "admin.dashboard.read", "invoice.read", "invoice.manage",
        ],
        "technician": [
            "ticket.read", "ticket.status_update", "device.read",
        ],
        "resident": [
            "resident.read_own", "ticket.create_own", "invoice.read_own",
        ],
    }

    for role_name, codes in role_matrix.items():
        r_id = role_map[role_name]
        for c in codes:
            if c in perm_map:
                op.execute(role_perms_table.insert().values(role_id=r_id, permission_id=perm_map[c]))


def downgrade() -> None:
    op.drop_index(op.f('ix_user_roles_user_id'), table_name='user_roles')
    op.drop_index(op.f('ix_user_roles_role_id'), table_name='user_roles')
    op.drop_index(op.f('ix_user_roles_building_id'), table_name='user_roles')
    op.drop_table('user_roles')
    op.drop_table('role_permissions')
    op.drop_index(op.f('ix_permissions_module'), table_name='permissions')
    op.drop_index(op.f('ix_permissions_code'), table_name='permissions')
    op.drop_table('permissions')
    op.drop_index(op.f('ix_roles_name'), table_name='roles')
    op.drop_table('roles')
