import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Boxes,
  CalendarRange,
  Coins,
  PiggyBank,
  ReceiptText,
  TrendingUp,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { apiGet } from "@/lib/api";
import { formatDateTime, formatRupiah } from "@/lib/format";
import { PAYMENT_LABELS } from "@/lib/types";
import type { CostMethod, DashboardSummary, ProfitReport } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

const METHOD_LABELS: Record<CostMethod, string> = {
  avg: "Harga beli rata-rata",
  last: "Harga beli terakhir",
};

function StatCard(props: {
  title: string;
  value: string;
  icon: LucideIcon;
  testid: string;
  tone?: "default" | "profit";
}) {
  const { title, value, icon: Icon, testid, tone = "default" } = props;
  return (
    <Card data-testid={testid}>
      <CardContent className="flex items-center gap-3 p-4">
        <span
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-lg",
            tone === "profit" ? "bg-green-50 text-green-700" : "bg-accent text-primary",
          )}
        >
          <Icon className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {title}
          </p>
          <p
            className={cn(
              "truncate font-mono text-lg font-bold tracking-tight",
              tone === "profit" && "text-green-700",
            )}
          >
            {value}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const [method, setMethod] = useState<CostMethod>("avg");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  const { data: summary, isLoading } = useQuery({
    queryKey: ["dashboard", "summary", method],
    queryFn: () => apiGet<DashboardSummary>(`/dashboard/summary?method=${method}`),
  });

  const rangeValid = !start || !end || start <= end;
  const profitParams = new URLSearchParams({ method });
  if (start) profitParams.set("start", start);
  if (end) profitParams.set("end", end);
  const { data: profit, isLoading: profitLoading } = useQuery({
    queryKey: ["dashboard", "profit", method, start, end],
    queryFn: () => apiGet<ProfitReport>(`/dashboard/profit?${profitParams.toString()}`),
    enabled: rangeValid,
  });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-bold tracking-tight">Dashboard Pemilik</h1>
          <p className="text-sm text-muted-foreground">Ringkasan penjualan & laba Toko Putra Rahayu</p>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Hitung laba dengan
          </span>
          <div className="inline-flex rounded-lg border bg-card p-1" data-testid="dashboard-cost-method">
            {(["avg", "last"] as CostMethod[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMethod(m)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  method === m ? "bg-primary text-white" : "text-slate-600 hover:bg-muted",
                )}
                data-testid={`dashboard-cost-method-${m}`}
              >
                {m === "avg" ? "Rata-rata" : "Terakhir"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : summary ? (
        <>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
            <StatCard
              title="Omzet Hari Ini"
              value={formatRupiah(summary.omzet_today)}
              icon={Wallet}
              testid="dashboard-omzet-today"
            />
            <StatCard
              title="Laba Kotor Hari Ini"
              value={formatRupiah(summary.laba_today)}
              icon={PiggyBank}
              testid="dashboard-laba-today"
              tone="profit"
            />
            <StatCard
              title="Transaksi Hari Ini"
              value={String(summary.transaksi_today)}
              icon={ReceiptText}
              testid="dashboard-transactions-today"
            />
            <StatCard
              title="Omzet Bulan Ini"
              value={formatRupiah(summary.omzet_month)}
              icon={TrendingUp}
              testid="dashboard-omzet-month"
            />
            <StatCard
              title="Laba Kotor Bulan Ini"
              value={formatRupiah(summary.laba_month)}
              icon={Coins}
              testid="dashboard-laba-month"
              tone="profit"
            />
            <StatCard
              title="Jumlah Produk"
              value={String(summary.produk_count)}
              icon={Boxes}
              testid="dashboard-product-count"
            />
          </div>

          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <CardTitle className="font-heading">Laba Kotor per Barang</CardTitle>
                  <CardDescription>
                    Omzet dikurangi {METHOD_LABELS[method].toLowerCase()} saat barang terjual
                  </CardDescription>
                </div>
                <div className="flex flex-wrap items-end gap-2">
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="profit-start" className="text-xs">
                      Dari
                    </Label>
                    <Input
                      id="profit-start"
                      type="date"
                      value={start || (profit?.start ?? summary.month_start)}
                      onChange={(e) => setStart(e.target.value)}
                      className="w-40"
                      data-testid="profit-start-input"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="profit-end" className="text-xs">
                      Sampai
                    </Label>
                    <Input
                      id="profit-end"
                      type="date"
                      value={end || (profit?.end ?? summary.today)}
                      onChange={(e) => setEnd(e.target.value)}
                      className="w-40"
                      data-testid="profit-end-input"
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setStart(summary.today);
                      setEnd(summary.today);
                    }}
                    data-testid="profit-range-today"
                  >
                    Hari Ini
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setStart("");
                      setEnd("");
                    }}
                    data-testid="profit-range-month"
                  >
                    <CalendarRange className="size-4" />
                    Bulan Ini
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {!rangeValid && (
                <p className="text-sm text-destructive" data-testid="profit-range-error">
                  Tanggal mulai harus sebelum tanggal selesai.
                </p>
              )}
              {profitLoading && rangeValid && <div className="h-40 animate-pulse rounded-lg bg-muted" />}
              {profit && rangeValid && (
                <>
                  <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted p-3 text-center">
                    <div>
                      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Omzet</p>
                      <p className="font-mono text-sm font-bold" data-testid="profit-total-revenue">
                        {formatRupiah(profit.revenue)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        Harga Beli
                      </p>
                      <p className="font-mono text-sm font-bold" data-testid="profit-total-cost">
                        {formatRupiah(profit.cost)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        Laba Kotor
                      </p>
                      <p className="font-mono text-sm font-bold text-green-700" data-testid="profit-total-profit">
                        {formatRupiah(profit.profit)}
                      </p>
                    </div>
                  </div>

                  {profit.revenue_no_cost > 0 && (
                    <p
                      className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-900"
                      data-testid="profit-no-cost-warning"
                    >
                      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                      Omzet {formatRupiah(profit.revenue_no_cost)} berasal dari barang yang belum
                      punya harga beli, sehingga tidak dihitung labanya. Isi harga beli di halaman
                      Produk atau catat lewat Stok Masuk.
                    </p>
                  )}

                  {profit.items.length === 0 ? (
                    <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                      Belum ada penjualan pada periode ini.
                    </p>
                  ) : (
                    <>
                      <div className="hidden overflow-hidden rounded-lg border md:block">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Barang</TableHead>
                              <TableHead className="text-right">Terjual</TableHead>
                              <TableHead className="text-right">Omzet</TableHead>
                              <TableHead className="text-right">Harga Beli</TableHead>
                              <TableHead className="text-right">Laba Kotor</TableHead>
                              <TableHead className="text-right">Margin</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {profit.items.map((item) => (
                              <TableRow
                                key={item.product_id}
                                data-testid={`profit-row-${item.code.toLowerCase()}`}
                              >
                                <TableCell>
                                  <p className="font-medium">{item.name}</p>
                                  <p className="font-mono text-[11px] text-muted-foreground">{item.code}</p>
                                </TableCell>
                                <TableCell className="text-right font-mono text-sm">
                                  {item.qty} {item.unit}
                                </TableCell>
                                <TableCell className="text-right font-mono text-sm">
                                  {formatRupiah(item.revenue)}
                                </TableCell>
                                <TableCell className="text-right font-mono text-sm">
                                  {item.has_cost ? formatRupiah(item.cost) : "-"}
                                </TableCell>
                                <TableCell className="text-right">
                                  {item.has_cost ? (
                                    <span
                                      className={cn(
                                        "font-mono text-sm font-bold",
                                        item.profit >= 0 ? "text-green-700" : "text-destructive",
                                      )}
                                    >
                                      {formatRupiah(item.profit)}
                                    </span>
                                  ) : (
                                    <Badge
                                      variant="outline"
                                      className="border-amber-300 bg-amber-50 text-amber-800"
                                    >
                                      Belum ada harga beli
                                    </Badge>
                                  )}
                                  {item.has_cost && item.qty_no_cost > 0 && (
                                    <p className="text-[10px] text-amber-700">
                                      {item.qty_no_cost} {item.unit} tanpa harga beli
                                    </p>
                                  )}
                                </TableCell>
                                <TableCell className="text-right font-mono text-sm">
                                  {item.margin_pct != null ? `${item.margin_pct}%` : "-"}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>

                      <div className="flex flex-col gap-2 md:hidden">
                        {profit.items.map((item) => (
                          <div
                            key={item.product_id}
                            className="flex flex-col gap-1 rounded-lg border p-3"
                            data-testid={`profit-card-${item.code.toLowerCase()}`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium">{item.name}</p>
                                <p className="text-[11px] text-muted-foreground">
                                  Terjual {item.qty} {item.unit} · omzet {formatRupiah(item.revenue)}
                                </p>
                              </div>
                              {item.has_cost ? (
                                <span
                                  className={cn(
                                    "font-mono text-sm font-bold",
                                    item.profit >= 0 ? "text-green-700" : "text-destructive",
                                  )}
                                >
                                  {formatRupiah(item.profit)}
                                </span>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="border-amber-300 bg-amber-50 text-[10px] text-amber-800"
                                >
                                  Belum ada harga beli
                                </Badge>
                              )}
                            </div>
                            {item.margin_pct != null && (
                              <p className="text-[11px] text-muted-foreground">
                                Margin {item.margin_pct}% · harga beli {formatRupiah(item.cost)}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-5">
            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle className="font-heading">Penjualan 7 Hari Terakhir</CardTitle>
                <CardDescription>Total omzet per hari</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={summary.sales_7d}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(value: string) => value.slice(5).replace("-", "/")}
                      tick={{ fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      width={56}
                      tickFormatter={(value: number) =>
                        value >= 1000000 ? `${value / 1000000}jt` : `${Math.round(value / 1000)}rb`
                      }
                      tick={{ fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      formatter={(value: number) => formatRupiah(value)}
                      labelFormatter={(label: string) => `Tanggal ${label}`}
                    />
                    <Bar dataKey="total" fill="#1D4ED8" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-heading">
                  <AlertTriangle className="size-4 text-destructive" />
                  Stok Menipis
                </CardTitle>
                <CardDescription>Segera pesan ulang</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {summary.stok_menipis.length === 0 && (
                  <p className="text-sm text-muted-foreground">Semua stok aman.</p>
                )}
                {summary.stok_menipis.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-2 rounded-lg border p-2.5"
                    data-testid={`dashboard-low-stock-${p.code.toLowerCase()}`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{p.name}</p>
                      <p className="font-mono text-[11px] text-muted-foreground">{p.code}</p>
                    </div>
                    <Badge variant="destructive">
                      Sisa {p.stock} {p.unit}
                    </Badge>
                  </div>
                ))}
                <Link
                  to="/products"
                  className={buttonVariants({ variant: "outline", size: "sm" }) + " mt-1"}
                  data-testid="dashboard-manage-products-link"
                >
                  Kelola Produk
                </Link>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="font-heading">Transaksi Terakhir</CardTitle>
              <CardDescription>5 transaksi terbaru dari semua kasir</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {summary.recent_transactions.length === 0 && (
                <p className="text-sm text-muted-foreground">Belum ada transaksi.</p>
              )}
              {summary.recent_transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2.5"
                  data-testid={`dashboard-recent-${tx.invoice_no.toLowerCase()}`}
                >
                  <div className="min-w-0">
                    <p className="font-mono text-sm font-semibold">{tx.invoice_no}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {formatDateTime(tx.created_at)} — {tx.cashier_name}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{PAYMENT_LABELS[tx.payment_method]}</Badge>
                    <span className="font-mono text-sm font-bold">{formatRupiah(tx.total)}</span>
                  </div>
                </div>
              ))}
              <Link
                to="/transactions"
                className={buttonVariants({ variant: "outline", size: "sm" }) + " mt-1"}
                data-testid="dashboard-all-transactions-link"
              >
                Lihat Semua Transaksi
              </Link>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}