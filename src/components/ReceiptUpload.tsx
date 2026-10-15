"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const MAX = 4 * 1024 * 1024;

// Las fotos de celular pesan 4-10 MB; las reducimos a JPEG de máx. 1600 px antes de subir.
async function shrink(file: File): Promise<File> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.85));
    return blob ? new File([blob], "comprobante.jpg", { type: "image/jpeg" }) : file;
  } catch {
    return file;
  }
}

export default function ReceiptUpload({ reference, k }: { reference: string; k: string }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setError("");
    setPreview(f ? URL.createObjectURL(f) : "");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    setError("");
    const toSend = await shrink(file);
    if (toSend.size > MAX) {
      setError("La imagen sigue pesando más de 4 MB. Toma una captura de pantalla del comprobante.");
      setLoading(false);
      return;
    }
    const fd = new FormData();
    fd.set("file", toSend);
    fd.set("k", k);
    try {
      const res = await fetch(`/api/orders/${reference}/receipt`, { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "No se pudo subir el comprobante.");
        setLoading(false);
        return;
      }
      router.refresh();
    } catch {
      setError("Sin conexión. Intenta de nuevo.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      {error && <p className="alert bad" role="alert">{error}</p>}
      <div className="field">
        <label htmlFor="receipt">Foto o captura del comprobante</label>
        <input id="receipt" type="file" accept="image/jpeg,image/png,image/webp" onChange={onPick} required />
      </div>
      {preview && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="Vista previa del comprobante" style={{ maxWidth: "100%", maxHeight: 260, borderRadius: 8, marginBottom: ".9rem" }} />
      )}
      <button className="btn block" disabled={!file || loading}>
        {loading ? "Subiendo…" : "Enviar comprobante"}
      </button>
    </form>
  );
}
