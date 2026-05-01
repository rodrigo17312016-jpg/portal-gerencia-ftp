/* ============================================================
   areas.js — carga áreas con cache local (24h TTL).
   Si no hay red, sirve desde localStorage.
   ============================================================ */

(function () {
  'use strict';

  const CACHE_KEY = 'temperaturas_pwa.areas_cache_v1';
  const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

  function readCache() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      if (!obj || !Array.isArray(obj.data)) return null;
      const age = Date.now() - (obj.savedAt || 0);
      return { ...obj, expired: age > CACHE_TTL_MS };
    } catch (e) {
      return null;
    }
  }

  function writeCache(data) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        savedAt: Date.now(),
        data
      }));
    } catch (e) {
      console.warn('[areas] cache write failed', e);
    }
  }

  /**
   * Devuelve áreas activas. Estrategia stale-while-revalidate:
   * - Devuelve cache (incluso expirado) inmediatamente si existe
   * - Refresca de Supabase en background y dispara evento 'areas:updated'
   */
  async function getAreas({ forceRefresh = false } = {}) {
    const cache = readCache();

    if (!forceRefresh && cache && !cache.expired) {
      return cache.data;
    }

    const fresh = await fetchAndCache().catch(err => {
      console.warn('[areas] fetch fresh failed, using cache', err);
      return null;
    });

    if (fresh) return fresh;
    if (cache) return cache.data;
    return [];
  }

  async function fetchAndCache() {
    if (!window.SBClient || !window.SBClient.fetchAreasActivas) return null;
    const res = await window.SBClient.fetchAreasActivas();
    if (!res.ok) {
      console.error('[areas] fetch error', res.error);
      return null;
    }
    writeCache(res.data);
    document.dispatchEvent(new CustomEvent('areas:updated', { detail: res.data }));
    return res.data;
  }

  function getByCodigo(codigo) {
    const cache = readCache();
    if (!cache) return null;
    return cache.data.find(a => a.codigo === codigo) || null;
  }

  function getEmojiByTipo(area) {
    if (!area) return '🌡️';
    if (area.codigo && area.codigo.includes('PRODUCTO TERMINADO')) return '❄️';
    if (Number(area.limite_max) < 0) return '🧊';
    if (area.formato === 'mp') return '🚛';
    if (area.formato === 'proceso') return '🏭';
    if (area.formato === 'empaque') return '📦';
    return '🌡️';
  }

  function getColorClassByTipo(area) {
    if (!area) return 'cold';
    if (Number(area.limite_max) < 0) return 'frozen';
    if (area.formato === 'mp' || Number(area.limite_max) <= 8) return 'cold';
    return 'process';
  }

  function getFormatoMeta(formato) {
    const meta = {
      mp:      { label: 'Materia Prima', emoji: '🚛' },
      proceso: { label: 'Proceso',       emoji: '🏭' },
      empaque: { label: 'Empaque',       emoji: '📦' }
    };
    return meta[formato] || { label: formato, emoji: '🌡️' };
  }

  window.AreasService = {
    getAreas,
    getByCodigo,
    getEmojiByTipo,
    getColorClassByTipo,
    getFormatoMeta,
    refresh: () => fetchAndCache()
  };
})();
