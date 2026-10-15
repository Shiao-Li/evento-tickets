import { Resend } from "resend";
import { db } from "./db";
import { getConfig } from "./config";
import { qrPng } from "./qr";
import { ticketsPdf } from "./pdf";
import { appUrl, fmtDate, money, serialLabel } from "./format";

type Result = { ok: boolean; error?: string };

const client = () => (process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null);
const from = () => process.env.EMAIL_FROM ?? "Entradas <onboarding@resend.dev>";
const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

const wrap = (body: string) =>
  `<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:auto;color:#14202b;line-height:1.5">${body}</div>`;

export async function sendTicketsEmail(orderId: string): Promise<Result> {
  try {
    const resend = client();
    if (!resend) return { ok: false, error: "RESEND_API_KEY no configurada." };
    const [order, cfg] = await Promise.all([
      db.order.findUnique({ where: { id: orderId }, include: { tickets: { orderBy: { serial: "asc" } } } }),
      getConfig(),
    ]);
    if (!order || !cfg || order.status !== "approved" || order.tickets.length === 0) {
      return { ok: false, error: "La orden no está aprobada o no tiene tickets." };
    }

    const link = `${appUrl()}/orden/${order.reference}?k=${order.accessToken}`;
    const attachments: { filename: string; content: Buffer }[] = await Promise.all(
      order.tickets.map(async (t) => ({
        filename: `entrada-${serialLabel(t.serial)}.png`,
        content: await qrPng(t.token),
      }))
    );
    const pdf = await ticketsPdf({
      eventName: cfg.eventName,
      dateText: fmtDate(cfg.eventDate),
      venue: cfg.venue,
      reference: order.reference,
      buyerName: order.buyerName,
      tickets: order.tickets,
    });
    attachments.push({ filename: `entradas-${order.reference}.pdf`, content: Buffer.from(pdf) });

    const { error } = await resend.emails.send({
      from: from(),
      to: order.buyerEmail,
      replyTo: cfg.notificationEmail || undefined,
      subject: `Tus entradas para ${cfg.eventName} (${order.reference})`,
      html: wrap(`
        <h2>¡Pago confirmado, ${esc(order.buyerName)}!</h2>
        <p>Tu compra <b>${esc(order.reference)}</b> fue aprobada: <b>${order.quantity}</b> entrada(s) para <b>${esc(cfg.eventName)}</b>.</p>
        <p>${esc(fmtDate(cfg.eventDate))}<br>${esc(cfg.venue)}</p>
        <p>Adjuntamos un QR por entrada (PNG) y un PDF con todas. Presenta el QR en la puerta; cada código permite un solo ingreso.</p>
        <p><a href="${link}" style="background:#0f5c5c;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;display:inline-block">Ver mis entradas</a></p>
        <p style="color:#6b7280;font-size:13px">Guarda este correo: el botón de arriba te permite volver a descargar tus entradas.</p>`),
      attachments,
    });
    if (error) return { ok: false, error: error.message };

    await db.order.update({ where: { id: orderId }, data: { emailSentAt: new Date() } });
    return { ok: true };
  } catch (e) {
    console.error("sendTicketsEmail", e);
    return { ok: false, error: e instanceof Error ? e.message : "Error desconocido" };
  }
}

export async function sendRejectionEmail(orderId: string): Promise<Result> {
  try {
    const resend = client();
    if (!resend) return { ok: false, error: "RESEND_API_KEY no configurada." };
    const [order, cfg] = await Promise.all([db.order.findUnique({ where: { id: orderId } }), getConfig()]);
    if (!order || !cfg) return { ok: false };
    const { error } = await resend.emails.send({
      from: from(),
      to: order.buyerEmail,
      replyTo: cfg.notificationEmail || undefined,
      subject: `No pudimos validar tu pago (${order.reference})`,
      html: wrap(`
        <h2>No pudimos validar tu comprobante</h2>
        <p>Hola ${esc(order.buyerName)}, la orden <b>${esc(order.reference)}</b> (${money(order.totalCents)}) fue rechazada.</p>
        ${order.rejectedReason ? `<p><b>Motivo:</b> ${esc(order.rejectedReason)}</p>` : ""}
        <p>Si crees que es un error, responde a este correo con tu comprobante.</p>`),
    });
    return error ? { ok: false, error: error.message } : { ok: true };
  } catch (e) {
    console.error("sendRejectionEmail", e);
    return { ok: false };
  }
}

export async function notifyReceiptUploaded(orderId: string): Promise<void> {
  try {
    const resend = client();
    const [order, cfg] = await Promise.all([db.order.findUnique({ where: { id: orderId } }), getConfig()]);
    if (!resend || !order || !cfg?.notificationEmail) return;
    await resend.emails.send({
      from: from(),
      to: cfg.notificationEmail,
      subject: `Nuevo comprobante: ${order.reference}`,
      html: wrap(`
        <p><b>${esc(order.buyerName)}</b> subió un comprobante para <b>${esc(order.reference)}</b>
        (${order.quantity} entrada(s), ${money(order.totalCents)}).</p>
        <p><a href="${appUrl()}/admin?f=review">Revisar en el panel</a></p>`),
    });
  } catch (e) {
    console.error("notifyReceiptUploaded", e);
  }
}
