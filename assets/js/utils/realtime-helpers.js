/* ════════════════════════════════════════════════════════
   REALTIME HELPERS - Supabase Postgres Changes
   Frutos Tropicales Peru Export S.A.C.

   Suscripciones a cambios en tablas operacionales.
   Uso tipico desde un modulo de panel:

   import { subscribeToTable } from '../../assets/js/utils/realtime-helpers.js';
   const sub = subscribeToTable('registro_produccion', (payload) => {
     console.log('cambio:', payload);
     loadData();  // re-renderizar
   });
   // En onHide/destroy:
   sub.unsubscribe();
   ════════════════════════════════════════════════════════ */

import { supabase } from '../config/supabase.js';

/**
 * Crea una suscripcion realtime a una tabla.
 *
 * @param {string} table - Nombre de la tabla (ej: 'registro_produccion')
 * @param {(payload: {eventType,new,old,table}) => void} onChange - Callback
 * @param {Object} [opts]
 * @param {'*'|'INSERT'|'UPDATE'|'DELETE'} [opts.event='*'] - Tipo de evento a escuchar
 * @param {string} [opts.schema='public']
 * @param {string} [opts.filter] - Filtro SQL (ej: "fecha=eq.2026-04-23")
 * @returns {Object} { unsubscribe(): void, status(): string }
 */
export function subscribeToTable(table, onChange, opts = {}) {
  const event = opts.event || '*';
  const schema = opts.schema || 'public';
  const channelName = `realtime:${schema}:${table}:${Date.now()}:${Math.random().toString(36).slice(2,8)}`;

  const config = { event, schema, table };
  if (opts.filter) config.filter = opts.filter;

  const channel = supabase
    .channel(channelName)
    .on('postgres_changes', config, (payload) => {
      try {
        onChange({
          eventType: payload.eventType,
          new: payload.new,
          old: payload.old,
          table: payload.table
        });
      } catch (err) {
        console.error('[realtime] callback error:', err);
      }
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.info(`[realtime] suscrito a ${table} (${event})`);
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.warn(`[realtime] problema en ${table}:`, status);
      }
    });

  return {
    unsubscribe() {
      try {
        supabase.removeChannel(channel);
      } catch (e) { /* noop */ }
    },
    status() {
      return channel.state;
    }
  };
}

/**
 * Suscribe a multiples tablas con un solo callback.
 * Retorna un objeto con unsubscribe() que limpia todas.
 */
export function subscribeToTables(tables, onChange) {
  const subs = tables.map(t => subscribeToTable(t, (payload) => onChange({ ...payload, table: t })));
  return {
    unsubscribe() { subs.forEach(s => s.unsubscribe()); }
  };
}

/**
 * Indicador visual "Live" - circulo pulsante que parpadea cuando hay cambios.
 * Retorna un elemento DOM listo para insertar.
 */
export function createLiveIndicator() {
  const el = document.createElement('span');
  el.className = 'ftp-live-indicator';
  el.innerHTML = `
    <span class="ftp-live-dot" style="width:8px;height:8px;background:#16a34a;border-radius:50%;display:inline-block;margin-right:6px;box-shadow:0 0 6px rgba(22,163,74,0.6)"></span>
    <span style="font-size:11px;font-weight:700;color:#16a34a">LIVE</span>
  `;
  el.style.cssText = 'display:inline-flex;align-items:center;padding:4px 10px;background:rgba(22,163,74,0.1);border-radius:12px;border:1px solid rgba(22,163,74,0.3)';

  // API: flash() hace parpadear el indicador cuando recibe evento
  el.flash = function() {
    const dot = el.querySelector('.ftp-live-dot');
    if (!dot) return;
    dot.style.transition = 'none';
    dot.style.transform = 'scale(2)';
    dot.style.background = '#f59e0b';
    setTimeout(() => {
      dot.style.transition = 'all 0.6s ease';
      dot.style.transform = 'scale(1)';
      dot.style.background = '#16a34a';
    }, 50);
  };

  return el;
}
