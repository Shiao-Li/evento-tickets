import Link from "next/link";
import { requireUser } from "@/lib/session";
import { signOut } from "@/lib/auth";
import Scanner from "@/components/Scanner";
import SwRegister from "@/components/SwRegister";

export const dynamic = "force-dynamic";
export const metadata = { title: "Escáner" };

export default async function ScanPage() {
  const user = await requireUser("/scan");
  return (
    <>
      <SwRegister />
      <header className="topbar">
        <div className="container">
          <b style={{ flex: 1 }}>Escáner · {user.name}</b>
          {user.role === "ADMIN" && <Link href="/admin" className="btn secondary sm">Panel</Link>}
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
      <main>
        <Scanner />
      </main>
    </>
  );
}
