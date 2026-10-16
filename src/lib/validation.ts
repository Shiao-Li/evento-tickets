import { z } from "zod";
import { cleanText, docField, emailField, nameField, normalizePhone, phoneField, PHONE_MSG } from "./validators";

/** Compra pública. `website` es un honeypot: los humanos no lo ven, los bots lo rellenan. */
export const orderSchema = z.object({
  ticketTypeId: z.string().uuid("Elige un tipo de entrada"),
  name: nameField,
  email: emailField,
  document: docField,
  phone: phoneField,
  quantity: z.coerce
    .number({ invalid_type_error: "Cantidad inválida" })
    .int("Cantidad inválida")
    .min(1, "Mínimo 1 entrada")
    .max(50, "Cantidad inválida"),
  website: z.string().max(0, "Solicitud inválida").optional(),
});
export type OrderInput = z.infer<typeof orderSchema>;

/** Venta registrada manualmente por el admin (efectivo, venta previa, etc.). */
export const PAYMENT_METHODS = ["efectivo", "transferencia", "deposito", "otro"] as const;

export const manualSaleSchema = z.object({
  ticketTypeId: z.string().uuid("Elige un tipo de entrada"),
  name: nameField,
  document: docField,
  email: z
    .string()
    .transform((s) => s.trim().toLowerCase())
    .refine((v) => v === "" || (v.length <= 120 && z.string().email().safeParse(v).success), "Email inválido"),
  phone: z.string().transform((s, ctx) => {
    const t = s.trim();
    if (!t) return "";
    const p = normalizePhone(t);
    if (!p) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: PHONE_MSG });
      return z.NEVER;
    }
    return p;
  }),
  quantity: z.coerce
    .number({ invalid_type_error: "Cantidad inválida" })
    .int("Cantidad inválida")
    .min(1, "Mínimo 1 entrada")
    .max(200, "Cantidad inválida"),
  paymentMethod: z.enum(PAYMENT_METHODS, { errorMap: () => ({ message: "Método de pago inválido" }) }),
  amount: z
    .string()
    .transform((s) => s.trim())
    .refine((s) => s === "" || /^\d{1,6}([.,]\d{1,2})?$/.test(s), "Monto inválido (ej. 10 o 10.50)")
    .transform((s) => (s === "" ? null : Math.round(Number(s.replace(",", ".")) * 100))),
  notes: z.string().transform((s) => cleanText(s, 300)),
});
export type ManualSaleInput = z.infer<typeof manualSaleSchema>;
