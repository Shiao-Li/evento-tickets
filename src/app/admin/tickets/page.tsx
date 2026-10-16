import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import BackLink from "@/components/BackLink";
import { fmtDate, serialLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminTickets({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const searchParams = await searchParamsPromise;
  const q = typeof searchParams.q === "string" ? searchParams.q.replace(/[\u0000-\u001F]/g, "").trim().slice(0, 60) : "";
  const s = typeof searchParams.s === "string" ? searchParams.s : "all";

  const where: Prisma.TicketWhereInput = {};
  if (s === "valid") where.usedAt = null;
  if (s === "used") where.usedAt = { not: null };
  if (q) {
    const n = Number(q.replace("#", ""));
    where.OR = [
      { order: { reference: { contains: q, mode: "insensitive" } } },
      { order: { buyerName: { contains: q, mode: "insensitive" } } },
      { order: { buyerEmail: { contains: q, mode: "insensitive" } } },
      ...(Number.isInteger(n) && n > 0 ? [{ serial: n }] : []),
    ];
  }

  const [tickets, total, used] = await Promise.all([
    db.ticket.findMany({
      where,
      orderBy: { serial: "asc" },
      take: 500,
      include: { order: { select: { reference: true, buyerName: true, buyerEmail: true, ticketType: { select: { name: true } } } }, usedBy: { select: { name: true } } },
    }),
    db.ticket.count(),
    db.ticket.count({ where: { usedAt: { not: null } } }),
  ]);

  const tab = (key: string, label: string) => (
    <Link href={`/admin/tickets?s=${key}${q ? `&q=${encodeURIComponent(q)}` : ""}`} aria-current={s === key ? "page" : undefined}>
      {label}
    </Link>
  );

  return (
    <>
      <BackLink href="/admin">Volver a órdenes</BackLink>
      <h1 style={{ fontSize: "2rem" }}>Tickets</h1>
      <p className="muted">{total} emitidos · {used} usados · {total - used} válidos</p>

      <form className="row" style={{ marginBottom: "1rem" }}>
        <input type="hidden" name="s" value={s} />
        <input name="q" defaultValue={q} placeholder="Buscar por nombre, email, referencia o N.º" style={{ maxWidth: 360 }} />
        <button className="btn secondary sm">Buscar</button>
      </form>
      <nav className="tabs" aria-label="Filtro de estado">
        {tab("all", "Todos")}{tab("valid", "Válidos")}{tab("used", "Usados")}
      </nav>

      <div className="tablewrap">
        <table>
          <thead><tr><th>N.º</th><th>Tipo</th><th>Comprador</th><th>Orden</th><th>Estado</th><th>Hora de uso</th><th>Validó</th></tr></thead>
          <tbody>
            {tickets.length === 0 && <tr><td colSpan={7} className="muted">Sin resultados.</td></tr>}
            {tickets.map((t) => (
              <tr key={t.id}>
                <td><b>#{serialLabel(t.serial)}</b></td>
                <td>{t.order.ticketType?.name ?? "—"}</td>
                <td>{t.order.buyerName}<div className="small muted">{t.order.buyerEmail}</div></td>
                <td>{t.order.reference}</td>
                <td>{t.usedAt ? <span className="badge warn">Usado</span> : <span className="badge ok">Válido</span>}</td>
                <td>{t.usedAt ? fmtDate(t.usedAt, { dateStyle: "short", timeStyle: "medium" }) : "—"}</td>
                <td>{t.usedBy?.name ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
