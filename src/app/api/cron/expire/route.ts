import { NextResponse } from "next/server";
import { expireStaleOrders } from "@/lib/config";

export const dynamic = "force-dynamic";

// Vercel Hobby solo permite crons diarios; además la expiración se aplica "en vivo"
// (el stock ya ignora pendientes vencidas) y en cada visita al panel / compra.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("No autorizado", { status: 401 });
  }
  return NextResponse.json({ expired: await expireStaleOrders() });
}
