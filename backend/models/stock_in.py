import uuid
from datetime import datetime, timezone

from pydantic import BaseModel, Field


class StockInItemIn(BaseModel):
    product_id: str
    qty: int = Field(gt=0)
    cost_price: int = Field(ge=0)  # harga beli per satuan dari supplier


class StockInCreate(BaseModel):
    supplier_name: str = Field(min_length=2)
    note: str | None = None
    items: list[StockInItemIn] = Field(min_length=1)


class StockInCancel(BaseModel):
    # False: tolak bila stok sudah terjual sebagian. True: kurangi stok sampai 0.
    force: bool = False


class StockInItem(BaseModel):
    product_id: str
    code: str
    name: str
    unit: str
    qty: int
    cost_price: int
    subtotal: int
    stock_after: int
    # Harga beli produk sebelum stok masuk ini — dipakai saat pembatalan.
    prev_cost_avg: int | None = None
    prev_cost_last: int | None = None


class StockIn(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    ref_no: str
    supplier_name: str
    note: str | None = None
    items: list[StockInItem]
    total_cost: int
    total_qty: int
    received_by_id: str
    received_by_name: str
    date: str  # YYYY-MM-DD in APP_TZ
    status: str = "active"  # "active" | "cancelled"
    cancelled_at: datetime | None = None
    cancelled_by_name: str | None = None
    cancel_forced: bool = False  # True bila stok dikurangi sampai 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class StockShortage(BaseModel):
    product_id: str
    name: str
    unit: str
    qty: int  # jumlah yang dicatat masuk
    stock: int  # stok saat ini (lebih kecil dari qty)