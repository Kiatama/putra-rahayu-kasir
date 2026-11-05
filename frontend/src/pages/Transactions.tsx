import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarX2, Eye, Trash2 } from "lucide-react";
import { apiDelete, apiGet } from "@/lib/api";
import { errorMessage, formatDateTime, formatRupiah } from "@/lib/format";
import { PAYMENT_LABELS } from "@/lib/types";
import type { Transaction } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function Transactions() {
  const queryClient = useQueryClient();
  const [date, setDate] = useState("");
  const [deleting, setDeleting] = useState<Transaction | null>(null);
  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["transactions", date],
    queryFn: () => apiGet<Transaction[]>(`/transactions${date ? `?date=${date}` : ""}`),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete<void>(`/transactions/${id}`),
    onSuccess: () => {
      toast.success("Transaksi dihapus dan stok dikembalikan");
      setDeleting(null);
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["products"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-bold tracking-tight">Riwayat Transaksi</h1>
          <p className="text-sm text-muted-foreground">
            {transactions.length} transaksi {date ? `pada ${date}` : "terbaru"}
          </p>
        </div>
        <div className="flex items-end gap-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="transactions-date" className="text-xs">
              Filter tanggal
            </Label>
            <Input
              id="transactions-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-44"
              data-testid="transactions-date-input"
            />
          </div>
          {date && (
            <Button
              variant="outline"
              onClick={() => setDate("")}
              data-testid="transactions-date-clear-button"
            >
              <CalendarX2 className="size-4" />
              Semua
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : transactions.length === 0 ? (
        <p className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          Belum ada transaksi {date ? "pada tanggal ini" : ""}
        </p>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>No. Nota</TableHead>
                  <TableHead>Waktu</TableHead>
                  <TableHead>Kasir</TableHead>
                  <TableHead>Pelanggan</TableHead>
                  <TableHead>Metode</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => (
                  <TableRow key={tx.id} data-testid={`transaction-row-${tx.invoice_no.toLowerCase()}`}>
                    <TableCell className="font-mono text-xs font-semibold">{tx.invoice_no}</TableCell>
                    <TableCell className="text-sm">{formatDateTime(tx.created_at)}</TableCell>
                    <TableCell className="text-sm">{tx.cashier_name}</TableCell>
                    <TableCell className="text-sm">{tx.customer_name ?? "-"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{PAYMENT_LABELS[tx.payment_method]}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm font-bold">
                      {formatRupiah(tx.total)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Link
                          to={`/receipt/${tx.id}`}
                          className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
                          aria-label="Lihat struk"
                          data-testid={`transaction-view-${tx.invoice_no.toLowerCase()}`}
                        >
                          <Eye className="size-4" />
                        </Link>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-destructive"
                          aria-label="Hapus transaksi"
                          onClick={() => setDeleting(tx)}
                          data-testid={`transaction-delete-button-${tx.invoice_no.toLowerCase()}`}
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
            {transactions.map((tx) => (
              <div
                key={tx.id}
                className="flex flex-col gap-2 rounded-xl border bg-card p-3"
                data-testid={`transaction-card-${tx.invoice_no.toLowerCase()}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-mono text-sm font-semibold">{tx.invoice_no}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {formatDateTime(tx.created_at)} — {tx.cashier_name}
                    </p>
                  </div>
                  <Badge variant="outline">{PAYMENT_LABELS[tx.payment_method]}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-base font-bold">{formatRupiah(tx.total)}</span>
                  <div className="flex gap-1">
                    <Link
                      to={`/receipt/${tx.id}`}
                      className={buttonVariants({ variant: "outline", size: "icon-sm" })}
                      aria-label="Lihat struk"
                      data-testid={`transaction-view-${tx.invoice_no.toLowerCase()}`}
                    >
                      <Eye className="size-4" />
                    </Link>
                    <Button
                      variant="outline"
                      size="icon-sm"
                      className="text-destructive"
                      aria-label="Hapus transaksi"
                      onClick={() => setDeleting(tx)}
                      data-testid={`transaction-delete-button-${tx.invoice_no.toLowerCase()}`}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Delete confirm dialog */}
      <Dialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading">Hapus Transaksi</DialogTitle>
            <DialogDescription>
              Transaksi <b>{deleting?.invoice_no}</b> akan dihapus dan stok produk dikembalikan
              seperti semula.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setDeleting(null)}
              data-testid="transaction-delete-cancel-button"
            >
              Batal
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={() => deleting && deleteMutation.mutate(deleting.id)}
              disabled={deleteMutation.isPending}
              data-testid="transaction-delete-confirm-button"
            >
              {deleteMutation.isPending ? "Menghapus…" : "Hapus"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}