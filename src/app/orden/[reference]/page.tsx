import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { getConfig } from "@/lib/config";
import { safeEqual } from "@/lib/tokens";
import { qrDataUrl } from "@/lib/qr";
import { fmtDate, money, serialLabel, STATUS_LABEL, STATUS_TONE } from "@/lib/format";
import ReceiptUpload from "@/components/ReceiptUpload";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tu orden", robots: { index: false } };

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: { reference: string };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const k = typeof searchParams.k === "string" ? searchParams.k : "";
  const order = await db.order.findUnique({
    where: { reference: params.reference },
    include: { tickets: { orderBy: { serial: "asc" } } },
  });
  if (!order || !safeEqual(order.accessToken, k)) notFound();
  const cfg = await getConfig();
  if (!cfg) notFound();

  let status: string = order.status;
  if (status === "pending" && order.expiresAt <= new Date()) {
    await db.order.updateMany({ where: { id: order.id, status: "pending" }, data: { status: "expired" } });
    status = "expired";
  }
  const qrs = status === "approved" ? await Promise.all(order.tickets.map((t) => qrDataUrl(t.token))) : [];
  const q = `?k=${order.accessToken}`;

  return (
    <main className="container">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <p className="small muted" style={{ margin: 0 }}>Tu referencia</p>
          <div className="ref">{order.reference}</div>
        </div>
        <span className={`badge ${STATUS_TONE[status]}`}>{STATUS_LABEL[status]}</span>
      </div>
      <p className="muted">
        {cfg.eventName} · {order.quantity} entrada(s) · {money(order.totalCents)}
      </p>

      {status === "pending" && (
        <div className="layout">
          <section className="card">
            <h2>1. Transfiere {money(order.totalCents)}</h2>
            <dl className="kv">
              <dt>Banco</dt><dd>{cfg.bankName}</dd>
              <dt>Tipo de cuenta</dt><dd>{cfg.accountType}</dd>
              <dt>N.º de cuenta</dt><dd>{cfg.accountNumber}</dd>
              <dt>Titular</dt><dd>{cfg.accountHolder}</dd>
              <dt>CI / RUC</dt><dd>{cfg.holderId}</dd>
              <dt>Referencia</dt><dd>{order.reference}</dd>
            </dl>
            <p className="small muted" style={{ marginBottom: 0 }}>
              Incluye la referencia en el detalle de la transferencia si tu banco lo permite.
            </p>
          </section>
          <section className="card">
            <h2>2. Sube tu comprobante</h2>
            <p className="small muted">
              Tienes hasta el <b>{fmtDate(order.expiresAt)}</b>; después la reserva se libera.
            </p>
            <ReceiptUpload reference={order.reference} k={order.accessToken} />
          </section>
        </div>
      )}

      {status === "receipt_uploaded" && (
        <section className="card stack">
          <h2>Estamos revisando tu pago</h2>
          <p>Recibimos tu comprobante. Cuando lo aprobemos te enviaremos las entradas a <b>{order.buyerEmail}</b>. También aparecerán en esta página.</p>
          {order.receiptUrl && <p className="small"><a href={order.receiptUrl} target="_blank" rel="noreferrer">Ver comprobante enviado</a></p>}
          <details>
            <summary className="small"><u>¿Subiste el archivo equivocado? Reemplázalo</u></summary>
            <div style={{ marginTop: ".75rem" }}><ReceiptUpload reference={order.reference} k={order.accessToken} /></div>
          </details>
        </section>
      )}

      {status === "rejected" && (
        <p className="alert bad">
          No pudimos validar tu pago.{order.rejectedReason ? ` Motivo: ${order.rejectedReason}.` : ""} Si crees que es un error, responde al correo que te enviamos o escríbenos con tu comprobante.
        </p>
      )}

      {status === "expired" && (
        <p className="alert warn">
          La orden expiró porque no recibimos el comprobante a tiempo. <Link href="/">Haz una nueva compra</Link>.
        </p>
      )}

      {status === "approved" && (
        <section className="stack">
          <p className="alert ok">¡Pago aprobado! Muestra el QR en la puerta: cada código permite un solo ingreso.</p>
          <div className="row">
            <a className="btn" href={`/api/orders/${order.reference}/pdf${q}`}>Descargar todas (PDF)</a>
          </div>
          <div className="tickets">
            {order.tickets.map((t, i) => (
              <article className="ticket" key={t.id}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="qr" src={qrs[i]} alt={`Código QR de la entrada ${serialLabel(t.serial)}`} />
                <h3 style={{ marginTop: ".75rem" }}>Entrada #{serialLabel(t.serial)}</h3>
                {t.usedAt ? (
                  <span className="badge warn">Ya utilizada · {fmtDate(t.usedAt, { dateStyle: "short", timeStyle: "short" })}</span>
                ) : (
                  <a className="btn secondary sm" href={`/api/tickets/${t.id}/qr${q}`}>Descargar imagen</a>
                )}
              </article>
            ))}
          </div>
          <p className="small muted">{fmtDate(cfg.eventDate)} · {cfg.venue}</p>
        </section>
      )}
    </main>
  );
}
