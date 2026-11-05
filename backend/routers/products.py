"""Produk: semua pengguna approved bisa lihat; pegawai + owner tambah/hapus; edit khusus owner."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query

from lib.auth import require_approved, require_owner
from lib.db import db
from lib.dates import utc_aware
from models.product import Product, ProductCreate, ProductUpdate

router = APIRouter(prefix="/products", tags=["products"])


@router.get("", response_model=list[Product])
async def list_products(
    search: str = Query(default=""),
    category: str = Query(default=""),
    user: dict = Depends(require_approved),
):
    query: dict = {}
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"code": {"$regex": search, "$options": "i"}},
        ]
    if category and category != "Semua":
        query["category"] = category
    docs = await db.products.find(query).sort("name", 1).to_list(1000)
    is_owner = user["role"] == "owner"
    for doc in docs:
        doc["created_at"] = utc_aware(doc["created_at"])
        if not is_owner:  # harga beli & laba hanya untuk owner
            doc["cost_avg"] = None
            doc["cost_last"] = None
    return [Product(**doc) for doc in docs]


@router.post("", response_model=Product, status_code=201)
async def create_product(input: ProductCreate, user: dict = Depends(require_approved)):
    code = input.code.strip() or f"PRD-{uuid.uuid4().hex[:6].upper()}"
    if await db.products.find_one({"code": code}):
        raise HTTPException(status_code=400, detail=f"Kode produk {code} sudah dipakai")
    data = input.model_dump()
    data["code"] = code
    cost = data.pop("cost_price")
    if user["role"] == "owner" and cost is not None:
        data["cost_avg"] = cost
        data["cost_last"] = cost
    product = Product(**data)
    await db.products.insert_one(product.model_dump())
    return product


@router.put("/{product_id}", response_model=Product)
async def update_product(product_id: str, input: ProductUpdate, owner: dict = Depends(require_owner)):
    doc = await db.products.find_one({"id": product_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Produk tidak ditemukan")
    updates = {k: v for k, v in input.model_dump(exclude_unset=True).items() if v is not None}
    if "cost_price" in updates:
        cost = updates.pop("cost_price")
        updates["cost_avg"] = cost
        updates["cost_last"] = cost
    if not updates:
        raise HTTPException(status_code=400, detail="Tidak ada perubahan")
    if "code" in updates and updates["code"] != doc["code"]:
        if await db.products.find_one({"code": updates["code"]}):
            raise HTTPException(status_code=400, detail=f"Kode produk {updates['code']} sudah dipakai")
    await db.products.update_one({"id": product_id}, {"$set": updates})
    doc.update(updates)
    doc["created_at"] = utc_aware(doc["created_at"])
    return Product(**doc)


@router.delete("/{product_id}", status_code=204)
async def delete_product(product_id: str, user: dict = Depends(require_approved)):
    result = await db.products.delete_one({"id": product_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Produk tidak ditemukan")
    return None