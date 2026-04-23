// ============================================================
// FRUTOS TROPICALES PERU S.A.C.
// Configuracion Supabase - Compartida por todas las apps
// ============================================================

const SUPABASE_URL = 'https://rslzosmeteyzxmgfkppe.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzbHpvc21ldGV5enhtZ2ZrcHBlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0OTc5NTgsImV4cCI6MjA5MDA3Mzk1OH0.XwitsLRWq10UsYshg_m2ViZh4BnV48zkJCK-JsRa9cs';

// Inicializar cliente Supabase - con verificacion de carga del CDN y reintentos
let supabaseClient;
function _initSupabase() {
  if (supabaseClient) return true;
  try {
    if (window.supabase && typeof window.supabase.createClient === 'function') {
      supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
      return true;
    }
  } catch(e) {
    console.error('ERROR al inicializar Supabase:', e);
  }
  return false;
}
if (!_initSupabase()) {
  setTimeout(function() { _initSupabase(); }, 500);
  setTimeout(function() { _initSupabase(); }, 1500);
}

// Helper: Obtener fecha de hoy en formato YYYY-MM-DD (hora local Peru)
function getLocalToday() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

// Helper: Guardar tambien en localStorage como backup
function saveToLocalStorage(key, records) {
  try { localStorage.setItem(key, JSON.stringify(records)); } catch(e) {}
}

// Helper: Toast notification para Supabase (styled)
function showSupabaseToast(msg, color) {
  const existing = document.getElementById('supaToast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.id = 'supaToast';
  toast.textContent = msg;
  toast.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);padding:12px 28px;border-radius:12px;color:#fff;font-weight:700;font-size:14px;z-index:99999;box-shadow:0 8px 32px rgba(0,0,0,0.3);background:'+(color||'#16a34a')+';transition:opacity 0.3s';
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3000);
}

// Helper: Verificar conexion a Supabase y actualizar indicador visual
async function checkSupabaseConnection() {
  const indicator = document.getElementById('supabaseStatus');
  if (!indicator) return false;
  if (!supabaseClient) _initSupabase();
  if (!supabaseClient) {
    indicator.style.background = '#ef4444';
    indicator.title = 'Supabase: NO conectado';
    return false;
  }
  try {
    const { error } = await supabaseClient.from('registro_produccion').select('fecha').limit(1);
    if (error) {
      indicator.style.background = '#ef4444';
      indicator.title = 'Supabase: Error - ' + error.message;
      return false;
    }
    indicator.style.background = '#16a34a';
    indicator.title = 'Supabase: Conectado';
    indicator.style.boxShadow = '0 0 8px rgba(22,163,74,0.5)';
    return true;
  } catch(e) {
    indicator.style.background = '#ef4444';
    indicator.title = 'Supabase: Sin conexion';
    return false;
  }
}

// Auto-check con reintentos progresivos al cargar la pagina
(function autoCheckConnection() {
  var delays = [1500, 4000, 8000, 15000];
  function tryCheck(i) {
    if (i >= delays.length) return;
    setTimeout(async function() {
      var ok = await checkSupabaseConnection();
      if (!ok) tryCheck(i + 1);
    }, delays[i]);
  }
  tryCheck(0);
})();
