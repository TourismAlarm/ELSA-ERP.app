// Service worker de ELSA ERP: red primero con caché de respaldo.
// Online siempre sirve lo último; offline sirve la última copia buena.
const CACHE = "elsa-erp-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // No cachear peticiones a otros orígenes (Supabase API/Storage van siempre a red)
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() =>
        caches.match(request).then((cached) => {
          if (cached) return cached;
          // Navegación sin red y sin caché exacta: servir la última shell de la app
          if (request.mode === "navigate") return caches.match("/");
          return Response.error();
        })
      )
  );
});
