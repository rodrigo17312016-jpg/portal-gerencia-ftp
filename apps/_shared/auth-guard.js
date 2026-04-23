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

  // 2) Fallback: sesion legacy
  var hasLegacy = false;
  try {
    var s = JSON.parse(localStorage.getItem('ftp_session') || 'null');
    if (s && s.user && s.expires > Date.now()) {
      hasLegacy = true;
      window.__ftpAuthMode = 'legacy';
      window.__ftpAuthUser = s.user;
    }
  } catch (e) { /* noop */ }

  // 3) Sin sesion: redirigir
  if (!hasSupabase && !hasLegacy) {
    // Calcular path al login: las apps estan en /apps/<app>/
    // El login esta en /<base>/login.html
    var current = window.location.pathname;
    var base = current.substring(0, current.indexOf('/apps/'));
    window.location.replace(base + '/login.html');
    // Bloquear ejecucion del resto del script
    throw new Error('FTP_AUTH_GUARD: redirigiendo a login');
  }

  // OK: sesion valida, exponer flag global por si la app necesita
  window.__ftpAuthOk = true;
})();
