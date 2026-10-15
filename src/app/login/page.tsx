import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";
import { getUser } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Acceso staff" };

const safePath = (p: string) => (p.startsWith("/") && !p.startsWith("//") ? p : "/scan");

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const callbackUrl = safePath(typeof searchParams.callbackUrl === "string" ? searchParams.callbackUrl : "/scan");
  const user = await getUser();
  if (user) redirect(user.role === "ADMIN" && callbackUrl === "/scan" ? "/admin" : callbackUrl);

  async function login(fd: FormData) {
    "use server";
    const to = safePath(String(fd.get("callbackUrl") ?? "/scan"));
    try {
      await signIn("credentials", {
        email: String(fd.get("email") ?? ""),
        password: String(fd.get("password") ?? ""),
        redirectTo: to,
      });
    } catch (e) {
      if (e instanceof AuthError) redirect(`/login?error=1&callbackUrl=${encodeURIComponent(to)}`);
      throw e; // NEXT_REDIRECT del login correcto
    }
  }

  return (
    <main className="container narrow">
      <h1 style={{ fontSize: "2rem" }}>Acceso staff</h1>
      {searchParams.error && <p className="alert bad">Email o contraseña incorrectos.</p>}
      <form action={login} className="card">
        <input type="hidden" name="callbackUrl" value={callbackUrl} />
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" autoComplete="username" required />
        </div>
        <div className="field">
          <label htmlFor="password">Contraseña</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required />
        </div>
        <button className="btn block">Entrar</button>
      </form>
    </main>
  );
}
