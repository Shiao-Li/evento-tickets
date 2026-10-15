import { createHmac, timingSafeEqual } from "crypto";

function secret(): string {
  const s = process.env.TICKET_SECRET;
  if (!s || s.length < 32) throw new Error("TICKET_SECRET no configurado (mínimo 32 caracteres).");
  return s;
}

const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");

/** Token del QR: v1.<ticketId>.<HMAC-SHA256>. Solo contiene el id; el estado vive en la DB. */
export function signTicketToken(ticketId: string): string {
  const payload = `v1.${ticketId}`;
  return `${payload}.${sign(payload)}`;
}

/** Devuelve el ticketId si la firma es válida, o null. */
export function verifyTicketToken(token: string): string | null {
  const parts = token.trim().split(".");
  if (parts.length !== 3 || parts[0] !== "v1" || !parts[1]) return null;
  const [version, id, sig] = parts;
  if (!safeEqual(sig, sign(`${version}.${id}`))) return null;
  return id;
}

export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}
