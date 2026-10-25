/**
 * Service Worker — Agua Clara PWA
 * Estrategia: Network-first para HTML/JS, cache-first para assets estáticos.
 * No cachea datos personales ni pagos.
 */

const CACHE_NAME = 'agua-clara-v10';
const BASE_PATH = new URL('./', self.registration.scope).pathname;
const STATIC_ASSETS = [
  '', 'index.html', 'styles.css', 'js/app.js', 'js/store.js', 'js/router.js', 'js/ui.js',
  'js/views/cliente.js', 'js/views/admin.js', 'js/views/repartidor.js', 'manifest.json',
  'icons/favicon.svg', 'img/aquaviva.jpg', 'img/cristalina.jpg', 'img/purissima.jpg',
].map(file => `${BASE_PATH}${file}`);

// Instalar: cachear recursos estáticos
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activar: limpiar caches antiguos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch: network-first para navegación y código, cache-first para assets
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Solo interceptamos nuestros propios archivos. Los recursos de terceros
  // (fuentes, wa.me, maps, supabase) los gestiona el navegador directamente.
  if (url.origin !== self.location.origin) return;

  // Navegación (HTML): red primero
  if (request.mode === 'navigate') {
    event.respondWith(fetchFirst(request));
    return;
  }

  // JavaScript y CSS: red primero para que una actualización se aplique
  // sin necesidad de desinstalar la PWA (el servidor envía no-cache).
  if (request.destination === 'script' || request.destination === 'style') {
    event.respondWith(fetchFirst(request));
    return;
  }

  // Resto de assets (iconos, imágenes): cache primero
  event.respondWith(
    caches.match(request)
      .then(cached => cached || fetch(request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        return response;
      }))
      .catch(() => caches.match('/index.html').then(r => r || new Response('Sin conexión', { status: 503 })))
  );
});

/** Red primero; si no hay red, usa la copia en caché. */
function fetchFirst(request) {
  return fetch(request)
    .then(response => {
      if (response.ok) {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
      }
      return response;
    })
    .catch(() =>
      caches.match(request).then(cached =>
        cached || (request.destination === 'document' ? caches.match(`${BASE_PATH}index.html`) : null)
      ).then(r => r || new Response('Sin conexión', { status: 503, statusText: 'Sin conexión' }))
    );
}
