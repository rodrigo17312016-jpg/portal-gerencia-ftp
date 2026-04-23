/* ════════════════════════════════════════════════════════
   AUTH GUARD - Apps standalone
   Frutos Tropicales Peru Export S.A.C.

   Verifica sesion (Supabase Auth o legacy) ANTES de que
   cualquier script de la app cargue. Si no hay sesion,
   redirige al login del portal principal.

   USO: incluir como PRIMER script en el <head> de cada app:
   <script src="../_shared/auth-guard.js"></script>

   No es modulo (corre sincrono, sin await), no requiere
   cargar @supabase/supabase-js.
   ════════════════════════════════════════════════════════ */

(function authGuard() {
  // 1) Buscar token Supabase Auth (JWT firmado, no manipulable)
  var hasSupabase = false;
  try {
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && k.indexOf('sb-') === 0 && k.indexOf('-auth-token') > 0) {
        var v = localStorage.getItem(k);
        if (v && v.length > 100) {
          // Verificacion adicional: que no haya expirado
          try {
            var payload = JSON.parse(v);
            var token = payload.access_token || (payload.currentSession && payload.currentSession.access_token);
            var expiresAt = payload.expires_at || (payload.currentSession && payload.currentSession.expires_at);
            if (expiresAt && expiresAt * 1000 > Date.now()) {
              hasSupabase = true;
              window.__ftpAuthMode = 'supabase';
              window.__ftpAuthToken = token;
              break;
            } else if (!expiresAt) {
              // No tiene expires_at en el formato conocido, pero hay token
              hasSupabase = true;
              window.__ftpAuthMode = 'supabase-unknown-format';
              break;
            }
          } catch (e) {
            // No se pudo parsear, asumimos valido si tiene >100 chars
            hasSupabase = true;
            window.__ftpAuthMode = 'supabase-raw';
            break;
          }
        }
      }
    }
  } catch (e) { /* localStorage bloqueado */ }

  // 2) Post-Fase 9: eliminado fallback legacy.
  // Si no hay sesion Supabase valida, no hay sesion.
  try { localStorage.removeItem('ftp_session'); } catch (e) { /* noop */ }

  // 3) Sin sesion: redirigir
  if (!hasSupabase) {
    // Calcular path al login de forma robusta:
    // - Caso normal: las apps estan en /<base>/apps/<app>/  -> /<base>/login.html
    // - Fallback: si no hay /apps/ en la URL (edge case), subir 2 niveles
    //   desde el archivo actual hasta llegar a la raiz del portal
    var current = window.location.pathname;
    var appsIdx = current.indexOf('/apps/');
    var loginUrl;
    if (appsIdx > -1) {
      loginUrl = current.substring(0, appsIdx) + '/login.html';
    } else {
      // Fallback: subir 2 niveles (../../login.html) relativo al archivo actual
      var parts = current.split('/').filter(Boolean);
      if (parts.length >= 2) parts.splice(parts.length - 2, 2);
      loginUrl = '/' + parts.join('/') + (parts.length ? '/' : '') + 'login.html';
    }
    // Ocultar el body para evitar flash antes del redirect
    if (document.documentElement) {
      document.documentElement.style.visibility = 'hidden';
    }
    window.location.replace(loginUrl);
    // Salir silenciosamente (en vez de throw, que ensucia la consola)
    window.__ftpAuthOk = false;
    return;
  }

  // OK: sesion valida, exponer flag global por si la app necesita
  window.__ftpAuthOk = true;
})();
