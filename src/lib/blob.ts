import { put } from "@vercel/blob";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

export const RECEIPT_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const RECEIPT_MAX_BYTES = 4 * 1024 * 1024; // Vercel limita el body de funciones a ~4.5 MB

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
