"""Manajemen pengguna — khusus owner: daftar, setujui, tolak, hapus akun."""

from fastapi import APIRouter, Depends, HTTPException
from pymongo import ReturnDocument

from lib.auth import public_user, require_owner
from lib.db import db
from models.user import UserPublic

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[UserPublic])
async def list_users(owner: dict = Depends(require_owner)):
    docs = await db.users.find().sort("created_at", -1).to_list(1000)
    return [UserPublic(**public_user(doc)) for doc in docs]


@router.post("/{user_id}/approve", response_model=UserPublic)
async def approve_user(user_id: str, owner: dict = Depends(require_owner)):
    doc = await db.users.find_one_and_update(
        {"id": user_id}, {"$set": {"status": "approved"}}, return_document=ReturnDocument.AFTER
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Pengguna tidak ditemukan")
    return UserPublic(**public_user(doc))


@router.post("/{user_id}/reject", response_model=UserPublic)
async def reject_user(user_id: str, owner: dict = Depends(require_owner)):
    doc = await db.users.find_one_and_update(
        {"id": user_id}, {"$set": {"status": "rejected"}}, return_document=ReturnDocument.AFTER
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Pengguna tidak ditemukan")
    return UserPublic(**public_user(doc))


@router.delete("/{user_id}", status_code=204)
async def delete_user(user_id: str, owner: dict = Depends(require_owner)):
    if user_id == owner["id"]:
        raise HTTPException(status_code=400, detail="Tidak dapat menghapus akun sendiri")
    doc = await db.users.find_one({"id": user_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Pengguna tidak ditemukan")
    if doc["role"] == "owner":
        raise HTTPException(status_code=400, detail="Akun owner tidak dapat dihapus")
    await db.users.delete_one({"id": user_id})
    return None