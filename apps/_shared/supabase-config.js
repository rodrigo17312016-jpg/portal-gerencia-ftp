/* ══════════════════════════════════════════════════════════════════════
   SUPABASE CONFIG - Fuente unica compartida para las 5 apps standalone
   Frutos Tropicales Peru Export S.A.C.

   Reemplaza las 5 copias duplicadas anteriores en apps/<app>/supabase-config.js
   (Carga global, no-module, para compatibilidad con <script src="...">)

   Expone globales:
   - SUPABASE_URL, SUPABASE_KEY
   - supabaseClient
   - checkSupabaseConnection()   (usa tabla inferida por URL)
   - getLocalToday()             (YYYY-MM-DD hora Peru)
   - saveToLocalStorage(key,val)
   - showSupabaseToast(msg,color)
   ══════════════════════════════════════════════════════════════════════ */

(function(global) {
  'use strict';

  // ─── Config base ───
  const SUPABASE_URL = 'https://rslzosmeteyzxmgfkppe.supabase.co';
  const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzbHpvc21ldGV5enhtZ2ZrcHBlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0OTc5NTgsImV4cCI6MjA5MDA3Mzk1OH0.XwitsLRWq10UsYshg_m2ViZh4BnV48zkJCK-JsRa9cs';

  // ─── Detectar tabla de health-check por URL de la app ───
  // Permite override manual via window.__FTP_PING_TABLE antes de cargar este script
  function inferPingTable() {
    if (global.__FTP_PING_TABLE) return global.__FTP_PING_TABLE;
    const p = (global.location && global.location.pathname) || '';
    if (p.indexOf('registro-tuneles') !== -1) return 'registro_tuneles';
    if (p.indexOf('registro-produccion') !== -1) return 'registro_produccion';
    if (p.indexOf('registro-personal') !== -1) return 'registro_personal';
    if (p.indexOf('registro-costos') !== -1) return 'config_costos';
    if (p.indexOf('empaque-congelado') !== -1) return 'registro_empaque_congelado';
    return 'registro_produccion'; // fallback seguro
  }

  // ─── Cliente Supabase con reintento de init (CDN puede cargar tarde) ───
  let supabaseClient = null;
  function _initSupabase() {
    if (supabaseClient) return true;
    try {
      if (global.supabase && typeof global.supabase.createClient === 'function') {
        supabaseClient = global.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        global.supabaseClient = supabaseClient;
        return true;
      }
    } catch (e) {
      console.error('[supabase-config] init error:', e);
    }
    return false;
  }
  if (!_initSupabase()) {
    setTimeout(_initSupabase, 500);
    setTimeout(_initSupabase, 1500);
  }

  // ─── Helper: fecha YYYY-MM-DD en hora Peru (UTC-5, sin DST) ───
  function getLocalToday() {
    // Convertir a hora Peru de forma robusta (cualquier TZ del navegador)
    const now = new Date();
    const peruTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Lima' }));
    const y = peruTime.getFullYear();
    const m = String(peruTime.getMonth() + 1).padStart(2, '0');
    const d = String(peruTime.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // ─── Helper: fecha ISO completa en hora Peru ───
  function getPeruDate() {
    return new Date().toLocaleString('en-US', { timeZone: 'America/Lima' });
  }

  // ─── Helper: backup en localStorage (swallow errors) ───
  function saveToLocalStorage(key, value) {
    try {
      localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
      return true;
    } catch (e) {
      console.warn('[supabase-config] localStorage full:', e.message);
      return false;
    }
  }

  // ─── Helper: Toast ligero para notif Supabase ───
  function showSupabaseToast(msg, color) {
    const existing = document.getElementById('supaToast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.id = 'supaToast';
    toast.textContent = msg;
    toast.style.cssText =
      'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);' +
      'padding:12px 28px;border-radius:12px;color:#fff;font-weight:700;' +
      'font-size:14px;z-index:99999;box-shadow:0 8px 32px rgba(0,0,0,0.3);' +
      'background:' + (color || '#16a34a') + ';transition:opacity 0.3s';
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // ─── Check de conexion con indicador visual ───
  // Busca el elemento por selector flexible para retrocompatibilidad con las 5 apps
  async function checkSupabaseConnection() {
    const pingTable = inferPingTable();
    const indicator =
      document.getElementById('supabaseStatus') ||
      document.querySelector('.supabase-status-dot, .status-indicator, [id*="supabase"], [class*="supabase"]') ||
      document.querySelector('.dot-status');
    const label =
      document.querySelector('.supabase-status-label, .sync-label, [id*="syncLabel"]');

    const setStatus = (ok, title) => {
      if (indicator) {
        indicator.style.background = ok ? '#22c55e' : '#ef4444';
        indicator.title = title;
        if (ok) indicator.style.boxShadow = '0 0 8px rgba(22,163,74,0.5)';
      }
      if (label) label.textContent = ok ? 'Conectado' : 'Sin conexion';
    };

    if (!supabaseClient) _initSupabase();
    if (!supabaseClient) {
      setStatus(false, 'Supabase: SDK no cargado');
      return false;
    }
    try {
      const { error } = await supabaseClient
        .from(pingTable)
        .select('*', { count: 'exact', head: true });
      if (error) {
        setStatus(false, 'Supabase: ' + error.message);
        return false;
      }
      setStatus(true, 'Supabase: Conectado');
      return true;
    } catch (e) {
      setStatus(false, 'Supabase: sin conexion');
      console.warn('[supabase-config] connection check failed:', e.message);
      return false;
    }
  }

  // ─── Auto-check con reintentos progresivos (uno por load) ───
  (function autoCheck() {
    const delays = [1500, 4000, 8000, 15000];
    (function next(i) {
      if (i >= delays.length) return;
      setTimeout(async function () {
        const ok = await checkSupabaseConnection();
        if (!ok) next(i + 1);
      }, delays[i]);
    })(0);
  })();

  // ─── Exponer API pública ───
  global.SUPABASE_URL = SUPABASE_URL;
  global.SUPABASE_KEY = SUPABASE_KEY;
  global.checkSupabaseConnection = checkSupabaseConnection;
  global.getLocalToday = getLocalToday;
  global.getPeruDate = getPeruDate;
  global.saveToLocalStorage = saveToLocalStorage;
  global.showSupabaseToast = showSupabaseToast;

})(window);
