import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/api";
import { errorMessage, formatRupiah, slugify } from "@/lib/format";
import { useMe } from "@/lib/session";
import { UNITS } from "@/lib/types";
import type { Product } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ProductFormState {
  code: string;
  name: string;
  category: string;
  unit: string;
  price: string;
  stock: string;
  threshold: string;
  cost: string;
}

const EMPTY_FORM: ProductFormState = {
  code: "",
  name: "",
  category: "",
  unit: "Sak",
  price: "",
  stock: "0",
  threshold: "10",
  cost: "",
};

// Harga beli — owner only. Produk tanpa harga beli ditandai dan tidak dihitung labanya.
function CostInfo({ product }: { product: Product }) {
  if (product.cost_avg == null) {
    return (
      <Badge
        variant="outline"
        className="border-amber-300 bg-amber-50 text-amber-800"
        data-testid={`product-no-cost-badge-${product.code.toLowerCase()}`}
      >
        Belum ada harga beli
      </Badge>
    );
  }
  return (
    <span
      className="block text-right font-mono text-xs leading-tight"
      data-testid={`product-cost-${product.code.toLowerCase()}`}
    >
      <span className="block">Rata² {formatRupiah(product.cost_avg)}</span>
      {product.cost_last != null && product.cost_last !== product.cost_avg && (
        <span className="block text-muted-foreground">Terakhir {formatRupiah(product.cost_last)}</span>
      )}
    </span>
  );
}

function StockBadge({ product }: { product: Product }) {
  if (product.stock < product.low_stock_threshold) {
    return (
      <Badge variant="destructive" data-testid={`product-stock-badge-${product.code.toLowerCase()}`}>
        Sisa {product.stock} {product.unit} — menipis
      </Badge>
    );
  }
  return (
    <Badge variant="outline" data-testid={`product-stock-badge-${product.code.toLowerCase()}`}>
      Stok {product.stock} {product.unit}
    </Badge>
  );
}

export default function Products() {
  const { data: me } = useMe();
  const isOwner = me?.role === "owner";
  const queryClient = useQueryClient();
  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: () => apiGet<Product[]>("/products"),
  });

  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductFormState>(EMPTY_FORM);
  const [deleting, setDeleting] = useState<Product | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter(
      (p) =>
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q),
    );
  }, [products, search]);

  const lowCount = products.filter((p) => p.stock < p.low_stock_threshold).length;

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  };

  const openEdit = (product: Product) => {
    setEditing(product);
    setForm({
      code: product.code,
      name: product.name,
      category: product.category,
      unit: product.unit,
      price: String(product.price),
      stock: String(product.stock),
      threshold: String(product.low_stock_threshold),
      cost: product.cost_avg != null ? String(product.cost_avg) : "",
    });
    setFormOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      const body = {
        code: form.code.trim(),
        name: form.name.trim(),
        category: form.category.trim(),
        unit: form.unit,
        price: Number(form.price) || 0,
        stock: Number(form.stock) || 0,
        low_stock_threshold: Number(form.threshold) || 0,
        // Only send cost when the owner actually changed it — keeps the weighted average intact.
        ...(isOwner &&
        form.cost !== "" &&
        Number(form.cost) !== (editing?.cost_avg ?? null)
          ? { cost_price: Number(form.cost) }
          : {}),
      };
      return editing
        ? apiPut<Product>(`/products/${editing.id}`, body)
        : apiPost<Product>("/products", body);
    },
    onSuccess: () => {
      toast.success(editing ? "Produk diperbarui" : "Produk ditambahkan");
      setFormOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete<void>(`/products/${id}`),
    onSuccess: () => {
      toast.success("Produk dihapus");
      setDeleting(null);
      void queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const formInvalid = form.name.trim().length < 2 || form.category.trim().length < 2 || !form.price;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-bold tracking-tight">Kelola Produk</h1>
          <p className="text-sm text-muted-foreground">
            {isOwner ? "Tambah, ubah, dan hapus produk toko" : "Tambah dan hapus produk toko"}
          </p>
        </div>
        <Button onClick={openAdd} className="active:scale-[0.98]" data-testid="products-add-button">
          <Plus className="size-4" />
          Tambah Produk
        </Button>
      </div>

      {lowCount > 0 && (
        <div
          className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
          data-testid="products-low-stock-banner"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <p>
            <b>{lowCount} produk</b> stoknya menipis (di bawah ambang batas). Segera lakukan
            pemesanan ulang.
          </p>
        </div>
      )}

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari nama, kode, atau kategori…"
          className="pl-9"
          data-testid="products-search-input"
        />
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kode</TableHead>
                  <TableHead>Nama Produk</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead className="text-right">Harga</TableHead>
                  {isOwner && <TableHead className="text-right">Harga Beli</TableHead>}
                  <TableHead>Stok</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => (
                  <TableRow key={p.id} data-testid={`product-row-${p.code.toLowerCase()}`}>
                    <TableCell className="font-mono text-xs">{p.code}</TableCell>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.category}</TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatRupiah(p.price)}
                      <span className="text-xs text-muted-foreground"> /{p.unit}</span>
                    </TableCell>
                    {isOwner && (
                      <TableCell className="text-right">
                        <CostInfo product={p} />
                      </TableCell>
                    )}
                    <TableCell>
                      <StockBadge product={p} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {isOwner && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Ubah produk"
                            onClick={() => openEdit(p)}
                            data-testid={`product-edit-button-${p.code.toLowerCase()}`}
                          >
                            <Pencil className="size-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-destructive"
                          aria-label="Hapus produk"
                          onClick={() => setDeleting(p)}
                          data-testid={`product-delete-button-${p.code.toLowerCase()}`}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile cards */}
          <div className="flex flex-col gap-2 md:hidden">
            {filtered.map((p) => (
              <div
                key={p.id}
                className="flex flex-col gap-2 rounded-xl border bg-card p-3"
                data-testid={`product-card-${p.code.toLowerCase()}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{p.name}</p>
                    <p className="font-mono text-[11px] text-muted-foreground">
                      {p.code} — {p.category}
                    </p>
                  </div>
                  <StockBadge product={p} />
                </div>
                {isOwner && (
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Harga beli</span>
                    <CostInfo product={p} />
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-bold text-primary">
                    {formatRupiah(p.price)}
                    <span className="text-xs font-normal text-muted-foreground"> /{p.unit}</span>
                  </span>
                  <div className="flex gap-1">
                    {isOwner && (
                      <Button
                        variant="outline"
                        size="icon-sm"
                        aria-label="Ubah produk"
                        onClick={() => openEdit(p)}
                        data-testid={`product-edit-button-${p.code.toLowerCase()}`}
                      >
                        <Pencil className="size-4" />
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="icon-sm"
                      className="text-destructive"
                      aria-label="Hapus produk"
                      onClick={() => setDeleting(p)}
                      data-testid={`product-delete-button-${p.code.toLowerCase()}`}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filtered.length === 0 && (
            <p className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
              Tidak ada produk yang cocok dengan pencarian
            </p>
          )}
        </>
      )}

      {/* Add / edit dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">
              {editing ? "Ubah Produk" : "Tambah Produk"}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? "Perbarui data produk termasuk stok terbaru"
                : "Produk baru langsung tampil di katalog kasir"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label htmlFor="product-name">Nama Produk</Label>
              <Input
                id="product-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="cth: Semen Gresik 50kg"
                required
                data-testid="product-name-input"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="product-code">Kode (opsional)</Label>
                <Input
                  id="product-code"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  placeholder="otomatis jika kosong"
                  data-testid="product-code-input"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="product-category">Kategori</Label>
                <Input
                  id="product-category"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  placeholder="cth: Semen"
                  required
                  data-testid="product-category-input"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="product-unit">Satuan</Label>
                <Select
                  value={form.unit}
                  onValueChange={(value: string) => setForm({ ...form, unit: value })}
                >
                  <SelectTrigger id="product-unit" data-testid="product-unit-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNITS.map((u) => (
                      <SelectItem key={u} value={u}>
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="product-price">Harga (Rp)</Label>
                <Input
                  id="product-price"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  placeholder="65000"
                  required
                  data-testid="product-price-input"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="product-stock">Stok</Label>
                <Input
                  id="product-stock"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={form.stock}
                  onChange={(e) => setForm({ ...form, stock: e.target.value })}
                  data-testid="product-stock-input"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="product-threshold">Ambang Stok Menipis</Label>
                <Input
                  id="product-threshold"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={form.threshold}
                  onChange={(e) => setForm({ ...form, threshold: e.target.value })}
                  data-testid="product-threshold-input"
                />
              </div>
            </div>
            {isOwner && (
              <div className="grid gap-2">
                <Label htmlFor="product-cost">Harga Beli dari Supplier (Rp, opsional)</Label>
                <Input
                  id="product-cost"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={form.cost}
                  onChange={(e) => setForm({ ...form, cost: e.target.value })}
                  placeholder="Kosongkan bila belum tahu"
                  data-testid="product-cost-input"
                />
                <p className="text-xs text-muted-foreground">
                  Dipakai untuk menghitung laba kotor. Akan diperbarui otomatis dari Stok Masuk.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              className="w-full"
              disabled={formInvalid || saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
              data-testid="product-dialog-submit-button"
            >
              {saveMutation.isPending ? "Menyimpan…" : editing ? "Simpan Perubahan" : "Tambah Produk"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading">Hapus Produk</DialogTitle>
            <DialogDescription>
              Produk <b>{deleting?.name}</b> akan dihapus permanen dari katalog. Tindakan ini tidak
              dapat dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setDeleting(null)}
              data-testid="product-delete-cancel-button"
            >
              Batal
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={() => deleting && deleteMutation.mutate(deleting.id)}
              disabled={deleteMutation.isPending}
              data-testid="product-delete-confirm-button"
            >
              {deleteMutation.isPending ? "Menghapus…" : "Hapus"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}