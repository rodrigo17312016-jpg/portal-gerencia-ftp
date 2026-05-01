/* ============================================================
   reminders.js — recordatorios horarios sin backend.
   Estrategia 3 capas (cae a la siguiente si la anterior no soporta):

   1) Periodic Background Sync (Chrome Android, PWA instalada con engagement)
      → SW se despierta cada hora aprox y dispara notificación.
   2) Notification API + setInterval mientras la app está abierta
      → si el operario tiene la PWA visible, recordatorio cada hora exacta.
   3) Reminder pasivo: al ABRIR la PWA, si pasó >1h del último registro
      del área pendiente, mostrar banner sticky en home.

   Sin servidor backend = 100% gratis. No requiere FCM/VAPID.
   ============================================================ */

(function () {
  'use strict';

  const PERMISSION_KEY = 'temperaturas_pwa.reminder_permission_asked';
  const LAST_REMINDER_KEY = 'temperaturas_pwa.last_reminder_at';
  const REMINDER_INTERVAL_MS = 60 * 60 * 1000; // 1 hora
  const SYNC_TAG = 'temperaturas-hourly-reminder';

  // ============== PERMISO DE NOTIFICACIONES ==============

  function permissionState() {
    if (typeof Notification === 'undefined') return 'unsupported';
    return Notification.permission; // 'default' | 'granted' | 'denied'
  }

  async function requestPermission() {
    if (typeof Notification === 'undefined') return 'unsupported';
    if (Notification.permission !== 'default') return Notification.permission;
    try {
      const result = await Notification.requestPermission();
      localStorage.setItem(PERMISSION_KEY, '1');
      return result;
    } catch (e) {
      return 'denied';
    }
  }

  function wasPermissionAsked() {
    return localStorage.getItem(PERMISSION_KEY) === '1';
  }

  // ============== PERIODIC BACKGROUND SYNC ==============

  async function registerPeriodicSync() {
    if (!('serviceWorker' in navigator)) return false;
    try {
      const reg = await navigator.serviceWorker.ready;
      // periodicSync API es experimental, está en Chrome estable Android
      if (!reg.periodicSync) return false;

      // Verificar permiso explícito
      const status = await navigator.permissions.query({ name: 'periodic-background-sync' });
      if (status.state !== 'granted') {
        console.warn('[reminders] periodic-background-sync no concedido:', status.state);
        return false;
      }

      await reg.periodicSync.register(SYNC_TAG, {
        minInterval: REMINDER_INTERVAL_MS  // mínimo solicitado; el browser decide cadencia real
      });
      console.log('[reminders] periodic sync registrado');
      return true;
    } catch (e) {
      console.warn('[reminders] periodic sync registro fallido', e);
      return false;
    }
  }

  // ============== TIMER MIENTRAS LA APP ESTÁ ABIERTA ==============

  let foregroundTimer = null;

  function startForegroundReminder() {
    stopForegroundReminder();
    // Calcular tiempo hasta próxima hora exacta (xx:00)
    const now = new Date();
    const minutesToNextHour = 60 - now.getMinutes();
    const msToNextHour = (minutesToNextHour * 60 - now.getSeconds()) * 1000;
    foregroundTimer = setTimeout(function tick() {
      maybeShowReminder('hourly_foreground');
      foregroundTimer = setInterval(() => maybeShowReminder('hourly_foreground'), REMINDER_INTERVAL_MS);
    }, msToNextHour);
  }

  function stopForegroundReminder() {
    if (foregroundTimer) {
      clearTimeout(foregroundTimer);
      clearInterval(foregroundTimer);
      foregroundTimer = null;
    }
  }

  // ============== NOTIFICATION ==============

  /**
   * Muestra notificación. Si la app está visible, cae a toast en lugar de notif sistema.
   */
  async function showReminderNotification({ title, body, source }) {
    // Throttle: máximo una cada 50 minutos
    const last = parseInt(localStorage.getItem(LAST_REMINDER_KEY) || '0', 10);
    if (Date.now() - last < 50 * 60 * 1000) return;
    localStorage.setItem(LAST_REMINDER_KEY, String(Date.now()));

    const visible = document.visibilityState === 'visible';

    if (visible && window.App && window.App.toast) {
      window.App.toast(`⏰ ${body}`, 'warning', 5000);
      return;
    }

    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

    try {
      const reg = await navigator.serviceWorker.ready;
      if (reg && reg.showNotification) {
        await reg.showNotification(title, {
          body,
          icon: 'icons/icon-192.png',
          badge: 'icons/icon-192.png',
          tag: 'hourly-reminder',
          renotify: true,
          requireInteraction: false,
          data: { source, url: location.origin + location.pathname }
        });
      } else {
        // Fallback notification directa (solo si no hay SW)
        new Notification(title, { body, icon: 'icons/icon-192.png' });
      }
    } catch (e) {
      console.warn('[reminders] notif fallida', e);
    }
  }

  // ============== LÓGICA DE DECISIÓN ==============

  /**
   * Decide si mostrar reminder. Solo lo muestra si:
   * - hay áreas activas
   * - alguna área no tiene registro en la última hora del turno actual
   */
  async function maybeShowReminder(source = 'manual') {
    if (!window.SBClient || !window.SBClient.isConfigured()) return;

    const areas = (window.AreasService && await window.AreasService.getAreas()) || [];
    const activas = areas.filter(a => a.activa !== false);
    if (!activas.length) return;

    // Cargar registros últimas 2 horas
    let registrosHoy = [];
    try {
      const res = await window.SBClient.fetchRegistrosHoy(200);
      if (res.ok) registrosHoy = res.data || [];
    } catch (e) {}

    // Para cada área, ver si hay registro en última hora
    const ahora = new Date();
    const fechaHoy = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(ahora);

    const pendientes = activas.filter(area => {
      const matches = registrosHoy.filter(r => r.area === area.codigo && r.fecha === fechaHoy);
      if (!matches.length) return true; // nunca registrada hoy
      // Encontrar el más reciente
      matches.sort((a, b) => (b.hora || '').localeCompare(a.hora || ''));
      const ultimoStr = matches[0].hora;
      if (!ultimoStr) return true;
      const [hh, mm] = ultimoStr.split(':').map(Number);
      const ultimo = new Date(ahora);
      ultimo.setHours(hh, mm, 0, 0);
      const diffMin = (ahora - ultimo) / 60000;
      return diffMin > 60; // sin registro en última hora
    });

    if (!pendientes.length) return;

    const totalPendientes = pendientes.length;
    const ejemplos = pendientes.slice(0, 3).map(a => a.nombre).join(', ');
    const more = totalPendientes > 3 ? ` +${totalPendientes - 3} más` : '';
    const body = `${totalPendientes} área(s) sin registro en la última hora: ${ejemplos}${more}`;

    await showReminderNotification({
      title: '🌡️ Recordatorio de temperaturas',
      body,
      source
    });
  }

  // ============== REMINDER PASIVO AL ABRIR ==============

  function checkOnAppOpen() {
    // Se ejecuta cuando la app abre/vuelve a foreground
    setTimeout(() => maybeShowReminder('app_open'), 2000);
  }

  // ============== INIT ==============

  async function init() {
    if (!('serviceWorker' in navigator)) return;

    // Si ya tiene permiso, registrar todo
    if (permissionState() === 'granted') {
      await registerPeriodicSync();
      startForegroundReminder();
    }

    // Cuando la pestaña vuelve visible
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        checkOnAppOpen();
      }
    });

    // Reminder al cargar
    checkOnAppOpen();
  }

  // Conectar después de que el resto de scripts esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(init, 1000));
  } else {
    setTimeout(init, 1000);
  }

  // Expose
  window.RemindersService = {
    permissionState,
    requestPermission,
    wasPermissionAsked,
    registerPeriodicSync,
    startForegroundReminder,
    stopForegroundReminder,
    maybeShowReminder,
    showReminderNotification
  };
})();
