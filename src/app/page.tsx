import Link from "next/link";
import { getAvailability, expireStaleOrders, getConfig } from "@/lib/config";
import { fmtDate, money } from "@/lib/format";
import BuyForm from "@/components/BuyForm";

export const dynamic = "force-dynamic";

export default async function Home() {
  const cfg = await getConfig();
  if (!cfg) {
    return (
      <main className="container narrow">
        <h1>Evento no configurado</h1>
        <p>Ejecuta <code>npm run db:seed</code> o crea la configuración desde el panel de administración.</p>
      </main>
    );
  }
  await expireStaleOrders();
  const av = await getAvailability(cfg.totalStock);
  const canBuy = cfg.salesOpen && av.remaining > 0;

  return (
    <main className="container">
      <div className="layout">
        <section>
          <div className="stub">
            <p className="when">{fmtDate(cfg.eventDate)}</p>
            <h1>{cfg.eventName}</h1>
            <p style={{ fontSize: "1.1rem", marginBottom: 0 }}>{cfg.venue}</p>
            <div className="perf" />
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span className="price">{money(cfg.priceCents)}</span>
              <span style={{ fontWeight: 700 }}>
                {av.remaining === 0 ? "Agotado" : `Quedan ${av.remaining} de ${av.total}`}
              </span>
            </div>
          </div>
          {cfg.description && (
            <p style={{ whiteSpace: "pre-line", marginTop: "1.5rem" }}>{cfg.description}</p>
          )}
        </section>

        <section className="card" aria-labelledby="buy">
          <h2 id="buy">Comprar entradas</h2>
          {canBuy ? (
            <BuyForm priceCents={cfg.priceCents} maxQty={Math.min(cfg.maxPerOrder, av.remaining)} />
          ) : (
            <p className="alert warn">
              {av.remaining === 0 ? "Las entradas están agotadas." : "Las ventas están cerradas por ahora."}
            </p>
          )}
          <p className="small muted" style={{ marginBottom: 0 }}>
            Pagas por transferencia bancaria y subes tu comprobante. Recibirás tus entradas con QR por email al aprobarlo.
          </p>
        </section>
      </div>
      <p className="small muted" style={{ marginTop: "2rem" }}>
        <Link href="/mis-tickets">Recuperar mis entradas</Link> · <Link href="/login">Acceso staff</Link>
      </p>
    </main>
  );
}
