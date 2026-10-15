import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { createStaffAction, toggleStaffAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function StaffPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const me = await requireAdmin();
  const users = await db.staffUser.findMany({ orderBy: { createdAt: "asc" } });
  const err = typeof searchParams.err === "string" ? searchParams.err : "";

  return (
    <>
      <h1 style={{ fontSize: "2rem", marginTop: "1rem" }}>Staff</h1>
      {searchParams.saved && <p className="alert ok" role="status">Usuario creado.</p>}
      {err && <p className="alert bad" role="alert">{err}</p>}

      <div className="tablewrap" style={{ marginBottom: "1.5rem" }}>
        <table>
          <thead><tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>{u.role === "ADMIN" ? "Admin" : "Puerta (solo escáner)"}</td>
                <td>{u.active ? <span className="badge ok">Activo</span> : <span className="badge muted">Desactivado</span>}</td>
                <td>
                  {u.id !== me.id && (
                    <form action={toggleStaffAction}>
                      <input type="hidden" name="id" value={u.id} />
                      <button className="btn secondary sm">{u.active ? "Desactivar" : "Activar"}</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form action={createStaffAction} className="card" style={{ maxWidth: 520 }}>
        <h2>Nuevo usuario</h2>
        <div className="field"><label htmlFor="name">Nombre</label><input id="name" name="name" required /></div>
        <div className="field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" required /></div>
        <div className="field"><label htmlFor="password">Contraseña (mín. 8)</label><input id="password" name="password" type="password" minLength={8} autoComplete="new-password" required /></div>
        <div className="field">
          <label htmlFor="role">Rol</label>
          <select id="role" name="role" defaultValue="STAFF">
            <option value="STAFF">Puerta (solo escáner)</option>
            <option value="ADMIN">Admin</option>
          </select>
        </div>
        <button className="btn">Crear usuario</button>
      </form>
    </>
  );
}
