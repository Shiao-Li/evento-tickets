import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { signOut } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Panel", robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  return (
    <>
      <header className="topbar">
        <div className="container">
          <b>Panel</b>
          <nav aria-label="Secciones">
            <Link href="/admin">Órdenes</Link>
            <Link href="/admin/manual">Venta manual</Link>
            <Link href="/admin/types">Tipos de entrada</Link>
            <Link href="/admin/tickets">Tickets</Link>
            <Link href="/admin/settings">Configuración</Link>
            <Link href="/admin/staff">Staff</Link>
            <Link href="/scan">Escáner</Link>
          </nav>
          <span className="small muted">{user.name}</span>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button className="btn secondary sm">Salir</button>
          </form>
        </div>
      </header>
      <main className="container">{children}</main>
    </>
  );
}
