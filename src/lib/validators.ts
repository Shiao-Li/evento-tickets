import { z } from "zod";

/* ---------- Limpieza de texto ---------- */

const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/** Quita caracteres de control (conserva saltos de línea), recorta y limita el largo. */
export const cleanText = (s: string, max: number) => s.replace(CONTROL, "").trim().slice(0, max);

const collapse = (s: string) => s.replace(/\s+/g, " ").trim();

/** Texto de una línea: sin < > ni caracteres de control. */
export const plainText = (min: number, max: number, label: string) =>
  z
    .string({ required_error: `${label} requerido` })
    .transform(collapse)
    .pipe(
      z
        .string()
        .min(min, `${label} requerido`)
        .max(max, `${label}: máximo ${max} caracteres`)
        .refine((s) => !/[<>\u0000-\u001F\u007F]/.test(s), `${label}: contiene caracteres no permitidos`)
    );

/* ---------- Nombre ---------- */

const NAME_RE = /^\p{L}[\p{L}\s.'’-]*$/u;

export const nameField = z
  .string({ required_error: "Nombre requerido" })
  .transform(collapse)
  .pipe(
    z
      .string()
      .min(3, "Ingresa tu nombre completo")
      .max(100, "El nombre es demasiado largo")
      .regex(NAME_RE, "El nombre solo puede tener letras, espacios, punto, apóstrofe y guion")
      .refine((s) => s.includes(" "), "Ingresa nombre y apellido")
  );

/* ---------- Email ---------- */

export const emailField = z
  .string({ required_error: "Email requerido" })
  .trim()
  .toLowerCase()
  .max(120, "Email demasiado largo")
  .email("Email inválido");

/* ---------- Cédula / RUC / Pasaporte ---------- */

const provinceOk = (c: string) => {
  const p = Number(c.slice(0, 2));
  return (p >= 1 && p <= 24) || p === 30;
};

/** Cédula ecuatoriana: 10 dígitos, provincia válida y dígito verificador (módulo 10). */
export function cedulaOk(c: string): boolean {
  if (!/^\d{10}$/.test(c) || !provinceOk(c) || Number(c[2]) >= 6) return false;
  const coef = [2, 1, 2, 1, 2, 1, 2, 1, 2];
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let v = Number(c[i]) * coef[i];
    if (v > 9) v -= 9;
    sum += v;
  }
  return (10 - (sum % 10)) % 10 === Number(c[9]);
}

/** Devuelve un mensaje de error o null si el documento es válido. */
export function checkDocument(raw: string): string | null {
  const v = raw.trim().toUpperCase();
  if (/^\d+$/.test(v)) {
    if (v.length === 10) return cedulaOk(v) ? null : "La cédula no es válida (revisa los 10 dígitos)";
    if (v.length === 13) {
      if (!provinceOk(v) || Number(v.slice(10)) === 0) return "El RUC no es válido";
      // Persona natural (3.er dígito < 6): los 10 primeros deben ser una cédula válida.
      if (Number(v[2]) < 6 && !cedulaOk(v.slice(0, 10))) return "El RUC no es válido (revisa los 10 primeros dígitos)";
      return null;
    }
    return "Ingresa una cédula (10 dígitos) o un RUC (13 dígitos)";
  }
  if (/^[A-Z0-9]{5,20}$/.test(v) && /\d/.test(v)) return null; // pasaporte
  return "Documento inválido: usa cédula, RUC o pasaporte (5 a 20 letras o números)";
}

export const docField = z
  .string({ required_error: "Documento requerido" })
  .transform((s) => s.trim().toUpperCase())
  .superRefine((v, ctx) => {
    const e = checkDocument(v);
    if (e) ctx.addIssue({ code: z.ZodIssueCode.custom, message: e });
  });

/* ---------- Teléfono ---------- */

export const PHONE_MSG = "Teléfono inválido (ej. 0991234567 o +593991234567)";

/** Devuelve el teléfono normalizado (sin espacios/guiones) o null. */
export function normalizePhone(raw: string): string | null {
  const v = raw.replace(/[\s().-]/g, "");
  if (/^09\d{8}$/.test(v) || /^0[2-7]\d{7}$/.test(v) || /^\+\d{8,15}$/.test(v)) return v;
  return null;
}

export const phoneField = z
  .string({ required_error: "Teléfono requerido" })
  .transform((s, ctx) => {
    const p = normalizePhone(s);
    if (!p) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: PHONE_MSG });
      return z.NEVER;
    }
    return p;
  });
