# evento-tickets

Venta de ~200 entradas de **un solo evento** con pago por transferencia, comprobante, aprobación manual,
tickets con QR firmado (HMAC-SHA256) y validación en puerta desde una PWA.

**Stack:** Next.js 14 (App Router) · TypeScript · Prisma · PostgreSQL (Neon/Supabase) · Auth.js v5 · Resend · Vercel Blob.

## Variables de entorno mínimas

| Variable | Para qué | Cómo obtenerla |
|---|---|---|
| `DATABASE_URL` | Conexión a Postgres (en Neon, la *pooled*) | Panel de Neon / Supabase |
| `DIRECT_URL` | Conexión directa (migraciones). Si solo tienes una, repite la misma | Panel de Neon / Supabase |
| `AUTH_SECRET` | Firma de sesiones de Auth.js | `openssl rand -base64 32` |
| `TICKET_SECRET` | Clave HMAC de los QR (≥32 caracteres) | `openssl rand -hex 32` |
| `RESEND_API_KEY` | Envío de emails | resend.com (plan gratis) |
| `EMAIL_FROM` | Remitente, p. ej. `Entradas <entradas@tudominio.com>` | Dominio verificado en Resend |
| `BLOB_READ_WRITE_TOKEN` | Comprobantes | Vercel → Storage → Blob (se inyecta sola al conectar el store) |
| `APP_URL` | Links de los emails (opcional en Vercel) | `https://tu-dominio.vercel.app` |
| `CRON_SECRET` | Protege `/api/cron/expire` (opcional) | cualquier string aleatorio |

> **Los datos bancarios y del evento NO van en variables de entorno**: se editan en `/admin/settings`.
> ⚠️ Con `onboarding@resend.dev` Resend solo entrega a tu propio correo. Para enviar a compradores reales verifica un dominio.
> ⚠️ Si cambias `TICKET_SECRET` después de emitir entradas, esos QR dejan de validar.

## Puesta en marcha local

```bash
cp .env.example .env        # completa los valores
npm install
npx prisma db push          # crea las tablas
npm run db:seed             # evento de ejemplo + admin (SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD)
npm run dev
```

Sin `BLOB_READ_WRITE_TOKEN`, en desarrollo los comprobantes se guardan en `public/uploads`.
Para usar la cámara en el celular durante el desarrollo necesitas HTTPS (usa el deploy de Vercel o un túnel).

## Deploy en Vercel + Neon

1. Crea la base en Neon y ejecuta una vez desde tu máquina: `npx prisma db push && npm run db:seed` con `DATABASE_URL`/`DIRECT_URL` de Neon.
2. Sube el repo a GitHub e impórtalo en Vercel.
3. En Vercel → Storage crea un **Blob** store y conéctalo al proyecto.
4. Añade las variables de la tabla de arriba y despliega.
5. Entra a `/login` con el admin del seed, **cambia la contraseña** (crea otro admin en `/admin/staff` y desactiva el inicial) y completa `/admin/settings`.
6. Crea usuarios de puerta en `/admin/staff` (rol *Puerta*: solo ven `/scan`).
7. En el celular de puerta abre `/scan` y usa «Añadir a pantalla de inicio» para instalar la PWA.

## Flujo

1. Comprador: `/` → formulario → orden `pending` con referencia `EVENTO-XXXXXX` → `/orden/<ref>?k=<token>` muestra datos bancarios + subida del comprobante → `receipt_uploaded`.
2. Si no sube comprobante en *N* horas (configurable) la orden pasa a `expired` y libera stock. Se aplica **en vivo** (el stock ignora pendientes vencidas), en cada compra/visita al panel y con un cron diario (límite del plan Hobby).
3. Admin (`/admin`): ve el comprobante, **aprueba** (genera un ticket por entrada y envía el email con QR PNG + PDF) o **rechaza** (con motivo; notifica al comprador). Si el email falla, la aprobación se mantiene y hay botón *Reenviar*.
4. Acceso del comprador: link mágico del email (`/orden/<ref>?k=<token>`, el token es aleatorio de 192 bits) o `/mis-tickets` con **email + referencia**.
5. Puerta: `/scan` → `POST /api/tickets/validate` verifica la firma y ejecuta un único
   `UPDATE tickets SET used_at = now(), used_by = X WHERE id = Y AND used_at IS NULL`.
   Verde = válido · Amarillo = ya usado (con hora y quién) · Rojo = inválido. Sonido y vibración opcionales.

## Cómo verificar los criterios de aceptación

- **Compra completa:** compra → sube una imagen → aparece en `/admin` (pestaña *Por revisar*) → aprobar → llega el email y las entradas aparecen en `/orden/...`.
- **Verde / amarillo / rojo:** escanea un QR (verde), el mismo otra vez (amarillo con hora), y uno alterado o ajeno (rojo).
- **Concurrencia:** `npm run test:race` lanza 25 actualizaciones simultáneas sobre un ticket de prueba contra tu DB y debe reportar *Aceptados: 1*.
- **Config sin redeploy:** cambia banco/precio/stock/horas en `/admin/settings` y recarga `/` y una orden pendiente.

## Decisiones y límites a conocer

- **Stock sin sobreventa:** crear orden usa transacción con `SELECT … FOR UPDATE` sobre la fila de configuración.
- **Anti-acaparamiento:** máx. 3 órdenes pendientes vigentes por email. No hay rate-limit por IP; si te preocupa abuso, añade Upstash Ratelimit o Vercel WAF.
- **Comprobantes:** JPG/PNG/WebP, máx. 4 MB (la web reduce las fotos automáticamente). Las URLs del Blob son públicas pero con sufijo aleatorio.
- **Zona horaria:** fechas en hora de Ecuador (UTC-5).
- **Sesiones:** JWT de 12 h, pero cada petición verifica en DB que el usuario siga activo.
- **Cédula:** se valida solo el formato, no el dígito verificador.
- **Email:** los QR van como adjuntos PNG + PDF (los clientes de correo bloquean imágenes embebidas con frecuencia) y el link a la web.
