import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mis entradas" };

export default function MyTickets({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  async function lookup(fd: FormData) {
    "use server";
    const email = String(fd.get("email") ?? "").trim().toLowerCase();
    const reference = String(fd.get("reference") ?? "").trim().toUpperCase();
    const order = email && reference ? await db.order.findUnique({ where: { reference } }) : null;
    // Mensaje genérico: no revela si la referencia existe.
    if (!order || order.buyerEmail !== email) redirect("/mis-tickets?error=1");
    redirect(`/orden/${order.reference}?k=${order.accessToken}`);
  }

  return (
    <main className="container narrow">
      <h1 style={{ fontSize: "2rem" }}>Recuperar mis entradas</h1>
      <p>Ingresa el email de tu compra y tu referencia (la que empieza con EVENTO-).</p>
      {searchParams.error && <p className="alert bad">No encontramos una orden con esos datos. Revisa el email y la referencia.</p>}
      <form action={lookup} className="card">
        <div className="field">
          <label htmlFor="email">Email de la compra</label>
          <input id="email" name="email" type="email" required />
        </div>
        <div className="field">
          <label htmlFor="reference">Referencia</label>
          <input id="reference" name="reference" placeholder="EVENTO-XXXXXX" required style={{ textTransform: "uppercase" }} />
        </div>
        <button className="btn block">Ver mis entradas</button>
      </form>
      <p className="small" style={{ marginTop: "1rem" }}><Link href="/">← Volver al evento</Link></p>
    </main>
  );
}
