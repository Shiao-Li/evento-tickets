"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Html5Qrcode } from "html5-qrcode";

type Result = {
  status: "valid" | "used" | "invalid" | "error";
  message: string;
  serial?: string;
  buyerName?: string;
  reference?: string;
  usedAt?: string;
  usedBy?: string | null;
};

const TITLE: Record<Result["status"], string> = {
  valid: "✔ VÁLIDO",
  used: "YA USADO",
  invalid: "✖ INVÁLIDO",
  error: "ERROR",
};

export default function Scanner() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [camError, setCamError] = useState("");
  const [sound, setSound] = useState(true);
  const [okCount, setOkCount] = useState(0);

  const scanner = useRef<Html5Qrcode | null>(null);
  const audio = useRef<AudioContext | null>(null);
  const busy = useRef(false);
  const last = useRef({ token: "", at: 0 });
  const timer = useRef<number | null>(null);
  const soundRef = useRef(true);

  useEffect(() => {
    const saved = localStorage.getItem("scan-sound");
    if (saved === "off") {
      setSound(false);
      soundRef.current = false;
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
      timer.current = window.setTimeout(dismiss, r.status === "valid" ? 2000 : 3500);
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
          body: JSON.stringify({ token: text }),
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

  return (
    <div className="scan-wrap stack">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <b>Entradas validadas en este equipo: {okCount}</b>
        <button className="btn secondary sm" onClick={toggleSound} aria-pressed={sound}>
          Sonido: {sound ? "sí" : "no"}
        </button>
      </div>

      <div id="qr-reader" />
      {!running && (
        <button className="btn block" onClick={start}>Iniciar cámara</button>
      )}
      {camError && <p className="alert bad" role="alert">{camError}</p>}

      {result && (
        <div className={`overlay ${result.status}`} onClick={dismiss} role="alert">
          <div className="big">{TITLE[result.status]}</div>
          {result.status === "used" && result.usedAt && (
            <p className="who">
              Usada a las{" "}
              {new Date(result.usedAt).toLocaleTimeString("es-EC", { timeZone: "America/Guayaquil", hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              {result.usedBy ? ` por ${result.usedBy}` : ""}
            </p>
          )}
          {result.serial && <p className="who">Entrada #{result.serial}</p>}
          {result.buyerName && <p>{result.buyerName} · {result.reference}</p>}
          {(result.status === "invalid" || result.status === "error") && <p className="who">{result.message}</p>}
          <p style={{ opacity: 0.8, marginTop: "1.5rem" }}>Toca para continuar</p>
        </div>
      )}
    </div>
  );
}
