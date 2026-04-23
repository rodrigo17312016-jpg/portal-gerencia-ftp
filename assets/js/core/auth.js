/* ════════════════════════════════════════════════════════
   AUTH - Supabase Auth exclusivo (post Fase 9)

   - doLogin: supabase.auth.signInWithPassword con email
     sintetico {username}@frutos-tropicales.pe
   - JWT HS256 firmado (no manipulable)
   - Role siempre leido de app_metadata (no user_metadata)
   - USERS[] solo se usa para display info (nombre, iniciales)
     cuando el JWT solo trae email. NO es fuente de autoridad.
   - Fallback legacy ELIMINADO (hallazgo H4 auditoria externa).
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
// Post-Fase 9: role SIEMPRE se lee de app_metadata (no editable por usuario).
// user_metadata solo para display info no-privilegiada (name, initials).
function userFromSupabaseSession(sbSession) {
  if (!sbSession || !sbSession.user) return null;
  const userMeta = sbSession.user.user_metadata || {};     // editable por usuario (DISPLAY ONLY)
  const appMeta = sbSession.user.app_metadata || {};       // solo service_role (AUTORIDAD)
  const username = appMeta.username || userMeta.username || emailToUsername(sbSession.user.email);
  const uiDefaults = USERS[username] || {};                // solo nombres/iniciales/labels
  return {
    username,
    name: userMeta.name || uiDefaults.name || username,
    // role SIEMPRE desde app_metadata (no manipulable). Fallback UI-only si no existe.
    role: appMeta.role || uiDefaults.role || null,
    roleLabel: uiDefaults.roleLabel || appMeta.role || '',
    initials: userMeta.initials || uiDefaults.initials || username.slice(0, 2).toUpperCase(),
    _supabase: true
  };
}

// ─── Sesion ───
// Post-Fase 9: solo se usa el currentUser en memoria (cargado desde JWT supabase).
// No hay fallback a ftp_session en localStorage (se elimina en anti-flash).
export function getSession() {
  if (currentUser && currentUser._supabase) {
    return { user: currentUser.username, expires: Date.now() + SESSION_TIMEOUT };
  }
  return null;
}

export function getCurrentUser() {
  return currentUser || null;
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

// ─── Login (Supabase Auth exclusivo) ───
// Post-Fase 9: eliminado el fallback legacy. Si Supabase no responde,
// el login falla con error claro en vez de aceptar credenciales hardcoded.
export async function doLogin(username, password) {
  const u = username.toLowerCase().trim();

  try {
    const loginPromise = supabase.auth.signInWithPassword({
      email: usernameToEmail(u),
      password
    });
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Supabase timeout - reintentar en unos segundos')), 6000)
    );
    const { data, error } = await Promise.race([loginPromise, timeoutPromise]);

    if (error) {
      // Bad credentials o email no confirmado
      console.info('[auth] Login fallido:', error.message);
      return { success: false, error: 'Usuario o contrasena incorrectos' };
    }

    if (!data || !data.session) {
      return { success: false, error: 'No se pudo establecer la sesion' };
    }

    currentUser = userFromSupabaseSession(data.session);
    sessionStorage.setItem('ftp_logged_in', 'true');
    startSessionTimer();
    console.info('[auth] Login OK via Supabase Auth');
    return { success: true, user: currentUser, mode: 'supabase' };
  } catch (err) {
    // Network error, timeout, etc.
    console.error('[auth] Error de red:', err.message);
    return { success: false, error: 'Error de conexion: ' + err.message };
  }
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
  // El SDK de Supabase auto-refresca el JWT.
  // Aqui solo reseteamos el timer de inactividad local.
  if (currentUser) startSessionTimer();
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
// Post-Fase 9: solo Supabase Auth. Sin fallback legacy.
export async function requireAuth() {
  try {
    const sessionPromise = supabase.auth.getSession();
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Supabase getSession timeout')), 3000)
    );
    const { data } = await Promise.race([sessionPromise, timeoutPromise]);
    const sbSession = data?.session;
    if (sbSession) {
      currentUser = userFromSupabaseSession(sbSession);
      startSessionTimer();
      return true;
    }
  } catch (err) {
    console.warn('[auth] Supabase getSession fallo:', err.message);
    // NO fallback a legacy (requerimiento Fase 9 hallazgo H4)
  }

  // Limpiar sesion legacy residual si existe (puede causar loops si anti-flash la detecta)
  try { localStorage.removeItem('ftp_session'); } catch {}

  // No hay sesion - redirigir a login
  window.location.href = 'login.html';
  return false;
}

// ─── Restaurar sesion (sincrona: usa solo estado en memoria) ───
// Post-Fase 9: la restauracion real se hace via requireAuth() async,
// que consulta supabase.auth.getSession(). Este helper solo confirma
// si ya hay un currentUser en memoria (util para guards rapidos).
export function restoreSession() {
  return currentUser !== null;
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
