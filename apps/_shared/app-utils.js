/* ══════════════════════════════════════════════════════════════════════
   APP UTILS - Helpers compartidos para las 5 apps standalone
   Frutos Tropicales Peru Export S.A.C.

   Funciones globales:
   - showToast(msg, opts)       (toast visual con color/tipo)
   - formatNum(n, decimals)     (es-PE locale)
   - formatDateTime(dt)         (hora Peru)
   - debounce(fn, ms)
   - applyThemeFromStorage(key) (dark/light persistente)
   - toggleTheme(key)
   ══════════════════════════════════════════════════════════════════════ */

(function(global) {
  'use strict';

  // ─── Toast unificado (reemplaza las 5 variantes por app) ───
  // Uso: showToast('Guardado', {type:'success'})
  //      showToast('Error', {type:'error'})
  //      showToast('Info', {color:'#3b82f6'})
  function showToast(msg, opts) {
    opts = opts || {};
    const type = opts.type || 'success';
    const colors = {
      success: '#16a34a',
      error: '#ef4444',
      warn: '#f59e0b',
      info: '#3b82f6'
    };
    const bg = opts.color || colors[type] || colors.success;
    const duration = opts.duration || 3000;

    let toast = document.getElementById('ftpToast');
    if (toast) toast.remove();
    toast = document.createElement('div');
    toast.id = 'ftpToast';
    toast.textContent = msg;
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.style.cssText =
      'position:fixed;bottom:28px;left:50%;transform:translateX(-50%);' +
      'padding:12px 28px;border-radius:12px;color:#fff;font-weight:700;' +
      'font-size:14px;z-index:99999;box-shadow:0 8px 32px rgba(0,0,0,0.35);' +
      'background:' + bg + ';transition:opacity .3s ease,transform .3s ease;' +
      'max-width:90vw;text-align:center';
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(-50%) translateY(10px)';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  // ─── Formato numerico Peru (es-PE) ───
  function formatNum(n, decimals) {
    if (n == null || isNaN(n)) return '0';
    return Number(n).toLocaleString('es-PE', {
      minimumFractionDigits: decimals || 0,
      maximumFractionDigits: decimals != null ? decimals : 1
    });
  }

  // ─── Formato fecha/hora Peru ───
  function formatDateTime(dt) {
    const d = dt instanceof Date ? dt : new Date(dt);
    if (isNaN(d)) return '';
    return d.toLocaleString('es-PE', {
      timeZone: 'America/Lima',
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  // ─── Debounce para inputs / resize ───
  function debounce(fn, ms) {
    let t;
    return function () {
      const args = arguments;
      const ctx = this;
      clearTimeout(t);
      t = setTimeout(() => fn.apply(ctx, args), ms || 200);
    };
  }

  // ─── Theme toggle unificado (persistente per-app via storage key) ───
  // Uso: applyThemeFromStorage('costos_theme') al cargar
  //      toggleTheme('costos_theme') al click
  function applyThemeFromStorage(storageKey) {
    try {
      const saved = localStorage.getItem(storageKey || 'ftp_app_theme');
      if (saved === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        document.body.setAttribute('data-theme', 'dark');
      } else {
        document.documentElement.removeAttribute('data-theme');
        document.body.removeAttribute('data-theme');
      }
    } catch (e) { /* storage bloqueado */ }
  }

  function toggleTheme(storageKey) {
    const key = storageKey || 'ftp_app_theme';
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark' ||
                   document.body.getAttribute('data-theme') === 'dark';
    const next = isDark ? 'light' : 'dark';
    if (next === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      document.body.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
      document.body.removeAttribute('data-theme');
    }
    try { localStorage.setItem(key, next); } catch (e) { /* noop */ }
    return next;
  }

  // ─── Exponer ───
  global.showToast = showToast;
  global.formatNum = formatNum;
  global.formatDateTime = formatDateTime;
  global.debounce = debounce;
  global.applyThemeFromStorage = applyThemeFromStorage;
  global.toggleThemeShared = toggleTheme; // 'toggleTheme' suele estar definida per-app, no pisamos

})(window);
