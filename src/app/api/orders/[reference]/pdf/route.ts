import { db } from "@/lib/db";
import { getConfig } from "@/lib/config";
import { safeEqual } from "@/lib/tokens";
import { ticketsPdf } from "@/lib/pdf";
import { fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params;
  const k = new URL(req.url).searchParams.get("k") ?? "";
  const [order, cfg] = await Promise.all([
    db.order.findUnique({ where: { reference: reference }, include: { tickets: { orderBy: { serial: "asc" } }, ticketType: true } }),
    getConfig(),
  ]);
  if (!order || !cfg || !safeEqual(order.accessToken, k) || order.status !== "approved" || !order.tickets.length) {
    return new Response("No encontrado", { status: 404 });
  }
  const pdf = await ticketsPdf({
    eventName: cfg.eventName,
    dateText: fmtDate(cfg.eventDate),
    venue: cfg.venue,
    reference: order.reference,
    buyerName: order.buyerName,
    typeName: order.ticketType?.name ?? "General",
    tickets: order.tickets,
  });
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="entradas-${order.reference}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
