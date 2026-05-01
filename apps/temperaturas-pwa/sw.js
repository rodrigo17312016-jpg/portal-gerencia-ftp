/* ============================================================
   Service Worker — Temperaturas PWA
   Estrategia:
   - App shell (HTML/CSS/JS): cache-first con fallback a network
   - Tesseract.js (lib pesada ~2MB): cache-first agresivo
   - Supabase API: network-first con timeout, fallback a queue offline
   - Imágenes locales: stale-while-revalidate
   ============================================================ */

const SW_VERSION = 'v3';
const APP_SHELL_CACHE = `temperaturas-shell-${SW_VERSION}`;
const RUNTIME_CACHE   = `temperaturas-runtime-${SW_VERSION}`;
const TESSERACT_CACHE = `temperaturas-tesseract-${SW_VERSION}`;

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/tokens.css',
  './css/components.css',
  './css/screens.css',
  './js/app.js',
  './js/supabase-client.js',
  './js/areas.js',
  './js/camera.js',
  './js/ocr.js',
  './js/offline-queue.js',
  './js/reminders.js',
  './js/screens/home.js',
  './js/screens/capture.js',
  './js/screens/confirm.js',
  './js/screens/success.js',
  './js/screens/setup.js',
  './js/screens/select-inspector.js',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// =========== INSTALL: precache app shell ===========
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
      .catch(err => console.error('[SW] Install failed:', err))
  );
});

// =========== ACTIVATE: limpiar caches viejos ===========
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k.startsWith('temperaturas-') && !k.endsWith(SW_VERSION))
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// =========== FETCH: routing por tipo de recurso ===========
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Solo manejamos GET. POST/PATCH a Supabase pasan directo al network.
  if (request.method !== 'GET') return;

  // Tesseract.js CDN (gstatic / unpkg / jsdelivr) → cache agresivo
  if (url.hostname.includes('tessdata') ||
      url.pathname.includes('tesseract') ||
      url.hostname.includes('jsdelivr.net') ||
      url.hostname.includes('unpkg.com')) {
    event.respondWith(cacheFirst(request, TESSERACT_CACHE));
    return;
  }

  // Supabase REST/Storage GET → network-first con fallback a cache
  if (url.hostname.includes('supabase.co')) {
    event.respondWith(networkFirst(request, RUNTIME_CACHE, 5000));
    return;
  }

  // Mismo origen → app shell cache-first
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(request, APP_SHELL_CACHE));
    return;
  }

  // Otros → network-first
  event.respondWith(networkFirst(request, RUNTIME_CACHE, 5000));
});

// =========== ESTRATEGIAS ===========
async function cacheFirst(request, cacheName) {
  try {
    const cached = await caches.match(request);
    if (cached) return cached;
    const fresh = await fetch(request);
    if (fresh && fresh.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, fresh.clone()).catch(() => {});
    }
    return fresh;
  } catch (err) {
    // Fallback final: si la app pide algo y no hay nada cacheado ni red, devolver index para SPA navigation
    if (request.mode === 'navigate') {
      const fallback = await caches.match('./index.html');
      if (fallback) return fallback;
    }
    throw err;
  }
}

async function networkFirst(request, cacheName, timeoutMs = 5000) {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const fresh = await fetch(request, { signal: controller.signal });
    clearTimeout(tid);
    if (fresh && fresh.ok && request.method === 'GET') {
      const cache = await caches.open(cacheName);
      cache.put(request, fresh.clone()).catch(() => {});
    }
    return fresh;
  } catch (err) {
    clearTimeout(tid);
    const cached = await caches.match(request);
    if (cached) return cached;
    if (request.mode === 'navigate') {
      const fallback = await caches.match('./index.html');
      if (fallback) return fallback;
    }
    // Devuelve respuesta sintética 503 para que el cliente sepa
    return new Response(JSON.stringify({ error: 'offline', message: 'Sin conexión y no hay copia en caché' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// =========== BACKGROUND SYNC (cuando vuelve la red) ===========
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-temperaturas') {
    event.waitUntil(notifyClientsToSync());
  }
});

async function notifyClientsToSync() {
  const clients = await self.clients.matchAll({ includeUncontrolled: true });
  clients.forEach(client => client.postMessage({ type: 'SYNC_TRIGGERED' }));
}

// =========== MESSAGE CHANNEL ===========
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// =========== PERIODIC BACKGROUND SYNC (recordatorios horarios) ===========
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'temperaturas-hourly-reminder') {
    event.waitUntil(handleHourlyReminder());
  }
});

async function handleHourlyReminder() {
  // Si hay un client abierto, le delegamos la decisión (sabe del config + áreas)
  const clients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
  if (clients.length > 0) {
    clients.forEach(c => c.postMessage({ type: 'CHECK_REMINDER' }));
    return;
  }
  // Sin client abierto: notificación genérica
  return self.registration.showNotification('🌡️ Recordatorio de temperaturas', {
    body: 'Toca para registrar las temperaturas pendientes de esta hora.',
    icon: 'icons/icon-192.png',
    badge: 'icons/icon-192.png',
    tag: 'hourly-reminder',
    renotify: true,
    requireInteraction: false,
    data: { source: 'periodic_sync', url: self.location.origin + self.location.pathname.replace(/sw\.js$/, '') }
  });
}

// =========== NOTIFICATION CLICK ===========
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) ||
                    self.location.origin + self.location.pathname.replace(/sw\.js$/, '');
  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    // Reusar tab si ya está abierta
    for (const client of clients) {
      if (client.url.startsWith(targetUrl) && 'focus' in client) {
        return client.focus();
      }
    }
    // Abrir nueva
    if (self.clients.openWindow) {
      return self.clients.openWindow(targetUrl);
    }
  })());
});
