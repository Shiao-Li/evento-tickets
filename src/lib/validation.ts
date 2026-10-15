import { z } from "zod";

export const orderSchema = z.object({
  name: z.string().trim().min(3, "Ingresa tu nombre completo").max(100),
  email: z.string().trim().toLowerCase().email("Email inválido").max(120),
  document: z.string().trim().regex(/^[0-9A-Za-z-]{5,20}$/, "Cédula o RUC inválido"),
  phone: z.string().trim().regex(/^[0-9+\s-]{7,20}$/, "Teléfono inválido"),
  quantity: z.coerce.number().int("Cantidad inválida").min(1, "Mínimo 1 entrada").max(50),
});
export type OrderInput = z.infer<typeof orderSchema>;
