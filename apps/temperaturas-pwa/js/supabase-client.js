/* ============================================================
   Supabase client wrapper.
   Config se guarda en localStorage (no hardcodeada por política
   de seguridad: ver memory feedback_no_hardcoded_secrets).

   La config se inicializa via setup.js o se importa desde el
   portal si la PWA se sirve desde el mismo origen.
   ============================================================ */

(function () {
  'use strict';

  const STORAGE_KEY = 'temperaturas_pwa.config_v1';

  const state = {
    client: null,
    config: null
  };

  function loadConfig() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && parsed.url && parsed.anonKey) return parsed;
      return null;
    } catch (e) {
      console.error('[supabase-client] loadConfig failed', e);
      return null;
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
    getClient,
    clearConfig,
    updateOperario,
    updateSede,
    getTurnoActual,
    calcEstado,
    insertRegistro,
    uploadFoto,
    fetchAreasActivas,
    fetchRegistrosHoy
  };
})();
