/* ════════════════════════════════════════════════════════
   ROUTER - Carga Dinamica de Paneles (Lazy Loading)
   ════════════════════════════════════════════════════════ */

import { hasAccess, getCurrentRole } from './auth.js';
import { destroyChartsIn } from '../utils/chart-helpers.js';

// Version estatica del build - bump manualmente cuando se despliega
// cambio a modulos. Esto permite al SW cachear correctamente.
const BUILD_VERSION = '28';

// Detectar base path (funciona en localhost Y GitHub Pages)
function getBasePath() {
  const path = window.location.pathname;
  // Si estamos en /portal-gerencia-ftp/portal.html -> base es /portal-gerencia-ftp/
  const lastSlash = path.lastIndexOf('/');
  return path.substring(0, lastSlash + 1);
}

export const BASE = getBasePath();

const loadedPanels = new Map();  // Cache de paneles cargados
let currentPanel = null;
let contentContainer = null;

export function initRouter() {
  contentContainer = document.getElementById('main-content');
  if (!contentContainer) {
    console.error('Router: #main-content no encontrado');
    return;
  }
}

// Mostrar un panel
export async function showPanel(panelId, modulePath) {
  if (!contentContainer) initRouter();

  // Verificar acceso
  if (!hasAccess(panelId)) {
    contentContainer.innerHTML = `
      <div class="empty-state" style="margin-top:100px">
        <div class="empty-state-icon">\uD83D\uDD12</div>
        <p class="empty-state-text">No tiene acceso a este modulo</p>
      </div>
    `;
    return;
  }

  // Ocultar panel actual + cleanup hook
  if (currentPanel) {
    const currentEl = document.getElementById(`panel-${currentPanel}`);
    if (currentEl) {
      currentEl.style.display = 'none';
      // Destruir charts del panel oculto (libera memoria, evita leak)
      // Cuando se re-muestre, refresh() o onShow() los recreara
      try { destroyChartsIn(currentEl); } catch (_) { /* noop */ }
    }

    // Llamar cleanup() del modulo si existe (para detener intervalos, etc)
    const currentModule = loadedPanels.get(currentPanel);
    if (currentModule && typeof currentModule.onHide === 'function') {
      try { currentModule.onHide(); } catch (e) { console.warn('onHide error:', e); }
    }
  }

  // Si ya esta cargado, solo mostrar
  if (loadedPanels.has(panelId)) {
    const panelEl = document.getElementById(`panel-${panelId}`);
    if (panelEl) {
      panelEl.style.display = 'block';
      panelEl.classList.add('animate-fadeInUp');
      currentPanel = panelId;
      updateBreadcrumb(panelId);
      updateActiveNav(panelId);

      // Re-ejecutar refresh / onShow si existen
      // (los charts fueron destruidos al ocultar, refresh los recrea)
      const module = loadedPanels.get(panelId);
      if (module && typeof module.onShow === 'function') {
        try { module.onShow(); } catch (e) { console.warn('onShow error:', e); }
      }
      if (module && module.refresh) module.refresh();
      return;
    }
  }

  // Cargar panel nuevo
  try {
    contentContainer.innerHTML += `
      <div id="panel-${panelId}" class="panel-wrapper" style="display:block">
        <div class="loading-spinner"></div>
      </div>
    `;

    // Cargar HTML template
    const htmlPath = `${BASE}modules/${modulePath}.html?v=${BUILD_VERSION}`;
    const htmlRes = await fetch(htmlPath);

    if (!htmlRes.ok) {
      throw new Error(`No se pudo cargar ${htmlPath}`);
    }

    const html = await htmlRes.text();
    const panelEl = document.getElementById(`panel-${panelId}`);
    panelEl.innerHTML = html;
    panelEl.classList.add('animate-fadeInUp');

    // Cargar JS module
    try {
      const jsPath = `${BASE}modules/${modulePath}.js?v=${BUILD_VERSION}`;
      const module = await import(jsPath);

      if (module.init) {
        await module.init(panelEl);
      }

      loadedPanels.set(panelId, module);
    } catch (jsErr) {
      // El panel puede no tener JS (solo HTML estatico)
      console.warn(`No JS module for ${modulePath}:`, jsErr.message);
      loadedPanels.set(panelId, {});
    }

    currentPanel = panelId;
    updateBreadcrumb(panelId);
    updateActiveNav(panelId);
  } catch (err) {
    console.error(`Error cargando panel ${panelId}:`, err);
    const panelEl = document.getElementById(`panel-${panelId}`);
    if (panelEl) {
      panelEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">\u26A0\uFE0F</div>
          <p class="empty-state-text">Error al cargar el modulo</p>
          <p style="color:var(--muted);font-size:12px;margin-top:8px">${err.message}</p>
        </div>
      `;
    }
  }
}

// Actualizar breadcrumb en topbar
function updateBreadcrumb(panelId) {
  const breadcrumb = document.getElementById('topbar-breadcrumb');
  if (!breadcrumb) return;

  const labels = {
    'resumen': 'General / Resumen Ejecutivo',
    'certificaciones': 'General / Certificaciones',
    'audit': 'General / Audit Log',
    'seguridad': 'General / Seguridad',
    'indicadores': 'Produccion / Indicadores',
    'produccion-dia': 'Produccion / Produccion del Dia',
    'rendimientos': 'Produccion / Rendimientos',
    'costos': 'Produccion / Costos',
    'productividad': 'Produccion / Productividad',
    'comparativo': 'Produccion / Comparativo Turnos',
    'programa': 'Produccion / Programa',
    'proyecciones': 'Produccion / Proyecciones',
    'almuerzos': 'Produccion / Almuerzos',
    'recepcion': 'Areas / Recepcion',
    'acondicionado': 'Areas / Acondicionado',
    'tuneles': 'Areas / Tuneles IQF',
    'empaque': 'Areas / Empaque',
    'temperaturas': 'Calidad / Temperaturas',
    'inspecciones': 'Calidad / Inspecciones',
    'consumos-calidad': 'Calidad / Consumos',
    'laboratorio': 'Calidad / Laboratorio',
    'costos-analisis': 'Calidad / Costos Analisis',
    'reclamos': 'Calidad / Reclamos',
    'stock-general': 'Almacen / Stock General',
    'materiales': 'Almacen / Materiales',
    'contenedores': 'Almacen / Contenedores',
    'rrhh': 'RRHH / Sistema',
    'resumen-mant': 'Mantenimiento / Resumen',
    'equipos': 'Mantenimiento / Equipos & Activos',
    'ordenes-trabajo': 'Mantenimiento / Ordenes de Trabajo',
    'preventivo': 'Mantenimiento / Preventivo',
    'correctivo': 'Mantenimiento / Correctivo',
    'predictivo': 'Mantenimiento / Predictivo',
    'repuestos': 'Mantenimiento / Repuestos',
    'tecnicos-mant': 'Mantenimiento / Tecnicos',
    'calendario-mant': 'Mantenimiento / Calendario',
    'lubricacion': 'Mantenimiento / Lubricacion',
    'indicadores-mant': 'Mantenimiento / Indicadores KPI',
    'costos-mant': 'Mantenimiento / Costos'
  };

  breadcrumb.textContent = labels[panelId] || panelId;
}

// Actualizar item activo en sidebar
function updateActiveNav(panelId) {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.panel === panelId);
  });
}

// Obtener panel actual
export function getCurrentPanel() {
  return currentPanel;
}

// Panel por defecto segun rol
export function getDefaultPanel() {
  const role = getCurrentRole();
  switch (role) {
    case 'admin': return { id: 'resumen', module: 'gerencia/resumen' };
    case 'produccion': return { id: 'indicadores', module: 'produccion/indicadores' };
    case 'calidad': return { id: 'temperaturas', module: 'calidad/temperaturas' };
    case 'mantenimiento': return { id: 'resumen-mant', module: 'mantenimiento/resumen' };
    default: return { id: 'resumen', module: 'gerencia/resumen' };
  }
}
