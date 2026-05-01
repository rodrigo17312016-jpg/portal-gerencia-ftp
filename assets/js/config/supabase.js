/* ════════════════════════════════════════════════════════
   SUPABASE - Clientes para ambos proyectos
   Proyecto 1: Calidad (temperaturas, consumos)
   Proyecto 2: Produccion (registros, costos, tuneles, empaque)
   ════════════════════════════════════════════════════════ */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// Proyecto 1: Frutos Tropicales (Calidad)
const SB_URL = 'https://obnvrfvcujsrmifvlqni.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ibnZyZnZjdWpzcm1pZnZscW5pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1MDY3OTUsImV4cCI6MjA4OTA4Mjc5NX0.A7BilSrDzqe2rqz1Kh8fg5t-GVNxrLGYJK4IaMlVtBs';

// Proyecto 2: Frutos Tropicales Produccion
const SB_PROD_URL = 'https://rslzosmeteyzxmgfkppe.supabase.co';
const SB_PROD_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzbHpvc21ldGV5enhtZ2ZrcHBlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0OTc5NTgsImV4cCI6MjA5MDA3Mzk1OH0.XwitsLRWq10UsYshg_m2ViZh4BnV48zkJCK-JsRa9cs';

// Cliente Calidad (temperaturas, consumos_insumos) - RAW (sin auto-filter)
const _calidadRaw = createClient(SB_URL, SB_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
    storageKey: 'sb-obnvrfvcujsrmifvlqni-anon'
  }
});

// Cliente Produccion (principal - lleva el JWT de login) - RAW
const _supabaseRaw = createClient(SB_PROD_URL, SB_PROD_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'sb-rslzosmeteyzxmgfkppe-auth-token'
  }
});

// ════════════════════════════════════════════════════════
// AUTO-FILTRO POR SEDE ACTIVA (Multi-tenant - Fase 7)
// ════════════════════════════════════════════════════════
// Intercepta supabase.from(table).select(...) para tablas con plantId
// (Prod) o sede_codigo (Calidad) y agrega .eq() automaticamente con
// la sede activa del usuario.
//
// - Si la sede activa es CONSOLIDADO o no esta inicializada, NO filtra
// - Solo afecta SELECT (INSERT/UPDATE/DELETE pasan al RAW)
// - Los modulos que necesitan vista cross-sede usan supabaseRaw

const PROD_TABLES_PLANT_ID = new Set([
  'registro_produccion',
  'registro_personal',
  'registro_tuneles',
  'registro_empaque_congelado',
  'config_costos'
]);

const CALIDAD_TABLES_SEDE_CODIGO = new Set([
  'registros_temperatura',
  'consumos_insumos'
]);

function getActivePlantUuid() {
  if (typeof window === 'undefined') return null;
  const v = window.__ftpActivePlantId;
  return (v && v !== 'CONSOLIDADO') ? v : null;
}

function getActiveSedeCodigo() {
  if (typeof window === 'undefined') return null;
  const v = window.__ftpActiveSedeCodigo;
  return (v && v !== 'CONSOLIDADO') ? v : null;
}

function makeFilteredClient(rawClient, tablesSet, getFilterValue, columnName) {
  const handler = {
    get(target, prop, receiver) {
      if (prop !== 'from') return Reflect.get(target, prop, receiver);
      return function(table) {
        const builder = target.from(table);
        if (!tablesSet.has(table)) return builder;

        // Wrappear .select() para anexar el filtro
        const originalSelect = builder.select.bind(builder);
        builder.select = function(...args) {
          const query = originalSelect(...args);
          const val = getFilterValue();
          if (val == null) return query;
          // Solo agregamos si la query no se referenciara explicitamente
          // (el dev puede saltarse esto usando supabaseRaw)
          return query.eq(columnName, val);
        };
        return builder;
      };
    }
  };
  return new Proxy(rawClient, handler);
}

export const supabase = makeFilteredClient(_supabaseRaw, PROD_TABLES_PLANT_ID, getActivePlantUuid, 'plantId');
export const supabaseCalidad = makeFilteredClient(_calidadRaw, CALIDAD_TABLES_SEDE_CODIGO, getActiveSedeCodigo, 'sede_codigo');

// Para casos especiales (comparativo cross-sede, admin sedes) usar RAW:
export const supabaseRaw = _supabaseRaw;
export const supabaseCalidadRaw = _calidadRaw;

// Estado de conexion
export let isConnected = false;

export async function checkConnection() {
  try {
    const { error } = await supabase.from('registro_produccion').select('id', { count: 'exact', head: true });
    isConnected = !error;
  } catch {
    isConnected = false;
  }
  return isConnected;
}

// Fetch para tablas de Calidad (proyecto 1)
export async function fetchSupabase(query) {
  try {
    const res = await fetch(`${SB_URL}/rest/v1/${query}`, {
      headers: {
        'apikey': SB_KEY,
        'Authorization': `Bearer ${SB_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    return res.ok ? await res.json() : [];
  } catch {
    return [];
  }
}

// Helper para insertar datos (produccion)
export async function insertSupabase(table, data) {
  try {
    const { data: result, error } = await supabase.from(table).insert(data).select();
    if (error) throw error;
    return result;
  } catch (err) {
    console.error(`Error insertando en ${table}:`, err);
    return null;
  }
}

// Helper para actualizar datos (produccion)
export async function updateSupabase(table, id, data) {
  try {
    const { data: result, error } = await supabase.from(table).update(data).eq('id', id).select();
    if (error) throw error;
    return result;
  } catch (err) {
    console.error(`Error actualizando en ${table}:`, err);
    return null;
  }
}

export { SB_URL, SB_KEY, SB_PROD_URL, SB_PROD_KEY };
