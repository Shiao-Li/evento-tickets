"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hash } from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { approveOrder, rejectOrder, OrderError } from "@/lib/orders";
import { sendTicketsEmail } from "@/lib/email";
import { getAvailability } from "@/lib/config";
import { fromInputValue } from "@/lib/format";

const enc = encodeURIComponent;

export async function approveOrderAction(fd: FormData) {
  const user = await requireAdmin();
  let err = "";
  try {
    await approveOrder(String(fd.get("orderId")), user.id);
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
    await rejectOrder(String(fd.get("orderId")), user.id, String(fd.get("reason") ?? "").trim().slice(0, 300));
  } catch (e) {
    if (e instanceof OrderError) err = e.message;
    else throw e;
  }
  revalidatePath("/admin");
  if (err) redirect(`/admin?err=${enc(err)}`);
}

export async function resendEmailAction(fd: FormData) {
  await requireAdmin();
  const r = await sendTicketsEmail(String(fd.get("orderId")));
  revalidatePath("/admin");
  if (!r.ok) redirect(`/admin?err=${enc("No se pudo enviar el email: " + (r.error ?? "error desconocido"))}`);
}

const settingsSchema = z.object({
  eventName: z.string().trim().min(2, "Nombre del evento requerido").max(120),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Fecha inválida"),
  venue: z.string().trim().min(2, "Lugar requerido").max(200),
  description: z.string().trim().max(4000),
  price: z.coerce.number().min(0, "Precio inválido").max(10000),
  totalStock: z.coerce.number().int().min(1, "Stock mínimo 1").max(100000),
  reservationHours: z.coerce.number().int().min(1, "Horas mínimas: 1").max(720),
  maxPerOrder: z.coerce.number().int().min(1).max(50),
  bankName: z.string().trim().min(2, "Banco requerido").max(80),
  accountType: z.string().trim().min(2).max(40),
  accountNumber: z.string().trim().min(4, "Número de cuenta requerido").max(40),
  accountHolder: z.string().trim().min(2, "Titular requerido").max(120),
  holderId: z.string().trim().min(5, "CI/RUC requerido").max(20),
  notificationEmail: z.string().trim().email("Email de notificación inválido"),
});

export async function saveSettingsAction(fd: FormData) {
  await requireAdmin();
  const parsed = settingsSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) redirect(`/admin/settings?err=${enc(parsed.error.issues[0].message)}`);
  const v = parsed.data;

  // No permitir bajar el stock por debajo de lo ya vendido/reservado.
  const av = await getAvailability(v.totalStock);
  const committed = av.sold + av.reserved;
  if (v.totalStock < committed) {
    redirect(`/admin/settings?err=${enc(`El stock no puede ser menor a lo ya comprometido (${committed}).`)}`);
  }

  const data = {
    eventName: v.eventName,
    eventDate: fromInputValue(v.eventDate),
    venue: v.venue,
    description: v.description,
    priceCents: Math.round(v.price * 100),
    totalStock: v.totalStock,
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

const staffSchema = z.object({
  name: z.string().trim().min(2, "Nombre requerido").max(80),
  email: z.string().trim().toLowerCase().email("Email inválido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres").max(100),
  role: z.enum(["ADMIN", "STAFF"]),
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
  const id = String(fd.get("id"));
  if (id === me.id) redirect(`/admin/staff?err=${enc("No puedes desactivarte a ti mismo.")}`);
  const u = await db.staffUser.findUnique({ where: { id } });
  if (u) await db.staffUser.update({ where: { id }, data: { active: !u.active } });
  revalidatePath("/admin/staff");
}
