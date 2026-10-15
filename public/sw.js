// Service worker mínimo: hace la app instalable. No cachea nada porque validar requiere conexión.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (e) => {
  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request).catch(
        () =>
          new Response("<h1>Sin conexión</h1><p>El escáner necesita internet para validar entradas.</p>", {
            headers: { "Content-Type": "text/html; charset=utf-8" },
          })
      )
    );
  }
});
