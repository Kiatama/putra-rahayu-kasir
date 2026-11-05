"""Ringkasan penjualan + laba kotor untuk dashboard owner."""

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
import os

from fastapi import APIRouter, Depends, HTTPException, Query

from lib.auth import require_owner
from lib.db import db
from lib.dates import today_iso, utc_aware
from models.dashboard import DashboardSummary, ProfitItem, ProfitReport, SalesPoint
from models.product import Product
from models.transaction import Transaction

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

METHOD_PATTERN = "^(avg|last)$"


async def compute_profit(start: str, end: str, method: str) -> ProfitReport:
    """Laba kotor = omzet - harga beli (snapshot saat terjual). Barang tanpa harga beli dipisah."""
    key = "cost_avg" if method == "avg" else "cost_last"
    rows: dict[str, dict] = {}
    async for tx in db.transactions.find({"date": {"$gte": start, "$lte": end}}):
        for it in tx["items"]:
            row = rows.setdefault(
                it["product_id"],
                {
                    "product_id": it["product_id"],
                    "code": it["code"],
                    "name": it["name"],
                    "unit": it["unit"],
                    "qty": 0,
                    "revenue": 0,
                    "cost": 0,
                    "qty_no_cost": 0,
                    "revenue_no_cost": 0,
                },
            )
            row["qty"] += it["qty"]
            row["revenue"] += it["subtotal"]
            cost = it.get(key)
            if cost is None:
                row["qty_no_cost"] += it["qty"]
                row["revenue_no_cost"] += it["subtotal"]
            else:
                row["cost"] += cost * it["qty"]

    items: list[ProfitItem] = []
    for row in rows.values():
        costed_revenue = row["revenue"] - row["revenue_no_cost"]
        has_cost = row["qty_no_cost"] < row["qty"]
        profit = costed_revenue - row["cost"]
        items.append(
            ProfitItem(
                product_id=row["product_id"],
                code=row["code"],
                name=row["name"],
                unit=row["unit"],
                qty=row["qty"],
                revenue=row["revenue"],
                cost=row["cost"],
                profit=profit,
                margin_pct=round(profit / costed_revenue * 100, 1) if has_cost and costed_revenue > 0 else None,
                has_cost=has_cost,
                qty_no_cost=row["qty_no_cost"],
            )
        )
    items.sort(key=lambda i: (i.has_cost, i.profit), reverse=True)
    return ProfitReport(
        start=start,
        end=end,
        cost_method=method,
        revenue=sum(i.revenue for i in items),
        cost=sum(i.cost for i in items),
        profit=sum(i.profit for i in items),
        revenue_no_cost=sum(r["revenue_no_cost"] for r in rows.values()),
        items=items,
    )


@router.get("/profit", response_model=ProfitReport)
async def profit_report(
    start: str | None = Query(default=None),
    end: str | None = Query(default=None),
    method: str = Query(default="avg", pattern=METHOD_PATTERN),
    owner: dict = Depends(require_owner),
):
    today = today_iso()
    start = start or f"{today[:7]}-01"
    end = end or today
    try:
        if datetime.strptime(start, "%Y-%m-%d") > datetime.strptime(end, "%Y-%m-%d"):
            raise HTTPException(status_code=400, detail="Tanggal mulai harus sebelum tanggal selesai")
    except ValueError:
        raise HTTPException(status_code=400, detail="Format tanggal harus YYYY-MM-DD")
    return await compute_profit(start, end, method)


@router.get("/summary", response_model=DashboardSummary)
async def summary(
    method: str = Query(default="avg", pattern=METHOD_PATTERN),
    owner: dict = Depends(require_owner),
):
    today = today_iso()
    month_start = f"{today[:7]}-01"

    today_docs = await db.transactions.find({"date": today}).to_list(1000)
    omzet_today = sum(doc["total"] for doc in today_docs)

    month_rows = await db.transactions.aggregate(
        [
            {"$match": {"date": {"$gte": month_start, "$lte": today}}},
            {"$group": {"_id": None, "total": {"$sum": "$total"}}},
        ]
    ).to_list(1)
    omzet_month = month_rows[0]["total"] if month_rows else 0

    now_local = datetime.now(ZoneInfo(os.environ.get("APP_TZ", "UTC")))
    week_dates = [(now_local - timedelta(days=i)).strftime("%Y-%m-%d") for i in range(6, -1, -1)]
    week_rows = await db.transactions.aggregate(
        [
            {"$match": {"date": {"$in": week_dates}}},
            {"$group": {"_id": "$date", "total": {"$sum": "$total"}, "count": {"$sum": 1}}},
        ]
    ).to_list(10)
    by_date = {row["_id"]: row for row in week_rows}
    sales_7d = [
        SalesPoint(
            date=date_str,
            total=by_date.get(date_str, {}).get("total", 0),
            count=by_date.get(date_str, {}).get("count", 0),
        )
        for date_str in week_dates
    ]

    low_docs = await db.products.find(
        {"$expr": {"$lt": ["$stock", "$low_stock_threshold"]}}
    ).sort("stock", 1).to_list(50)
    produk_count = await db.products.count_documents({})
    recent_docs = await db.transactions.find().sort("created_at", -1).to_list(5)

    laba_today = (await compute_profit(today, today, method)).profit
    laba_month = (await compute_profit(month_start, today, method)).profit

    return DashboardSummary(
        omzet_today=omzet_today,
        transaksi_today=len(today_docs),
        omzet_month=omzet_month,
        produk_count=produk_count,
        laba_today=laba_today,
        laba_month=laba_month,
        cost_method=method,
        today=today,
        month_start=month_start,
        stok_menipis=[Product(**{**doc, "created_at": utc_aware(doc["created_at"])}) for doc in low_docs],
        sales_7d=sales_7d,
        recent_transactions=[Transaction(**{**doc, "created_at": utc_aware(doc["created_at"])}) for doc in recent_docs],
    )