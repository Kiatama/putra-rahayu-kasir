"""Transaksi: harga dihitung server-side, stok berkurang atomik, invoice berurutan per hari.

The payment-received confirmation is enforced here too — a receipt is never created
unless the cashier (or owner) asserted the money actually arrived.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from pymongo import ReturnDocument

from lib.auth import require_approved, require_owner
from lib.db import db
from lib.dates import today_iso, utc_aware
from models.transaction import Transaction, TransactionCreate, TransactionItem

router = APIRouter(prefix="/transactions", tags=["transactions"])


def normalize(doc: dict) -> dict:
    doc["created_at"] = utc_aware(doc["created_at"])
    return doc


async def next_invoice_no(date_str: str) -> str:
    row = await db.counters.find_one_and_update(
        {"_id": f"invoice-{date_str}"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    return f"INV-{date_str.replace('-', '')}-{row['seq']:04d}"


@router.post("", response_model=Transaction, status_code=201)
async def create_transaction(input: TransactionCreate, user: dict = Depends(require_approved)):
    if not input.payment_received:
        raise HTTPException(
            status_code=400,
            detail="Pembayaran belum dikonfirmasi diterima — centang konfirmasi sebelum mencetak struk",
        )

    product_ids = [item.product_id for item in input.items]
    docs = await db.products.find({"id": {"$in": product_ids}}).to_list(1000)
    by_id = {d["id"]: d for d in docs}

    total = 0
    lines: list[TransactionItem] = []
    for item in input.items:
        product = by_id.get(item.product_id)
        if not product:
            raise HTTPException(status_code=404, detail=f"Produk {item.product_id} tidak ditemukan")
        subtotal = product["price"] * item.qty
        total += subtotal
        lines.append(
            TransactionItem(
                product_id=product["id"],
                code=product["code"],
                name=product["name"],
                unit=product["unit"],
                price=product["price"],
                qty=item.qty,
                subtotal=subtotal,
                cost_avg=product.get("cost_avg"),
                cost_last=product.get("cost_last"),
            )
        )

    amount_paid = input.amount_paid
    change_due = None
    if input.payment_method == "tunai":
        if amount_paid is None or amount_paid < total:
            raise HTTPException(status_code=400, detail="Uang diterima kurang dari total pembayaran")
        change_due = amount_paid - total
    else:
        amount_paid = total

    # Atomic per-line decrement; roll everything back if any line runs out of stock.
    decremented: list[tuple[str, int]] = []
    try:
        for item in input.items:
            result = await db.products.update_one(
                {"id": item.product_id, "stock": {"$gte": item.qty}},
                {"$inc": {"stock": -item.qty}},
            )
            if result.modified_count == 0:
                product = by_id[item.product_id]
                raise HTTPException(
                    status_code=400,
                    detail=f"Stok {product['name']} tidak cukup (tersisa {product['stock']} {product['unit']})",
                )
            decremented.append((item.product_id, item.qty))
    except HTTPException:
        for product_id, qty in decremented:
            await db.products.update_one({"id": product_id}, {"$inc": {"stock": qty}})
        raise

    transaction = Transaction(
        invoice_no=await next_invoice_no(today_iso()),
        cashier_id=user["id"],
        cashier_name=user["name"],
        items=lines,
        total=total,
        payment_method=input.payment_method,
        payment_received=True,
        amount_paid=amount_paid,
        change_due=change_due,
        payment_reference=input.payment_reference,
        customer_name=input.customer_name,
        date=today_iso(),
    )
    await db.transactions.insert_one(transaction.model_dump())
    return transaction


@router.get("", response_model=list[Transaction])
async def list_transactions(
    date: str | None = Query(default=None),
    owner: dict = Depends(require_owner),
):
    query = {"date": date} if date else {}
    docs = await db.transactions.find(query).sort("created_at", -1).to_list(200)
    return [Transaction(**normalize(doc)) for doc in docs]


@router.get("/{transaction_id}", response_model=Transaction)
async def get_transaction(transaction_id: str, user: dict = Depends(require_approved)):
    doc = await db.transactions.find_one({"id": transaction_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Struk tidak ditemukan")
    return Transaction(**normalize(doc))


@router.delete("/{transaction_id}", status_code=204)
async def delete_transaction(transaction_id: str, owner: dict = Depends(require_owner)):
    doc = await db.transactions.find_one({"id": transaction_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Transaksi tidak ditemukan")
    for item in doc["items"]:
        await db.products.update_one({"id": item["product_id"]}, {"$inc": {"stock": item["qty"]}})
    await db.transactions.delete_one({"id": transaction_id})
    return None