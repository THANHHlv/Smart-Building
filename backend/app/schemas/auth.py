"""Authentication schemas."""

import uuid
from pydantic import BaseModel, ConfigDict, EmailStr, Field


class LoginRequest(BaseModel):
    """User login request payload."""

    email: str
    password: str


class RegisterRequest(BaseModel):
    """New user registration payload. Defaults to role 'resident', no apartment."""

    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    full_name: str = Field(min_length=1, max_length=255)


class UserProfile(BaseModel):
    """Authenticated user profile representation."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    full_name: str | None
    role: str  # 'admin' | 'resident'
    apartment_id: uuid.UUID | None
    apartment_unit: str | None = None
    building_name: str | None = None
    is_active: bool


class TokenResponse(BaseModel):
    """JWT token response with user profile."""

    access_token: str
    token_type: str = "bearer"
    user: UserProfile


class DemoAccount(BaseModel):
    """Sample demo account description for quick UI switching."""

    email: str
    role: str
    label: str
    description: str
    apartment_unit: str | None = None
    building_name: str | None = None
