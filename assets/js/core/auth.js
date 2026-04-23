/* ════════════════════════════════════════════════════════
   AUTH - Sistema dual: Supabase Auth (real) con fallback
   a USERS[] hardcoded para transicion suave.

   Comportamiento:
   - signIn intenta primero supabase.auth.signInWithPassword
     usando email sintetico {username}@frutos.local
   - Si falla (user no existe en Supabase Auth), cae al sistema
     legacy USERS[] con localStorage. Esto permite migrar sin
     romper logins durante la transicion.
   - La sesion Supabase es JWT firmado (no manipulable).
     La sesion legacy es localStorage manipulable (deuda tecnica).

   Para migrar 100%: una vez confirmado que todos los users
   pueden entrar via Supabase, eliminar el fallback en doLogin().
   ════════════════════════════════════════════════════════ */

import { USERS } from '../config/users.js';
import { SESSION_TIMEOUT } from '../config/constants.js';
import { supabase } from '../config/supabase.js';

const EMAIL_DOMAIN = '@frutos.local';
let sessionTimer = null;
let currentUser = null;

// ─── Helpers internos ───
function usernameToEmail(username) {
  return username.toLowerCase().trim() + EMAIL_DOMAIN;
}

function emailToUsername(email) {
  return (email || '').replace(EMAIL_DOMAIN, '').toLowerCase();
}

// Construir objeto user a partir de session de Supabase
function userFromSupabaseSession(sbSession) {
  if (!sbSession || !sbSession.user) return null;
  const meta = sbSession.user.user_metadata || {};
  const username = meta.username || emailToUsername(sbSession.user.email);
  // Combinar metadata con USERS[] (USERS tiene los datos legacy)
  const legacy = USERS[username] || {};
  return {
    username,
    name: meta.name || legacy.name || username,
    role: meta.role || legacy.role || 'admin',
    roleLabel: legacy.roleLabel || meta.role || '',
    initials: meta.initials || legacy.initials || username.slice(0, 2).toUpperCase(),
    _supabase: true  // marca: sesion Supabase real
  };
}

// ─── Sesion ───
export function getSession() {
  // Prioridad: sesion Supabase (si esta cargada)
  // No es async para mantener compatibilidad; usa el estado en memoria
  if (currentUser && currentUser._supabase) {
    return { user: currentUser.username, expires: Date.now() + SESSION_TIMEOUT };
  }
  // Fallback: localStorage (sistema legacy)
  try {
    const data = JSON.parse(localStorage.getItem('ftp_session') || 'null');
    if (data && data.user && data.expires > Date.now() && USERS[data.user]) {
      return data;
    }
  } catch {}
  return null;
}

export function getCurrentUser() {
  if (currentUser) return currentUser;
  const session = getSession();
  if (session && USERS[session.user]) {
    currentUser = { ...USERS[session.user], username: session.user };
    return currentUser;
  }
  return null;
}

export function getCurrentRole() {
  const user = getCurrentUser();
  return user ? user.role : null;
}

// ─── Permisos ───
export function hasAccess(panelId) {
  const role = getCurrentRole();
  if (!role) return false;
  if (role === 'admin') return true;
  const permissions = getPermissions();
  if (!permissions[role]) return false;
  if (permissions[role].panels === '*') return true;
  return permissions[role].panels.includes(panelId);
}

let _permissions = null;
function getPermissions() {
  if (_permissions) return _permissions;
  _permissions = window.__ROLES || {};
  return _permissions;
}

export function setPermissions(roles) {
  _permissions = roles;
  window.__ROLES = roles;
}

// ─── Login (Supabase + fallback) ───
export async function doLogin(username, password) {
  const u = username.toLowerCase().trim();

  // 1) Intento Supabase Auth (real, JWT firmado)
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: usernameToEmail(u),
      password
    });

    if (!error && data && data.session) {
      currentUser = userFromSupabaseSession(data.session);
      sessionStorage.setItem('ftp_logged_in', 'true');
      // No guardamos en localStorage porque Supabase ya lo hace
      // (sb-<ref>-auth-token) y es un JWT firmado
      startSessionTimer();
      return { success: true, user: currentUser, mode: 'supabase' };
    }
    // Si error existe, no es excepcion - es bad credentials
  } catch (err) {
    // Network error o supabase caido. Cae al fallback
    console.warn('[auth] Supabase Auth no disponible, usando fallback:', err.message);
  }

  // 2) Fallback: sistema legacy USERS[] (deuda tecnica)
  const user = USERS[u];
  if (!user || user.pass !== password) {
    return { success: false, error: 'Usuario o contrasena incorrectos' };
  }

  const sessionData = {
    user: u,
    loginTime: Date.now(),
    expires: Date.now() + SESSION_TIMEOUT
  };
  localStorage.setItem('ftp_session', JSON.stringify(sessionData));
  sessionStorage.setItem('ftp_logged_in', 'true');
  currentUser = { ...user, username: u };
  startSessionTimer();

  return { success: true, user: currentUser, mode: 'legacy' };
}

// ─── Logout ───
export async function doLogout() {
  if (sessionTimer) clearTimeout(sessionTimer);

  // Cerrar sesion Supabase si existe
  try {
    await supabase.auth.signOut();
  } catch (_) { /* noop */ }

  // Limpiar legacy storage
  localStorage.removeItem('ftp_session');
  sessionStorage.removeItem('ftp_logged_in');
  currentUser = null;

  // Destruir charts
  if (typeof Chart !== 'undefined') {
    document.querySelectorAll('canvas').forEach(c => {
      const ch = Chart.getChart(c);
      if (ch) ch.destroy();
    });
  }

  window.location.href = 'login.html';
}

// ─── Timer de inactividad ───
function startSessionTimer() {
  if (sessionTimer) clearTimeout(sessionTimer);
  sessionTimer = setTimeout(() => doLogout(), SESSION_TIMEOUT);
}

export function resetSessionTimer() {
  // Si estamos en Supabase mode, refrescamos el JWT (el SDK auto-refresca)
  if (currentUser && currentUser._supabase) {
    startSessionTimer();
    return;
  }
  // Modo legacy
  const session = getSession();
  if (!session) return;
  session.expires = Date.now() + SESSION_TIMEOUT;
  localStorage.setItem('ftp_session', JSON.stringify(session));
  startSessionTimer();
}

// ─── Listeners de actividad (registro idempotente) ───
let _activityInitialized = false;
export function initActivityListeners() {
  if (_activityInitialized) return;  // evita doble registro
  _activityInitialized = true;
  const events = ['click', 'keydown', 'mousemove', 'touchstart', 'scroll'];
  let lastReset = Date.now();
  events.forEach(event => {
    document.addEventListener(event, () => {
      if (Date.now() - lastReset > 30000) {
        lastReset = Date.now();
        resetSessionTimer();
      }
    }, { passive: true });
  });
}

// ─── Guard: verificar sesion al cargar portal.html ───
// Esta version es ASINCRONA porque ahora consulta Supabase
export async function requireAuth() {
  // 1) Probar sesion Supabase (JWT en localStorage del SDK)
  try {
    const { data: { session: sbSession } } = await supabase.auth.getSession();
    if (sbSession) {
      currentUser = userFromSupabaseSession(sbSession);
      startSessionTimer();
      return true;
    }
  } catch (_) { /* noop */ }

  // 2) Fallback: sesion legacy en localStorage manual
  const session = getSession();
  if (session && USERS[session.user]) {
    currentUser = { ...USERS[session.user], username: session.user };
    startSessionTimer();
    return true;
  }

  // 3) No hay sesion - redirigir a login
  window.location.href = 'login.html';
  return false;
}

// ─── Restaurar sesion (sincrona: usa solo cache local) ───
export function restoreSession() {
  const session = getSession();
  if (session && USERS[session.user]) {
    currentUser = { ...USERS[session.user], username: session.user };
    return true;
  }
  return false;
}
