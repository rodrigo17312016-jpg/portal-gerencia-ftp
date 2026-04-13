/* ════════════════════════════════════════════════════════
   AUTH - Sistema de Autenticacion Unificado
   ════════════════════════════════════════════════════════ */

import { USERS } from '../config/users.js';
import { SESSION_TIMEOUT } from '../config/constants.js';

let sessionTimer = null;
let currentUser = null;

// Obtener sesion actual
export function getSession() {
  try {
    const data = JSON.parse(localStorage.getItem('ftp_session') || 'null');
    if (data && data.user && data.expires > Date.now() && USERS[data.user]) {
      return data;
    }
  } catch {}
  return null;
}

// Obtener usuario actual
export function getCurrentUser() {
  if (currentUser) return currentUser;
  const session = getSession();
  if (session) {
    currentUser = { ...USERS[session.user], username: session.user };
    return currentUser;
  }
  return null;
}

// Obtener rol actual
export function getCurrentRole() {
  const user = getCurrentUser();
  return user ? user.role : null;
}

// Verificar si tiene acceso a un panel
export function hasAccess(panelId) {
  const role = getCurrentRole();
  if (!role) return false;
  if (role === 'admin') return true;

  // Cargar permisos de roles.json (cacheado)
  const permissions = getPermissions();
  if (!permissions[role]) return false;
  if (permissions[role].panels === '*') return true;
  return permissions[role].panels.includes(panelId);
}

// Cache de permisos
let _permissions = null;
function getPermissions() {
  if (_permissions) return _permissions;
  // Se carga de forma sincrona desde la variable global (inyectada en portal.html)
  _permissions = window.__ROLES || {};
  return _permissions;
}

export function setPermissions(roles) {
  _permissions = roles;
  window.__ROLES = roles;
}

// Login
export function doLogin(username, password) {
  const u = username.toLowerCase().trim();
  const user = USERS[u];

  if (!user || user.pass !== password) {
    return { success: false, error: 'Usuario o contrasena incorrectos' };
  }

  // Guardar sesion
  const sessionData = {
    user: u,
    loginTime: Date.now(),
    expires: Date.now() + SESSION_TIMEOUT
  };

  localStorage.setItem('ftp_session', JSON.stringify(sessionData));
  sessionStorage.setItem('ftp_logged_in', 'true');
  currentUser = { ...user, username: u };

  // Iniciar timer de inactividad
  startSessionTimer();

  return { success: true, user: currentUser };
}

// Logout
export function doLogout() {
  if (sessionTimer) clearTimeout(sessionTimer);
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

// Timer de inactividad
function startSessionTimer() {
  if (sessionTimer) clearTimeout(sessionTimer);
  sessionTimer = setTimeout(() => doLogout(), SESSION_TIMEOUT);
}

export function resetSessionTimer() {
  const session = getSession();
  if (!session) return;

  // Renovar expiracion
  session.expires = Date.now() + SESSION_TIMEOUT;
  localStorage.setItem('ftp_session', JSON.stringify(session));
  startSessionTimer();
}

// Inicializar listeners de actividad
export function initActivityListeners() {
  const events = ['click', 'keydown', 'mousemove', 'touchstart', 'scroll'];
  let lastReset = Date.now();

  events.forEach(event => {
    document.addEventListener(event, () => {
      // Throttle: solo resetear cada 30 segundos
      if (Date.now() - lastReset > 30000) {
        lastReset = Date.now();
        resetSessionTimer();
      }
    }, { passive: true });
  });
}

// Guard: verificar sesion en portal.html
export function requireAuth() {
  const session = getSession();
  if (!session) {
    window.location.href = 'login.html';
    return false;
  }
  currentUser = { ...USERS[session.user], username: session.user };
  startSessionTimer();
  return true;
}

// Restaurar sesion (para auto-login en refresh)
export function restoreSession() {
  const session = getSession();
  if (session) {
    currentUser = { ...USERS[session.user], username: session.user };
    return true;
  }
  return false;
}
