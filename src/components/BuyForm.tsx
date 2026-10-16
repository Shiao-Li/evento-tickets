"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { money } from "@/lib/format";
import { checkDocument, normalizePhone, PHONE_MSG } from "@/lib/validators";

export type BuyType = { id: string; name: string; description: string; priceCents: number; remaining: number };

export default function BuyForm({ types, maxPerOrder }: { types: BuyType[]; maxPerOrder: number }) {
  const router = useRouter();
  const [typeId, setTypeId] = useState(types.find((t) => t.remaining > 0)?.id ?? "");
  const [qty, setQty] = useState(1);
  const selected = types.find((t) => t.id === typeId);
  const maxQty = Math.max(1, Math.min(maxPerOrder, selected?.remaining ?? 1));
  const priceCents = selected?.priceCents ?? 0;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") ?? "").replace(/\s+/g, " ").trim();
    const doc = String(fd.get("document") ?? "");
    const phone = String(fd.get("phone") ?? "");

    // Validación inmediata en el navegador (el servidor vuelve a validar todo).
    if (!selected || selected.remaining === 0) return setError("Elige un tipo de entrada disponible.");
    if (!/^\p{L}[\p{L}\s.'’-]*$/u.test(name) || !name.includes(" ")) {
      return setError("Ingresa tu nombre y apellido (solo letras).");
    }
    const docErr = checkDocument(doc);
    if (docErr) return setError(docErr);
    if (!normalizePhone(phone)) return setError(PHONE_MSG);

    setLoading(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketTypeId: typeId,
          name,
          email: fd.get("email"),
          document: doc,
          phone,
          quantity: qty,
          website: fd.get("website") ?? "",
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
    <form onSubmit={onSubmit} noValidate>
      {error && <p className="alert bad" role="alert">{error}</p>}
      {/* Honeypot anti-bots: invisible para personas. */}
      <div className="hp" aria-hidden="true">
        <label>No llenar<input name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>
      <fieldset className="tiers">
        <legend>Tipo de entrada</legend>
        {types.map((t) => {
          const soldOut = t.remaining === 0;
          return (
            <label key={t.id} className={`tier${t.id === typeId ? " on" : ""}${soldOut ? " out" : ""}`}>
              <input
                type="radio"
                name="ticketType"
                value={t.id}
                checked={t.id === typeId}
                disabled={soldOut}
                onChange={() => {
                  setTypeId(t.id);
                  setQty((q) => Math.min(q, Math.max(1, Math.min(maxPerOrder, t.remaining))));
                }}
              />
              <span className="tier-main">
                <b>{t.name}</b>
                {t.description && <span className="small muted">{t.description}</span>}
              </span>
              <span className="tier-price">
                {money(t.priceCents)}
                <span className="small muted">{soldOut ? "Agotado" : `Quedan ${t.remaining}`}</span>
              </span>
            </label>
          );
        })}
      </fieldset>
      <div className="field">
        <label htmlFor="name">Nombre y apellido</label>
        <input id="name" name="name" autoComplete="name" required minLength={3} maxLength={100} />
      </div>
      <div className="field">
        <label htmlFor="email">Email (aquí llegarán tus entradas)</label>
        <input id="email" name="email" type="email" autoComplete="email" required maxLength={120} />
      </div>
      <div className="grid2">
        <div className="field">
          <label htmlFor="document">Cédula, RUC o pasaporte</label>
          <input id="document" name="document" required maxLength={20} autoComplete="off" />
        </div>
        <div className="field">
          <label htmlFor="phone">Teléfono / WhatsApp</label>
          <input id="phone" name="phone" type="tel" autoComplete="tel" required maxLength={16} placeholder="0991234567" />
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
        {loading ? "Reservando…" : `Reservar ${qty} ${selected?.name ?? ""} · ${money(priceCents * qty)}`}
      </button>
    </form>
  );
}
