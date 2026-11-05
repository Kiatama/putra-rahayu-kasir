import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Printer } from "lucide-react";
import { apiGet } from "@/lib/api";
import { formatDateTime, formatRupiah } from "@/lib/format";
import { PAYMENT_LABELS } from "@/lib/types";
import type { Transaction } from "@/lib/types";
import { buttonVariants } from "@/components/ui/button";
import { Button } from "@/components/ui/button";

export default function Receipt() {
  const { id } = useParams<{ id: string }>();
  const { data: tx, isLoading, isError } = useQuery({
    queryKey: ["transaction", id],
    queryFn: () => apiGet<Transaction>(`/transactions/${id}`),
    retry: false,
  });

  return (
    <div className="mx-auto max-w-lg">
      <div className="no-print mb-4 flex items-center justify-between gap-3">
        <Link
          to="/pos"
          className={buttonVariants({ variant: "ghost", size: "sm" })}
          data-testid="receipt-back-button"
        >
          <ArrowLeft className="size-4" />
          Kasir
        </Link>
        <Button
          onClick={() => window.print()}
          disabled={!tx}
          className="active:scale-[0.98]"
          data-testid="receipt-print-button"
        >
          <Printer className="size-4" />
          Cetak Struk
        </Button>
      </div>

      {isLoading && <div className="h-96 animate-pulse rounded-xl bg-muted" />}

      {isError && (
        <div className="rounded-xl border p-10 text-center text-sm text-muted-foreground">
          Struk tidak ditemukan.{" "}
          <Link to="/pos" className="font-medium text-primary hover:underline">
            Kembali ke kasir
          </Link>
        </div>
      )}

      {tx && (
        <div
          className="print-area mx-auto w-full max-w-[400px] rounded-xl border bg-white p-6 font-mono text-[13px] leading-relaxed text-slate-900 shadow-sm"
          data-testid="receipt-paper"
        >
          <div className="flex flex-col items-center text-center">
            <img
              src="/logo-mark.png"
              alt="Logo Putra Rahayu"
              className="mb-1 size-16 object-contain"
              data-testid="receipt-logo"
            />
            <p className="font-heading text-base font-bold tracking-tight">
              TOKO BAHAN BANGUNAN PUTRA RAHAYU
            </p>
            <p className="text-[11px] text-slate-500">Jl. Raya Cileunyi No. 300</p>
            <p className="text-[11px] text-slate-500">Telp. 022 (7798209) / 0813-3399-9691</p>
          </div>

          <div className="my-3 border-t border-dashed border-slate-300" />

          <div className="space-y-0.5 text-[12px]">
            <div className="flex justify-between">
              <span>No. Nota</span>
              <span data-testid="receipt-invoice-no">{tx.invoice_no}</span>
            </div>
            <div className="flex justify-between">
              <span>Tanggal</span>
              <span>{formatDateTime(tx.created_at)}</span>
            </div>
            <div className="flex justify-between">
              <span>Kasir</span>
              <span>{tx.cashier_name}</span>
            </div>
            {tx.customer_name && (
              <div className="flex justify-between">
                <span>Pelanggan</span>
                <span>{tx.customer_name}</span>
              </div>
            )}
          </div>

          <div className="my-3 border-t border-dashed border-slate-300" />

          <table className="w-full text-[12px]">
            <tbody>
              {tx.items.map((item) => (
                <tr key={item.product_id}>
                  <td className="py-0.5 align-top">
                    {item.name}
                    <br />
                    <span className="text-slate-500">
                      {item.qty} {item.unit} x {formatRupiah(item.price)}
                    </span>
                  </td>
                  <td className="py-0.5 text-right align-top font-semibold">
                    {formatRupiah(item.subtotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="my-3 border-t border-dashed border-slate-300" />

          <div className="flex justify-between text-sm font-bold">
            <span>TOTAL</span>
            <span data-testid="receipt-total">{formatRupiah(tx.total)}</span>
          </div>

          <div className="mt-1 space-y-0.5 text-[12px]">
            <div className="flex justify-between">
              <span>Metode Bayar</span>
              <span>{PAYMENT_LABELS[tx.payment_method]}</span>
            </div>
            {tx.payment_method === "tunai" && tx.amount_paid != null && (
              <>
                <div className="flex justify-between">
                  <span>Tunai</span>
                  <span>{formatRupiah(tx.amount_paid)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Kembalian</span>
                  <span>{formatRupiah(tx.change_due ?? 0)}</span>
                </div>
              </>
            )}
            {tx.payment_reference && (
              <div className="flex justify-between gap-3">
                <span>Referensi</span>
                <span className="text-right">{tx.payment_reference}</span>
              </div>
            )}
          </div>

          <div className="mt-3 rounded bg-green-50 px-2 py-1 text-center text-[11px] font-semibold text-green-700">
            PEMBAYARAN SUDAH DITERIMA
          </div>

          <p className="mt-3 text-center text-[10px] leading-relaxed text-slate-500">
            Barang yang sudah dibeli tidak dapat ditukar/dikembalikan tanpa bukti nota.
            <br />
            Terima kasih telah berbelanja.
          </p>
        </div>
      )}
    </div>
  );
}