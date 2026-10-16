"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hash } from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { approveOrder, rejectOrder, createManualSale, OrderError } from "@/lib/orders";
import { sendTicketsEmail } from "@/lib/email";
import { listTypeStats } from "@/lib/config";
import { fromInputValue } from "@/lib/format";
import { manualSaleSchema } from "@/lib/validation";
import { cleanText, docField, emailField, plainText } from "@/lib/validators";

const enc = encodeURIComponent;
const idOf = (fd: FormData) => {
  const id = String(fd.get("orderId") ?? "");
  return /^[0-9a-f-]{36}$/i.test(id) ? id : "";
};

export async function approveOrderAction(fd: FormData) {
  const user = await requireAdmin();
  let err = "";
  try {
    const id = idOf(fd);
    if (!id) throw new OrderError("Orden inválida.");
    await approveOrder(id, user.id);
  } catch (e) {
    if (e instanceof OrderError) err = e.message;
    else throw e;
  }
  revalidatePath("/admin");
  if (err) redirect(`/admin?err=${enc(err)}`);
}

export async function rejectOrderAction(fd: FormData) {
  const user = await requireAdmin();
  let err = "";
  try {
    const id = idOf(fd);
    if (!id) throw new OrderError("Orden inválida.");
    await rejectOrder(id, user.id, cleanText(String(fd.get("reason") ?? ""), 300));
  } catch (e) {
    if (e instanceof OrderError) err = e.message;
    else throw e;
  }
  revalidatePath("/admin");
  if (err) redirect(`/admin?err=${enc(err)}`);
}

export async function resendEmailAction(fd: FormData) {
  await requireAdmin();
  const id = idOf(fd);
  if (!id) redirect(`/admin?err=${enc("Orden inválida.")}`);
  const r = await sendTicketsEmail(id);
  revalidatePath("/admin");
  if (!r.ok) redirect(`/admin?err=${enc("No se pudo enviar el email: " + (r.error ?? "error desconocido"))}`);
}

/* ---------- Venta manual ---------- */

export async function createManualSaleAction(fd: FormData) {
  const user = await requireAdmin();
  const parsed = manualSaleSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) redirect(`/admin/manual?err=${enc(parsed.error.issues[0].message)}`);
  const { amount, ...rest } = parsed.data;

  let ref = "";
  let err = "";
  try {
    ref = (await createManualSale({ ...rest, amountCents: amount }, user.id)).reference;
  } catch (e) {
    if (e instanceof OrderError) err = e.message;
    else throw e;
  }
  revalidatePath("/admin");
  if (err) redirect(`/admin/manual?err=${enc(err)}`);
  redirect(`/admin/manual?done=${enc(ref)}`);
}

/* ---------- Configuración ---------- */

const settingsSchema = z.object({
  eventName: plainText(2, 120, "Nombre del evento"),
  eventDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Fecha inválida")
    .refine((v) => !Number.isNaN(fromInputValue(v).getTime()), "Fecha inválida"),
  venue: plainText(2, 200, "Lugar"),
  description: z.string().transform((s) => cleanText(s, 4000)),
  reservationHours: z.coerce.number().int("Horas inválidas").min(1, "Horas mínimas: 1").max(720, "Máximo 720 horas"),
  maxPerOrder: z.coerce.number().int("Máximo por compra inválido").min(1).max(50),
  bankName: plainText(2, 80, "Banco"),
  accountType: z.enum(["Ahorros", "Corriente"], { errorMap: () => ({ message: "Tipo de cuenta inválido" }) }),
  accountNumber: z
    .string()
    .transform((s) => s.replace(/[\s-]/g, ""))
    .pipe(z.string().regex(/^\d{6,20}$/, "El número de cuenta debe tener entre 6 y 20 dígitos")),
  accountHolder: plainText(2, 120, "Titular"),
  holderId: docField,
  notificationEmail: emailField,
});

export async function saveSettingsAction(fd: FormData) {
  await requireAdmin();
  const parsed = settingsSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) redirect(`/admin/settings?err=${enc(parsed.error.issues[0].message)}`);
  const v = parsed.data;

  const data = {
    eventName: v.eventName,
    eventDate: fromInputValue(v.eventDate),
    venue: v.venue,
    description: v.description,
    reservationHours: v.reservationHours,
    maxPerOrder: v.maxPerOrder,
    salesOpen: fd.get("salesOpen") === "on",
    bankName: v.bankName,
    accountType: v.accountType,
    accountNumber: v.accountNumber,
    accountHolder: v.accountHolder,
    holderId: v.holderId,
    notificationEmail: v.notificationEmail,
  };
  await db.eventConfig.upsert({ where: { id: 1 }, update: data, create: { id: 1, ...data } });
  revalidatePath("/", "layout");
  redirect("/admin/settings?saved=1");
}

/* ---------- Tipos de entrada ---------- */

const typeSchema = z.object({
  id: z.string().optional(),
  name: plainText(2, 40, "Nombre del tipo"),
  description: z.string().transform((s) => cleanText(s, 300)),
  price: z.coerce.number({ invalid_type_error: "Precio inválido" }).min(0, "Precio inválido").max(10000, "Precio inválido"),
  stock: z.coerce.number({ invalid_type_error: "Stock inválido" }).int("Stock inválido").min(0, "Stock inválido").max(100000, "Stock inválido"),
  sortOrder: z.coerce.number().int("Orden inválido").min(0, "Orden inválido").max(1000, "Orden inválido"),
});

export async function saveTicketTypeAction(fd: FormData) {
  await requireAdmin();
  const parsed = typeSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) redirect(`/admin/types?err=${enc(parsed.error.issues[0].message)}`);
  const v = parsed.data;
  const id = v.id && /^[0-9a-f-]{36}$/i.test(v.id) ? v.id : "";

  const dup = await db.ticketType.findFirst({
    where: { name: { equals: v.name, mode: "insensitive" }, ...(id ? { id: { not: id } } : {}) },
  });
  if (dup) redirect(`/admin/types?err=${enc(`Ya existe un tipo llamado «${v.name}».`)}`);

  const data = {
    name: v.name,
    description: v.description,
    priceCents: Math.round(v.price * 100),
    stock: v.stock,
    sortOrder: v.sortOrder,
    active: fd.get("active") === "on",
  };

  if (id) {
    const current = (await listTypeStats()).find((t) => t.id === id);
    if (!current) redirect(`/admin/types?err=${enc("Tipo no encontrado.")}`);
    const committed = current.sold + current.reserved;
    if (v.stock < committed) {
      redirect(`/admin/types?err=${enc(`El stock de ${current.name} no puede ser menor a lo ya comprometido (${committed}).`)}`);
    }
    await db.ticketType.update({ where: { id }, data });
  } else {
    await db.ticketType.create({ data });
  }
  revalidatePath("/", "layout");
  redirect("/admin/types?saved=1");
}

export async function deleteTicketTypeAction(fd: FormData) {
  await requireAdmin();
  const id = String(fd.get("id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) redirect(`/admin/types?err=${enc("Tipo inválido.")}`);
  if ((await db.order.count({ where: { ticketTypeId: id } })) > 0) {
    redirect(`/admin/types?err=${enc("Ese tipo ya tiene órdenes: desactívalo en lugar de borrarlo.")}`);
  }
  await db.ticketType.delete({ where: { id } });
  revalidatePath("/", "layout");
  redirect("/admin/types?saved=1");
}

/* ---------- Staff ---------- */

const staffSchema = z.object({
  name: plainText(2, 80, "Nombre"),
  email: emailField,
  password: z
    .string()
    .min(10, "La contraseña debe tener al menos 10 caracteres")
    .max(100, "Contraseña demasiado larga")
    .regex(/[A-Za-z]/, "La contraseña debe incluir al menos una letra")
    .regex(/\d/, "La contraseña debe incluir al menos un número"),
  role: z.enum(["ADMIN", "STAFF"], { errorMap: () => ({ message: "Rol inválido" }) }),
});

export async function createStaffAction(fd: FormData) {
  await requireAdmin();
  const parsed = staffSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) redirect(`/admin/staff?err=${enc(parsed.error.issues[0].message)}`);
  const v = parsed.data;
  if (await db.staffUser.findUnique({ where: { email: v.email } })) {
    redirect(`/admin/staff?err=${enc("Ya existe un usuario con ese email.")}`);
  }
  await db.staffUser.create({
    data: { name: v.name, email: v.email, role: v.role, passwordHash: await hash(v.password, 10) },
  });
  revalidatePath("/admin/staff");
  redirect("/admin/staff?saved=1");
}

export async function toggleStaffAction(fd: FormData) {
  const me = await requireAdmin();
  const id = String(fd.get("id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) redirect(`/admin/staff?err=${enc("Usuario inválido.")}`);
  if (id === me.id) redirect(`/admin/staff?err=${enc("No puedes desactivarte a ti mismo.")}`);
  const u = await db.staffUser.findUnique({ where: { id } });
  if (u) await db.staffUser.update({ where: { id }, data: { active: !u.active } });
  revalidatePath("/admin/staff");
}
