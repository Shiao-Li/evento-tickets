import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque } from "next/font/google";
import "./globals.css";

const font = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-main", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Entradas", template: "%s · Entradas" },
  description: "Compra de entradas con QR",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icons/icon-192.png", apple: "/icons/icon-192.png" },
  appleWebApp: { capable: true, title: "Escáner", statusBarStyle: "black-translucent" },
};
export const viewport: Viewport = { themeColor: "#0f5c5c", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={font.variable}>
      <body>{children}</body>
    </html>
  );
}
