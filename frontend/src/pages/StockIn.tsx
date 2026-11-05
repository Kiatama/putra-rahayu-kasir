import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, PackagePlus, Plus, Trash2, Truck, Undo2 } from "lucide-react";
import { ApiError, apiGet, apiPost } from "@/lib/api";
import { errorMessage, formatDateTime, formatRupiah } from "@/lib/format";
import { useMe } from "@/lib/session";
import type { Product, StockIn, StockShortage } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";

interface Row {
  key: number;
  productId: string;
  qty: string;
  costPrice: string;
}

let rowSeq = 0;
const newRow = (): Row => ({ key: ++rowSeq, productId: "", qty: "", costPrice: "" });

export default function StockInPage() {
  const { data: me } = useMe();
  const queryClient = useQueryClient();
  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: () => apiGet<Product[]>("/products"),
  });
  const { data: suppliers = [] } = useQuery({
    queryKey: ["stock-in-suppliers"],
    queryFn: () => apiGet<string[]>("/stock-in/suppliers"),
  });
  const { data: history = [], isLoading } = useQuery({
    queryKey: ["stock-in"],
    queryFn: () => apiGet<StockIn[]>("/stock-in"),
  });

  const [supplier, setSupplier] = useState("");
  const [note, setNote] = useState("");
  const [rows, setRows] = useState<Row[]>([newRow()]);

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const isOwner = me?.role === "owner";
  const [cancelling, setCancelling] = useState<StockIn | null>(null);
  const [shortages, setShortages] = useState<StockShortage[] | null>(null);

  const cancelMutation = useMutation({
    mutationFn: (vars: { id: string; force: boolean }) =>
      apiPost<StockIn>(`/stock-in/${vars.id}/cancel`, { force: vars.force }),
    onSuccess: (rec) => {
      toast.success(`${rec.ref_no} dibatalkan, stok dikembalikan`);
      setCancelling(null);
      setShortages(null);
      void queryClient.invalidateQueries({ queryKey: ["stock-in"] });
      void queryClient.invalidateQueries({ queryKey: ["products"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error) => {
      // 409 = some goods already sold; the body lists what is short so the owner can decide.
      if (error instanceof ApiError && error.status === 409) {
        const body = error.body as { shortages?: StockShortage[] } | null;
        setShortages(body?.shortages ?? []);
        return;
      }
      toast.error(errorMessage(error));
    },
  });
  const productLabels = useMemo(
    () => Object.fromEntries(products.map((p) => [p.id, `${p.name} (${p.unit})`])),
    [products],
  );

  const total = rows.reduce(
    (sum, r) => sum + (Number(r.qty) || 0) * (Number(r.costPrice) || 0),
    0,
  );
  const validRows = rows.filter((r) => r.productId && Number(r.qty) > 0 && r.costPrice !== "");
  const duplicate = new Set(validRows.map((r) => r.productId)).size !== validRows.length;
  const canSubmit =
    supplier.trim().length >= 2 && validRows.length === rows.length && rows.length > 0 && !duplicate;

  const updateRow = (key: number, patch: Partial<Row>) =>
    setRows(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const mutation = useMutation({
    mutationFn: () =>
      apiPost<StockIn>("/stock-in", {
        supplier_name: supplier.trim(),
        note: note.trim() || null,
        items: rows.map((r) => ({
          product_id: r.productId,
          qty: Number(r.qty),
          cost_price: Number(r.costPrice),
        })),
      }),
    onSuccess: (rec) => {
      toast.success(`${rec.ref_no}: ${rec.total_qty} barang masuk, stok diperbarui`);
      setSupplier("");
      setNote("");
      setRows([newRow()]);
      void queryClient.invalidateQueries({ queryKey: ["stock-in"] });
      void queryClient.invalidateQueries({ queryKey: ["stock-in-suppliers"] });
      void queryClient.invalidateQueries({ queryKey: ["products"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-heading text-xl font-bold tracking-tight">Stok Masuk</h1>
        <p className="text-sm text-muted-foreground">
          Catat barang datang dari supplier — stok produk bertambah otomatis
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-5 lg:items-start">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-heading">
              <Truck className="size-4 text-primary" />
              Catat Barang Datang
            </CardTitle>
            <CardDescription>Isi nama supplier, barang, jumlah, dan harga beli</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-2">
              <Label htmlFor="stockin-supplier">Nama Supplier</Label>
              <Input
                id="stockin-supplier"
                list="stockin-supplier-list"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                placeholder="cth: CV Semen Jaya"
                autoComplete="off"
                data-testid="stockin-supplier-input"
              />
              <datalist id="stockin-supplier-list">
                {suppliers.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>

            <div className="flex flex-col gap-3">
              <Label>Daftar Barang</Label>
              {rows.map((row, index) => {
                const product = byId.get(row.productId);
                const subtotal = (Number(row.qty) || 0) * (Number(row.costPrice) || 0);
                return (
                  <div
                    key={row.key}
                    className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-3"
                    data-testid={`stockin-row-${index}`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <Select
                          value={row.productId}
                          onValueChange={(value: string) => updateRow(row.key, { productId: value })}
                        >
                          <SelectTrigger
                            className="w-full"
                            data-testid={`stockin-product-select-${index}`}
                          >
                            <SelectValue placeholder="Pilih produk">
                              {(v: string) => (v ? productLabels[v] : "Pilih produk")}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent className="max-h-72">
                            {products.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.name} ({p.unit}) — stok {p.stock}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-destructive"
                        aria-label="Hapus baris"
                        disabled={rows.length === 1}
                        onClick={() => setRows(rows.filter((r) => r.key !== row.key))}
                        data-testid={`stockin-row-remove-${index}`}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="grid gap-1">
                        <span className="text-xs text-muted-foreground">
                          Jumlah{product ? ` (${product.unit})` : ""}
                        </span>
                        <Input
                          type="number"
                          min={1}
                          inputMode="numeric"
                          value={row.qty}
                          onChange={(e) => updateRow(row.key, { qty: e.target.value })}
                          placeholder="0"
                          data-testid={`stockin-qty-input-${index}`}
                        />
                      </div>
                      <div className="grid gap-1">
                        <span className="text-xs text-muted-foreground">
                          Harga Beli / {product?.unit ?? "satuan"} (Rp)
                        </span>
                        <Input
                          type="number"
                          min={0}
                          inputMode="numeric"
                          value={row.costPrice}
                          onChange={(e) => updateRow(row.key, { costPrice: e.target.value })}
                          placeholder={product ? String(Math.round(product.price * 0.85)) : "0"}
                          data-testid={`stockin-cost-input-${index}`}
                        />
                      </div>
                    </div>
                    {product && (
                      <p className="text-xs text-muted-foreground">
                        Stok sekarang {product.stock} → setelah masuk{" "}
                        <b className="text-foreground">
                          {product.stock + (Number(row.qty) || 0)} {product.unit}
                        </b>
                        {subtotal > 0 && (
                          <span className="font-mono"> · subtotal {formatRupiah(subtotal)}</span>
                        )}
                      </p>
                    )}
                  </div>
                );
              })}
              {duplicate && (
                <p className="text-xs text-destructive" data-testid="stockin-duplicate-warning">
                  Produk yang sama dipilih lebih dari sekali — gabungkan jumlahnya di satu baris.
                </p>
              )}
              <Button
                variant="outline"
                size="sm"
                className="self-start"
                onClick={() => setRows([...rows, newRow()])}
                data-testid="stockin-add-row-button"
              >
                <Plus className="size-4" />
                Tambah Barang
              </Button>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="stockin-note">Catatan (opsional)</Label>
              <Textarea
                id="stockin-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="cth: No. surat jalan 12345"
                rows={2}
                data-testid="stockin-note-input"
              />
            </div>

            <div className="flex items-center justify-between rounded-lg bg-muted p-3">
              <span className="text-sm font-medium">Total Pembelian</span>
              <span className="font-mono text-lg font-bold" data-testid="stockin-total">
                {formatRupiah(total)}
              </span>
            </div>

            <Button
              size="lg"
              className="active:scale-[0.98]"
              disabled={!canSubmit || mutation.isPending}
              onClick={() => mutation.mutate()}
              data-testid="stockin-submit-button"
            >
              <PackagePlus className="size-4" />
              {mutation.isPending ? "Menyimpan…" : "Simpan Stok Masuk"}
            </Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="font-heading">Riwayat Stok Masuk</CardTitle>
            <CardDescription>
              {me?.role === "owner" ? "Semua catatan dari owner dan pegawai" : "Catatan yang Anda buat"}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {isLoading &&
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />
              ))}
            {!isLoading && history.length === 0 && (
              <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                Belum ada catatan stok masuk
              </p>
            )}
            {history.map((rec) => (
              <div
                key={rec.id}
                className={`flex flex-col gap-1.5 rounded-lg border p-3 ${rec.status === "cancelled" ? "bg-muted/50 opacity-70" : ""}`}
                data-testid={`stockin-history-${rec.ref_no.toLowerCase()}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{rec.supplier_name}</p>
                    <p className="font-mono text-[11px] text-muted-foreground">
                      {rec.ref_no} · {formatDateTime(rec.created_at)}
                    </p>
                  </div>
                  <span
                    className={`font-mono text-sm font-bold ${rec.status === "cancelled" ? "line-through" : ""}`}
                  >
                    {formatRupiah(rec.total_cost)}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {rec.items.map((item) => (
                    <Badge key={item.product_id} variant="secondary" className="text-[11px]">
                      +{item.qty} {item.unit} {item.name}
                    </Badge>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Dicatat oleh {rec.received_by_name}
                  {rec.note ? ` · ${rec.note}` : ""}
                </p>
                {rec.status === "cancelled" ? (
                  <Badge
                    variant="destructive"
                    className="self-start text-[11px]"
                    data-testid={`stockin-cancelled-badge-${rec.ref_no.toLowerCase()}`}
                  >
                    Dibatalkan oleh {rec.cancelled_by_name}
                    {rec.cancel_forced ? " · stok dikurangi sampai 0" : ""}
                  </Badge>
                ) : (
                  isOwner && (
                    <Button
                      variant="outline"
                      size="xs"
                      className="self-start text-destructive"
                      onClick={() => {
                        setShortages(null);
                        setCancelling(rec);
                      }}
                      data-testid={`stockin-cancel-button-${rec.ref_no.toLowerCase()}`}
                    >
                      <Undo2 className="size-3" />
                      Batalkan
                    </Button>
                  )
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={!!cancelling}
        onOpenChange={(open) => {
          if (!open) {
            setCancelling(null);
            setShortages(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md" data-testid="stockin-cancel-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading">Batalkan Stok Masuk</DialogTitle>
            <DialogDescription>
              Catatan <b>{cancelling?.ref_no}</b> dari {cancelling?.supplier_name} akan dibatalkan.
              Stok dan harga beli produk dikembalikan seperti sebelum barang ini masuk.
            </DialogDescription>
          </DialogHeader>

          {shortages && shortages.length > 0 && (
            <div
              className="flex flex-col gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
              data-testid="stockin-cancel-shortage"
            >
              <p className="flex items-start gap-2 font-medium">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                Pembatalan ditolak: sebagian barang sudah terjual, stok tidak cukup untuk ditarik
                kembali.
              </p>
              <ul className="ml-6 list-disc text-xs">
                {shortages.map((s) => (
                  <li key={s.product_id}>
                    {s.name}: dicatat masuk {s.qty} {s.unit}, stok sekarang tinggal {s.stock} {s.unit}
                  </li>
                ))}
              </ul>
              <p className="text-xs">
                Anda tetap bisa membatalkan dengan mengurangi stok barang tersebut sampai 0.
              </p>
            </div>
          )}

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              onClick={() => setCancelling(null)}
              data-testid="stockin-cancel-dismiss-button"
            >
              Tutup
            </Button>
            {shortages && shortages.length > 0 ? (
              <Button
                variant="destructive"
                disabled={cancelMutation.isPending}
                onClick={() => cancelling && cancelMutation.mutate({ id: cancelling.id, force: true })}
                data-testid="stockin-cancel-force-button"
              >
                {cancelMutation.isPending ? "Memproses…" : "Kurangi Stok sampai 0 & Batalkan"}
              </Button>
            ) : (
              <Button
                variant="destructive"
                disabled={cancelMutation.isPending}
                onClick={() => cancelling && cancelMutation.mutate({ id: cancelling.id, force: false })}
                data-testid="stockin-cancel-confirm-button"
              >
                {cancelMutation.isPending ? "Memproses…" : "Ya, Batalkan"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}