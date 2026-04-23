/* ════════════════════════════════════════════════════════
   RATE LIMIT - Anti brute-force client-side
   Frutos Tropicales Peru Export S.A.C.

   NOTA: es una DEFENSA EN CAPAS. Supabase Auth tiene rate limit
   server-side nativo, esto agrega friccion cliente para detener
   el ataque antes de llegar al servidor.

   Politica: 5 intentos fallidos -> lock 5 minutos por usuario.
   Se registra en sessionStorage (se resetea al cerrar browser).
   ════════════════════════════════════════════════════════ */

const MAX_ATTEMPTS = 5;
const LOCK_DURATION_MS = 5 * 60 * 1000; // 5 minutos
const STORAGE_KEY = 'ftp_login_attempts';

/**
 * @returns {Object<string,{count:number, firstAt:number, lockedUntil?:number}>}
 */
function loadState() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveState(state) {
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
}

/**
 * Verifica si un usuario esta locked-out actualmente.
 * @param {string} username
 * @returns {{locked: boolean, remainingMs: number, remainingSec: number, attemptsLeft: number}}
 */
export function checkLockout(username) {
  const u = (username || '').toLowerCase().trim();
  const state = loadState();
  const entry = state[u];
  const now = Date.now();

  if (!entry) return { locked: false, remainingMs: 0, remainingSec: 0, attemptsLeft: MAX_ATTEMPTS };

  // Limpiar si ya paso el lock
  if (entry.lockedUntil && entry.lockedUntil <= now) {
    delete state[u];
    saveState(state);
    return { locked: false, remainingMs: 0, remainingSec: 0, attemptsLeft: MAX_ATTEMPTS };
  }

  if (entry.lockedUntil) {
    const remainingMs = entry.lockedUntil - now;
    return {
      locked: true,
      remainingMs,
      remainingSec: Math.ceil(remainingMs / 1000),
      attemptsLeft: 0
    };
  }

  return {
    locked: false,
    remainingMs: 0,
    remainingSec: 0,
    attemptsLeft: Math.max(0, MAX_ATTEMPTS - entry.count)
  };
}

/**
 * Registra un intento fallido. Si supera el limite, activa el lock.
 * @param {string} username
 * @returns {{locked: boolean, attemptsLeft: number, lockedForSec: number}}
 */
export function recordFailedAttempt(username) {
  const u = (username || '').toLowerCase().trim();
  const state = loadState();
  const now = Date.now();
  const entry = state[u] || { count: 0, firstAt: now };

  entry.count += 1;

  if (entry.count >= MAX_ATTEMPTS) {
    entry.lockedUntil = now + LOCK_DURATION_MS;
  }

  state[u] = entry;
  saveState(state);

  return {
    locked: !!entry.lockedUntil,
    attemptsLeft: Math.max(0, MAX_ATTEMPTS - entry.count),
    lockedForSec: entry.lockedUntil ? Math.ceil(LOCK_DURATION_MS / 1000) : 0
  };
}

/**
 * Limpia el tracking de un usuario (cuando el login es exitoso).
 */
export function clearAttempts(username) {
  const u = (username || '').toLowerCase().trim();
  const state = loadState();
  if (state[u]) {
    delete state[u];
    saveState(state);
  }
}
