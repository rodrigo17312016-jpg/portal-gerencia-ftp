// Supabase Configuration - Proyecto Produccion
const SUPABASE_URL = 'https://rslzosmeteyzxmgfkppe.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzbHpvc21ldGV5enhtZ2ZrcHBlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0OTc5NTgsImV4cCI6MjA5MDA3Mzk1OH0.XwitsLRWq10UsYshg_m2ViZh4BnV48zkJCK-JsRa9cs';
const supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

// Connection check function used by all apps
async function checkSupabaseConnection() {
  const dot = document.querySelector('.supabase-status-dot, .status-indicator, [id*="supabase"], [class*="supabase"]') || document.querySelector('.dot-status');
  const label = document.querySelector('.supabase-status-label, .sync-label, [id*="syncLabel"]');

  try {
    if (!supabaseClient) {
      if (dot) dot.style.background = '#ef4444';
      if (label) label.textContent = 'Sin conexion';
      return false;
    }
    const { error } = await supabaseClient.from('registro_produccion').select('id', { count: 'exact', head: true });
    if (error) throw error;
    if (dot) dot.style.background = '#22c55e';
    if (label) label.textContent = 'Conectado';
    return true;
  } catch (e) {
    if (dot) dot.style.background = '#ef4444';
    if (label) label.textContent = 'Error conexion';
    console.warn('Supabase connection check failed:', e.message);
    return false;
  }
}
