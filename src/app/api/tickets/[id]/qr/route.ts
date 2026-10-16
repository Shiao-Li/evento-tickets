import { db } from "@/lib/db";
import { safeEqual } from "@/lib/tokens";
import { qrPng } from "@/lib/qr";
import { serialLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const k = new URL(req.url).searchParams.get("k") ?? "";
  const t = await db.ticket.findUnique({ where: { id: id }, include: { order: true } });
  if (!t || !safeEqual(t.order.accessToken, k)) return new Response("No encontrado", { status: 404 });
  const png = await qrPng(t.token);
  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="entrada-${serialLabel(t.serial)}.png"`,
      "Cache-Control": "private, no-store",
    },
  });
}
