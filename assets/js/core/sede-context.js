/* ════════════════════════════════════════════════════════
   SEDE CONTEXT - Estado global de la sede activa
   ════════════════════════════════════════════════════════
   Maneja qué planta/maquila está viendo el usuario.
   - Persiste en localStorage (clave 'ftp_sede_activa')
   - Emite evento 'sede-changed' cuando cambia
   - Cualquier modulo se suscribe via onSedeChange(cb)
   - El consolidado es un caso especial (codigo: 'CONSOLIDADO')
   ════════════════════════════════════════════════════════ */

import { getDefaultSede, getSedeByCodigo, getSedes, getPlantIdByCodigo } from '../config/sedes.js';

const STORAGE_KEY = 'ftp_sede_activa';
const EVENT_NAME = 'sede-changed';

let _currentCodigo = null;
let _currentSede = null;
let _initialized = false;

// EventTarget interno para emitir eventos sin contaminar window
const _bus = new EventTarget();

// ── Init ──
export async function initSedeContext() {
  if (_initialized) return _currentSede;

  // 1. Leer de localStorage
  let codigo = null;
  try {
    codigo = localStorage.getItem(STORAGE_KEY);
  } catch (_) { /* SSR / privacy mode */ }

  // 2. Validar que la sede exista (puede haberse desactivado)
  if (codigo) {
    const found = await getSedeByCodigo(codigo);
    if (!found) codigo = null;
  }

  // 3. Fallback a sede default
  if (!codigo) {
    codigo = await getDefaultSede();
  }

  _currentCodigo = codigo;
  _currentSede = await getSedeByCodigo(codigo);
  _initialized = true;

  return _currentSede;
}

// ── Getters ──
export function getSedeActiva() {
  return _currentSede;
}

export function getSedeCodigoActiva() {
  return _currentCodigo;
}

export function isConsolidado() {
  return _currentCodigo === 'CONSOLIDADO';
}

// ── Setter ──
export async function setSedeActiva(codigo) {
  if (!codigo || codigo === _currentCodigo) return false;

  const sede = await getSedeByCodigo(codigo);
  if (!sede) {
    console.warn('[sede-context] Codigo de sede invalido:', codigo);
    return false;
  }

  const previo = _currentCodigo;
  _currentCodigo = codigo;
  _currentSede = sede;

  // Persistir
  try {
    localStorage.setItem(STORAGE_KEY, codigo);
  } catch (_) { /* noop */ }

  // Emitir evento
  _bus.dispatchEvent(new CustomEvent(EVENT_NAME, {
    detail: { sede, codigo, previo }
  }));

  return true;
}

// ── Suscripción ──
export function onSedeChange(callback) {
  if (typeof callback !== 'function') return () => {};
  const handler = (e) => callback(e.detail);
  _bus.addEventListener(EVENT_NAME, handler);
  // Retorna funcion para des-suscribirse (cleanup)
  return () => _bus.removeEventListener(EVENT_NAME, handler);
}

// ── Util: aplicar filtro a query Supabase (Calidad usa sede_codigo TEXT) ──
// Si la sede es CONSOLIDADO devuelve query sin filtro.
// Si es una sede especifica, agrega .eq('sede_codigo', codigo).
export function applySedeFilter(query, columna = 'sede_codigo') {
  if (!query) return query;
  if (isConsolidado()) return query;
  if (typeof query.eq === 'function') {
    return query.eq(columna, _currentCodigo);
  }
  return query;
}

// ── Util: aplicar filtro a query Supabase (Produccion usa plantId UUID) ──
// Necesita resolver el UUID a partir del codigo de la sede activa.
export async function applyPlantFilter(query, columna = 'plantId') {
  if (!query) return query;
  if (isConsolidado()) return query;
  const plantId = await getPlantIdByCodigo(_currentCodigo);
  if (!plantId) {
    console.warn('[sede-context] No se encontro plantId para codigo', _currentCodigo);
    return query; // sin filtro - mejor mostrar todo que romper
  }
  if (typeof query.eq === 'function') {
    return query.eq(columna, plantId);
  }
  return query;
}

// ── Util: obtener plantId UUID de la sede activa (para INSERT/UPDATE) ──
export async function getPlantIdActivo() {
  if (isConsolidado()) return null; // no se puede insertar en consolidado
  return await getPlantIdByCodigo(_currentCodigo);
}

// ── Util: obtener lista de sedes para iterar (admin/consolidado) ──
export async function getSedesParaIterar() {
  return await getSedes();
}
