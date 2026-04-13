/* ════════════════════════════════════════════════════════
   SUPABASE - Cliente Unificado
   ════════════════════════════════════════════════════════ */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SB_URL = 'https://obnvrfvcujsrmifvlqni.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ibnZyZnZjdWpzcm1pZnZscW5pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1MDY3OTUsImV4cCI6MjA4OTA4Mjc5NX0.A7BilSrDzqe2rqz1Kh8fg5t-GVNxrLGYJK4IaMlVtBs';

export const supabase = createClient(SB_URL, SB_KEY);

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

// Helper legacy para paneles que aun usan REST directo
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

// Helper para insertar datos
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

// Helper para actualizar datos
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

export { SB_URL, SB_KEY };
