/** @type {import('next').NextConfig} */
const nextConfig = {
  // html5-qrcode arranca la cámara sobre un <div> y no tolera el doble montaje del modo estricto en dev.
  reactStrictMode: false,
  poweredByHeader: false,
};
export default nextConfig;
