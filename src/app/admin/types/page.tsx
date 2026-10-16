import { listTypeStats, totalsOf } from "@/lib/config";
import { money } from "@/lib/format";
import BackLink from "@/components/BackLink";
import { deleteTicketTypeAction, saveTicketTypeAction } from "../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tipos de entrada" };

export default async function TypesPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const searchParams = await searchParamsPromise;
  const types = await listTypeStats();
  const tot = totalsOf(types);
  const err = typeof searchParams.err === "string" ? searchParams.err.slice(0, 200) : "";

  return (
    <>
      <BackLink href="/admin">Volver a órdenes</BackLink>
      <h1 style={{ fontSize: "2rem" }}>Tipos de entrada</h1>
      <p className="muted">
        Crea los tipos que quieras (Oro, Plata, Bronce…), cada uno con su precio y su propio stock. Capacidad total:{" "}
        <b>{tot.stock}</b> · vendidas <b>{tot.sold}</b> · reservadas <b>{tot.reserved}</b> · restantes <b>{tot.remaining}</b>.
      </p>
      {searchParams.saved && <p className="alert ok" role="status">Cambios guardados. Ya están visibles en el sitio.</p>}
      {err && <p className="alert bad" role="alert">{err}</p>}

      <div className="stack">
        {types.map((t) => (
          <section className="card" key={t.id}>
            <div className="row" style={{ justifyContent: "space-between", marginBottom: ".75rem" }}>
              <h2 style={{ margin: 0 }}>
                {t.name} {!t.active && <span className="badge muted">Oculto</span>}
              </h2>
              <span className="small muted">
                {money(t.priceCents)} · vendidas {t.sold} · reservadas {t.reserved} · <b>restantes {t.remaining}</b> de {t.stock}
              </span>
            </div>
            <form action={saveTicketTypeAction}>
              <input type="hidden" name="id" value={t.id} />
              <div className="grid2">
                <div className="field"><label htmlFor={`n-${t.id}`}>Nombre</label><input id={`n-${t.id}`} name="name" defaultValue={t.name} required maxLength={40} /></div>
                <div className="field"><label htmlFor={`d-${t.id}`}>Descripción corta (opcional)</label><input id={`d-${t.id}`} name="description" defaultValue={t.description} maxLength={300} /></div>
                <div className="field"><label htmlFor={`p-${t.id}`}>Precio (USD)</label><input id={`p-${t.id}`} name="price" type="number" step="0.01" min="0" max="10000" defaultValue={(t.priceCents / 100).toFixed(2)} required /></div>
                <div className="field"><label htmlFor={`s-${t.id}`}>Stock de este tipo</label><input id={`s-${t.id}`} name="stock" type="number" min="0" max="100000" defaultValue={t.stock} required /></div>
                <div className="field"><label htmlFor={`o-${t.id}`}>Orden en pantalla (0 = primero)</label><input id={`o-${t.id}`} name="sortOrder" type="number" min="0" max="1000" defaultValue={t.sortOrder} required /></div>
              </div>
              <label className="row" style={{ marginBottom: ".9rem" }}>
                <input type="checkbox" name="active" defaultChecked={t.active} style={{ width: "auto" }} /> Visible para la venta online
              </label>
              <button className="btn sm">Guardar {t.name}</button>
            </form>
            <details style={{ marginTop: ".75rem" }}>
              <summary className="small muted"><u>Eliminar este tipo</u></summary>
              <form action={deleteTicketTypeAction} style={{ marginTop: ".5rem" }}>
                <input type="hidden" name="id" value={t.id} />
                <p className="small muted">Solo se puede eliminar si nunca tuvo órdenes; si ya vendió, ocúltalo con la casilla de arriba.</p>
                <button className="btn danger sm">Eliminar definitivamente</button>
              </form>
            </details>
          </section>
        ))}

        <section className="card">
          <h2>Nuevo tipo de entrada</h2>
          <form action={saveTicketTypeAction}>
            <div className="grid2">
              <div className="field"><label htmlFor="n-new">Nombre</label><input id="n-new" name="name" required maxLength={40} placeholder="Oro" /></div>
              <div className="field"><label htmlFor="d-new">Descripción corta (opcional)</label><input id="d-new" name="description" maxLength={300} placeholder="Zona preferencial" /></div>
              <div className="field"><label htmlFor="p-new">Precio (USD)</label><input id="p-new" name="price" type="number" step="0.01" min="0" max="10000" required /></div>
              <div className="field"><label htmlFor="s-new">Stock de este tipo</label><input id="s-new" name="stock" type="number" min="0" max="100000" required /></div>
              <div className="field"><label htmlFor="o-new">Orden en pantalla</label><input id="o-new" name="sortOrder" type="number" min="0" max="1000" defaultValue={types.length} required /></div>
            </div>
            <label className="row" style={{ marginBottom: ".9rem" }}>
              <input type="checkbox" name="active" defaultChecked style={{ width: "auto" }} /> Visible para la venta online
            </label>
            <button className="btn">Crear tipo</button>
          </form>
        </section>
      </div>
    </>
  );
}
