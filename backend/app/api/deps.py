"""FastAPI authentication and RBAC dependencies."""

from typing import Annotated
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.apartment import Apartment
from app.models.floor import Floor
from app.models.building import Building
from app.models.user import User
from app.models.rbac import Permission, Role, RolePermission, UserRole

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)


async def get_current_user(
    token: Annotated[str | None, Depends(oauth2_scheme)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    """Retrieve and validate the currently authenticated user."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials or token expired",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if not token:
        raise credentials_exception

    payload = decode_access_token(token)
    if not payload:
        raise credentials_exception

    user_id_str: str | None = payload.get("sub")
    if not user_id_str:
        raise credentials_exception

    try:
        user_id = UUID(user_id_str)
    except ValueError:
        raise credentials_exception

    stmt = (
        select(User)
        .options(
            selectinload(User.apartment)
            .selectinload(Apartment.floor)
            .selectinload(Floor.building)
        )
        .where(User.id == user_id, User.is_active.is_(True))
    )
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or account is deactivated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


async def fetch_user_permissions(user: User, db: AsyncSession) -> set[str]:
    """Retrieve all distinct permission codes assigned to the user across all roles."""
    if user.is_superuser:
        return {"*"}

    stmt = (
        select(Permission.code)
        .join(RolePermission, Permission.id == RolePermission.permission_id)
        .join(UserRole, RolePermission.role_id == UserRole.role_id)
        .where(UserRole.user_id == user.id)
    )
    result = await db.execute(stmt)
    codes = set(result.scalars().all())

    # Backward compatibility fallback for users without explicit user_roles records
    if not codes:
        if user.role == "admin":
            return {"*"}
        if user.role == "resident":
            return {"resident.read_own", "ticket.create_own", "invoice.read_own"}

    return codes


async def fetch_user_roles(user: User, db: AsyncSession) -> set[str]:
    """Retrieve all role names assigned to the user."""
    if user.is_superuser:
        return {"super_admin"}

    stmt = (
        select(Role.name)
        .join(UserRole, Role.id == UserRole.role_id)
        .where(UserRole.user_id == user.id)
    )
    result = await db.execute(stmt)
    roles = set(result.scalars().all())

    if not roles and user.role == "admin":
        return {"super_admin", "admin"}
    if not roles and user.role == "resident":
        return {"resident"}

    return roles


def require_permission(permission_code: str):
    """Dependency factory checking whether the current user has the specified permission."""

    async def _permission_dependency(
        current_user: Annotated[User, Depends(get_current_user)],
        db: Annotated[AsyncSession, Depends(get_db)],
    ) -> User:
        user_perms = await fetch_user_permissions(current_user, db)
        if "*" in user_perms or permission_code in user_perms:
            return current_user

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bạn không có quyền thực hiện thao tác này",
        )

    return _permission_dependency


def require_role(*role_names: str):
    """Dependency factory checking whether the current user holds at least one of the specified roles."""

    async def _role_dependency(
        current_user: Annotated[User, Depends(get_current_user)],
        db: Annotated[AsyncSession, Depends(get_db)],
    ) -> User:
        if current_user.is_superuser:
            return current_user

        user_roles = await fetch_user_roles(current_user, db)
        if any(r in user_roles for r in role_names):
            return current_user

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bạn không có vai trò phù hợp để thực hiện thao tác này",
        )

    return _role_dependency


async def require_admin(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    """Authorize administrative privileges (super_admin, building_admin, or legacy admin)."""
    if current_user.is_superuser or current_user.role == "admin":
        return current_user

    user_roles = await fetch_user_roles(current_user, db)
    if "super_admin" in user_roles or "building_admin" in user_roles:
        return current_user

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Administrative privileges required",
    )


async def require_resident(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    """Authorize resident privileges bound to a specific apartment."""
    user_roles = await fetch_user_roles(current_user, db)
    is_res = "resident" in user_roles or current_user.role == "resident"
    is_adm = "super_admin" in user_roles or "building_admin" in user_roles or current_user.role == "admin" or current_user.is_superuser

    if not is_res and not is_adm:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Yêu cầu quyền cư dân",
        )

    if not current_user.apartment_id and not is_adm:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tài khoản cư dân chưa được gán căn hộ",
        )

    return current_user
