import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  Banknote,
  Landmark,
  Minus,
  Plus,
  QrCode,
  Search,
  ShoppingCart,
  Trash2,
} from "lucide-react";
import { apiGet, apiPost } from "@/lib/api";
import { errorMessage, formatRupiah, slugify } from "@/lib/format";
import { PAYMENT_LABELS } from "@/lib/types";
import type { PaymentMethod, Product, Transaction } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

interface CartLine {
  product: Product;
  qty: number;
}

const QUICK_CASH = [50000, 100000, 200000, 500000];
const BANKS = ["BCA", "Mandiri", "BRI", "BNI", "CIMB Niaga"];

function PaymentDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cart: CartLine[];
  total: number;
  customerName: string;
  onDone: (tx: Transaction) => void;
}) {
  const { open, onOpenChange, cart, total, customerName, onDone } = props;
  const [method, setMethod] = useState<PaymentMethod>("tunai");
  const [amountPaid, setAmountPaid] = useState("");
  const [bank, setBank] = useState("BCA");
  const [reference, setReference] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  const paid = Number(amountPaid) || 0;
  const cashShort = method === "tunai" && paid < total;
  const change = paid - total;
  const canSubmit = confirmed && !cashShort && cart.length > 0;

  const mutation = useMutation({
    mutationFn: () =>
      apiPost<Transaction>("/transactions", {
        items: cart.map((line) => ({ product_id: line.product.id, qty: line.qty })),
        payment_method: method,
        payment_received: confirmed,
        customer_name: customerName.trim() || null,
        amount_paid: method === "tunai" ? paid : total,
        payment_reference:
          method === "tunai" ? null : [bank, reference.trim()].filter(Boolean).join(" - ") || null,
      }),
    onSuccess: (tx) => {
      toast.success(`Transaksi ${tx.invoice_no} berhasil disimpan`);
      onDone(tx);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const close = (next: boolean) => {
    onOpenChange(next);
    if (!next) {
      setMethod("tunai");
      setAmountPaid("");
      setReference("");
      setConfirmed(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-md" data-testid="payment-dialog">
        <DialogHeader>
          <DialogTitle className="font-heading">Penyelesaian Pembayaran</DialogTitle>
          <DialogDescription>
            Total belanja {formatRupiah(total)}
            {customerName ? ` atas nama ${customerName}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-2">
            {(["tunai", "transfer", "qris"] as PaymentMethod[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMethod(m)}
                data-testid={`pos-payment-method-${m}`}
                className={cn(
                  "flex min-h-11 flex-col items-center justify-center gap-1 rounded-lg border p-2 text-xs font-medium transition-all duration-100 active:scale-[0.98]",
                  method === m ? "border-primary bg-accent text-primary" : "hover:bg-muted",
                )}
              >
                {m === "tunai" ? (
                  <Banknote className="size-5" />
                ) : m === "transfer" ? (
                  <Landmark className="size-5" />
                ) : (
                  <QrCode className="size-5" />
                )}
                {PAYMENT_LABELS[m]}
              </button>
            ))}
          </div>

          {method === "tunai" && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="pos-paid">Uang Diterima (Rp)</Label>
                <Input
                  id="pos-paid"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  placeholder={String(total)}
                  data-testid="pos-paid-input"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() => setAmountPaid(String(total))}
                  data-testid="pos-quick-exact"
                >
                  Uang Pas
                </Button>
                {QUICK_CASH.filter((v) => v >= total)
                  .slice(0, 3)
                  .map((v) => (
                    <Button
                      key={v}
                      type="button"
                      variant="outline"
                      size="xs"
                      onClick={() => setAmountPaid(String(v))}
                      data-testid={`pos-quick-${v}`}
                    >
                      {formatRupiah(v)}
                    </Button>
                  ))}
              </div>
              {paid > 0 && (
                <div
                  className={cn(
                    "flex justify-between rounded-md px-3 py-2 text-sm font-medium",
                    cashShort ? "bg-red-50 text-destructive" : "bg-green-50 text-green-700",
                  )}
                >
                  <span>{cashShort ? "Kurang" : "Kembalian"}</span>
                  <span className="font-mono">{formatRupiah(Math.abs(change))}</span>
                </div>
              )}
            </div>
          )}

          {method === "transfer" && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="pos-bank">Bank Tujuan</Label>
                <Select value={bank} onValueChange={(value: string) => setBank(value)}>
                  <SelectTrigger id="pos-bank" data-testid="pos-bank-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BANKS.map((b) => (
                      <SelectItem key={b} value={b}>
                        {b}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="pos-reference">Nama Pengirim / Referensi</Label>
                <Input
                  id="pos-reference"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="cth: Budi 9876543210"
                  data-testid="pos-reference-input"
                />
              </div>
            </div>
          )}

          {method === "qris" && (
            <div className="flex flex-col gap-3">
              <div
                className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-slate-300 p-5 text-center"
                data-testid="pos-qris-panel"
              >
                <QrCode className="size-12 text-primary" />
                <p className="text-sm font-medium">QRIS Toko Putra Rahayu</p>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Minta pelanggan memindai QRIS dengan e-wallet atau mobile banking, lalu tunggu
                  notifikasi pembayaran berhasil.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="pos-qris-ref">Referensi Pembayaran</Label>
                <Input
                  id="pos-qris-ref"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="cth: QRIS-8821"
                  data-testid="pos-qris-reference-input"
                />
              </div>
            </div>
          )}

          <div
            className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
            data-testid="payment-warning-banner"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <p>
              PERHATIAN: Pastikan pembayaran sebesar <b>{formatRupiah(total)}</b>{" "}
              <b>SUDAH DITERIMA SEPENUHNYA</b> sebelum mencetak struk.
            </p>
          </div>

          <label className="flex items-start gap-3 rounded-md border p-3">
            <Checkbox
              checked={confirmed}
              onCheckedChange={(checked) => setConfirmed(checked === true)}
              className="mt-0.5"
              data-testid="payment-confirm-checkbox"
            />
            <span className="text-sm leading-relaxed">
              Saya menyatakan bahwa pembayaran sebesar{" "}
              <b className="font-mono">{formatRupiah(total)}</b> sudah diterima dengan benar di
              kasir/rekening toko.
            </span>
          </label>
        </div>

        <DialogFooter>
          <Button
            size="lg"
            className="w-full active:scale-[0.98]"
            disabled={!canSubmit || mutation.isPending}
            onClick={() => mutation.mutate()}
            data-testid="payment-submit-button"
          >
            {mutation.isPending ? "Menyimpan…" : `Cetak Struk — ${formatRupiah(total)}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Pos() {
  const navigate = useNavigate();
  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: () => apiGet<Product[]>("/products"),
  });
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Semua");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [payOpen, setPayOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const categories = useMemo(
    () => ["Semua", ...Array.from(new Set(products.map((p) => p.category)))],
    [products],
  );
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter(
      (p) =>
        (category === "Semua" || p.category === category) &&
        (!q || p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q)),
    );
  }, [products, search, category]);

  const total = cart.reduce((sum, line) => sum + line.product.price * line.qty, 0);
  const totalQty = cart.reduce((sum, line) => sum + line.qty, 0);

  const addToCart = (product: Product) => {
    if (product.stock <= 0) {
      toast.warning(`${product.name} sedang habis`);
      return;
    }
    const existing = cart.find((line) => line.product.id === product.id);
    const nextQty = (existing?.qty ?? 0) + 1;
    if (nextQty > product.stock) {
      toast.warning(`Stok ${product.name} hanya ${product.stock} ${product.unit}`);
      return;
    }
    setCart(
      existing
        ? cart.map((line) => (line.product.id === product.id ? { ...line, qty: nextQty } : line))
        : [...cart, { product, qty: 1 }],
    );
  };

  const changeQty = (line: CartLine, qty: number) => {
    if (qty <= 0) {
      setCart(cart.filter((l) => l.product.id !== line.product.id));
      return;
    }
    if (qty > line.product.stock) {
      toast.warning(`Stok ${line.product.name} hanya ${line.product.stock} ${line.product.unit}`);
      return;
    }
    setCart(cart.map((l) => (l.product.id === line.product.id ? { ...l, qty } : l)));
  };

  const onPaid = (tx: Transaction) => {
    setCart([]);
    setCustomerName("");
    setPayOpen(false);
    setSheetOpen(false);
    navigate(`/receipt/${tx.id}`);
  };

  const renderCart = (prefix: string) => (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="font-heading text-base font-semibold tracking-tight">
          Keranjang ({totalQty})
        </h3>
        {cart.length > 0 && (
          <Button
            variant="ghost"
            size="xs"
            onClick={() => setCart([])}
            data-testid={`${prefix}-cart-clear-button`}
          >
            Kosongkan
          </Button>
        )}
      </div>

      <div className="flex max-h-[38svh] flex-col gap-2 overflow-y-auto">
        {cart.length === 0 && (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Keranjang kosong — pilih produk untuk memulai transaksi
          </p>
        )}
        {cart.map((line) => (
          <div
            key={line.product.id}
            className="flex items-center gap-2 rounded-lg border p-2"
            data-testid={`${prefix}-cart-line-${line.product.code.toLowerCase()}`}
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{line.product.name}</p>
              <p className="font-mono text-xs text-muted-foreground">
                {formatRupiah(line.product.price)} / {line.product.unit}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon-xs"
                aria-label="Kurangi jumlah"
                onClick={() => changeQty(line, line.qty - 1)}
                data-testid={`${prefix}-qty-minus-${line.product.code.toLowerCase()}`}
              >
                <Minus className="size-3" />
              </Button>
              <span className="w-7 text-center font-mono text-sm">{line.qty}</span>
              <Button
                variant="outline"
                size="icon-xs"
                aria-label="Tambah jumlah"
                onClick={() => changeQty(line, line.qty + 1)}
                data-testid={`${prefix}-qty-plus-${line.product.code.toLowerCase()}`}
              >
                <Plus className="size-3" />
              </Button>
            </div>
            <span className="w-20 text-right font-mono text-sm font-semibold">
              {formatRupiah(line.product.price * line.qty)}
            </span>
            <Button
              variant="ghost"
              size="icon-xs"
              className="text-destructive"
              aria-label="Hapus dari keranjang"
              onClick={() => changeQty(line, 0)}
              data-testid={`${prefix}-line-remove-${line.product.code.toLowerCase()}`}
            >
              <Trash2 className="size-3" />
            </Button>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`${prefix}-customer`}>Nama Pelanggan (opsional)</Label>
        <Input
          id={`${prefix}-customer`}
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          placeholder="Tanpa nama"
          data-testid={`${prefix}-customer-input`}
        />
      </div>

      <div className="flex items-center justify-between rounded-lg bg-muted p-3">
        <span className="text-sm font-medium">Total</span>
        <span className="font-mono text-lg font-bold tracking-tight" data-testid={`${prefix}-cart-total`}>
          {formatRupiah(total)}
        </span>
      </div>

      <Button
        size="lg"
        className="active:scale-[0.98]"
        disabled={cart.length === 0}
        onClick={() => {
          setSheetOpen(false);
          setPayOpen(true);
        }}
        data-testid={`${prefix}-checkout-button`}
      >
        <ShoppingCart className="size-4" />
        Bayar Sekarang
      </Button>
    </div>
  );

  return (
    <div className="flex flex-col gap-5 pb-28 lg:pb-0">
      <div>
        <h1 className="font-heading text-xl font-bold tracking-tight">Kasir</h1>
        <p className="text-sm text-muted-foreground">Transaksi penjualan Toko Putra Rahayu</p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama produk atau kode…"
            className="pl-9"
            data-testid="pos-search-input"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              data-testid={`pos-category-chip-${slugify(c)}`}
              className={cn(
                "whitespace-nowrap rounded-full border px-3 py-1.5 text-sm transition-colors",
                category === c
                  ? "border-primary bg-primary text-white"
                  : "bg-card text-slate-600 hover:bg-muted",
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1">
          {isLoading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-28 animate-pulse rounded-xl bg-muted" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
              Tidak ada produk yang cocok dengan pencarian
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {filtered.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => addToCart(p)}
                  disabled={p.stock <= 0}
                  className="flex flex-col gap-1 rounded-xl border bg-card p-3 text-left shadow-sm transition-all duration-200 hover:border-slate-300 hover:shadow-md active:scale-[0.98] disabled:opacity-50"
                  data-testid={`pos-product-card-${p.code.toLowerCase()}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-mono text-[11px] text-muted-foreground">{p.code}</span>
                    {p.stock < p.low_stock_threshold ? (
                      <Badge variant="destructive" className="text-[10px]">
                        Sisa {p.stock}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">
                        Stok {p.stock}
                      </Badge>
                    )}
                  </div>
                  <p className="line-clamp-2 min-h-10 text-sm font-medium leading-snug">{p.name}</p>
                  <span className="font-mono text-sm font-bold text-primary">
                    {formatRupiah(p.price)}
                    <span className="text-xs font-normal text-muted-foreground"> /{p.unit}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <aside className="sticky top-20 hidden w-[360px] shrink-0 rounded-xl border bg-card p-4 shadow-sm lg:block">
          {renderCart("pos")}
        </aside>
      </div>

      <div
        className="fixed inset-x-0 bottom-0 z-30 border-t bg-white p-3 shadow-[0_-4px_16px_rgba(15,23,42,0.06)] lg:hidden"
        data-testid="pos-cart-bar"
      >
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">{totalQty} item</p>
            <p className="font-mono text-lg font-bold tracking-tight" data-testid="pos-bar-total">
              {formatRupiah(total)}
            </p>
          </div>
          <Button
            className="min-h-11 flex-1 active:scale-[0.98]"
            disabled={cart.length === 0}
            onClick={() => setSheetOpen(true)}
            data-testid="pos-cart-sheet-trigger"
          >
            <ShoppingCart className="size-4" />
            Lihat Keranjang
          </Button>
        </div>
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="max-h-[88svh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-left font-heading">Keranjang Belanja</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-6">{renderCart("pos-sheet")}</div>
        </SheetContent>
      </Sheet>

      <PaymentDialog
        open={payOpen}
        onOpenChange={setPayOpen}
        cart={cart}
        total={total}
        customerName={customerName}
        onDone={onPaid}
      />
    </div>
  );
}