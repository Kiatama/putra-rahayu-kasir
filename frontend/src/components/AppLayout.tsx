import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Bell,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  PackagePlus,
  ReceiptText,
  ShoppingCart,
  Users,
} from "lucide-react";
import { apiGet } from "@/lib/api";
import { endSession, useMe } from "@/lib/session";
import type { Product } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const NAV = [
  { to: "/pos", label: "Kasir", icon: ShoppingCart, roles: ["owner", "pegawai"] },
  { to: "/products", label: "Produk", icon: Package, roles: ["owner", "pegawai"] },
  { to: "/stock-in", label: "Stok Masuk", icon: PackagePlus, roles: ["owner", "pegawai"] },
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["owner"] },
  { to: "/transactions", label: "Transaksi", icon: ReceiptText, roles: ["owner"] },
  { to: "/users", label: "Pengguna", icon: Users, roles: ["owner"] },
];

export default function AppLayout() {
  const { data: me } = useMe();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: () => apiGet<Product[]>("/products"),
    enabled: !!me,
  });

  const lowCount = products.filter((p) => p.stock < p.low_stock_threshold).length;
  const navItems = NAV.filter((item) => (me ? item.roles.includes(me.role) : false));

  const handleLogout = async () => {
    await endSession();
    navigate("/login", { replace: true });
  };

  const initials = (me?.name ?? "?")
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-svh bg-background">
      <header className="no-print sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMenuOpen(true)}
              aria-label="Buka menu"
              data-testid="header-menu-button"
            >
              <Menu className="size-5" />
            </Button>
            <Link to="/pos" className="flex items-center gap-2.5">
              <img
                src="/logo-mark.png"
                alt="Logo Putra Rahayu"
                className="size-10 rounded-lg border border-slate-200 bg-white object-contain p-0.5"
                data-testid="header-logo"
              />
              <span className="hidden sm:block">
                <span className="block font-heading text-sm font-bold leading-tight tracking-tight">
                  Toko Putra Rahayu
                </span>
                <span className="block text-[11px] text-muted-foreground">Kasir Toko Bangunan</span>
              </span>
            </Link>
          </div>

          <nav className="hidden items-center gap-1 lg:flex">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive ? "bg-primary text-white" : "text-slate-600 hover:bg-muted",
                  )
                }
                data-testid={`nav-link-${item.to.slice(1)}`}
              >
                <item.icon className="size-4" />
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Link
              to="/products"
              className="relative flex size-10 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-muted"
              aria-label="Peringatan stok menipis"
              data-testid="header-low-stock-alert"
            >
              <Bell className="size-5" />
              {lowCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex size-5 items-center justify-center rounded-full bg-destructive font-mono text-[10px] font-bold text-white">
                  {lowCount}
                </span>
              )}
            </Link>

            <DropdownMenu>
              <DropdownMenuTrigger
                className="flex items-center gap-2 rounded-full border border-slate-200 py-1 pl-1 pr-3 transition-colors hover:bg-muted"
                data-testid="header-user-menu"
              >
                <span className="flex size-8 items-center justify-center rounded-full bg-primary font-mono text-xs font-bold text-white">
                  {initials}
                </span>
                <span className="hidden text-left sm:block">
                  <span className="block max-w-32 truncate text-xs font-semibold leading-tight">
                    {me?.name}
                  </span>
                  <span className="block text-[11px] text-muted-foreground">
                    {me?.role === "owner" ? "Pemilik (Owner)" : "Pegawai / Kasir"}
                  </span>
                </span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {/* base-ui: a Menu label must live inside a Menu.Group */}
                <DropdownMenuGroup>
                  <DropdownMenuLabel>
                    <p className="text-sm font-semibold">{me?.name}</p>
                    <p className="text-xs font-normal text-muted-foreground">{me?.email}</p>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={handleLogout}
                  data-testid="logout-button"
                >
                  <LogOut className="size-4" />
                  Keluar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        <Outlet />
      </main>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="w-72">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2 text-left font-heading">
              <img src="/logo-mark.png" alt="" className="size-8 object-contain" />
              Toko Putra Rahayu
            </SheetTitle>
          </SheetHeader>
          <nav className="flex flex-col gap-1 px-3 pb-6">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive ? "bg-primary text-white" : "text-slate-600 hover:bg-muted",
                  )
                }
                data-testid={`mobile-nav-${item.to.slice(1)}`}
              >
                <item.icon className="size-4" />
                {item.label}
              </NavLink>
            ))}
            <button
              type="button"
              onClick={handleLogout}
              className="mt-2 flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-destructive transition-colors hover:bg-red-50"
              data-testid="mobile-logout-button"
            >
              <LogOut className="size-4" />
              Keluar
            </button>
          </nav>
        </SheetContent>
      </Sheet>
    </div>
  );
}