/* ════════════════════════════════════════════════════════
   DEMO BANNER - Indicador de modo demostracion
   Frutos Tropicales Peru Export S.A.C.

   Muestra un banner amarillo al tope del panel para indicar
   que los datos son simulados/demo, no produccion real.
   ════════════════════════════════════════════════════════ */

/**
 * Inserta un banner DEMO al inicio del panel.
 * Idempotente: no duplica si ya existe.
 *
 * @param {HTMLElement} container - Panel contenedor
 * @param {string} [text] - Texto custom (default: "Modo DEMO...")
 */
export function addDemoBanner(container, text) {
  if (!container) return;
  if (container.querySelector('.ftp-demo-banner')) return; // ya existe

  const banner = document.createElement('div');
  banner.className = 'ftp-demo-banner';
  banner.style.cssText = 'margin:0 0 14px;padding:10px 16px;background:linear-gradient(90deg,#fbbf24,#f59e0b);color:#1e293b;border-radius:8px;font-size:13px;font-weight:700;display:flex;align-items:center;gap:10px;box-shadow:0 2px 8px rgba(245,158,11,0.25)';
  banner.innerHTML = `
    <span style="font-size:18px">⚠️</span>
    <span style="flex:1">${text || 'Modo DEMO: los datos mostrados son simulados para demostracion. No reflejan operaciones reales.'}</span>
    <span style="padding:2px 8px;background:rgba(0,0,0,0.15);border-radius:4px;font-size:10px;letter-spacing:0.5px">DEMO</span>
  `;

  // Insertar al principio del container
  if (container.firstChild) {
    container.insertBefore(banner, container.firstChild);
  } else {
    container.appendChild(banner);
  }
}
