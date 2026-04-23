/* ════════════════════════════════════════════════════════
   SERVICE WORKER - Portal Gerencia Unificado
   Frutos Tropicales Peru Export S.A.C.
   ════════════════════════════════════════════════════════ */

const CACHE_NAME = 'ftp-portal-v28';
const STATIC_ASSETS = [
  '/',
  '/portal.html',
  '/login.html',
  '/index.html',
  '/manifest.json',
  '/assets/css/variables.css',
  '/assets/css/reset.css',
  '/assets/css/animations.css',
  '/assets/css/layout.css',
  '/assets/css/components.css',
  '/assets/css/charts.css',
  '/assets/css/login.css',
  '/assets/css/landing.css',
  '/assets/js/app.js',
  '/assets/js/landing.js',
  '/assets/js/config/supabase.js',
  '/assets/js/config/users.js',
  '/assets/js/config/constants.js',
  '/assets/js/core/auth.js',
  '/assets/js/core/router.js',
  '/assets/js/core/theme.js',
  '/assets/js/core/clock.js',
  '/assets/js/utils/chart-helpers.js',
  '/assets/js/utils/formatters.js',
  '/assets/js/utils/dom-helpers.js',
  '/config/roles.json',
  '/config/navigation.json',
  '/assets/images/logo.png',
  '/apps/_shared/auth-guard.js',
  '/apps/_shared/supabase-config.js',
  '/apps/_shared/app-utils.js',
  '/apps/_shared/app-base.css',
  '/apps/_shared/data-sync.js',
  '/apps/_shared/chart-helpers.js'
];

// Install - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(err => {
        console.warn('SW: Some assets failed to cache:', err);
      });
    })
  );
  self.skipWaiting();
});

// Activate - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      );
    })
  );
  self.clients.claim();
});

// ── Notificaciones: click para abrir/enfocar portal ──
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const panelId = event.notification.data?.panelId || '';
  const targetUrl = panelId
    ? `/portal-gerencia-ftp/portal.html?panel=${encodeURIComponent(panelId)}`
    : '/portal-gerencia-ftp/portal.html';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Si ya hay una tab del portal abierta, enfocarla
      for (const client of clients) {
        if (client.url.includes('/portal-gerencia-ftp/') && 'focus' in client) {
          // Postear mensaje al cliente para que navegue al panel
          if (panelId) client.postMessage({ type: 'SHOW_PANEL', panelId });
          return client.focus();
        }
      }
      // Sino abrir una nueva
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});

// Fetch - Network first, fallback to cache
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Never cache Supabase API calls
  if (url.hostname.includes('supabase.co')) return;

  // Never cache external CDNs (fonts, chart.js, font-awesome)
  if (url.hostname !== location.hostname) return;

  // For module HTML/JS files - network first (they change during dev)
  if (url.pathname.startsWith('/modules/')) {
    event.respondWith(
      fetch(request).catch(() => caches.match(request))
    );
    return;
  }

  // For static assets - cache first, network fallback
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok && request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        return response;
      });
    }).catch(() => {
      // Offline fallback for navigation
      if (request.mode === 'navigate') {
        return caches.match('/portal.html');
      }
    })
  );
});
