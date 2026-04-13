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

// Cliente Calidad (temperaturas, consumos_insumos)
export const supabaseCalidad = createClient(SB_URL, SB_KEY);

// Cliente Produccion (registro_produccion, registro_personal, config_costos, registro_tuneles, registro_empaque_congelado)
export const supabase = createClient(SB_PROD_URL, SB_PROD_KEY);

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
