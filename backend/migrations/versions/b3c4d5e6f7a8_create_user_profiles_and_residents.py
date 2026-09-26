"""Create user profiles, apartment residents, and technician profiles tables.

Revision ID: b3c4d5e6f7a8
Revises: 9e0f1a2b3c4d
Create Date: 2026-09-20 22:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "b3c4d5e6f7a8"
down_revision: Union[str, None] = "9e0f1a2b3c4d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add phone and is_verified columns to users table
    op.add_column("users", sa.Column("phone", sa.String(length=50), nullable=True))
    op.add_column(
        "users",
        sa.Column("is_verified", sa.Boolean(), server_default="false", nullable=False),
    )

    # 2. Create profiles table
    op.create_table(
        "profiles",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("full_name", sa.String(length=255), nullable=True),
        sa.Column("date_of_birth", sa.Date(), nullable=True),
        sa.Column("gender", sa.String(length=20), nullable=True),
        sa.Column("avatar_url", sa.String(length=500), nullable=True),
        sa.Column("national_id_masked", sa.String(length=50), nullable=True),
        sa.Column("emergency_contact_name", sa.String(length=255), nullable=True),
        sa.Column("emergency_contact_phone", sa.String(length=50), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "date_of_birth <= CURRENT_DATE", name="ck_profile_dob_not_future"
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", name="uq_profiles_user_id"),
    )
    op.create_index("ix_profiles_user_id", "profiles", ["user_id"], unique=False)

    # 3. Create apartment_residents table
    op.create_table(
        "apartment_residents",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("apartment_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column(
            "relationship",
            sa.String(length=50),
            server_default="owner",
            nullable=False,
        ),
        sa.Column(
            "is_primary_contact",
            sa.Boolean(),
            server_default="false",
            nullable=False,
        ),
        sa.Column(
            "moved_in_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("moved_out_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "status",
            sa.String(length=20),
            server_default="active",
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["apartment_id"], ["apartments.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_apartment_residents_apartment_id",
        "apartment_residents",
        ["apartment_id"],
        unique=False,
    )
    op.create_index(
        "ix_apartment_residents_user_id",
        "apartment_residents",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        "ix_apartment_residents_status",
        "apartment_residents",
        ["status"],
        unique=False,
    )

    # PostgreSQL Partial Unique Indexes
    op.create_index(
        "uq_apartment_primary_contact",
        "apartment_residents",
        ["apartment_id"],
        unique=True,
        postgresql_where=sa.text("is_primary_contact = true AND status = 'active'"),
    )
    op.create_index(
        "uq_apartment_user_active",
        "apartment_residents",
        ["apartment_id", "user_id"],
        unique=True,
        postgresql_where=sa.text("status = 'active'"),
    )

    # 4. Create technician_profiles table
    op.create_table(
        "technician_profiles",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("specialties", sa.JSON(), server_default="[]", nullable=False),
        sa.Column("certification_info", sa.Text(), nullable=True),
        sa.Column(
            "active_building_ids", sa.JSON(), server_default="[]", nullable=False
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", name="uq_technician_profiles_user_id"),
    )
    op.create_index(
        "ix_technician_profiles_user_id",
        "technician_profiles",
        ["user_id"],
        unique=False,
    )

    # 5. DATA BACKFILL:
    # 5a. Migrate existing full_name from users to profiles
    op.execute(
        """
        INSERT INTO profiles (id, user_id, full_name, created_at, updated_at)
        SELECT gen_random_uuid(), id, full_name, created_at, updated_at
        FROM users
        ON CONFLICT (user_id) DO NOTHING;
        """
    )

    # 5b. Drop full_name from users table (separation of concerns)
    op.drop_column("users", "full_name")

    # 5c. Backfill existing user.apartment_id into apartment_residents
    op.execute(
        """
        INSERT INTO apartment_residents (id, apartment_id, user_id, relationship, is_primary_contact, moved_in_at, status, created_at, updated_at)
        SELECT gen_random_uuid(), apartment_id, id, 'owner', true, created_at, 'active', created_at, updated_at
        FROM users
        WHERE apartment_id IS NOT NULL
        ON CONFLICT DO NOTHING;
        """
    )

    # 5d. Backfill existing technicians into technician_profiles if technicians table exists
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'technicians') THEN
                INSERT INTO technician_profiles (id, user_id, specialties, created_at, updated_at)
                SELECT gen_random_uuid(), user_id, specialties, created_at, updated_at
                FROM technicians
                ON CONFLICT (user_id) DO NOTHING;
            END IF;
        END $$;
        """
    )

    # 5e. Seed resident.manage permission and assign to super_admin and building_admin
    op.execute(
        """
        DO $$
        DECLARE
            perm_id uuid;
        BEGIN
            IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'permissions') THEN
                SELECT id INTO perm_id FROM permissions WHERE code = 'resident.manage';
                IF perm_id IS NULL THEN
                    perm_id := gen_random_uuid();
                    INSERT INTO permissions (id, code, description, module, created_at)
                    VALUES (perm_id, 'resident.manage', 'Quản lý thông tin và danh sách cư dân căn hộ', 'resident', NOW());
                END IF;

                -- Grant to super_admin and building_admin
                IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'role_permissions') THEN
                    INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, perm_id
                    FROM roles r
                    WHERE r.name IN ('super_admin', 'building_admin')
                    ON CONFLICT DO NOTHING;
                END IF;
            END IF;
        END $$;
        """
    )


def downgrade() -> None:
    # 1. Restore full_name to users
    op.add_column("users", sa.Column("full_name", sa.String(length=255), nullable=True))
    op.execute(
        """
        UPDATE users u
        SET full_name = p.full_name
        FROM profiles p
        WHERE u.id = p.user_id;
        """
    )

    # 2. Drop technician_profiles
    op.drop_table("technician_profiles")

    # 3. Drop apartment_residents
    op.drop_index("uq_apartment_user_active", table_name="apartment_residents")
    op.drop_index("uq_apartment_primary_contact", table_name="apartment_residents")
    op.drop_table("apartment_residents")

    # 4. Drop profiles
    op.drop_table("profiles")

    # 5. Drop added columns from users
    op.drop_column("users", "is_verified")
    op.drop_column("users", "phone")
