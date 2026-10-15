import { Prisma } from "@prisma/client";
import { randomBytes, randomInt, randomUUID } from "crypto";
import { db } from "./db";
import { expireStaleOrders, getAvailability } from "./config";
import { signTicketToken } from "./tokens";
import { sendRejectionEmail, sendTicketsEmail } from "./email";
import type { OrderInput } from "./validation";

export class OrderError extends Error {}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin I, O, 0, 1
export const REF_PREFIX = "EVENTO";

function newReference(): string {
  let s = "";
  for (let i = 0; i < 6; i++) s += ALPHABET[randomInt(ALPHABET.length)];
  return `${REF_PREFIX}-${s}`;
}

export async function createOrder(input: OrderInput) {
  await expireStaleOrders();

  // Anti-acaparamiento de stock: máximo 3 órdenes pendientes vigentes por email.
  const open = await db.order.count({
    where: { buyerEmail: input.email, status: "pending", expiresAt: { gt: new Date() } },
  });
  if (open >= 3) {
    throw new OrderError("Ya tienes 3 órdenes pendientes de comprobante. Súbelo o espera a que expiren.");
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await db.$transaction(
        async (tx) => {
          // Serializa compras concurrentes: bloquea la fila de config hasta el commit.
          await tx.$queryRaw`SELECT id FROM event_config WHERE id = 1 FOR UPDATE`;
          const cfg = await tx.eventConfig.findUnique({ where: { id: 1 } });
          if (!cfg) throw new OrderError("El evento aún no está configurado.");
          if (!cfg.salesOpen) throw new OrderError("Las ventas están cerradas.");
          if (input.quantity > cfg.maxPerOrder) {
            throw new OrderError(`Máximo ${cfg.maxPerOrder} entradas por compra.`);
          }
          const av = await getAvailability(cfg.totalStock, tx);
          if (av.remaining === 0) throw new OrderError("Entradas agotadas.");
          if (input.quantity > av.remaining) {
            throw new OrderError(`Solo quedan ${av.remaining} entradas disponibles.`);
          }
          return tx.order.create({
            data: {
              reference: newReference(),
              accessToken: randomBytes(24).toString("hex"),
              buyerName: input.name,
              buyerEmail: input.email,
              buyerDocument: input.document,
              buyerPhone: input.phone,
              quantity: input.quantity,
              totalCents: cfg.priceCents * input.quantity,
              expiresAt: new Date(Date.now() + cfg.reservationHours * 3600 * 1000),
            },
          });
        },
        { timeout: 10_000 }
      );
    } catch (e) {
      // Colisión de referencia (muy improbable): reintenta con otra.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue;
      throw e;
    }
  }
  throw new OrderError("No se pudo generar la referencia. Intenta de nuevo.");
}

/** Aprueba y genera un ticket por entrada. El cambio de estado es atómico (doble clic seguro). */
export async function approveOrder(orderId: string, staffId: string) {
  await db.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order) throw new OrderError("Orden no encontrada.");

    const upd = await tx.order.updateMany({
      where: {
        id: orderId,
        OR: [{ status: "receipt_uploaded" }, { status: "pending", expiresAt: { gt: new Date() } }],
      },
      data: { status: "approved", approvedAt: new Date(), reviewedById: staffId, rejectedReason: null },
    });
    if (upd.count === 0) throw new OrderError(`La orden ya no se puede aprobar (estado: ${order.status}).`);

    const rows = Array.from({ length: order.quantity }, () => {
      const id = randomUUID();
      return { id, orderId, token: signTicketToken(id) };
    });
    await tx.ticket.createMany({ data: rows });
  });

  // Fuera de la transacción: si el email falla, la aprobación se mantiene (hay botón "Reenviar").
  await sendTicketsEmail(orderId);
}

export async function rejectOrder(orderId: string, staffId: string, reason: string) {
  const upd = await db.order.updateMany({
    where: { id: orderId, status: { in: ["pending", "receipt_uploaded"] } },
    data: { status: "rejected", rejectedReason: reason || null, reviewedById: staffId },
  });
  if (upd.count === 0) throw new OrderError("La orden ya no se puede rechazar.");
  await sendRejectionEmail(orderId);
}
