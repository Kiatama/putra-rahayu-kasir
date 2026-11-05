import uuid
from datetime import datetime, timezone

from pydantic import BaseModel, Field


class TransactionItemIn(BaseModel):
    product_id: str
    qty: int = Field(gt=0)


class TransactionCreate(BaseModel):
    items: list[TransactionItemIn] = Field(min_length=1)
    payment_method: str = Field(pattern="^(tunai|transfer|qris)$")
    # The cashier must actively confirm the money was received before a receipt exists.
    payment_received: bool
    customer_name: str | None = None
    amount_paid: int | None = Field(default=None, ge=0)
    payment_reference: str | None = None


class TransactionItem(BaseModel):
    product_id: str
    code: str
    name: str
    unit: str
    price: int
    qty: int
    subtotal: int
    # Harga beli saat terjual (snapshot) — dasar perhitungan laba kotor. None = belum ada.
    cost_avg: int | None = None
    cost_last: int | None = None


class Transaction(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    invoice_no: str
    cashier_id: str
    cashier_name: str
    items: list[TransactionItem]
    total: int
    payment_method: str
    payment_received: bool
    amount_paid: int | None = None
    change_due: int | None = None
    payment_reference: str | None = None
    customer_name: str | None = None
    date: str  # YYYY-MM-DD in APP_TZ — anchored server-side
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))