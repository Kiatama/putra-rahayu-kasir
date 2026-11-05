import uuid
from datetime import datetime, timezone

from pydantic import BaseModel, EmailStr, Field


class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    email: EmailStr
    password_hash: str
    role: str = "pegawai"  # "owner" | "pegawai"
    status: str = "pending"  # "pending" | "approved" | "rejected"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class UserPublic(BaseModel):
    id: str
    name: str
    email: str
    role: str
    status: str
    created_at: datetime


class RegisterRequest(BaseModel):
    name: str = Field(min_length=2)
    email: EmailStr
    password: str = Field(min_length=6)
    role: str = Field(default="pegawai", pattern="^(owner|pegawai)$")


class LoginRequest(BaseModel):
    email: EmailStr
    password: str