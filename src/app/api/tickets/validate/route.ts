import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUser } from "@/lib/session";
import { verifyTicketToken } from "@/lib/tokens";
import { serialLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ status: "error", message: "Sesión expirada. Vuelve a iniciar sesión." }, { status: 401 });

  let token = "";
  try {
    token = String((await req.json()).token ?? "");
  } catch {
    /* token vacío -> inválido */
  }

  const id = token ? verifyTicketToken(token) : null;
  if (!id) return NextResponse.json({ status: "invalid", message: "QR inválido" });

  // Operación atómica: una sola sentencia UPDATE ... WHERE id = ? AND used_at IS NULL.
  // Si dos escaneos llegan a la vez, Postgres deja que solo uno afecte la fila.
  const res = await db.ticket.updateMany({
    where: { id, usedAt: null },
    data: { usedAt: new Date(), usedById: user.id },
  });

  const ticket = await db.ticket.findUnique({
    where: { id },
    include: { order: { select: { buyerName: true, reference: true } }, usedBy: { select: { name: true } } },
  });
  if (!ticket) return NextResponse.json({ status: "invalid", message: "Entrada no encontrada" });

  const info = {
    serial: serialLabel(ticket.serial),
    buyerName: ticket.order.buyerName,
    reference: ticket.order.reference,
  };
  if (res.count === 1) return NextResponse.json({ status: "valid", message: "Entrada válida", ...info });
  return NextResponse.json({
    status: "used",
    message: "YA USADO",
    ...info,
    usedAt: ticket.usedAt,
    usedBy: ticket.usedBy?.name ?? null,
  });
}
