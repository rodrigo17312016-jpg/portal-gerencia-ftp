/* ============================================================
   Supabase client wrapper.

   La PWA arranca con config "default" hardcodeada (URL + anon key
   pública del proyecto FTP). El operario solo elige su nombre.

   La anon key es PÚBLICA por diseño (RLS la protege), igual que en
   el dashboard legacy dashboards/temperaturas.html linea 1440. NO es
   un secreto, NO viola la regla feedback_no_hardcoded_secrets que
   aplica a credenciales privadas (postgres password, service_role).
   ============================================================ */

(function () {
  'use strict';

  const STORAGE_KEY = 'temperaturas_pwa.config_v1';

  // Config por defecto — la PWA arranca lista para usar
  const DEFAULT_CONFIG = {
    url: 'https://obnvrfvcujsrmifvlqni.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ibnZyZnZjdWpzcm1pZnZscW5pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1MDY3OTUsImV4cCI6MjA4OTA4Mjc5NX0.A7BilSrDzqe2rqz1Kh8fg5t-GVNxrLGYJK4IaMlVtBs',
    sedeCodigo: 'FTP-HUA',
    operario: ''
  };

  // Lista oficial de inspectores de calidad (igual que dashboard legacy)
  const INSPECTORES = [
    'LUIS APONTE',
    'MAYDA APONTE',
    'SHEYLA CAMONES',
    'JOHNNY PAJUELO',
    'BLANCA MALVACEDA',
    'CHRISTY JIMENEZ',
    'CORAYMA CHANGANA'
  ];

  const state = {
    client: null,
    config: null
  };

  function loadConfig() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        // Sin config guardada → usar defaults (sin operario)
        return { ...DEFAULT_CONFIG };
      }
      const parsed = JSON.parse(raw);
      // Mergear con defaults para casos donde solo se guardó operario
      return {
        url: parsed.url || DEFAULT_CONFIG.url,
        anonKey: parsed.anonKey || DEFAULT_CONFIG.anonKey,
        sedeCodigo: parsed.sedeCodigo || DEFAULT_CONFIG.sedeCodigo,
        operario: parsed.operario || ''
      };
    } catch (e) {
      console.error('[supabase-client] loadConfig failed', e);
      return { ...DEFAULT_CONFIG };
    }
  }

  function saveConfig(cfg) {
    if (!cfg || !cfg.url || !cfg.anonKey) {
      throw new Error('Config inválida: faltan url o anonKey');
    }
    // Validación básica del formato (acepta letras, números y guiones)
    if (!/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)\/?$/i.test(cfg.url)) {
      throw new Error('URL Supabase inválida (debe ser https://xxx.supabase.co)');
    }
    if (cfg.anonKey.length < 60) {
      throw new Error('anonKey parece inválida (muy corta)');
    }
    const clean = {
      url: cfg.url.replace(/\/$/, ''),
      anonKey: cfg.anonKey,
      sedeCodigo: cfg.sedeCodigo || 'FTP-HUA',
      operario: cfg.operario || ''
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
    state.config = clean;
    state.client = null; // forzar recreación con nueva config
    return clean;
  }

  function getConfig() {
    if (!state.config) state.config = loadConfig();
    return state.config;
  }

  function isConfigured() {
    const c = getConfig();
    return !!(c && c.url && c.anonKey);
  }

  /** El inspector está elegido (config básica completa para arrancar) */
  function isOperarioSet() {
    const c = getConfig();
    return !!(c && c.operario && c.operario.trim());
  }

  /** Lista oficial de inspectores */
  function getInspectores() {
    return INSPECTORES.slice();
  }

  function getClient() {
    if (state.client) return state.client;
    const cfg = getConfig();
    if (!cfg) return null;
    if (typeof window.supabase === 'undefined' || !window.supabase.createClient) {
      console.error('[supabase-client] supabase-js no cargó');
      return null;
    }
    state.client = window.supabase.createClient(cfg.url, cfg.anonKey, {
      auth: { persistSession: false },        // operación sin login (anon)
      global: { fetch: (...args) => fetch(...args) }
    });
    return state.client;
  }

  function clearConfig() {
    localStorage.removeItem(STORAGE_KEY);
    state.config = null;
    state.client = null;
  }

  function updateOperario(nombre) {
    const cfg = getConfig();
    if (!cfg) return;
    cfg.operario = (nombre || '').trim();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
    state.config = cfg;
  }

  function updateSede(codigo) {
    const cfg = getConfig();
    if (!cfg) return;
    cfg.sedeCodigo = (codigo || 'FTP-HUA').trim();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
    state.config = cfg;
  }

  // ============ HELPERS DE NEGOCIO ============

  /** Obtener turno actual según hora local Perú (robusto a TZ del cliente) */
  function getTurnoActual(date = new Date()) {
    const fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'America/Lima', hour: '2-digit', hour12: false
    });
    const h = parseInt(fmt.format(date), 10);
    return (h >= 6 && h <= 18) ? 'TURNO DIA (06:00-17:00)' : 'TURNO NOCHE (18:00-05:00)';
  }

  /** Calcular estado (OK / ALERTA / CRITICO) según rangos del área */
  function calcEstado(area, temp) {
    if (!area || temp === null || temp === undefined || isNaN(temp)) return 'OK';
    // REEFERs y TEMPERATURA DE PRODUCTO(MP) sin alertas (legacy behavior)
    if (area.codigo && (area.codigo.startsWith('REEFER') || area.codigo === 'TEMPERATURA DE PRODUCTO(MP)')) {
      return 'OK';
    }
    const limite = Number(area.limite_max);
    const critico = Number(area.critico_max);
    // Tanto para refrigeración (limite positivo) como congelado (negativo),
    // "superar" = subir por encima del límite/crítico.
    if (temp > critico) return 'CRITICO';
    if (temp > limite) return 'ALERTA';
    return 'OK';
  }

  /**
   * Llama al Edge Function 'detect-temperatura' (Gemini Vision AI) para
   * detectar la temperatura de una foto. Es el fallback cuando OCR local falla.
   * Devuelve { ok, value, confidence, raw, elapsed_ms, provider } o { ok: false, error }.
   */
  async function detectTemperaturaAI(blob) {
    const client = getClient();
    if (!client) return { ok: false, error: new Error('Supabase no configurado') };
    try {
      // Convertir blob a base64
      const base64 = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onloadend = () => resolve((r.result || '').toString().split(',')[1] || '');
        r.onerror = () => reject(r.error);
        r.readAsDataURL(blob);
      });
      const { data, error } = await client.functions.invoke('detect-temperatura', {
        body: { image_base64: base64, mime_type: blob.type || 'image/jpeg' }
      });
      if (error) return { ok: false, error };
      if (data?.error) return { ok: false, error: new Error(data.error) };
      return { ok: true, ...data };
    } catch (e) {
      return { ok: false, error: e };
    }
  }

  /** Insert directo. Devuelve {ok, data, error}. */
  async function insertRegistro(payload) {
    const client = getClient();
    if (!client) return { ok: false, error: new Error('Supabase no configurado') };
    try {
      const { data, error } = await client
        .from('registros_temperatura')
        .insert(payload)
        .select()
        .single();
      if (error) return { ok: false, error };
      return { ok: true, data };
    } catch (e) {
      return { ok: false, error: e };
    }
  }

  /**
   * Upload de foto al bucket privado. Guardamos el PATH (no public URL) en foto_url,
   * porque el bucket es privado y las URLs públicas no funcionan.
   * El dashboard genera signed URLs on-demand cuando muestra las fotos.
   * Devuelve {ok, path, error}.
   */
  async function uploadFoto(blob, syncOfflineId) {
    const client = getClient();
    if (!client) return { ok: false, error: new Error('Supabase no configurado') };
    const cfg = getConfig();
    // Path en zona Perú (no UTC) para agrupar correctamente por día operativo
    const fechaPath = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date());
    const filename = `${fechaPath}/${syncOfflineId}.jpg`;
    const fullPath = `${cfg.sedeCodigo || 'FTP-HUA'}/${filename}`;
    try {
      const { data, error } = await client.storage
        .from('temperaturas-fotos')
        .upload(fullPath, blob, {
          contentType: 'image/jpeg',
          cacheControl: '3600',
          upsert: false
        });
      if (error) return { ok: false, error };
      // Devolvemos el path; la lectura se hace via signed URL desde el dashboard.
      return { ok: true, path: data.path };
    } catch (e) {
      return { ok: false, error: e };
    }
  }

  /** Cargar áreas activas. */
  async function fetchAreasActivas() {
    const client = getClient();
    if (!client) return { ok: false, error: new Error('Supabase no configurado') };
    try {
      const { data, error } = await client
        .from('areas_temperatura')
        .select('*')
        .eq('activa', true)
        .order('orden', { ascending: true });
      if (error) return { ok: false, error };
      return { ok: true, data: data || [] };
    } catch (e) {
      return { ok: false, error: e };
    }
  }

  /** Cargar últimos N registros del operario actual hoy. */
  async function fetchRegistrosHoy(limit = 50) {
    const client = getClient();
    if (!client) return { ok: false, error: new Error('Supabase no configurado') };
    const cfg = getConfig();
    // "Hoy" en zona Perú (no UTC), robusto a timezone del cliente
    const hoy = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date());
    try {
      const { data, error } = await client
        .from('registros_temperatura')
        .select('id, fecha, hora, area, temperatura, estado, created_at')
        .eq('fecha', hoy)
        .eq('sede_codigo', cfg.sedeCodigo || 'FTP-HUA')
        .order('hora', { ascending: false })
        .limit(limit);
      if (error) return { ok: false, error };
      return { ok: true, data: data || [] };
    } catch (e) {
      return { ok: false, error: e };
    }
  }

  // Expose
  window.SBClient = {
    loadConfig,
    saveConfig,
    getConfig,
    isConfigured,
    isOperarioSet,
    getInspectores,
    getClient,
    clearConfig,
    updateOperario,
    updateSede,
    getTurnoActual,
    calcEstado,
    insertRegistro,
    uploadFoto,
    fetchAreasActivas,
    fetchRegistrosHoy,
    detectTemperaturaAI
  };
})();
