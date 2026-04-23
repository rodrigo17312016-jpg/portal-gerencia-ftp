/* ════════════════════════════════════════════════════════
   PRODUCTION GUARD - Sanitiza logs en produccion
   Frutos Tropicales Peru Export S.A.C.

   Cuando el portal se sirve desde github.io o dominio de produccion,
   reduce la verbosidad de console.* para no exponer stack traces,
   URLs de Supabase, versiones de SDK, etc.

   Dev (localhost, 127.0.0.1, file://): logs completos.
   Prod (cualquier otro host): solo console.error minimalizado.
   ════════════════════════════════════════════════════════ */

(function () {
  const host = window.location.hostname;
  const isDev = !host || host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.') || window.location.protocol === 'file:';

  if (isDev) {
    // En dev: dejar todo como esta
    return;
  }

  // ─── PRODUCCION: sanitizar ───

  // Filtrar stack traces largos de errores
  const origError = console.error;
  console.error = function (...args) {
    const sanitized = args.map(a => {
      if (a instanceof Error) {
        // Solo mensaje, no stack completo
        return '[Error] ' + a.message;
      }
      if (typeof a === 'string') {
        // Remover URLs completas, mantener solo el host
        return a
          .replace(/https?:\/\/[^\s/]+/g, (url) => {
            try { return new URL(url).hostname; } catch { return '[url]'; }
          })
          .replace(/\s+at\s+.*?\n/g, ' ')     // stack frames
          .replace(/\/[a-zA-Z0-9_-]+\.js:\d+:\d+/g, '/[file].js');  // paths archivos
      }
      return a;
    });
    origError.apply(console, sanitized);
  };

  // Deshabilitar console.log / debug / info completamente en produccion
  console.log = function () {};
  console.debug = function () {};
  console.info = function () {};

  // console.warn permanece pero sin stacks
  const origWarn = console.warn;
  console.warn = function (...args) {
    const sanitized = args.map(a => {
      if (a instanceof Error) return '[Warn] ' + a.message;
      if (typeof a === 'string') return a.replace(/https?:\/\/[^\s/]+/g, '[host]');
      return a;
    });
    origWarn.apply(console, sanitized);
  };

  // ─── Bloquear window.onerror de filtrar info ───
  const origOnError = window.onerror;
  window.onerror = function (msg, src, line, col, err) {
    // Loguear solo mensaje generico
    origError.call(console, '[Runtime Error]', typeof msg === 'string' ? msg.substring(0, 100) : '[error]');
    // Llamar handler original si existia
    if (typeof origOnError === 'function') {
      try { origOnError.apply(window, arguments); } catch {}
    }
    return true; // prevenir default (que lo imprima con stack)
  };

  // ─── Marker inicial opcional (util para detectar prod) ───
  window.__FTP_PROD_MODE = true;
})();
