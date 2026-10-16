import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const db = new PrismaClient();

async function main() {
  const email = (process.env.SEED_ADMIN_EMAIL ?? "admin@example.com").toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD ?? "cambia-esto-123";

  await db.staffUser.upsert({
    where: { email },
    update: {},
    create: { email, name: "Administrador", passwordHash: await hash(password, 10), role: "ADMIN" },
  });

  // Solo crea la configuración si no existe: re-ejecutar el seed no pisa lo editado en /admin.
  const existing = await db.eventConfig.findUnique({ where: { id: 1 } });
  if (!existing) {
    await db.eventConfig.create({
      data: {
        id: 1,
        eventName: "Noche de Ejemplo",
        eventDate: new Date(Date.now() + 30 * 24 * 3600 * 1000),
        venue: "Quito, Ecuador (actualiza el lugar en /admin/settings)",
        description: "Descripción del evento.\nEdítala desde el panel de administración.",
        reservationHours: 24,
        maxPerOrder: 10,
        bankName: "Banco Pichincha",
        accountType: "Ahorros",
        accountNumber: "0000000000",
        accountHolder: "Titular de ejemplo",
        holderId: "1700000000",
        notificationEmail: email,
      },
    });
  }

  // Tipos de entrada.
  if ((await db.ticketType.count()) === 0) {
    if (existing) {
      // Actualización desde la versión de un solo tipo: conserva el precio y el stock anteriores.
      await db.ticketType.create({
        data: {
          name: "General",
          description: "",
          priceCents: existing.priceCents > 0 ? existing.priceCents : 1000,
          stock: existing.totalStock > 0 ? existing.totalStock : 200,
          sortOrder: 0,
        },
      });
      console.log("Se creó el tipo «General» con el precio/stock anteriores. Renómbralo o crea más en /admin/types.");
    } else {
      await db.ticketType.createMany({
        data: [
          { name: "Oro", description: "Zona preferencial", priceCents: 2500, stock: 40, sortOrder: 0 },
          { name: "Plata", description: "Zona intermedia", priceCents: 1500, stock: 80, sortOrder: 1 },
          { name: "Bronce", description: "Zona general", priceCents: 1000, stock: 80, sortOrder: 2 },
        ],
      });
    }
  }

  // Órdenes creadas antes de existir los tipos: se asignan al primer tipo.
  const legacy = await db.order.count({ where: { ticketTypeId: null } });
  if (legacy > 0) {
    const first = await db.ticketType.findFirst({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
    if (first) {
      await db.order.updateMany({ where: { ticketTypeId: null }, data: { ticketTypeId: first.id } });
      console.log(`${legacy} orden(es) anteriores asignadas al tipo «${first.name}».`);
    }
  }

  console.log(`Seed listo. Admin: ${email} / ${password}  <- cambia la contraseña después del primer login.`);
}

main().finally(() => db.$disconnect());
