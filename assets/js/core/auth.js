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

const EMAIL_DOMAIN = '@frutos-tropicales.pe';
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

/**
 * Verifica si el usuario puede ejecutar una accion sobre un recurso.
 *
 * @param {'view'|'edit'|'delete'|'export'|'config'} action
 * @param {string} [resource] - Nombre del recurso (ej: 'registro_produccion').
 *        Si no se pasa, chequea solo si tiene la accion en general.
 * @returns {boolean}
 *
 * @example
 * hasAction('edit', 'registro_produccion')   // true si rol puede editar esa tabla
 * hasAction('delete')                        // true si rol puede borrar algo
 * hasAction('export')                        // true si rol puede exportar
 */
export function hasAction(action, resource) {
  const role = getCurrentRole();
  if (!role) return false;
  if (role === 'admin') return true;

  const permissions = getPermissions();
  if (!permissions[role]) return false;

  const actions = permissions[role].actions;
  if (!actions) return false;             // rol sin actions definidas
  if (actions === '*') return true;        // rol con todos los actions

  const allowed = actions[action];
  if (allowed === undefined || allowed === null) return false;
  if (allowed === '*') return true;
  if (!Array.isArray(allowed)) return false;
  if (!resource) return allowed.length > 0; // "puede hacer X en general"
  return allowed.includes(resource);
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

// ─── Login (Supabase + fallback resiliente) ───
export async function doLogin(username, password) {
  const u = username.toLowerCase().trim();

  // 1) Intento Supabase Auth (real, JWT firmado) con timeout 4s
  // Si tarda mas o falla por cualquier razon, caemos al legacy
  let supabaseOk = false;
  try {
    const loginPromise = supabase.auth.signInWithPassword({
      email: usernameToEmail(u),
      password
    });
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Supabase timeout')), 4000)
    );
    const { data, error } = await Promise.race([loginPromise, timeoutPromise]);

    if (!error && data && data.session) {
      currentUser = userFromSupabaseSession(data.session);
      sessionStorage.setItem('ftp_logged_in', 'true');
      startSessionTimer();
      console.info('[auth] Login OK via Supabase Auth');
      return { success: true, user: currentUser, mode: 'supabase' };
    }
    // Error explicito (bad credentials u otro): logueamos y caemos al fallback
    if (error) console.info('[auth] Supabase rechazo:', error.message, '- usando fallback');
    else supabaseOk = true; // No hay error pero no hay session, raro
  } catch (err) {
    // Network error, timeout, dominio invalido, cualquier cosa
    console.warn('[auth] Supabase no disponible:', err.message, '- usando fallback');
  }

  // 2) Fallback: sistema legacy USERS[]
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
  console.info('[auth] Login OK via fallback legacy');
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
// Async pero con timeout corto para no bloquear si Supabase no responde
export async function requireAuth() {
  // 1) Probar sesion Supabase (JWT en localStorage del SDK) con timeout 2s
  try {
    const sessionPromise = supabase.auth.getSession();
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Supabase getSession timeout')), 2000)
    );
    const { data } = await Promise.race([sessionPromise, timeoutPromise]);
    const sbSession = data?.session;
    if (sbSession) {
      currentUser = userFromSupabaseSession(sbSession);
      startSessionTimer();
      return true;
    }
  } catch (err) {
    console.warn('[auth] Supabase getSession fallo:', err.message, '- usando legacy');
  }

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

// ─── Auto-refresh de sesion Supabase ───
// Supabase SDK renueva JWT automaticamente antes de expirar,
// pero si el refresh falla (token revocado, red caida >1hr),
// hay que detectarlo y hacer logout limpio.
let _authSubscription = null;
export function initSessionAutoRefresh() {
  if (_authSubscription) return; // idempotente
  try {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'TOKEN_REFRESHED') {
        console.info('[auth] JWT refrescado automaticamente');
        if (session) currentUser = userFromSupabaseSession(session);
      } else if (event === 'SIGNED_OUT') {
        console.info('[auth] Sesion terminada (SIGNED_OUT)');
        doLogout();
      } else if (event === 'USER_UPDATED') {
        if (session) currentUser = userFromSupabaseSession(session);
      }
    });
    _authSubscription = data?.subscription;
  } catch (err) {
    console.warn('[auth] No se pudo inicializar auto-refresh:', err.message);
  }
}

// ─── Password recovery: enviar email con link de reset ───
export async function requestPasswordReset(username) {
  const u = (username || '').toLowerCase().trim();
  if (!u) return { success: false, error: 'Ingresa tu usuario' };

  const email = usernameToEmail(u);
  try {
    // URL de redireccion: puede ser absolute o relative
    const baseUrl = window.location.origin + window.location.pathname.replace(/[^/]+$/, '');
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: baseUrl + 'login.html?reset=1'
    });
    if (error) return { success: false, error: error.message };
    return { success: true, message: 'Revisa tu email (' + email + ') para el link de recuperacion.' };
  } catch (err) {
    return { success: false, error: 'Error de red: ' + err.message };
  }
}

// ─── Password update (desde flow de recovery) ───
export async function updatePassword(newPassword) {
  if (!newPassword || newPassword.length < 8) {
    return { success: false, error: 'La contrasena debe tener al menos 8 caracteres' };
  }
  try {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
