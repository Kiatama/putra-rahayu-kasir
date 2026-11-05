import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import AppLayout from "@/components/AppLayout";
import { useMe } from "@/lib/session";
import Dashboard from "@/pages/Dashboard";
import Login from "@/pages/Login";
import Pos from "@/pages/Pos";
import Products from "@/pages/Products";
import Receipt from "@/pages/Receipt";
import Register from "@/pages/Register";
import StockInPage from "@/pages/StockIn";
import Transactions from "@/pages/Transactions";
import UsersPage from "@/pages/Users";

function RequireAuth({ children }: { children: ReactNode }) {
  const { data: me, isLoading } = useMe();
  if (isLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Memuat…</p>
      </div>
    );
  }
  if (!me) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RequireOwner({ children }: { children: ReactNode }) {
  const { data: me, isLoading } = useMe();
  if (isLoading) return null;
  if (!me) return <Navigate to="/login" replace />;
  if (me.role !== "owner") return <Navigate to="/pos" replace />;
  return <>{children}</>;
}

// One <Route> per page in src/pages; BrowserRouter already wraps this in main.tsx.
export default function App() {
  return (
    <>
      <Toaster richColors />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          element={
            <RequireAuth>
              <AppLayout />
            </RequireAuth>
          }
        >
          <Route path="/pos" element={<Pos />} />
          <Route path="/products" element={<Products />} />
          <Route path="/stock-in" element={<StockInPage />} />
          <Route path="/receipt/:id" element={<Receipt />} />
          <Route
            path="/dashboard"
            element={
              <RequireOwner>
                <Dashboard />
              </RequireOwner>
            }
          />
          <Route
            path="/transactions"
            element={
              <RequireOwner>
                <Transactions />
              </RequireOwner>
            }
          />
          <Route
            path="/users"
            element={
              <RequireOwner>
                <UsersPage />
              </RequireOwner>
            }
          />
        </Route>
        <Route path="/" element={<Navigate to="/pos" replace />} />
        <Route path="*" element={<Navigate to="/pos" replace />} />
      </Routes>
    </>
  );
}