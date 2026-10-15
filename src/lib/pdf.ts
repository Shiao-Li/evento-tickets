import { PDFDocument, PDFFont, StandardFonts, rgb } from "pdf-lib";
import { qrPng } from "./qr";
import { serialLabel } from "./format";

// Las fuentes estándar del PDF solo codifican Latin-1: lo demás se reemplaza.
const safe = (s: string) => s.replace(/[^\x20-\x7E\u00A0-\u00FF]/g, "?");

function fit(text: string, font: PDFFont, size: number, max: number): string {
  let t = safe(text);
  if (font.widthOfTextAtSize(t, size) <= max) return t;
  while (t.length > 1 && font.widthOfTextAtSize(t + "...", size) > max) t = t.slice(0, -1);
  return t + "...";
}

export async function ticketsPdf(p: {
  eventName: string;
  dateText: string;
  venue: string;
  reference: string;
  buyerName: string;
  tickets: { serial: number; token: string }[];
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const W = 360;
  const H = 600;

  const centered = (page: ReturnType<PDFDocument["addPage"]>, text: string, y: number, size: number, font: PDFFont, color = rgb(0.08, 0.1, 0.15)) => {
    const t = fit(text, font, size, W - 40);
    page.drawText(t, { x: (W - font.widthOfTextAtSize(t, size)) / 2, y, size, font, color });
  };

  for (const t of p.tickets) {
    const page = pdf.addPage([W, H]);
    page.drawRectangle({ x: 0, y: H - 100, width: W, height: 100, color: rgb(0.06, 0.36, 0.36) });
    centered(page, p.eventName, H - 45, 20, bold, rgb(1, 1, 1));
    centered(page, p.dateText, H - 68, 10, regular, rgb(0.95, 0.76, 0.19));
    centered(page, p.venue, H - 84, 9, regular, rgb(0.85, 0.92, 0.92));

    const png = await pdf.embedPng(await qrPng(t.token));
    page.drawImage(png, { x: 40, y: 190, width: 280, height: 280 });

    centered(page, `ENTRADA #${serialLabel(t.serial)}`, 150, 16, bold);
    centered(page, p.buyerName, 128, 11, regular);
    centered(page, `Ref: ${p.reference}`, 110, 10, regular, rgb(0.4, 0.43, 0.48));
    centered(page, "Presenta este QR en la puerta. Válido para un solo ingreso.", 40, 8, regular, rgb(0.4, 0.43, 0.48));
  }
  return pdf.save();
}
