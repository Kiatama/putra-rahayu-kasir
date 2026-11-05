"""Password hashing + httpOnly cookie sessions (JWT). Import from routers."""

import hashlib
import hmac
import os
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException, Request, Response

from lib.db import db
from lib.dates import utc_aware

SESSION_SECRET = os.environ.get("SESSION_SECRET", "putra-rahayu-dev-secret")
COOKIE_NAME = "session"
SESSION_TTL_DAYS = 7


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 120_000)
    return f"{salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        salt_hex, digest_hex = stored.split("$", 1)
    except ValueError:
        return False
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt_hex), 120_000)
    return hmac.compare_digest(digest.hex(), digest_hex)


def create_token(user_id: str) -> str:
    payload = {"sub": user_id, "exp": datetime.now(timezone.utc) + timedelta(days=SESSION_TTL_DAYS)}
    return jwt.encode(payload, SESSION_SECRET, algorithm="HS256")


def set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        COOKIE_NAME,
        token,
        httponly=True,
        samesite="lax",
        path="/",
        max_age=SESSION_TTL_DAYS * 24 * 3600,
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(COOKIE_NAME, path="/")


async def get_current_user(request: Request) -> dict:
    """Raw user doc or 401. Role/status checks live in require_approved/require_owner."""
    credentials_error = HTTPException(status_code=401, detail="Sesi tidak valid, silakan login kembali")
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        raise credentials_error
    try:
        payload = jwt.decode(token, SESSION_SECRET, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise credentials_error
    user = await db.users.find_one({"id": payload.get("sub")})
    if not user:
        raise credentials_error
    return user


async def require_approved(user: dict = Depends(get_current_user)) -> dict:
    if user.get("status") != "approved":
        raise HTTPException(status_code=403, detail="Akun Anda belum disetujui pemilik toko")
    return user


async def require_owner(user: dict = Depends(require_approved)) -> dict:
    if user.get("role") != "owner":
        raise HTTPException(status_code=403, detail="Hanya pemilik toko yang dapat mengakses fitur ini")
    return user


def public_user(doc: dict) -> dict:
    """User fields safe to expose — never the password hash, with an aware created_at."""
    return {
        "id": doc["id"],
        "name": doc["name"],
        "email": doc["email"],
        "role": doc["role"],
        "status": doc["status"],
        "created_at": utc_aware(doc.get("created_at", datetime.now(timezone.utc))),
    }