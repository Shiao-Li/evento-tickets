export const EVENT_TZ = "America/Guayaquil";
const OFFSET_MS = 5 * 60 * 60 * 1000; // Ecuador continental: UTC-5, sin horario de verano

export function money(cents: number): string {
  return new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" }).format(cents / 100);
}

export function fmtDate(
  d: Date | string,
  opts: Intl.DateTimeFormatOptions = { dateStyle: "full", timeStyle: "short" }
): string {
  return new Date(d).toLocaleString("es-EC", { timeZone: EVENT_TZ, ...opts });
}

/** Date -> valor para <input type="datetime-local"> en hora de Ecuador. */
export function toInputValue(d: Date): string {
  return new Date(d.getTime() - OFFSET_MS).toISOString().slice(0, 16);
}

/** Valor de <input type="datetime-local"> (hora de Ecuador) -> Date UTC. */
export function fromInputValue(v: string): Date {
  return new Date(`${v}:00-05:00`);
}

export const serialLabel = (n: number) => String(n).padStart(3, "0");

export const STATUS_LABEL: Record<string, string> = {
  pending: "Pendiente de pago",
  receipt_uploaded: "Comprobante en revisión",
  approved: "Aprobada",
  rejected: "Rechazada",
  expired: "Expirada",
  cancelled: "Cancelada",
};

export const STATUS_TONE: Record<string, string> = {
  pending: "warn",
  receipt_uploaded: "info",
  approved: "ok",
  rejected: "bad",
  expired: "muted",
  cancelled: "muted",
};

export function appUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "http://localhost:3000";
}

/** Link de WhatsApp (wa.me) a partir de un teléfono ecuatoriano o internacional ya normalizado. */
export function waLink(phone: string, text: string): string {
  let digits = phone.replace(/\D/g, "");
  if (!phone.startsWith("+") && digits.startsWith("0")) digits = "593" + digits.slice(1);
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
