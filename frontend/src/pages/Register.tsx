import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, ShieldAlert } from "lucide-react";
import { apiPost } from "@/lib/api";
import { errorMessage } from "@/lib/format";
import { useMe } from "@/lib/session";
import type { Role, User } from "@/lib/types";
import { ROLE_LABELS } from "@/lib/types";
import { buttonVariants } from "@/components/ui/button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Register() {
  useMe(); // warms the session cache; the page itself renders identically without it
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("pegawai");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiPost<User>("/auth/register", { name, email, password, role });
      setSubmitted(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-svh items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center gap-3">
          <img
            src="/logo-mark.png"
            alt="Logo Putra Rahayu"
            className="size-12 rounded-xl border border-slate-200 bg-white object-contain p-1"
            data-testid="register-logo"
          />
          <div>
            <p className="font-heading text-base font-bold tracking-tight">Toko Putra Rahayu</p>
            <p className="text-xs text-muted-foreground">Kasir Toko Bangunan</p>
          </div>
        </div>

        {submitted ? (
          <div
            className="rounded-xl border border-green-200 bg-green-50 p-6 text-center"
            data-testid="register-success-panel"
          >
            <CheckCircle2 className="mx-auto size-10 text-green-600" />
            <h2 className="mt-3 font-heading text-xl font-bold tracking-tight">
              Pendaftaran Berhasil
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-green-800">
              Akun <b>{email}</b> sedang menunggu persetujuan pemilik toko (owner). Silakan hubungi
              owner untuk mengaktifkan akun Anda sebelum dapat login.
            </p>
            <Link
              to="/login"
              className={`${buttonVariants({ variant: "outline" })} mt-4`}
              data-testid="register-back-to-login"
            >
              Kembali ke Halaman Masuk
            </Link>
          </div>
        ) : (
          <>
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
              <p className="flex items-start gap-2 text-sm text-amber-900">
                <ShieldAlert className="mt-0.5 size-4 shrink-0" />
                Setiap pendaftaran baru memerlukan persetujuan pemilik toko (owner) sebelum akun
                dapat digunakan.
              </p>
            </div>

            <h2 className="mt-6 font-heading text-2xl font-bold tracking-tight">Daftar Akun</h2>
            <p className="mt-1 text-sm text-muted-foreground">Untuk pegawai dan owner toko</p>

            {error && (
              <div
                className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                data-testid="register-error"
              >
                {error}
              </div>
            )}

            <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="register-name">Nama Lengkap</Label>
                <Input
                  id="register-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nama Anda"
                  required
                  data-testid="register-name-input"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="register-email">Email</Label>
                <Input
                  id="register-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@putrarahayu.com"
                  required
                  autoComplete="email"
                  data-testid="register-email-input"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="register-password">Password</Label>
                <Input
                  id="register-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  data-testid="register-password-input"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="register-role">Daftar sebagai</Label>
                <Select value={role} onValueChange={(value: string) => setRole(value as Role)}>
                  <SelectTrigger id="register-role" data-testid="register-role-select">
                    <SelectValue>{(value: string) => ROLE_LABELS[value as Role]}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pegawai">Pegawai (Kasir)</SelectItem>
                    <SelectItem value="owner">Owner (Pemilik)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="submit"
                size="lg"
                disabled={submitting}
                className="active:scale-[0.98]"
                data-testid="register-submit-button"
              >
                {submitting ? "Mendaftarkan…" : "Daftar"}
              </Button>
            </form>

            <p className="mt-4 text-sm text-muted-foreground">
              Sudah punya akun?{" "}
              <Link
                to="/login"
                className="font-medium text-primary hover:underline"
                data-testid="register-login-link"
              >
                Masuk di sini
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}