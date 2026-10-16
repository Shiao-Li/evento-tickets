import { getConfig } from "@/lib/config";
import BackLink from "@/components/BackLink";
import { toInputValue } from "@/lib/format";
import { saveSettingsAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const searchParams = await searchParamsPromise;
  const c = await getConfig();
  const err = typeof searchParams.err === "string" ? searchParams.err.slice(0, 200) : "";
  const d = {
    eventName: c?.eventName ?? "",
    eventDate: toInputValue(c?.eventDate ?? new Date(Date.now() + 30 * 864e5)),
    venue: c?.venue ?? "",
    description: c?.description ?? "",
    reservationHours: c?.reservationHours ?? 24,
    maxPerOrder: c?.maxPerOrder ?? 10,
    salesOpen: c?.salesOpen ?? true,
    bankName: c?.bankName ?? "Banco Pichincha",
    accountType: c?.accountType ?? "Ahorros",
    accountNumber: c?.accountNumber ?? "",
    accountHolder: c?.accountHolder ?? "",
    holderId: c?.holderId ?? "",
    notificationEmail: c?.notificationEmail ?? "",
  };

  return (
    <>
      <BackLink href="/admin">Volver a órdenes</BackLink>
      <h1 style={{ fontSize: "2rem" }}>Configuración</h1>
      {searchParams.saved && <p className="alert ok" role="status">Cambios guardados. Ya están visibles en el sitio.</p>}
      {err && <p className="alert bad" role="alert">{err}</p>}

      <form action={saveSettingsAction} className="stack" style={{ maxWidth: 720 }}>
        <section className="card">
          <h2>Evento</h2>
          <div className="field"><label htmlFor="eventName">Nombre</label><input id="eventName" name="eventName" defaultValue={d.eventName} required /></div>
          <div className="grid2">
            <div className="field"><label htmlFor="eventDate">Fecha y hora (hora de Ecuador)</label><input id="eventDate" name="eventDate" type="datetime-local" defaultValue={d.eventDate} required /></div>
            <div className="field"><label htmlFor="venue">Lugar</label><input id="venue" name="venue" defaultValue={d.venue} required /></div>
          </div>
          <div className="field"><label htmlFor="description">Descripción</label><textarea id="description" name="description" defaultValue={d.description} /></div>
          <div className="grid2">
            <div className="field"><label htmlFor="reservationHours">Horas para subir comprobante</label><input id="reservationHours" name="reservationHours" type="number" min="1" max="720" defaultValue={d.reservationHours} required /></div>
            <div className="field"><label htmlFor="maxPerOrder">Máximo de entradas por compra</label><input id="maxPerOrder" name="maxPerOrder" type="number" min="1" max="50" defaultValue={d.maxPerOrder} required /></div>
          </div>
          <p className="small muted">Los precios y el stock se editan por tipo de entrada en <a href="/admin/types">Tipos de entrada</a>.</p>
          <label className="row"><input type="checkbox" name="salesOpen" defaultChecked={d.salesOpen} style={{ width: "auto" }} /> Ventas abiertas</label>
        </section>

        <section className="card">
          <h2>Datos bancarios</h2>
          <div className="grid2">
            <div className="field"><label htmlFor="bankName">Banco</label><input id="bankName" name="bankName" defaultValue={d.bankName} required /></div>
            <div className="field">
              <label htmlFor="accountType">Tipo de cuenta</label>
              <select id="accountType" name="accountType" defaultValue={d.accountType}>
                <option>Ahorros</option><option>Corriente</option>
              </select>
            </div>
            <div className="field"><label htmlFor="accountNumber">Número de cuenta</label><input id="accountNumber" name="accountNumber" inputMode="numeric" defaultValue={d.accountNumber} required /></div>
            <div className="field"><label htmlFor="accountHolder">Titular</label><input id="accountHolder" name="accountHolder" defaultValue={d.accountHolder} required /></div>
            <div className="field"><label htmlFor="holderId">CI / RUC del titular</label><input id="holderId" name="holderId" defaultValue={d.holderId} required /></div>
            <div className="field"><label htmlFor="notificationEmail">Email de notificación</label><input id="notificationEmail" name="notificationEmail" type="email" defaultValue={d.notificationEmail} required /></div>
          </div>
          <p className="small muted" style={{ marginBottom: 0 }}>
            El email de notificación recibe un aviso por cada comprobante subido y es el «responder a» de los correos a compradores.
          </p>
        </section>

        <button className="btn">Guardar cambios</button>
      </form>
    </>
  );
}
