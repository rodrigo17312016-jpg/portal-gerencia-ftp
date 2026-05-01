/* ════════════════════════════════════════════════════════
   SEDES - Registry de plantas / maquilas
   ════════════════════════════════════════════════════════
   Fuente de verdad: tabla "Plant" en Supabase produccion.
   Fallback: config/sedes.json (offline / sin auth).
   Cachea en memoria; refresca al cambiar el SW.
   ════════════════════════════════════════════════════════ */

import { supabase } from './supabase.js';

let _cache = null;
let _loadingPromise = null;

// Mapping para uso interno: el codigo (FTP-HUA) ↔ id (UUID) de Plant
let _codigoToId = new Map();
let _idToCodigo = new Map();

function resolveSedesJsonUrl() {
  try {
    return new URL('../../../config/sedes.json', import.meta.url).href;
  } catch (_) {
    return 'config/sedes.json';
  }
}

// Mapea fila de Plant a estructura interna {codigo, nombre, nombreCorto, ...}
function plantToSede(p) {
  return {
    id: p.id,                           // UUID — para INSERTs (plantId)
    codigo: p.code,                     // FTP-HUA, FTP-PIU, PRC-MAQ
    nombre: p.name,
    nombreCorto: shortName(p.name),
    tipo: p.tipo || 'propia',
    color: p.color || '#0e7c3a',
    icono: p.icono || '🏭',
    activa: p.activa !== false,
    principal: !!p.principal,
    scaleFactor: parseFloat(p.scale_factor) || 1.0,
    ubicacion: p.ubicacion || p.address || '',
    empresa: p.empresa || ''
  };
}

function shortName(name) {
  if (!name) return '—';
  // "FTP Huaura" → "Huaura"; "PRC (Maquila)" → "PRC"
  const cleaned = name.replace(/^FTP\s+/i, '').replace(/\s*\(.*?\)\s*$/, '').trim();
  return cleaned || name;
}

async function loadFromSupabase() {
  const { data, error } = await supabase
    .from('Plant')
    .select('id, code, name, address, tipo, color, icono, activa, principal, scale_factor, ubicacion, empresa')
    .eq('activa', true)
    .order('principal', { ascending: false })
    .order('code', { ascending: true });

  if (error) throw error;
  if (!Array.isArray(data) || !data.length) throw new Error('Plant table vacia');

  const sedes = data.map(plantToSede);
  // Reset y rellena maps
  _codigoToId = new Map(sedes.map(s => [s.codigo, s.id]));
  _idToCodigo = new Map(sedes.map(s => [s.id, s.codigo]));
  return sedes;
}

async function loadFromJsonFallback() {
  const r = await fetch(resolveSedesJsonUrl());
  if (!r.ok) throw new Error('No se pudo cargar config/sedes.json (status ' + r.status + ')');
  const json = await r.json();
  // El JSON usa scaleFactor camelCase y no tiene id (UUID) - lo dejamos null
  return (json.sedes || []).filter(s => s.activa !== false).map(s => ({
    id: null,
    codigo: s.codigo,
    nombre: s.nombre,
    nombreCorto: s.nombreCorto,
    tipo: s.tipo || 'propia',
    color: s.color || '#0e7c3a',
    icono: s.icono || '🏭',
    activa: s.activa !== false,
    principal: !!s.principal,
    scaleFactor: s.scaleFactor || 1.0,
    ubicacion: s.ubicacion || '',
    empresa: s.empresa || ''
  }));
}

async function loadSedes() {
  if (_cache) return _cache;
  if (_loadingPromise) return _loadingPromise;

  _loadingPromise = (async () => {
    let sedes;
    try {
      sedes = await loadFromSupabase();
    } catch (err) {
      console.warn('[sedes] Supabase fallo, usando JSON fallback:', err.message);
      try {
        sedes = await loadFromJsonFallback();
      } catch (err2) {
        console.error('[sedes] JSON fallback tambien fallo:', err2.message);
        sedes = [{
          id: null, codigo: 'FTP-HUA', nombre: 'FTP Huaura', nombreCorto: 'Huaura',
          tipo: 'propia', color: '#0e7c3a', icono: '🏭', activa: true, principal: true,
          scaleFactor: 1.0, ubicacion: 'Huaura, Lima', empresa: 'Frutos Tropicales Peru Export S.A.C.'
        }];
      }
    }

    const data = {
      version: 2,
      default: sedes.find(s => s.principal)?.codigo || sedes[0]?.codigo || 'FTP-HUA',
      sedes,
      consolidado: {
        id: null, codigo: 'CONSOLIDADO', nombre: 'Consolidado (todas las sedes)',
        nombreCorto: 'Consolidado', tipo: 'agregado', color: '#6d28d9', icono: '⚡'
      }
    };
    _cache = data;
    return data;
  })();

  return _loadingPromise;
}

// Helpers para conversion codigo ↔ uuid (necesario para INSERT con plantId)
export async function getPlantIdByCodigo(codigo) {
  await loadSedes();
  return _codigoToId.get(codigo) || null;
}

export async function getCodigoByPlantId(id) {
  await loadSedes();
  return _idToCodigo.get(id) || null;
}

// Forzar recarga (util tras cambios admin de sedes)
export function invalidateSedesCache() {
  _cache = null;
  _loadingPromise = null;
  _codigoToId.clear();
  _idToCodigo.clear();
}

export async function getSedes() {
  const data = await loadSedes();
  return data.sedes.filter(s => s.activa);
}

export async function getAllSedesIncludingConsolidado() {
  const data = await loadSedes();
  return [...data.sedes.filter(s => s.activa), data.consolidado];
}

export async function getSedeByCodigo(codigo) {
  const data = await loadSedes();
  if (codigo === 'CONSOLIDADO') return data.consolidado;
  return data.sedes.find(s => s.codigo === codigo) || null;
}

export async function getDefaultSede() {
  const data = await loadSedes();
  return data.default || 'FTP-HUA';
}

export async function getConsolidado() {
  const data = await loadSedes();
  return data.consolidado;
}
