"""Auth: register (pending owner approval), login, logout, me. Sessions are httpOnly cookies."""

from fastapi import APIRouter, Depends, HTTPException, Response

from lib.auth import (
    clear_session_cookie,
    create_token,
    hash_password,
    public_user,
    set_session_cookie,
    verify_password,
    get_current_user,
)
from lib.db import db
from models.user import LoginRequest, RegisterRequest, User, UserPublic

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserPublic, status_code=201)
async def register(input: RegisterRequest):
    email = input.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email sudah terdaftar")
    user = User(
        name=input.name.strip(),
        email=email,
        password_hash=hash_password(input.password),
        role=input.role,
        status="pending",  # every new account waits for the owner's approval
    )
    await db.users.insert_one(user.model_dump())
    return user


@router.post("/login", response_model=UserPublic)
async def login(input: LoginRequest, response: Response):
    doc = await db.users.find_one({"email": input.email.lower()})
    if not doc or not verify_password(input.password, doc["password_hash"]):
        raise HTTPException(status_code=401, detail="Email atau password salah")
    if doc["status"] == "pending":
        raise HTTPException(status_code=403, detail="Akun masih menunggu persetujuan pemilik toko")
    if doc["status"] == "rejected":
        raise HTTPException(status_code=403, detail="Pendaftaran akun Anda ditolak pemilik toko")
    set_session_cookie(response, create_token(doc["id"]))
    return UserPublic(**public_user(doc))


@router.post("/logout")
async def logout(response: Response):
    clear_session_cookie(response)
    return {"ok": True}


@router.get("/me", response_model=UserPublic)
async def me(user: dict = Depends(get_current_user)):
    return UserPublic(**public_user(user))