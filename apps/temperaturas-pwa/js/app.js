/* ============================================================
   app.js — entry point + router + helpers globales.
   Se ejecuta DESPUÉS de los demás scripts (orden en index.html).
   ============================================================ */

(function () {
  'use strict';

  const SCREENS = {
    'select-inspector': () => window.ScreenSelectInspector,
    setup:   () => window.ScreenSetup,
    home:    () => window.ScreenHome,
    capture: () => window.ScreenCapture,
    confirm: () => window.ScreenConfirm,
    success: () => window.ScreenSuccess
  };

  let currentScreen = null;

  function navigate(screen, props = {}) {
    const handler = SCREENS[screen]?.();
    if (!handler) {
      console.error('[app] screen not found:', screen);
      return;
    }
    currentScreen = screen;

    // Asíncrono: el render puede ser async (ej: home espera fetch).
    Promise.resolve()
      .then(() => handler.render(props))
      .then((html) => {
        if (typeof html === 'string') {
          document.getElementById('app').innerHTML = html;
        }
        if (typeof handler.bind === 'function') {
          handler.bind(props);
        }
        // Scroll al tope al cambiar de pantalla
        window.scrollTo({ top: 0, behavior: 'instant' });
      })
      .catch((e) => {
        console.error('[app] navigate error', e);
        toast('Error: ' + (e.message || 'desconocido'), 'error');
      });
  }

  function toast(message, type = 'info', durationMs = 3000) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const el = document.createElement('div');
    el.className = `toast toast--${type}`;
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => {
      el.classList.add('toast--leaving');
      setTimeout(() => el.remove(), 250);
    }, durationMs);
  }

  // ============ ONLINE/OFFLINE indicator ============
  function updateOnlineStatus() {
    const pill = document.getElementById('online-status');
    if (!pill) return;
    if (navigator.onLine) {
      pill.classList.remove('offline');
      pill.classList.add('online');
      pill.textContent = 'En línea';
    } else {
      pill.classList.remove('online');
      pill.classList.add('offline');
      pill.textContent = 'Sin conexión';
    }
  }
  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
  document.addEventListener('queue:flushed', (ev) => {
    if (ev.detail && ev.detail.synced > 0) {
      toast(`✓ Sincronizado: ${ev.detail.synced} registro(s)`, 'success', 2500);
      // Refrescar home si está visible
      if (currentScreen === 'home' && window.ScreenHome.refresh) {
        window.ScreenHome.refresh();
      }
    }
  });

  // ============ SERVICE WORKER ============
  function registerSW() {
    if (!('serviceWorker' in navigator)) return;
    if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
      // Service Workers solo funcionan en HTTPS o localhost
      return;
    }
    navigator.serviceWorker.register('./sw.js').catch(err => {
      console.warn('[app] SW register failed', err);
    });
    // Mensajes desde el SW (ej: CHECK_REMINDER tras periodicsync)
    navigator.serviceWorker.addEventListener('message', (ev) => {
      if (!ev.data || !ev.data.type) return;
      if (ev.data.type === 'CHECK_REMINDER' && window.RemindersService) {
        window.RemindersService.maybeShowReminder('periodic_sync_relay');
      }
    });
  }

  // ============ INIT ============
  function init() {
    // Flow nuevo: la PWA siempre tiene config (defaults hardcoded).
    // Lo único que falta es elegir inspector.
    if (window.SBClient && window.SBClient.isOperarioSet()) {
      navigate('home');
    } else {
      navigate('select-inspector');
    }
    registerSW();
  }

  // Esperar a que todos los scripts estén cargados
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose
  window.App = { navigate, toast };
})();
