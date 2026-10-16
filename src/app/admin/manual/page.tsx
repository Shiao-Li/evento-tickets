import { db } from "@/lib/db";
import { getConfig, listTypeStats, totalsOf } from "@/lib/config";
import { appUrl, money, waLink } from "@/lib/format";
import BackLink from "@/components/BackLink";
import { createManualSaleAction } from "../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Venta manual" };

export default async function ManualSalePage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const searchParams = await searchParamsPromise;
  const cfg = await getConfig();
  const types = await listTypeStats();
  const remaining = totalsOf(types).remaining;
  const err = typeof searchParams.err === "string" ? searchParams.err.slice(0, 200) : "";
  const ref = typeof searchParams.done === "string" && /^EVENTO-[A-Z0-9]{6}$/.test(searchParams.done) ? searchParams.done : "";
  const done = ref ? await db.order.findUnique({ where: { reference: ref } }) : null;
  const link = done ? `${appUrl()}/orden/${done.reference}?k=${done.accessToken}` : "";

  return (
    <>
      <BackLink href="/admin">Volver a órdenes</BackLink>
      <h1 style={{ fontSize: "2rem" }}>Venta manual</h1>
      <p className="muted">
        Registra una venta hecha fuera del sitio (efectivo, venta directa, etc.). Se aprueba al instante, descuenta del stock y
        genera los QR. <b>Quedan {remaining} entradas en total.</b>
      </p>
      {err && <p className="alert bad" role="alert">{err}</p>}

      {done && (
        <section className="card stack" style={{ marginBottom: "1.5rem" }} role="status">
          <h2>✔ Venta registrada: {done.reference}</h2>
          <p style={{ marginBottom: 0 }}>
            {done.quantity} entrada(s) a nombre de <b>{done.buyerName}</b> · {money(done.totalCents)}.{" "}
            {done.buyerEmail ? (done.emailSentAt ? "Se envió el email." : "No se pudo enviar el email (puedes reenviarlo desde Órdenes).") : "Sin email: entrega las entradas con el link."}
          </p>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="link">Link de las entradas (QR)</label>
            <input id="link" readOnly value={link} />
          </div>
          <div className="row">
            <a className="btn sm" href={link} target="_blank" rel="noreferrer">Abrir entradas</a>
            <a className="btn secondary sm" href={`/api/orders/${done.reference}/pdf?k=${done.accessToken}`}>Descargar PDF</a>
            {done.buyerPhone && (
              <a
                className="btn secondary sm"
                target="_blank"
                rel="noreferrer"
                href={waLink(done.buyerPhone, `Hola ${done.buyerName}, estas son tus entradas para ${cfg?.eventName ?? "el evento"}: ${link}`)}
              >
                Enviar por WhatsApp
              </a>
            )}
          </div>
        </section>
      )}

      <form action={createManualSaleAction} className="card" style={{ maxWidth: 640 }}>
        <h2>Datos del comprador</h2>
        <div className="grid2">
          <div className="field">
            <label htmlFor="name">Nombre y apellido</label>
            <input id="name" name="name" required minLength={3} maxLength={100} autoComplete="off" />
          </div>
          <div className="field">
            <label htmlFor="document">Cédula, RUC o pasaporte</label>
            <input id="document" name="document" required maxLength={20} autoComplete="off" />
          </div>
          <div className="field">
            <label htmlFor="phone">Teléfono (opcional)</label>
            <input id="phone" name="phone" type="tel" maxLength={16} placeholder="0991234567" autoComplete="off" />
          </div>
          <div className="field">
            <label htmlFor="email">Email (opcional)</label>
            <input id="email" name="email" type="email" maxLength={120} autoComplete="off" />
          </div>
        </div>
        <p className="small muted">Si pones email, se le envían las entradas automáticamente.</p>

        <h2>Venta</h2>
        <div className="grid2">
          <div className="field">
            <label htmlFor="ticketTypeId">Tipo de entrada</label>
            <select id="ticketTypeId" name="ticketTypeId" required defaultValue={types.find((t) => t.remaining > 0)?.id}>
              {types.map((t) => (
                <option key={t.id} value={t.id} disabled={t.remaining === 0}>
                  {t.name} · {money(t.priceCents)} · {t.remaining === 0 ? "agotado" : `quedan ${t.remaining}`}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="quantity">Cantidad</label>
            <input id="quantity" name="quantity" type="number" min={1} max={200} defaultValue={1} required />
          </div>
          <div className="field">
            <label htmlFor="paymentMethod">Forma de pago</label>
            <select id="paymentMethod" name="paymentMethod" defaultValue="efectivo">
              <option value="efectivo">Efectivo</option>
              <option value="transferencia">Transferencia</option>
              <option value="deposito">Depósito</option>
              <option value="otro">Otro</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="amount">Monto cobrado en USD (opcional)</label>
            <input id="amount" name="amount" inputMode="decimal" maxLength={9} placeholder="Por defecto: precio del tipo × cantidad" />
          </div>
        </div>
        <div className="field">
          <label htmlFor="notes">Notas (opcional)</label>
          <input id="notes" name="notes" maxLength={300} />
        </div>
        <button className="btn" disabled={remaining === 0}>Registrar venta</button>
      </form>
    </>
  );
}
