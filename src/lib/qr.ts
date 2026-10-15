import QRCode from "qrcode";

export const qrPng = (token: string): Promise<Buffer> =>
  QRCode.toBuffer(token, { width: 512, margin: 2, errorCorrectionLevel: "M" });

export const qrDataUrl = (token: string): Promise<string> =>
  QRCode.toDataURL(token, { width: 360, margin: 2, errorCorrectionLevel: "M" });
