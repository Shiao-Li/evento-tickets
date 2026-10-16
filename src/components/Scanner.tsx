"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Html5Qrcode } from "html5-qrcode";

type Result = {
  status: "valid" | "used" | "invalid" | "error";
  message: string;
  serial?: string;
  buyerName?: string;
  reference?: string;
  document?: string;
  ticketType?: string | null;
  usedAt?: string;
  usedBy?: string | null;
};

const TITLE: Record<Result["status"], string> = {
  valid: "✔ VÁLIDO",
  used: "YA USADO",
  invalid: "✖ INVÁLIDO",
  error: "ERROR",
};

// Cuánto permanece el resultado en pantalla. "0" = hasta que el guardia toque la pantalla.
const HOLD_OPTIONS = [
  { value: "0", label: "Hasta tocar" },
  { value: "10", label: "10 segundos" },
  { value: "20", label: "20 segundos" },
];

export default function Scanner() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [camError, setCamError] = useState("");
  const [sound, setSound] = useState(true);
  const [hold, setHold] = useState("0");
  const [okCount, setOkCount] = useState(0);

  const scanner = useRef<Html5Qrcode | null>(null);
  const audio = useRef<AudioContext | null>(null);
  const busy = useRef(false);
  const last = useRef({ token: "", at: 0 });
  const timer = useRef<number | null>(null);
  const soundRef = useRef(true);
  const holdRef = useRef(0);

  useEffect(() => {
    if (localStorage.getItem("scan-sound") === "off") {
      setSound(false);
      soundRef.current = false;
    }
    const h = localStorage.getItem("scan-hold");
    if (h && HOLD_OPTIONS.some((o) => o.value === h)) {
      setHold(h);
      holdRef.current = Number(h) * 1000;
    }
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
      scanner.current?.stop().then(() => scanner.current?.clear()).catch(() => {});
    };
  }, []);

  const beep = (freq: number, ms: number, delay = 0) => {
    const ctx = audio.current;
    if (!ctx || !soundRef.current) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = freq;
    g.gain.value = 0.25;
    o.connect(g);
    g.connect(ctx.destination);
    const t = ctx.currentTime + delay;
    o.start(t);
    o.stop(t + ms / 1000);
  };

  const feedback = (s: Result["status"]) => {
    if (s === "valid") {
      beep(880, 150);
      navigator.vibrate?.(100);
    } else if (s === "used") {
      beep(440, 150);
      beep(440, 150, 0.22);
      navigator.vibrate?.([150, 80, 150]);
    } else {
      beep(200, 450);
      navigator.vibrate?.(450);
    }
  };

  const dismiss = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
    setResult(null);
    last.current.at = Date.now(); // enfría 3 s el mismo QR para no re-escanearlo sin querer
    busy.current = false;
  }, []);

  const show = useCallback(
    (r: Result) => {
      setResult(r);
      feedback(r.status);
      if (r.status === "valid") setOkCount((n) => n + 1);
      if (holdRef.current > 0) timer.current = window.setTimeout(dismiss, holdRef.current);
    },
    [dismiss]
  );

  const onDecode = useCallback(
    async (text: string) => {
      if (busy.current) return;
      const now = Date.now();
      if (last.current.token === text && now - last.current.at < 3000) return;
      busy.current = true;
      last.current = { token: text, at: now };
      try {
        const res = await fetch("/api/tickets/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: text.slice(0, 300) }),
        });
        show((await res.json()) as Result);
      } catch {
        show({ status: "error", message: "Sin conexión" });
      }
    },
    [show]
  );

  async function start() {
    setCamError("");
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    audio.current = new AC(); // se crea dentro del toque del usuario (requisito de iOS)
    try {
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
      const s = new Html5Qrcode("qr-reader", { formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE], verbose: false });
      scanner.current = s;
      await s.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: (w: number, h: number) => {
            const m = Math.floor(Math.min(w, h) * 0.75);
            return { width: m, height: m };
          },
        },
        (t) => void onDecode(t),
        () => {}
      );
      setRunning(true);
    } catch {
      setCamError("No se pudo abrir la cámara. Permite el acceso en el navegador y vuelve a intentar.");
    }
  }

  function toggleSound() {
    const next = !sound;
    setSound(next);
    soundRef.current = next;
    localStorage.setItem("scan-sound", next ? "on" : "off");
  }

  function changeHold(v: string) {
    setHold(v);
    holdRef.current = Number(v) * 1000;
    localStorage.setItem("scan-hold", v);
  }

  return (
    <div className="scan-wrap stack">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <b>Validadas en este equipo: {okCount}</b>
        <button className="btn secondary sm" onClick={toggleSound} aria-pressed={sound}>
          Sonido: {sound ? "sí" : "no"}
        </button>
      </div>

      <div className="field" style={{ marginBottom: 0 }}>
        <label htmlFor="hold">Mostrar resultado</label>
        <select id="hold" value={hold} onChange={(e) => changeHold(e.target.value)}>
          {HOLD_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <div id="qr-reader" />
      {!running && <button className="btn block" onClick={start}>Iniciar cámara</button>}
      {camError && <p className="alert bad" role="alert">{camError}</p>}

      {result && (
        <div className={`overlay ${result.status}`} onClick={dismiss} role="alert">
          <div className="big">{TITLE[result.status]}</div>

          {result.ticketType && (
            <>
              <p className="label">Tipo de entrada</p>
              <p className="doc" style={{ marginBottom: ".75rem" }}>{result.ticketType.toUpperCase()}</p>
            </>
          )}
          {result.buyerName && (
            <>
              <p className="label">Comprador</p>
              <p className="who">{result.buyerName}</p>
            </>
          )}
          {result.document && (
            <>
              <p className="label">Cédula / documento (compáralo con el físico)</p>
              <p className="doc">{result.document}</p>
            </>
          )}
          {result.serial && <p className="who">Entrada #{result.serial} · {result.reference}</p>}
          {result.status === "used" && result.usedAt && (
            <p className="who">
              Usada a las{" "}
              {new Date(result.usedAt).toLocaleTimeString("es-EC", { timeZone: "America/Guayaquil", hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              {result.usedBy ? ` por ${result.usedBy}` : ""}
            </p>
          )}
          {(result.status === "invalid" || result.status === "error") && <p className="who">{result.message}</p>}

          <span className="cta">Continuar escaneando</span>
        </div>
      )}
    </div>
  );
}
