import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { safeEqual } from "@/lib/tokens";
import { RECEIPT_MAX_BYTES, RECEIPT_TYPES, sniffImage, storeReceipt } from "@/lib/blob";
import { notifyReceiptUploaded } from "@/lib/email";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params;
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const k = String(form?.get("k") ?? "");
  if (!form || !(file instanceof File)) {
    return NextResponse.json({ error: "Adjunta una imagen del comprobante." }, { status: 400 });
  }
  if (!RECEIPT_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Formato no permitido. Usa JPG, PNG o WebP." }, { status: 400 });
  }
  if (file.size > RECEIPT_MAX_BYTES) {
    return NextResponse.json({ error: "La imagen supera 4 MB." }, { status: 413 });
  }

  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (sniffImage(head) !== file.type) {
    return NextResponse.json({ error: "El archivo no es una imagen válida." }, { status: 400 });
  }

  const order = await db.order.findUnique({ where: { reference: reference } });
  if (!order || !safeEqual(order.accessToken, k)) {
    return NextResponse.json({ error: "Orden no encontrada." }, { status: 404 });
  }
  if (order.status === "pending" && order.expiresAt <= new Date()) {
    await db.order.updateMany({ where: { id: order.id, status: "pending" }, data: { status: "expired" } });
    return NextResponse.json({ error: "La orden expiró. Haz una nueva compra." }, { status: 410 });
  }
  if (order.status !== "pending" && order.status !== "receipt_uploaded") {
    return NextResponse.json({ error: "Esta orden ya no admite comprobantes." }, { status: 409 });
  }

  let url: string;
  try {
    url = await storeReceipt(file, order.reference);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "No se pudo guardar el archivo." }, { status: 500 });
  }

  const upd = await db.order.updateMany({
    where: { id: order.id, status: { in: ["pending", "receipt_uploaded"] } },
    data: { status: "receipt_uploaded", receiptUrl: url, receiptUploadedAt: new Date() },
  });
  if (upd.count === 0) return NextResponse.json({ error: "La orden cambió de estado." }, { status: 409 });

  await notifyReceiptUploaded(order.id);
  return NextResponse.json({ ok: true });
}
