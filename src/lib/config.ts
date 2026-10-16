import type { Prisma, PrismaClient } from "@prisma/client";
import { db } from "./db";

export const getConfig = () => db.eventConfig.findUnique({ where: { id: 1 } });

type OrderClient = Pick<PrismaClient, "order">;

/**
 * Stock comprometido = aprobadas + comprobante en revisión + pendientes aún vigentes.
 * Una pendiente vencida deja de contar aunque el cron no la haya marcado como expirada.
 */
export function committedWhere(now = new Date()): Prisma.OrderWhereInput {
  return {
    OR: [{ status: "approved" }, { status: "receipt_uploaded" }, { status: "pending", expiresAt: { gt: now } }],
  };
}

/** Disponibilidad de UN tipo de entrada (se usa dentro de transacciones con bloqueo). */
export async function getTypeAvailability(typeId: string, stock: number, client: OrderClient = db) {
  const [committed, approved] = await Promise.all([
    client.order.aggregate({ _sum: { quantity: true }, where: { ticketTypeId: typeId, ...committedWhere() } }),
    client.order.aggregate({ _sum: { quantity: true }, where: { ticketTypeId: typeId, status: "approved" } }),
  ]);
  const c = committed._sum.quantity ?? 0;
  const sold = approved._sum.quantity ?? 0;
  return { stock, sold, reserved: c - sold, remaining: Math.max(0, stock - c) };
}

export type TypeStats = {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  stock: number;
  sortOrder: number;
  active: boolean;
  sold: number;
  reserved: number;
  remaining: number;
};

/** Todos los tipos con sus números de venta (una sola consulta agrupada). */
export async function listTypeStats(opts: { onlyActive?: boolean } = {}): Promise<TypeStats[]> {
  const types = await db.ticketType.findMany({
    where: opts.onlyActive ? { active: true } : {},
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  const rows = await db.order.groupBy({
    by: ["ticketTypeId", "status"],
    _sum: { quantity: true },
    where: committedWhere(),
  });
  return types.map((t) => {
    let sold = 0;
    let reserved = 0;
    for (const r of rows) {
      if (r.ticketTypeId !== t.id) continue;
      const q = r._sum?.quantity ?? 0;
      if (r.status === "approved") sold += q;
      else reserved += q;
    }
    return {
      id: t.id,
      name: t.name,
      description: t.description,
      priceCents: t.priceCents,
      stock: t.stock,
      sortOrder: t.sortOrder,
      active: t.active,
      sold,
      reserved,
      remaining: Math.max(0, t.stock - sold - reserved),
    };
  });
}

export const totalsOf = (list: TypeStats[]) =>
  list.reduce(
    (a, t) => ({
      stock: a.stock + t.stock,
      sold: a.sold + t.sold,
      reserved: a.reserved + t.reserved,
      remaining: a.remaining + t.remaining,
    }),
    { stock: 0, sold: 0, reserved: 0, remaining: 0 }
  );

/** Marca como expiradas las órdenes pendientes vencidas (libera stock). Idempotente. */
export async function expireStaleOrders(): Promise<number> {
  const r = await db.order.updateMany({
    where: { status: "pending", expiresAt: { lte: new Date() } },
    data: { status: "expired" },
  });
  return r.count;
}
