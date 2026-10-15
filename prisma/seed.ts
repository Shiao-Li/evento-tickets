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
        priceCents: 1000,
        totalStock: 200,
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

  console.log(`Seed listo. Admin: ${email} / ${password}  <- cambia la contraseña después del primer login.`);
}

main().finally(() => db.$disconnect());
