import { redirect } from "next/navigation";
import BackLink from "@/components/BackLink";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mis entradas" };

export default async function MyTickets({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const searchParams = await searchParamsPromise;
  async function lookup(fd: FormData) {
    "use server";
    const email = String(fd.get("email") ?? "").trim().toLowerCase().slice(0, 120);
    const reference = String(fd.get("reference") ?? "").trim().toUpperCase().slice(0, 20);
    const valid = /^EVENTO-[A-Z0-9]{6}$/.test(reference) && email.includes("@");
    const order = valid ? await db.order.findUnique({ where: { reference } }) : null;
    // Mensaje genérico: no revela si la referencia existe.
    if (!order || order.buyerEmail !== email) redirect("/mis-tickets?error=1");
    redirect(`/orden/${order.reference}?k=${order.accessToken}`);
  }

  return (
    <main className="container narrow">
      <BackLink href="/">Volver al evento</BackLink>
      <h1 style={{ fontSize: "2rem" }}>Recuperar mis entradas</h1>
      <p>Ingresa el email de tu compra y tu referencia (la que empieza con EVENTO-).</p>
      {searchParams.error && <p className="alert bad">No encontramos una orden con esos datos. Revisa el email y la referencia.</p>}
      <form action={lookup} className="card">
        <div className="field">
          <label htmlFor="email">Email de la compra</label>
          <input id="email" name="email" type="email" required maxLength={120} />
        </div>
        <div className="field">
          <label htmlFor="reference">Referencia</label>
          <input id="reference" name="reference" placeholder="EVENTO-XXXXXX" required maxLength={20} pattern="[Ee][Vv][Ee][Nn][Tt][Oo]-[A-Za-z0-9]{6}" title="Formato: EVENTO-XXXXXX" style={{ textTransform: "uppercase" }} />
        </div>
        <button className="btn block">Ver mis entradas</button>
      </form>
    </main>
  );
}
