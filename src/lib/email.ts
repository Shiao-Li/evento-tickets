import { Resend } from "resend";
import nodemailer from "nodemailer";
import { db } from "./db";
import { getConfig } from "./config";
import { qrPng } from "./qr";
import { ticketsPdf } from "./pdf";
import { appUrl, fmtDate, money, serialLabel } from "./format";

type Result = { ok: boolean; error?: string };
type Attachment = { filename: string; content: Buffer };
type Mail = { to: string; subject: string; html: string; replyTo?: string; attachments?: Attachment[] };

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

const wrap = (body: string) =>
  `<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:auto;color:#14202b;line-height:1.5">${body}</div>`;

/**
 * Proveedor de email, en este orden:
 *  1) SMTP (p. ej. Gmail con contraseña de aplicación) si hay SMTP_HOST -> gratis y SIN dominio propio.
 *  2) Resend si hay RESEND_API_KEY (para enviar a terceros requiere dominio verificado).
 */
async function sendMail(m: Mail): Promise<Result> {
  const from = process.env.EMAIL_FROM ?? "Entradas <onboarding@resend.dev>";
  try {
    if (process.env.SMTP_HOST) {
      const port = Number(process.env.SMTP_PORT ?? 465);
      const transport = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port,
        secure: port === 465,
        auth: { user: process.env.SMTP_USER ?? "", pass: process.env.SMTP_PASS ?? "" },
      });
      await transport.sendMail({
        from,
        to: m.to,
        replyTo: m.replyTo,
        subject: m.subject,
        html: m.html,
        attachments: m.attachments,
      });
      return { ok: true };
    }
    if (process.env.RESEND_API_KEY) {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const { error } = await resend.emails.send({
        from,
        to: m.to,
        replyTo: m.replyTo,
        subject: m.subject,
        html: m.html,
        attachments: m.attachments,
      });
      return error ? { ok: false, error: error.message } : { ok: true };
    }
    return { ok: false, error: "Sin proveedor de email: configura SMTP_HOST (Gmail) o RESEND_API_KEY." };
  } catch (e) {
    console.error("sendMail", e);
    return { ok: false, error: e instanceof Error ? e.message : "Error desconocido" };
  }
}

export async function sendTicketsEmail(orderId: string): Promise<Result> {
  try {
    const [order, cfg] = await Promise.all([
      db.order.findUnique({ where: { id: orderId }, include: { tickets: { orderBy: { serial: "asc" } }, ticketType: true } }),
      getConfig(),
    ]);
    if (!order || !cfg || order.status !== "approved" || order.tickets.length === 0) {
      return { ok: false, error: "La orden no está aprobada o no tiene tickets." };
    }
    if (!order.buyerEmail) return { ok: false, error: "La orden no tiene email." };

    const link = `${appUrl()}/orden/${order.reference}?k=${order.accessToken}`;
    const attachments: Attachment[] = await Promise.all(
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
      typeName: order.ticketType?.name ?? "General",
      tickets: order.tickets,
    });
    attachments.push({ filename: `entradas-${order.reference}.pdf`, content: Buffer.from(pdf) });

    const r = await sendMail({
      to: order.buyerEmail,
      replyTo: cfg.notificationEmail || undefined,
      subject: `Tus entradas para ${cfg.eventName} (${order.reference})`,
      attachments,
      html: wrap(`
        <h2>¡Pago confirmado, ${esc(order.buyerName)}!</h2>
        <p>Tu compra <b>${esc(order.reference)}</b> fue aprobada: <b>${order.quantity}</b> entrada(s) <b>${esc(order.ticketType?.name ?? "General")}</b> para <b>${esc(cfg.eventName)}</b>.</p>
        <p>${esc(fmtDate(cfg.eventDate))}<br>${esc(cfg.venue)}</p>
        <p>Adjuntamos un QR por entrada (PNG) y un PDF con todas. Presenta el QR en la puerta junto con tu cédula; cada código permite un solo ingreso.</p>
        <p><a href="${link}" style="background:#0f5c5c;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;display:inline-block">Ver mis entradas</a></p>
        <p style="color:#6b7280;font-size:13px">Guarda este correo: el botón de arriba te permite volver a descargar tus entradas.</p>`),
    });
    if (r.ok) await db.order.update({ where: { id: orderId }, data: { emailSentAt: new Date() } });
    return r;
  } catch (e) {
    console.error("sendTicketsEmail", e);
    return { ok: false, error: e instanceof Error ? e.message : "Error desconocido" };
  }
}

export async function sendRejectionEmail(orderId: string): Promise<Result> {
  try {
    const [order, cfg] = await Promise.all([db.order.findUnique({ where: { id: orderId } }), getConfig()]);
    if (!order || !cfg || !order.buyerEmail) return { ok: false };
    return await sendMail({
      to: order.buyerEmail,
      replyTo: cfg.notificationEmail || undefined,
      subject: `No pudimos validar tu pago (${order.reference})`,
      html: wrap(`
        <h2>No pudimos validar tu comprobante</h2>
        <p>Hola ${esc(order.buyerName)}, la orden <b>${esc(order.reference)}</b> (${money(order.totalCents)}) fue rechazada.</p>
        ${order.rejectedReason ? `<p><b>Motivo:</b> ${esc(order.rejectedReason)}</p>` : ""}
        <p>Si crees que es un error, responde a este correo con tu comprobante.</p>`),
    });
  } catch (e) {
    console.error("sendRejectionEmail", e);
    return { ok: false };
  }
}

export async function notifyReceiptUploaded(orderId: string): Promise<void> {
  try {
    const [order, cfg] = await Promise.all([db.order.findUnique({ where: { id: orderId } }), getConfig()]);
    if (!order || !cfg?.notificationEmail) return;
    await sendMail({
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
