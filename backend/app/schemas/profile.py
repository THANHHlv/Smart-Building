"""Pydantic schemas for User Profile, Resident management, and Technician profiles."""

import re
import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

# Vietnamese phone regex: 10 digits starting with 03, 05, 07, 08, 09 or +84
VN_PHONE_REGEX = re.compile(r"^(0|\+84)(3[2-9]|5[25689]|7[06-9]|8[1-9]|9[0-9])[0-9]{7}$")


def mask_national_id(val: str | None) -> str | None:
    """Mask sensitive national ID (CCCD/CMND) so plain text is never stored or exposed."""
    if not val:
        return None
    val = val.strip()
    if "*" in val:
        return val  # Already masked
    # If 9 to 12 digits plain text, mask the middle digits
    digits_only = re.sub(r"\D", "", val)
    if len(digits_only) >= 7:
        prefix = digits_only[:3]
        suffix = digits_only[-4:]
        return f"{prefix}***{suffix}"
    return f"{digits_only[:2]}***" if len(digits_only) > 2 else "***"


class UserProfileResponse(BaseModel):
    """Full user profile response for current authenticated user."""

    id: uuid.UUID
    user_id: uuid.UUID
    email: str
    phone: str | None = None
    role: str
    full_name: str | None = None
    date_of_birth: date | None = None
    gender: str | None = None
    avatar_url: str | None = None
    national_id_masked: str | None = None
    emergency_contact_name: str | None = None
    emergency_contact_phone: str | None = None
    is_active: bool = True
    is_verified: bool = False
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UserProfileUpdateRequest(BaseModel):
    """Request to update personal profile information."""

    full_name: str | None = Field(None, min_length=2, max_length=255, description="Họ và tên")
    phone: str | None = Field(None, description="Số điện thoại Việt Nam (10 số)")
    date_of_birth: date | None = Field(None, description="Ngày sinh (không được ở tương lai, tuổi <= 120)")
    gender: Literal["male", "female", "other"] | None = Field(None, description="Giới tính")
    national_id: str | None = Field(None, description="Số CCCD/CMND (sẽ được tự động che để bảo mật)")
    emergency_contact_name: str | None = Field(None, max_length=255, description="Họ tên người liên hệ khẩn cấp")
    emergency_contact_phone: str | None = Field(None, description="Số điện thoại người liên hệ khẩn cấp")

    @field_validator("phone", mode="after")
    @classmethod
    def validate_phone(cls, v: str | None) -> str | None:
        if v is not None and v.strip() != "":
            cleaned = re.sub(r"[\s\-\.]", "", v)
            if not VN_PHONE_REGEX.match(cleaned):
                raise ValueError("Số điện thoại không đúng định dạng Việt Nam (10 số, đầu 03/05/07/08/09)")
            return cleaned
        return v

    @field_validator("emergency_contact_phone", mode="after")
    @classmethod
    def validate_emergency_phone(cls, v: str | None) -> str | None:
        if v is not None and v.strip() != "":
            cleaned = re.sub(r"[\s\-\.]", "", v)
            if not VN_PHONE_REGEX.match(cleaned):
                raise ValueError("Số điện thoại liên hệ khẩn cấp không đúng định dạng Việt Nam")
            return cleaned
        return v

    @field_validator("date_of_birth", mode="after")
    @classmethod
    def validate_date_of_birth(cls, v: date | None) -> date | None:
        if v is not None:
            today = date.today()
            if v > today:
                raise ValueError("Ngày sinh không được ở tương lai")
            age_days = (today - v).days
            if age_days > 120 * 365.25:
                raise ValueError("Ngày sinh không hợp lý (tuổi không được vượt quá 120)")
        return v

    @field_validator("national_id", mode="after")
    @classmethod
    def process_national_id(cls, v: str | None) -> str | None:
        return mask_national_id(v)


class AvatarUploadResponse(BaseModel):
    """Response returned when an avatar image is uploaded."""

    avatar_url: str
    message: str = "Tải lên ảnh đại diện thành công"


# --- Apartment Residency Schemas ---

class ResidentApartmentResponse(BaseModel):
    """Information on an apartment linked to the current user."""

    id: uuid.UUID
    apartment_id: uuid.UUID
    unit_number: str
    floor_number: int
    building_id: uuid.UUID
    building_name: str
    building_address: str | None = None
    relationship: str
    is_primary_contact: bool
    status: str
    moved_in_at: datetime
    moved_out_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class AdminResidentItemResponse(BaseModel):
    """Item for admin resident management table."""

    id: uuid.UUID
    apartment_id: uuid.UUID
    unit_number: str
    floor_number: int
    building_id: uuid.UUID
    building_name: str
    user_id: uuid.UUID
    resident_name: str
    email: str
    phone: str | None = None
    avatar_url: str | None = None
    relationship: str
    is_primary_contact: bool
    status: str
    moved_in_at: datetime
    moved_out_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class AdminCreateResidentRequest(BaseModel):
    """Admin adds a resident to an apartment."""

    apartment_id: uuid.UUID
    user_id: uuid.UUID | None = None
    email: str | None = None  # Find or match user by email
    full_name: str | None = None
    phone: str | None = None
    relationship: Literal["owner", "tenant", "family_member", "other"] = "tenant"
    is_primary_contact: bool = False

    @field_validator("phone", mode="after")
    @classmethod
    def validate_phone(cls, v: str | None) -> str | None:
        if v is not None and v.strip() != "":
            cleaned = re.sub(r"[\s\-\.]", "", v)
            if not VN_PHONE_REGEX.match(cleaned):
                raise ValueError("Số điện thoại không đúng định dạng Việt Nam")
            return cleaned
        return v


class AdminUpdateResidentRequest(BaseModel):
    """Admin updates relationship, primary contact, or moving status."""

    relationship: Literal["owner", "tenant", "family_member", "other"] | None = None
    is_primary_contact: bool | None = None
    status: Literal["active", "moved_out"] | None = None


# --- Technician Profile Schemas ---

class TechnicianProfileResponse(BaseModel):
    """Technician profile with technical specialties and certifications."""

    id: uuid.UUID
    user_id: uuid.UUID
    full_name: str
    email: str
    phone: str | None = None
    avatar_url: str | None = None
    specialties: list[str] = []
    certification_info: str | None = None
    active_building_ids: list[str] = []
    is_active: bool = True

    model_config = ConfigDict(from_attributes=True)


class TechnicianProfileUpdateRequest(BaseModel):
    """Admin updates technician profile."""

    specialties: list[str] | None = None
    certification_info: str | None = None
    active_building_ids: list[str] | None = None
    is_active: bool | None = None
