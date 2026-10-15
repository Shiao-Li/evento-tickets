import { redirect } from "next/navigation";
import { auth } from "./auth";
import { db } from "./db";

export type SessionUser = { id: string; name: string; email: string; role: "ADMIN" | "STAFF" };

/** Usuario autenticado Y activo en DB (un staff desactivado pierde acceso de inmediato, aunque su JWT siga vigente). */
export async function getUser(): Promise<SessionUser | null> {
  const s = await auth();
  const id = (s?.user as any)?.id as string | undefined;
  if (!id) return null;
  const u = await db.staffUser.findUnique({ where: { id } });
  if (!u || !u.active) return null;
  return { id: u.id, name: u.name, email: u.email, role: u.role };
}

export async function requireUser(callbackUrl = "/"): Promise<SessionUser> {
  const u = await getUser();
  if (!u) redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  return u;
}

export async function requireAdmin(): Promise<SessionUser> {
  const u = await requireUser("/admin");
  if (u.role !== "ADMIN") redirect("/scan");
  return u;
}
