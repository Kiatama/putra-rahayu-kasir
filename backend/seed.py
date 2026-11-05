"""Seed Toko Putra Rahayu — users, products, sample transactions.

Run once: cd /app/backend && python seed.py
Idempotent: each collection is skipped when it already has data.
"""

import asyncio
import os
import uuid
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from lib.auth import hash_password
from lib.db import db, ensure_indexes
from lib.dates import today_iso

APP_TZ = ZoneInfo(os.environ.get("APP_TZ", "UTC"))

USERS = [
    {"name": "Budi Rahayu", "email": "owner@putrarahayu.com", "password": "owner123", "role": "owner", "status": "approved"},
    {"name": "Siti Nurhaliza", "email": "kasir@putrarahayu.com", "password": "kasir123", "role": "pegawai", "status": "approved"},
    {"name": "Andi Pratama", "email": "andi@putrarahayu.com", "password": "andi123", "role": "pegawai", "status": "pending"},
]

# code, name, category, unit, price, stock, low_stock_threshold
PRODUCTS = [
    ("SM-001", "Semen Gresik 50kg", "Semen", "Sak", 65000, 120, 10),
    ("SM-002", "Semen Tiga Roda 50kg", "Semen", "Sak", 62000, 85, 10),
    ("SM-003", "Mortar Instan 40kg", "Semen", "Sak", 45000, 40, 10),
    ("BB-001", "Besi Beton Polos 8mm", "Besi & Baja", "Batang", 58000, 150, 20),
    ("BB-002", "Besi Beton Ulir 10mm", "Besi & Baja", "Batang", 88000, 100, 20),
    ("BB-003", "Besi Beton Ulir 12mm", "Besi & Baja", "Batang", 128000, 65, 15),
    ("BB-004", "Besi Hollow 4x4 2mm", "Besi & Baja", "Batang", 42000, 45, 10),
    ("BB-005", "Wiremesh M8 2.1x5.4m", "Besi & Baja", "Lembar", 95000, 8, 10),
    ("BB-006", "Seng Gelombang 0.3mm", "Besi & Baja", "Lembar", 68000, 40, 10),
    ("PB-001", "Pasir Cor", "Pasir & Batu", "Karung", 35000, 200, 25),
    ("PB-002", "Batu Kali 1-2", "Pasir & Batu", "Karung", 55000, 90, 20),
    ("PB-003", "Bata Merah", "Pasir & Batu", "Pcs", 1000, 5000, 500),
    ("PB-004", "Bata Ringan", "Pasir & Batu", "Pcs", 8500, 300, 50),
    ("CK-001", "Cat Dulux 5kg", "Cat & Kimia", "Kaleng", 210000, 25, 5),
    ("CK-002", "Cat Avian 1kg", "Cat & Kimia", "Kaleng", 38000, 60, 10),
    ("CK-003", "Waterproofing Coating", "Cat & Kimia", "Kaleng", 145000, 15, 5),
    ("KP-001", "Triplek 9mm", "Kayu & Papan", "Lembar", 88000, 35, 10),
    ("KP-002", "Triplek 12mm", "Kayu & Papan", "Lembar", 110000, 22, 10),
    ("KP-003", "Kaso 2/3 4m", "Kayu & Papan", "Batang", 12000, 200, 30),
    ("PS-001", "Pipa PVC 1/2 inch", "Pipa & Sanitari", "Batang", 10000, 140, 20),
    ("PS-002", "Pipa PVC 3 inch", "Pipa & Sanitari", "Batang", 38000, 75, 15),
    ("PS-003", "Keran Air Kuningan", "Pipa & Sanitari", "Pcs", 45000, 30, 8),
    ("PS-004", "Kloset Duduk", "Pipa & Sanitari", "Pcs", 750000, 6, 5),
    ("AP-001", "Sekop Full", "Alat Pertukangan", "Pcs", 95000, 12, 5),
    ("AP-002", "Palu Kambing 2kg", "Alat Pertukangan", "Pcs", 55000, 15, 5),
    ("AP-003", "Meteran Lipat 5m", "Alat Pertukangan", "Pcs", 28000, 20, 6),
    ("AP-004", "Paku 5cm", "Alat Pertukangan", "Kg", 18000, 50, 10),
    ("AP-005", "Paku 7cm", "Alat Pertukangan", "Kg", 19000, 7, 10),
]


async def seed_users() -> None:
    for spec in USERS:
        if await db.users.find_one({"email": spec["email"]}):
            continue
        await db.users.insert_one(
            {
                "id": str(uuid.uuid4()),
                "name": spec["name"],
                "email": spec["email"],
                "password_hash": hash_password(spec["password"]),
                "role": spec["role"],
                "status": spec["status"],
                "created_at": datetime.now(timezone.utc),
            }
        )
        print(f"user: {spec['email']} ({spec['role']}, {spec['status']})")


def demo_cost(price: int) -> int:
    """Harga beli CONTOH untuk data demo: ~82% dari harga jual, dibulatkan ke ratusan."""
    return max(100, round(price * 0.82 / 100) * 100)


async def backfill_costs() -> None:
    """Idempoten: isi harga beli contoh untuk produk demo yang belum punya field cost_avg,
    lalu lengkapi snapshot harga beli pada item transaksi lama."""
    demo_codes = {code: price for code, _n, _c, _u, price, _s, _t in PRODUCTS}
    filled = 0
    async for p in db.products.find({"cost_avg": {"$exists": False}}):
        if p["code"] in demo_codes:
            cost = demo_cost(p["price"])
            await db.products.update_one({"id": p["id"]}, {"$set": {"cost_avg": cost, "cost_last": cost}})
            filled += 1
    costs = {p["id"]: p async for p in db.products.find({}, {"id": 1, "cost_avg": 1, "cost_last": 1})}
    tx_fixed = 0
    async for tx in db.transactions.find({"items.cost_avg": {"$exists": False}}):
        items = []
        for it in tx["items"]:
            p = costs.get(it["product_id"], {})
            items.append({**it, "cost_avg": p.get("cost_avg"), "cost_last": p.get("cost_last")})
        await db.transactions.update_one({"id": tx["id"]}, {"$set": {"items": items}})
        tx_fixed += 1
    print(f"backfill: {filled} produk, {tx_fixed} transaksi")


async def seed_products() -> None:
    if await db.products.count_documents({}) > 0:
        print("products: skip (sudah ada)")
        return
    now = datetime.now(timezone.utc)
    for code, name, category, unit, price, stock, threshold in PRODUCTS:
        await db.products.insert_one(
            {
                "id": str(uuid.uuid4()),
                "code": code,
                "name": name,
                "category": category,
                "unit": unit,
                "price": price,
                "stock": stock,
                "low_stock_threshold": threshold,
                "cost_avg": demo_cost(price),
                "cost_last": demo_cost(price),
                "created_at": now,
            }
        )
    print(f"products: {len(PRODUCTS)}")


def local_dt(date_str: str, hhmm: str) -> datetime:
    return datetime.strptime(f"{date_str} {hhmm}", "%Y-%m-%d %H:%M").replace(tzinfo=APP_TZ)


async def seed_transactions(cashier_id: str) -> None:
    if await db.transactions.count_documents({}) > 0:
        print("transactions: skip (sudah ada)")
        return
    today = today_iso()
    yesterday = (datetime.now(APP_TZ) - timedelta(days=1)).strftime("%Y-%m-%d")
    three_ago = (datetime.now(APP_TZ) - timedelta(days=3)).strftime("%Y-%m-%d")
    by_code = {doc["code"]: doc async for doc in db.products.find({})}

    # (date, time, items, method, customer)
    samples = [
        (today, "09:15", [("SM-001", 5), ("AP-004", 2)], "tunai", "Pak Haji"),
        (today, "13:40", [("BB-002", 4), ("AP-001", 1)], "transfer", None),
        (yesterday, "10:05", [("CK-001", 2), ("KP-001", 3)], "qris", "Bu Sari"),
        (three_ago, "15:30", [("SM-002", 10), ("PB-001", 20)], "tunai", None),
    ]

    seq = 0
    for date_str, hhmm, items, method, customer in samples:
        seq += 1
        lines, total = [], 0
        for code, qty in items:
            product = by_code[code]
            subtotal = product["price"] * qty
            total += subtotal
            lines.append(
                {
                    "product_id": product["id"],
                    "code": product["code"],
                    "name": product["name"],
                    "unit": product["unit"],
                    "price": product["price"],
                    "qty": qty,
                    "subtotal": subtotal,
                }
            )
            await db.products.update_one({"code": code}, {"$inc": {"stock": -qty}})

        amount_paid = None
        change_due = None
        reference = None
        if method == "tunai":
            amount_paid = ((total + 4999) // 5000) * 5000  # bulatkan ke 5.000 teratas
            change_due = amount_paid - total
        elif method == "transfer":
            reference = "BCA 9876543210"
        else:
            reference = "QRIS-OK"

        invoice_no = f"INV-{date_str.replace('-', '')}-{seq:04d}"
        await db.counters.update_one({"_id": f"invoice-{date_str}"}, {"$set": {"seq": seq}}, upsert=True)
        await db.transactions.insert_one(
            {
                "id": str(uuid.uuid4()),
                "invoice_no": invoice_no,
                "cashier_id": cashier_id,
                "cashier_name": "Siti Nurhaliza",
                "items": lines,
                "total": total,
                "payment_method": method,
                "payment_received": True,
                "amount_paid": amount_paid,
                "change_due": change_due,
                "payment_reference": reference,
                "customer_name": customer,
                "date": date_str,
                "created_at": local_dt(date_str, hhmm),
            }
        )
    print(f"transactions: {seq}")


async def main() -> None:
    await ensure_indexes()
    await seed_users()
    await seed_products()
    kasir = await db.users.find_one({"email": "kasir@putrarahayu.com"})
    if kasir:
        await seed_transactions(kasir["id"])
    await backfill_costs()
    print("seed selesai")


if __name__ == "__main__":
    asyncio.run(main())