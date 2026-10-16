import { put } from "@vercel/blob";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

export const RECEIPT_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const RECEIPT_MAX_BYTES = 4 * 1024 * 1024; // Vercel limita el body de funciones a ~4.5 MB

/** Detecta el tipo real por los primeros bytes (no confiar solo en el MIME que declara el navegador). */
export function sniffImage(b: Uint8Array): string | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "image/webp";
  return null;
}

export async function storeReceipt(file: File, reference: string): Promise<string> {
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const name = `receipts/${reference}.${ext}`;

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(name, file, { access: "public", addRandomSuffix: true, contentType: file.type });
    return blob.url;
  }
  if (process.env.NODE_ENV === "production") throw new Error("BLOB_READ_WRITE_TOKEN no configurado.");

  // Solo desarrollo local: guarda en /public/uploads.
  const dir = path.join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });
  const fname = `${reference}-${Date.now()}.${ext}`;
  await writeFile(path.join(dir, fname), Buffer.from(await file.arrayBuffer()));
  return `/uploads/${fname}`;
}
