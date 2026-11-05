"""Stok Masuk: pencatatan barang datang dari supplier — stok produk otomatis bertambah.

Owner dan pegawai boleh mencatat. Owner melihat semua riwayat, pegawai hanya catatannya sendiri.
Hanya owner yang boleh membatalkan; pembatalan mengembalikan stok dan harga beli produk.
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from pymongo import ReturnDocument

from lib.auth import require_approved, require_owner
from lib.db import db
from lib.dates import today_iso, utc_aware
from models.stock_in import StockIn, StockInCancel, StockInCreate, StockInItem, StockShortage

router = APIRouter(prefix="/stock-in", tags=["stock-in"])


def to_model(doc: dict) -> StockIn:
    doc = {**doc, "created_at": utc_aware(doc["created_at"])}
    if doc.get("cancelled_at"):
        doc["cancelled_at"] = utc_aware(doc["cancelled_at"])
    return StockIn(**doc)


async def next_ref_no(date_str: str) -> str:
    row = await db.counters.find_one_and_update(
        {"_id": f"stockin-{date_str}"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    return f"SM-{date_str.replace('-', '')}-{row['seq']:04d}"


@router.get("/suppliers", response_model=list[str])
async def list_suppliers(user: dict = Depends(require_approved)):
    names = await db.stock_ins.distinct("supplier_name")
    return sorted(names, key=str.lower)


@router.get("", response_model=list[StockIn])
async def list_stock_ins(user: dict = Depends(require_approved)):
    query = {} if user["role"] == "owner" else {"received_by_id": user["id"]}
    docs = await db.stock_ins.find(query).sort("created_at", -1).to_list(200)
    return [to_model(doc) for doc in docs]


@router.post("", response_model=StockIn, status_code=201)
async def create_stock_in(input: StockInCreate, user: dict = Depends(require_approved)):
    ids = [item.product_id for item in input.items]
    if len(set(ids)) != len(ids):
        raise HTTPException(status_code=400, detail="Produk yang sama dicatat lebih dari sekali")
    docs = await db.products.find({"id": {"$in": ids}}).to_list(1000)
    by_id = {d["id"]: d for d in docs}
    if any(pid not in by_id for pid in ids):
        raise HTTPException(status_code=404, detail="Produk tidak ditemukan")

    lines: list[StockInItem] = []
    for item in input.items:
        product = by_id[item.product_id]
        old_stock = max(product["stock"], 0)
        old_avg = product.get("cost_avg")
        # Rata-rata tertimbang: stok lama x harga lama + stok baru x harga baru.
        if old_avg is None or old_stock == 0:
            new_avg = item.cost_price
        else:
            new_avg = round((old_avg * old_stock + item.cost_price * item.qty) / (old_stock + item.qty))
        updated = await db.products.find_one_and_update(
            {"id": item.product_id},
            {"$inc": {"stock": item.qty}, "$set": {"cost_avg": new_avg, "cost_last": item.cost_price}},
            return_document=ReturnDocument.AFTER,
        )
        lines.append(
            StockInItem(
                product_id=updated["id"],
                code=updated["code"],
                name=updated["name"],
                unit=updated["unit"],
                qty=item.qty,
                cost_price=item.cost_price,
                subtotal=item.qty * item.cost_price,
                stock_after=updated["stock"],
                prev_cost_avg=old_avg,
                prev_cost_last=product.get("cost_last"),
            )
        )

    today = today_iso()
    record = StockIn(
        ref_no=await next_ref_no(today),
        supplier_name=input.supplier_name.strip(),
        note=(input.note or "").strip() or None,
        items=lines,
        total_cost=sum(line.subtotal for line in lines),
        total_qty=sum(line.qty for line in lines),
        received_by_id=user["id"],
        received_by_name=user["name"],
        date=today,
    )
    await db.stock_ins.insert_one(record.model_dump())
    return record


@router.post("/{stock_in_id}/cancel", response_model=StockIn)
async def cancel_stock_in(stock_in_id: str, input: StockInCancel, owner: dict = Depends(require_owner)):
    record = await db.stock_ins.find_one({"id": stock_in_id})
    if not record:
        raise HTTPException(status_code=404, detail="Catatan stok masuk tidak ditemukan")
    if record.get("status") == "cancelled":
        raise HTTPException(status_code=400, detail="Catatan ini sudah dibatalkan")

    products = {
        p["id"]: p
        async for p in db.products.find({"id": {"$in": [it["product_id"] for it in record["items"]]}})
    }
    shortages = [
        StockShortage(
            product_id=it["product_id"],
            name=it["name"],
            unit=it["unit"],
            qty=it["qty"],
            stock=products[it["product_id"]]["stock"],
        )
        for it in record["items"]
        if it["product_id"] in products and products[it["product_id"]]["stock"] < it["qty"]
    ]
    if shortages and not input.force:
        # 409 with structured shortages so the owner can decide to reduce stock to 0.
        return JSONResponse(
            status_code=409,
            content={
                "detail": "Sebagian barang dari stok masuk ini sudah terjual, stok tidak cukup untuk ditarik kembali",
                "shortages": [s.model_dump() for s in shortages],
            },
        )

    for it in record["items"]:
        product = products.get(it["product_id"])
        if not product:
            continue  # produk sudah dihapus — tidak ada stok untuk dikembalikan
        stock = product["stock"]
        removed = min(it["qty"], stock)
        new_stock = stock - removed
        avg = product.get("cost_avg")
        prev_avg = it.get("prev_cost_avg")
        if new_stock > 0 and avg is not None:
            reversed_avg = (avg * stock - it["cost_price"] * removed) / new_stock
            new_avg = round(reversed_avg) if reversed_avg >= 0 else (prev_avg if prev_avg is not None else avg)
        else:
            new_avg = prev_avg if prev_avg is not None else avg
        latest = await db.stock_ins.find_one(
            {"id": {"$ne": stock_in_id}, "status": {"$ne": "cancelled"}, "items.product_id": it["product_id"]},
            sort=[("created_at", -1)],
        )
        if latest:
            new_last = next(x["cost_price"] for x in latest["items"] if x["product_id"] == it["product_id"])
        else:
            new_last = it.get("prev_cost_last")
        await db.products.update_one(
            {"id": it["product_id"]},
            {"$set": {"stock": new_stock, "cost_avg": new_avg, "cost_last": new_last}},
        )

    updated = await db.stock_ins.find_one_and_update(
        {"id": stock_in_id},
        {
            "$set": {
                "status": "cancelled",
                "cancelled_at": datetime.now(timezone.utc),
                "cancelled_by_name": owner["name"],
                "cancel_forced": bool(shortages),
            }
        },
        return_document=ReturnDocument.AFTER,
    )
    return to_model(updated)