import uuid
from datetime import datetime, timezone

from pydantic import BaseModel, Field


class Product(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    code: str
    name: str
    category: str
    unit: str  # Sak, Batang, Karung, Meter, Kaleng, Kg, Lembar, Dus, Pcs, Roll
    price: int = Field(ge=0)
    stock: int = Field(ge=0)
    low_stock_threshold: int = Field(default=10, ge=0)
    # Harga beli dari supplier (per satuan). None = belum ada harga beli.
    # Hanya dikirim ke owner; pegawai menerima None.
    cost_avg: int | None = None  # rata-rata tertimbang dari stok masuk
    cost_last: int | None = None  # harga beli pembelian terakhir
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ProductCreate(BaseModel):
    code: str = ""
    name: str = Field(min_length=2)
    category: str = Field(min_length=2)
    unit: str = Field(min_length=1)
    price: int = Field(ge=0)
    stock: int = Field(default=0, ge=0)
    low_stock_threshold: int = Field(default=10, ge=0)
    cost_price: int | None = Field(default=None, ge=0)  # owner only — sets avg + last


class ProductUpdate(BaseModel):
    code: str | None = None
    name: str | None = None
    category: str | None = None
    unit: str | None = None
    price: int | None = Field(default=None, ge=0)
    stock: int | None = Field(default=None, ge=0)
    low_stock_threshold: int | None = Field(default=None, ge=0)
    cost_price: int | None = Field(default=None, ge=0)  # sets avg + last