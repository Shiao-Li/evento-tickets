// Prueba del criterio "dos escaneos simultáneos solo dejan pasar uno".
// Ejecuta la MISMA sentencia atómica que usa /api/tickets/validate, 25 veces en paralelo.
import { PrismaClient } from "@prisma/client";
import { randomBytes, randomUUID } from "crypto";

const db = new PrismaClient();

async function main() {
  const order = await db.order.create({
    data: {
      reference: "RACE-" + randomBytes(3).toString("hex").toUpperCase(),
      accessToken: randomBytes(24).toString("hex"),
      buyerName: "Race Test", buyerEmail: "race@test.local", buyerDocument: "0000000", buyerPhone: "0000000",
      quantity: 1, totalCents: 0, status: "approved", expiresAt: new Date(),
    },
  });
  const ticket = await db.ticket.create({ data: { id: randomUUID(), token: "race-" + randomUUID(), orderId: order.id } });

  try {
    const results = await Promise.all(
      Array.from({ length: 25 }, () =>
        db.ticket.updateMany({ where: { id: ticket.id, usedAt: null }, data: { usedAt: new Date() } })
      )
    );
    const winners = results.filter((r) => r.count === 1).length;
    console.log(`Intentos: 25 | Aceptados: ${winners} | Rechazados: ${25 - winners}`);
    if (winners !== 1) { console.error("FALLO: debía pasar exactamente 1"); process.exitCode = 1; }
    else console.log("OK: solo un escaneo pudo marcar el ticket como usado.");
  } finally {
    await db.order.delete({ where: { id: order.id } }); // borra el ticket en cascada
    await db.$disconnect();
  }
}
main();
