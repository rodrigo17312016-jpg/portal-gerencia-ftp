/* ════════════════════════════════════════════════════════
   PLANT CONTEXT (sub-apps) - obtener plantId activo
   ════════════════════════════════════════════════════════
   Patron de uso en sub-apps de registro:

     import { getActivePlantId } from '../_shared/plant-context.js';

     const record = {
       fecha: '2026-04-30',
       fruta: 'mango',
       consumo_kg: 1500,
       plantId: await getActivePlantId()  // opcional: si null usa DEFAULT (FTP-HUA)
     };
     await supabase.from('registro_produccion').insert(record);

   Fuentes (en orden de prioridad):
   1. URL param ?plant=FTP-PIU (ejemplo: maquila pasa link con sede ya elegida)
   2. localStorage 'ftp_sede_activa' (heredado del portal padre via mismo origen)
   3. null → la DB usa DEFAULT (FTP-HUA)

   Nota: la DB tiene DEFAULT '6d8707af-...' (UUID de FTP-HUA) en plantId.
   Si el INSERT no incluye plantId, Postgres lo asigna automaticamente.
   ════════════════════════════════════════════════════════ */

const STORAGE_KEY = 'ftp_sede_activa';

// UUIDs de Plant (para no depender de fetch del portal cuando la sub-app
// es standalone). Si cambian las sedes hay que actualizar este mapa.
const PLANT_UUID_BY_CODE = {
  'FTP-HUA': '6d8707af-3394-4018-8136-51bb8f6a52cb',
  'FTP-PIU': 'ad13a88f-8f1f-45b3-8afe-c36ae3cfdc81',
  'PRC-MAQ': '4d13f1ea-ac76-415f-9aea-16ab2f54ce4d'
};

const VALID_CODES = new Set(Object.keys(PLANT_UUID_BY_CODE));

/**
 * Devuelve el codigo de sede activa o null si no hay seleccion clara.
 */
export function getActiveSedeCodigo() {
  // 1. URL param
  try {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get('plant') || params.get('sede');
    if (fromUrl && VALID_CODES.has(fromUrl)) return fromUrl;
  } catch (_) {}

  // 2. localStorage del portal
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && VALID_CODES.has(stored)) return stored;
    // Si esta en CONSOLIDADO no hay sede unica para INSERT
    if (stored === 'CONSOLIDADO') return null;
  } catch (_) {}

  return null;
}

/**
 * Devuelve el UUID de Plant para INSERT, o null si no hay sede activa.
 * Si retorna null, NO incluyas plantId en el INSERT - la DB usa DEFAULT.
 */
export function getActivePlantId() {
  const codigo = getActiveSedeCodigo();
  return codigo ? PLANT_UUID_BY_CODE[codigo] : null;
}

/**
 * Helper: agrega plantId a un objeto de INSERT solo si hay sede activa.
 * Si no hay sede activa (o esta CONSOLIDADO), devuelve el objeto sin tocar
 * y la DB aplica el DEFAULT (FTP-HUA).
 */
export function withPlantId(record) {
  const id = getActivePlantId();
  if (id && record && typeof record === 'object') {
    return { ...record, plantId: id };
  }
  return record;
}

/**
 * Para sub-apps que quieren mostrar la sede actual al usuario antes de guardar.
 */
export function getActiveSedeNombre() {
  const codigo = getActiveSedeCodigo();
  if (!codigo) return 'FTP Huaura (default)';
  if (codigo === 'FTP-HUA') return 'FTP Huaura';
  if (codigo === 'FTP-PIU') return 'FTP Piura';
  if (codigo === 'PRC-MAQ') return 'PRC (Maquila)';
  return codigo;
}
