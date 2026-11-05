// Locale formatting helpers — Indonesian Rupiah, dates in id-ID.

const rupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export const formatRupiah = (value: number) => rupiah.format(value);

export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

export const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

// FastAPI 422s carry a {detail: [...]} list; other errors a string detail.
export function errorMessage(error: unknown): string {
  if (error && typeof error === "object" && "body" in error) {
    const body = (error as { body: unknown }).body;
    if (body && typeof body === "object" && "detail" in body) {
      const detail = (body as { detail: unknown }).detail;
      if (typeof detail === "string") return detail;
      if (Array.isArray(detail) && detail.length > 0) {
        const first = detail[0] as { msg?: string; loc?: (string | number)[] };
        const field = first.loc?.slice(1).join(".") ?? "";
        return first.msg ? `${field ? `${field}: ` : ""}${first.msg}` : "Data tidak valid";
      }
    }
  }
  return error instanceof Error ? error.message : "Terjadi kesalahan";
}