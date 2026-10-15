import type { PrismaClient } from "@prisma/client";
import { db } from "./db";

export const getConfig = () => db.eventConfig.findUnique({ where: { id: 1 } });

type OrderClient = Pick<PrismaClient, "order">;

/**
 * Stock comprometido = aprobadas + comprobante en revisión + pendientes aún vigentes.
 * Una pendiente vencida deja de contar aunque el cron no la haya marcado como expirada.
 */
export async function getAvailability(total: number, client: OrderClient = db) {
  const now = new Date();
  const [committed, approved] = await Promise.all([
    client.order.aggregate({
      _sum: { quantity: true },
      where: {
        OR: [
          { status: "approved" },
          { status: "receipt_uploaded" },
          { status: "pending", expiresAt: { gt: now } },
        ],
      },
    }),
    client.order.aggregate({ _sum: { quantity: true }, where: { status: "approved" } }),
  ]);
  const c = committed._sum.quantity ?? 0;
  const sold = approved._sum.quantity ?? 0;
  return { total, sold, reserved: c - sold, remaining: Math.max(0, total - c) };
}

/** Marca como expiradas las órdenes pendientes vencidas (libera stock). Idempotente. */
export async function expireStaleOrders(): Promise<number> {
  const r = await db.order.updateMany({
    where: { status: "pending", expiresAt: { lte: new Date() } },
    data: { status: "expired" },
  });
  return r.count;
}
