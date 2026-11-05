import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { apiPost } from "@/lib/api";
import { errorMessage } from "@/lib/format";
import { beginSession, useMe } from "@/lib/session";
import type { User } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const HERO_URL =
  "https://images.unsplash.com/photo-1689942010216-dc412bb1e7a9?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NzV8MHwxfHNlYXJjaHwxfHxidWlsZGluZyUyMG1hdGVyaWFscyUyMHN0b3JlJTIwd2FyZWhvdXNlfGVufDB8fHx8MTc4NjkyNDc5N3ww&ixlib=rb-4.1.0&q=85";

const HERO_POINTS = [
  "Transaksi cepat: tunai, transfer, dan QRIS",
  "Struk otomatis dengan konfirmasi pembayaran diterima",
  "Stok real-time dengan peringatan stok menipis",
];

export default function Login() {
  const navigate = useNavigate();
  const { data: me } = useMe();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (me) navigate("/pos", { replace: true });
  }, [me, navigate]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const user = await apiPost<User>("/auth/login", { email, password });
      await beginSession(user);
      navigate("/pos", { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div
        className="relative hidden flex-col justify-between p-10 text-white lg:flex"
        style={{ backgroundImage: `url(${HERO_URL})`, backgroundSize: "cover", backgroundPosition: "center" }}
      >
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(135deg, rgba(15,23,42,0.92) 0%, rgba(30,41,59,0.85) 100%)",
          }}
        />
        <div className="relative">
          <img
            src="/logo-full.png"
            alt="Logo Toko Putra Rahayu"
            className="size-40 rounded-2xl bg-white object-contain p-2 shadow-xl"
            data-testid="login-hero-logo"
          />
        </div>
        <div className="relative max-w-md">
          <h1 className="font-heading text-4xl font-bold leading-tight tracking-tight">
            Kelola penjualan material toko Anda dalam satu aplikasi
          </h1>
          <ul className="mt-6 space-y-3 text-sm text-slate-200">
            {HERO_POINTS.map((point) => (
              <li key={point} className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-blue-400" />
                {point}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-slate-400">
          © {new Date().getFullYear()} Toko Putra Rahayu
        </p>
      </div>

      <div className="flex items-center justify-center bg-background px-4 py-10">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <img
              src="/logo-mark.png"
              alt="Logo Putra Rahayu"
              className="size-12 rounded-xl border border-slate-200 bg-white object-contain p-1"
              data-testid="login-mobile-logo"
            />
            <div>
              <p className="font-heading text-base font-bold tracking-tight">Toko Putra Rahayu</p>
              <p className="text-xs text-muted-foreground">Kasir Toko Bangunan</p>
            </div>
          </div>

          <h2 className="font-heading text-2xl font-bold tracking-tight">Masuk ke Aplikasi</h2>
          <p className="mt-1 text-sm text-muted-foreground">Gunakan akun pegawai atau owner Anda</p>

          {error && (
            <div
              className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
              data-testid="login-error"
            >
              {error}
            </div>
          )}

          <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="login-email">Email</Label>
              <Input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@putrarahayu.com"
                required
                autoComplete="email"
                data-testid="login-email-input"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="login-password">Password</Label>
              <Input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                data-testid="login-password-input"
              />
            </div>
            <Button
              type="submit"
              size="lg"
              disabled={submitting}
              className="active:scale-[0.98]"
              data-testid="login-submit-button"
            >
              {submitting ? "Memproses…" : "Masuk"}
            </Button>
          </form>

          <p className="mt-4 text-sm text-muted-foreground">
            Belum punya akun?{" "}
            <Link
              to="/register"
              className="font-medium text-primary hover:underline"
              data-testid="login-register-link"
            >
              Daftar di sini
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}