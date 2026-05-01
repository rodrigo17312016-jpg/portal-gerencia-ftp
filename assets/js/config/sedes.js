/* ════════════════════════════════════════════════════════
   SEDES - Registry de plantas / maquilas
   ════════════════════════════════════════════════════════
   Carga config/sedes.json una sola vez y lo cachea.
   Las APIs de consumo trabajan con codigos (FTP-HUA, etc).
   ════════════════════════════════════════════════════════ */

let _cache = null;
let _loadingPromise = null;

// Resolver URL absoluta del JSON desde la ubicacion del modulo.
// Funciona desde portal.html (raiz), GitHub Pages (/portal-gerencia-ftp/),
// y desde paginas en subcarpetas como /docs/test-multi-sede.html.
function resolveSedesJsonUrl() {
  try {
    // /assets/js/config/sedes.js → quitar 3 niveles → llegar a la raiz del portal
    return new URL('../../../config/sedes.json', import.meta.url).href;
  } catch (_) {
    return 'config/sedes.json';
  }
}

async function loadSedes() {
  if (_cache) return _cache;
  if (_loadingPromise) return _loadingPromise;

  _loadingPromise = fetch(resolveSedesJsonUrl())
    .then(r => {
      if (!r.ok) throw new Error('No se pudo cargar config/sedes.json (status ' + r.status + ')');
      return r.json();
    })
    .then(data => {
      _cache = data;
      return data;
    })
    .catch(err => {
      console.error('[sedes] Error cargando config:', err);
      // Fallback minimo para no romper la app
      _cache = {
        version: 1,
        default: 'FTP-HUA',
        sedes: [{ codigo: 'FTP-HUA', nombre: 'FTP Huaura', nombreCorto: 'Huaura', tipo: 'propia', color: '#0e7c3a', icono: '🏭', activa: true, principal: true, scaleFactor: 1.0 }],
        consolidado: { codigo: 'CONSOLIDADO', nombre: 'Consolidado', nombreCorto: 'Consolidado', tipo: 'agregado', color: '#6d28d9', icono: '⚡' }
      };
      return _cache;
    });

  return _loadingPromise;
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
