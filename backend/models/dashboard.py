from pydantic import BaseModel

from models.product import Product
from models.transaction import Transaction


class SalesPoint(BaseModel):
    date: str
    total: int
    count: int


class DashboardSummary(BaseModel):
    omzet_today: int
    transaksi_today: int
    omzet_month: int
    produk_count: int
    laba_today: int
    laba_month: int
    cost_method: str  # "avg" | "last"
    today: str
    month_start: str
    stok_menipis: list[Product]
    sales_7d: list[SalesPoint]
    recent_transactions: list[Transaction]


class ProfitItem(BaseModel):
    product_id: str
    code: str
    name: str
    unit: str
    qty: int
    revenue: int  # omzet seluruh penjualan barang ini
    cost: int  # total harga beli (hanya qty yang punya harga beli)
    profit: int  # (omzet yang punya harga beli) - cost
    margin_pct: float | None  # None bila tidak ada harga beli sama sekali
    has_cost: bool
    qty_no_cost: int  # qty terjual tanpa catatan harga beli


class ProfitReport(BaseModel):
    start: str
    end: str
    cost_method: str
    revenue: int
    cost: int
    profit: int
    revenue_no_cost: int  # omzet yang tidak bisa dihitung labanya
    items: list[ProfitItem]