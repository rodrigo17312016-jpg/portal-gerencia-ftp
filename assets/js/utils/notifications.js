/* ════════════════════════════════════════════════════════
   NOTIFICATIONS - Notificaciones desktop via Service Worker
   Frutos Tropicales Peru Export S.A.C.

   API limpia sobre la Notification API + Service Worker.
   Uso tipico desde un modulo:

   import { requestPermission, notifyAlert } from './notifications.js';
   await requestPermission();
   notifyAlert('Temperatura alta', 'Tunel 2 reporto -8°C (limite -15°C)');
   ════════════════════════════════════════════════════════ */

const DEFAULT_ICON = '/portal-gerencia-ftp/assets/images/logo.png';
const DEFAULT_BADGE = '/portal-gerencia-ftp/assets/icons/icon-192x192.png';

/**
 * Estado del permiso: 'granted' | 'denied' | 'default' | 'unsupported'
 */
export function getPermissionState() {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

/**
 * Solicita permiso para mostrar notificaciones.
 * @returns {Promise<'granted'|'denied'|'default'|'unsupported'>}
 */
export async function requestPermission() {
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  try {
    const result = await Notification.requestPermission();
    return result;
  } catch {
    return 'default';
  }
}

/**
 * Muestra una notificacion. Si el SW esta disponible, la delega ahi
 * (funciona tambien cuando la pestana no esta activa). Si no, fallback
 * a Notification directa.
 *
 * @param {string} title
 * @param {Object} [opts]
 * @param {string} [opts.body]
 * @param {string} [opts.icon]
 * @param {string} [opts.badge]
 * @param {string} [opts.tag] - Evita duplicados con el mismo tag
 * @param {boolean} [opts.requireInteraction=false]
 * @param {Array<Object>} [opts.actions]
 * @param {Object} [opts.data] - Datos custom (onclick tiene acceso)
 */
export async function notify(title, opts = {}) {
  if (!('Notification' in window)) {
    console.warn('[notifications] Notification API no soportada');
    return false;
  }
  if (Notification.permission !== 'granted') {
    console.warn('[notifications] Sin permiso para notificar');
    return false;
  }

  const options = {
    body: opts.body || '',
    icon: opts.icon || DEFAULT_ICON,
    badge: opts.badge || DEFAULT_BADGE,
    tag: opts.tag,
    requireInteraction: !!opts.requireInteraction,
    data: opts.data || {},
    silent: opts.silent || false
  };
  if (opts.actions) options.actions = opts.actions;

  try {
    // Preferir SW (funciona con tab en background)
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      if (reg) {
        await reg.showNotification(title, options);
        return true;
      }
    }
    // Fallback: Notification directa
    new Notification(title, options);
    return true;
  } catch (err) {
    console.error('[notifications] Error:', err);
    return false;
  }
}

/**
 * Atajo para alertas criticas (rojo, requireInteraction).
 */
export function notifyAlert(title, body, opts = {}) {
  return notify('⚠️ ' + title, {
    body,
    requireInteraction: true,
    tag: opts.tag || 'ftp-alert',
    ...opts
  });
}

/**
 * Atajo para notificaciones informativas.
 */
export function notifyInfo(title, body, opts = {}) {
  return notify('ℹ️ ' + title, {
    body,
    requireInteraction: false,
    tag: opts.tag || 'ftp-info',
    ...opts
  });
}
