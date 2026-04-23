/* ══════════════════════════════════════════════════════════════════════
   CHART HELPERS - Wrapper sobre Chart.js para reuso y menos re-creacion
   Frutos Tropicales Peru Export S.A.C.

   En vez de destroy + new Chart() en cada render (costoso), usar
   upsertChart() que actualiza datasets si el chart ya existe.

   Reduce GC presion y flickering.
   ══════════════════════════════════════════════════════════════════════ */

(function(global) {
  'use strict';

  const registry = (global.__ftpChartRegistry = global.__ftpChartRegistry || new Map());

  /**
   * Crea o actualiza un Chart.js por canvas id.
   * @param {string} canvasId
   * @param {object} config  Config Chart.js { type, data, options }
   * @returns {Chart|null}
   */
  function upsertChart(canvasId, config) {
    if (typeof Chart === 'undefined') {
      console.warn('[chart-helpers] Chart.js no cargado');
      return null;
    }
    const canvas = typeof canvasId === 'string'
      ? document.getElementById(canvasId)
      : canvasId;
    if (!canvas) return null;

    const existing = registry.get(canvas);
    if (existing) {
      // Si cambio el tipo, hay que recrear
      if (existing.config && existing.config.type !== config.type) {
        existing.destroy();
        registry.delete(canvas);
      } else {
        // Actualizar in-place (rapido)
        existing.data = config.data;
        if (config.options) existing.options = config.options;
        existing.update('none'); // sin animacion para updates rapidos
        return existing;
      }
    }
    const chart = new Chart(canvas, config);
    registry.set(canvas, chart);
    return chart;
  }

  /**
   * Destruye un chart por canvas id o todos los del registry.
   */
  function destroyChart(canvasId) {
    if (!canvasId) {
      registry.forEach((c) => { try { c.destroy(); } catch (e) {} });
      registry.clear();
      return;
    }
    const canvas = typeof canvasId === 'string'
      ? document.getElementById(canvasId)
      : canvasId;
    if (!canvas) return;
    const c = registry.get(canvas);
    if (c) {
      try { c.destroy(); } catch (e) {}
      registry.delete(canvas);
    }
  }

  global.ftpChart = { upsertChart, destroyChart };
})(window);
