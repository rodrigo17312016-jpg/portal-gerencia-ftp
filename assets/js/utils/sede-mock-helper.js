/* ════════════════════════════════════════════════════════
   SEDE MOCK HELPER
   ════════════════════════════════════════════════════════
   Mientras Supabase no tenga columna `sede_id` (Fase 5+),
   simulamos data por planta multiplicando datos de FTP-HUA
   por un factor (definido en sedes.json).

   - getScaledNumber(n): escala un numero por factor de la sede activa
   - getScaledArray(arr, fields): escala campos numericos de un array
   - getConsolidadoMultiplier(): suma de factors de todas las sedes
   - filterMockData(data, sedeCodigo): filtra/escala segun sede

   IMPORTANTE: este helper se elimina cuando todas las tablas
   tengan sede_id real (ver Fase 6 del plan).
   ════════════════════════════════════════════════════════ */

import { getSedeActiva, isConsolidado } from '../core/sede-context.js';
import { getSedes } from '../config/sedes.js';

/**
 * Devuelve el factor de escala para la sede activa.
 * - Sede propia/maquila: scaleFactor del JSON (ej. 1.0, 0.72, 0.41)
 * - Consolidado: suma de todos los scaleFactor (~2.13)
 */
export async function getScaleFactor() {
  if (isConsolidado()) {
    const sedes = await getSedes();
    return sedes.reduce((sum, s) => sum + (s.scaleFactor || 1), 0);
  }
  const sede = getSedeActiva();
  return sede?.scaleFactor || 1;
}

/**
 * Escala un numero por el factor de la sede activa.
 */
export async function scaleNumber(n) {
  if (typeof n !== 'number' || !isFinite(n)) return n;
  const factor = await getScaleFactor();
  return n * factor;
}

/**
 * Escala campos numericos especificos de un array de objetos.
 * Devuelve copia, no muta el original.
 *
 * @example scaleArray(rows, ['consumo_kg', 'pt_aprox_kg'])
 */
export async function scaleArray(arr, fields) {
  if (!Array.isArray(arr) || !arr.length) return arr;
  const factor = await getScaleFactor();
  if (factor === 1) return arr.slice();

  return arr.map(row => {
    const out = { ...row };
    fields.forEach(f => {
      if (typeof out[f] === 'number' && isFinite(out[f])) {
        out[f] = +(out[f] * factor).toFixed(2);
      }
    });
    return out;
  });
}

/**
 * Devuelve metricas agregadas por sede (para dashboard comparativo).
 * Toma un array base y devuelve { 'FTP-HUA': [...], 'FTP-PIU': [...], 'PRC-MAQ': [...] }
 * con los valores numericos escalados por el factor de cada sede.
 */
export async function splitByAllSedes(arr, fields) {
  if (!Array.isArray(arr)) arr = [];
  const sedes = await getSedes();
  const result = {};

  sedes.forEach(sede => {
    const factor = sede.scaleFactor || 1;
    result[sede.codigo] = arr.map(row => {
      const out = { ...row };
      fields.forEach(f => {
        if (typeof out[f] === 'number' && isFinite(out[f])) {
          out[f] = +(out[f] * factor).toFixed(2);
        }
      });
      return out;
    });
  });

  return result;
}

/**
 * Calcula totales por sede para una metrica especifica.
 * Util para comparativos rapidos.
 *
 * @example totalsBySede(prodData, 'pt_aprox_kg')
 *  => [{ codigo: 'FTP-HUA', sede: 'FTP Huaura', total: 12500 }, ...]
 */
export async function totalsBySede(arr, field) {
  if (!Array.isArray(arr)) arr = [];
  const sedes = await getSedes();
  const baseTotal = arr.reduce((s, r) => s + (r[field] || 0), 0);

  return sedes.map(sede => ({
    codigo: sede.codigo,
    nombre: sede.nombre,
    nombreCorto: sede.nombreCorto,
    color: sede.color,
    icono: sede.icono,
    tipo: sede.tipo,
    total: +(baseTotal * (sede.scaleFactor || 1)).toFixed(2)
  }));
}

/**
 * Genera datos sinteticos para demostrar el comparativo
 * cuando NO hay data base (caso clean-slate).
 */
export async function generateSyntheticTotals(metric, baseValue) {
  const sedes = await getSedes();
  return sedes.map(sede => {
    const variation = 0.85 + Math.random() * 0.3; // 0.85x .. 1.15x
    return {
      codigo: sede.codigo,
      nombre: sede.nombre,
      nombreCorto: sede.nombreCorto,
      color: sede.color,
      icono: sede.icono,
      tipo: sede.tipo,
      metric,
      total: +(baseValue * (sede.scaleFactor || 1) * variation).toFixed(2)
    };
  });
}
