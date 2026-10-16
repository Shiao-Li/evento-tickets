import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { expireStaleOrders, getConfig, listTypeStats, totalsOf } from "@/lib/config";
import { appUrl, fmtDate, money, STATUS_LABEL, STATUS_TONE, waLink } from "@/lib/format";
import { approveOrderAction, rejectOrderAction, resendEmailAction } from "./actions";

export const dynamic = "force-dynamic";

const FILTERS: { key: string; label: string; where: Prisma.OrderWhereInput }[] = [
  { key: "review", label: "Por revisar", where: { status: "receipt_uploaded" } },
  { key: "pending", label: "Pendientes de pago", where: { status: "pending" } },
  { key: "approved", label: "Aprobadas", where: { status: "approved" } },
  { key: "closed", label: "Rechazadas / expiradas / canceladas", where: { status: { in: ["rejected", "expired", "cancelled"] } } },
  { key: "all", label: "Todas", where: {} },
];

export default async function AdminOrders({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const searchParams = await searchParamsPromise;
  await expireStaleOrders();
  const cfg = await getConfig();
  const types = await listTypeStats();
  const tot = totalsOf(types);

  // Tickets emitidos y usados, por tipo de entrada.
  const issuedRows = await db.ticket.findMany({
    select: { usedAt: true, order: { select: { ticketTypeId: true } } },
  });
  const used = issuedRows.filter((t) => t.usedAt).length;
  const issued = issuedRows.length;
  const usedByType = (id: string) => issuedRows.filter((t) => t.usedAt && t.order.ticketTypeId === id).length;

  const fKey = typeof searchParams.f === "string" ? searchParams.f : "review";
  const filter = FILTERS.find((f) => f.key === fKey) ?? FILTERS[0];
  const orders = await db.order.findMany({
    where: filter.where,
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { ticketType: { select: { name: true } } },
  });
  const err = typeof searchParams.err === "string" ? searchParams.err.slice(0, 200) : "";

  return (
    <>
      <div className="row" style={{ justifyContent: "space-between", margin: "1rem 0" }}>
        <h1 style={{ fontSize: "2rem", margin: 0 }}>Órdenes</h1>
        <Link href="/admin/manual" className="btn">+ Venta manual</Link>
      </div>
      {err && <p className="alert bad" role="alert">{err}</p>}

      <div className="stats">
        <div className="stat"><span className="small muted">Vendidas</span><b>{tot.sold}</b><span className="small muted">de {tot.stock}</span></div>
        <div className="stat"><span className="small muted">Reservadas (sin aprobar)</span><b>{tot.reserved}</b></div>
        <div className="stat"><span className="small muted">Validadas en puerta</span><b>{used}</b><span className="small muted">de {issued} emitidas</span></div>
        <div className="stat"><span className="small muted">Restantes</span><b>{tot.remaining}</b></div>
      </div>

      {types.length === 0 ? (
        <p className="alert warn">Aún no hay tipos de entrada. <Link href="/admin/types">Crea el primero</Link>.</p>
      ) : (
        <div className="tablewrap" style={{ marginBottom: "1.25rem" }}>
          <table>
            <thead><tr><th>Tipo</th><th>Precio</th><th>Stock</th><th>Vendidas</th><th>Reservadas</th><th>Restantes</th><th>Validadas</th></tr></thead>
            <tbody>
              {types.map((t) => (
                <tr key={t.id}>
                  <td><b>{t.name}</b> {!t.active && <span className="badge muted">Oculto</span>}</td>
                  <td>{money(t.priceCents)}</td>
                  <td>{t.stock}</td>
                  <td>{t.sold}</td>
                  <td>{t.reserved}</td>
                  <td><b>{t.remaining}</b></td>
                  <td>{usedByType(t.id)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <nav className="tabs" aria-label="Filtro de órdenes">
        {FILTERS.map((f) => (
          <Link key={f.key} href={`/admin?f=${f.key}`} aria-current={f.key === filter.key ? "page" : undefined}>
            {f.label}
          </Link>
        ))}
      </nav>

      <div className="tablewrap">
        <table>
          <thead>
            <tr><th>Orden</th><th>Comprador</th><th>Entradas / Total</th><th>Estado</th><th>Comprobante</th><th>Acciones</th></tr>
          </thead>
          <tbody>
            {orders.length === 0 && (
              <tr><td colSpan={6} className="muted">No hay órdenes en esta vista.</td></tr>
            )}
            {orders.map((o) => (
              <tr key={o.id}>
                <td>
                  <b>{o.reference}</b>
                  {o.source === "manual" && <div><span className="badge muted">Manual · {o.paymentMethod}</span></div>}
                  <div className="small muted">{fmtDate(o.createdAt, { dateStyle: "short", timeStyle: "short" })}</div>
                </td>
                <td>
                  {o.buyerName}
                  <div className="small muted">{o.buyerEmail || "sin email"}</div>
                  <div className="small muted">CI/RUC {o.buyerDocument} · {o.buyerPhone}</div>
                </td>
                <td>
                  {o.quantity} × <b>{o.ticketType?.name ?? "General"}</b>
                  <div><b>{money(o.totalCents)}</b></div>
                </td>
                <td>
                  <span className={`badge ${STATUS_TONE[o.status]}`}>{STATUS_LABEL[o.status]}</span>
                  {o.status === "pending" && <div className="small muted">vence {fmtDate(o.expiresAt, { dateStyle: "short", timeStyle: "short" })}</div>}
                  {o.status === "rejected" && o.rejectedReason && <div className="small muted">{o.rejectedReason}</div>}
                  {o.status === "approved" && o.buyerEmail && <div className="small muted">{o.emailSentAt ? "Email enviado" : "Email NO enviado"}</div>}
                </td>
                <td>
                  {o.receiptUrl ? (
                    <a href={o.receiptUrl} target="_blank" rel="noreferrer" title="Abrir en tamaño completo">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img className="thumb" src={o.receiptUrl} alt={`Comprobante de ${o.reference}`} />
                    </a>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
                <td>
                  {(o.status === "receipt_uploaded" || o.status === "pending") && (
                    <div className="row">
                      <form action={approveOrderAction}>
                        <input type="hidden" name="orderId" value={o.id} />
                        <button className="btn sm">{o.status === "pending" ? "Aprobar sin comprobante" : "Aprobar"}</button>
                      </form>
                      <details>
                        <summary className="btn danger sm">Rechazar</summary>
                        <form action={rejectOrderAction}>
                          <input type="hidden" name="orderId" value={o.id} />
                          <input name="reason" placeholder="Motivo (opcional)" maxLength={300} />
                          <button className="btn danger sm">Confirmar rechazo</button>
                        </form>
                      </details>
                    </div>
                  )}
                  {o.status === "approved" && (
                    <div className="row">
                      {o.buyerEmail && (
                        <form action={resendEmailAction}>
                          <input type="hidden" name="orderId" value={o.id} />
                          <button className="btn secondary sm">{o.emailSentAt ? "Reenviar email" : "Enviar email"}</button>
                        </form>
                      )}
                      {o.buyerPhone && (
                        <a
                          className="btn secondary sm"
                          target="_blank"
                          rel="noreferrer"
                          href={waLink(o.buyerPhone, `Hola ${o.buyerName}, aquí están tus entradas para ${cfg?.eventName ?? "el evento"}: ${appUrl()}/orden/${o.reference}?k=${o.accessToken}`)}
                        >
                          WhatsApp
                        </a>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
