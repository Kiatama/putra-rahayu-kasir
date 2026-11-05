// Hand-written mirrors of the backend Pydantic models — keep in sync in the same edit.

export type Role = "owner" | "pegawai";
export type UserStatus = "pending" | "approved" | "rejected";
export type PaymentMethod = "tunai" | "transfer" | "qris";

// models/user.py :: UserPublic
export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: UserStatus;
  created_at: string;
}

// models/product.py :: Product
export interface Product {
  id: string;
  code: string;
  name: string;
  category: string;
  unit: string;
  price: number;
  stock: number;
  low_stock_threshold: number;
  cost_avg: number | null;
  cost_last: number | null;
  created_at: string;
}

// models/transaction.py :: TransactionItem
export interface TransactionItem {
  product_id: string;
  code: string;
  name: string;
  unit: string;
  price: number;
  qty: number;
  subtotal: number;
  cost_avg: number | null;
  cost_last: number | null;
}

// models/transaction.py :: Transaction
export interface Transaction {
  id: string;
  invoice_no: string;
  cashier_id: string;
  cashier_name: string;
  items: TransactionItem[];
  total: number;
  payment_method: PaymentMethod;
  payment_received: boolean;
  amount_paid: number | null;
  change_due: number | null;
  payment_reference: string | null;
  customer_name: string | null;
  date: string;
  created_at: string;
}

// models/dashboard.py :: SalesPoint
export interface SalesPoint {
  date: string;
  total: number;
  count: number;
}

// models/dashboard.py :: DashboardSummary
export interface DashboardSummary {
  omzet_today: number;
  transaksi_today: number;
  omzet_month: number;
  produk_count: number;
  laba_today: number;
  laba_month: number;
  cost_method: CostMethod;
  today: string;
  month_start: string;
  stok_menipis: Product[];
  sales_7d: SalesPoint[];
  recent_transactions: Transaction[];
}

export type CostMethod = "avg" | "last";

// models/dashboard.py :: ProfitItem
export interface ProfitItem {
  product_id: string;
  code: string;
  name: string;
  unit: string;
  qty: number;
  revenue: number;
  cost: number;
  profit: number;
  margin_pct: number | null;
  has_cost: boolean;
  qty_no_cost: number;
}

// models/dashboard.py :: ProfitReport
export interface ProfitReport {
  start: string;
  end: string;
  cost_method: CostMethod;
  revenue: number;
  cost: number;
  profit: number;
  revenue_no_cost: number;
  items: ProfitItem[];
}

// models/stock_in.py :: StockShortage (body of the 409 from POST /stock-in/{id}/cancel)
export interface StockShortage {
  product_id: string;
  name: string;
  unit: string;
  qty: number;
  stock: number;
}

// models/stock_in.py :: StockInItem
export interface StockInItem {
  product_id: string;
  code: string;
  name: string;
  unit: string;
  qty: number;
  cost_price: number;
  subtotal: number;
  stock_after: number;
  prev_cost_avg: number | null;
  prev_cost_last: number | null;
}

// models/stock_in.py :: StockIn
export interface StockIn {
  id: string;
  ref_no: string;
  supplier_name: string;
  note: string | null;
  items: StockInItem[];
  total_cost: number;
  total_qty: number;
  received_by_id: string;
  received_by_name: string;
  date: string;
  status: "active" | "cancelled";
  cancelled_at: string | null;
  cancelled_by_name: string | null;
  cancel_forced: boolean;
  created_at: string;
}

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  tunai: "Tunai",
  transfer: "Transfer Bank",
  qris: "QRIS",
};

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner (Pemilik)",
  pegawai: "Pegawai (Kasir)",
};

export const USER_STATUS_LABELS: Record<UserStatus, string> = {
  pending: "Menunggu Persetujuan",
  approved: "Aktif",
  rejected: "Ditolak",
};

export const UNITS = [
  "Sak",
  "Batang",
  "Karung",
  "Meter",
  "Kaleng",
  "Kg",
  "Lembar",
  "Dus",
  "Pcs",
  "Roll",
];