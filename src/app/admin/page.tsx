import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { expireStaleOrders, getAvailability, getConfig } from "@/lib/config";
import { fmtDate, money, STATUS_LABEL, STATUS_TONE } from "@/lib/format";
import { approveOrderAction, rejectOrderAction, resendEmailAction } from "./actions";

export const dynamic = "force-dynamic";

const FILTERS: { key: string; label: string; where: Prisma.OrderWhereInput }[] = [
  { key: "review", label: "Por revisar", where: { status: "receipt_uploaded" } },
  { key: "pending", label: "Pendientes de pago", where: { status: "pending" } },
  { key: "approved", label: "Aprobadas", where: { status: "approved" } },
  { key: "closed", label: "Rechazadas / expiradas", where: { status: { in: ["rejected", "expired"] } } },
  { key: "all", label: "Todas", where: {} },
];

export default async function AdminOrders({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  await expireStaleOrders();
  const cfg = await getConfig();
  const av = cfg ? await getAvailability(cfg.totalStock) : null;
  const [issued, used] = await Promise.all([
    db.ticket.count(),
    db.ticket.count({ where: { usedAt: { not: null } } }),
  ]);

  const fKey = typeof searchParams.f === "string" ? searchParams.f : "review";
  const filter = FILTERS.find((f) => f.key === fKey) ?? FILTERS[0];
  const orders = await db.order.findMany({ where: filter.where, orderBy: { createdAt: "desc" }, take: 200 });
  const err = typeof searchParams.err === "string" ? searchParams.err : "";

  return (
    <>
      <h1 style={{ fontSize: "2rem", marginTop: "1rem" }}>Órdenes</h1>
      {err && <p className="alert bad" role="alert">{err}</p>}

      {av && (
        <div className="stats">
          <div className="stat"><span className="small muted">Vendidas</span><b>{av.sold}</b><span className="small muted">de {av.total}</span></div>
          <div className="stat"><span className="small muted">Reservadas (sin aprobar)</span><b>{av.reserved}</b></div>
          <div className="stat"><span className="small muted">Validadas en puerta</span><b>{used}</b><span className="small muted">de {issued} emitidas</span></div>
          <div className="stat"><span className="small muted">Restantes</span><b>{av.remaining}</b></div>
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
            <tr><th>Orden</th><th>Comprador</th><th>Cant. / Total</th><th>Estado</th><th>Comprobante</th><th>Acciones</th></tr>
          </thead>
          <tbody>
            {orders.length === 0 && (
              <tr><td colSpan={6} className="muted">No hay órdenes en esta vista.</td></tr>
            )}
            {orders.map((o) => (
              <tr key={o.id}>
                <td>
                  <b>{o.reference}</b>
                  <div className="small muted">{fmtDate(o.createdAt, { dateStyle: "short", timeStyle: "short" })}</div>
                </td>
                <td>
                  {o.buyerName}
                  <div className="small muted">{o.buyerEmail}</div>
                  <div className="small muted">CI/RUC {o.buyerDocument} · {o.buyerPhone}</div>
                </td>
                <td>{o.quantity} × / <b>{money(o.totalCents)}</b></td>
                <td>
                  <span className={`badge ${STATUS_TONE[o.status]}`}>{STATUS_LABEL[o.status]}</span>
                  {o.status === "pending" && <div className="small muted">vence {fmtDate(o.expiresAt, { dateStyle: "short", timeStyle: "short" })}</div>}
                  {o.status === "rejected" && o.rejectedReason && <div className="small muted">{o.rejectedReason}</div>}
                  {o.status === "approved" && <div className="small muted">{o.emailSentAt ? "Email enviado" : "Email NO enviado"}</div>}
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
                    <form action={resendEmailAction}>
                      <input type="hidden" name="orderId" value={o.id} />
                      <button className="btn secondary sm">{o.emailSentAt ? "Reenviar email" : "Enviar email"}</button>
                    </form>
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
