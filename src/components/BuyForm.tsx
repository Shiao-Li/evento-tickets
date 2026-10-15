"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { money } from "@/lib/format";

export default function BuyForm({ priceCents, maxQty }: { priceCents: number; maxQty: number }) {
  const router = useRouter();
  const [qty, setQty] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fd.get("name"),
          email: fd.get("email"),
          document: fd.get("document"),
          phone: fd.get("phone"),
          quantity: qty,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "No se pudo crear la orden.");
        setLoading(false);
        return;
      }
      router.push(`/orden/${data.reference}?k=${data.accessToken}`);
    } catch {
      setError("Sin conexión. Intenta de nuevo.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      {error && <p className="alert bad" role="alert">{error}</p>}
      <div className="field">
        <label htmlFor="name">Nombre completo</label>
        <input id="name" name="name" autoComplete="name" required minLength={3} />
      </div>
      <div className="field">
        <label htmlFor="email">Email (aquí llegarán tus entradas)</label>
        <input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="grid2">
        <div className="field">
          <label htmlFor="document">Cédula o RUC</label>
          <input id="document" name="document" inputMode="numeric" required />
        </div>
        <div className="field">
          <label htmlFor="phone">Teléfono</label>
          <input id="phone" name="phone" type="tel" autoComplete="tel" required />
        </div>
      </div>
      <div className="field">
        <label htmlFor="qty">Cantidad</label>
        <select id="qty" value={qty} onChange={(e) => setQty(Number(e.target.value))}>
          {Array.from({ length: maxQty }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </div>
      <button className="btn block" disabled={loading}>
        {loading ? "Reservando…" : `Reservar ${qty} · ${money(priceCents * qty)}`}
      </button>
    </form>
  );
}
