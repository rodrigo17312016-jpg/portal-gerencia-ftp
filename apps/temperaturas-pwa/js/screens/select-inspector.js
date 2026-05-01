/* ============================================================
   select-inspector.js — pantalla minimalista para elegir inspector.
   Reemplaza el setup completo (URL/key ya hardcodeadas como default).
   ============================================================ */

(function () {
  'use strict';

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    })[c]);
  }

  function getInitials(nombre) {
    return (nombre || '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(p => p[0])
      .join('')
      .toUpperCase();
  }

  // Paleta cíclica para los avatares (consistente por nombre)
  const AVATAR_COLORS = [
    'linear-gradient(135deg,#0EA5E9,#1E40AF)',  // azul
    'linear-gradient(135deg,#F59E0B,#D97706)',  // ámbar
    'linear-gradient(135deg,#10B981,#059669)',  // verde
    'linear-gradient(135deg,#EC4899,#BE185D)',  // rosa
    'linear-gradient(135deg,#8B5CF6,#6D28D9)',  // morado
    'linear-gradient(135deg,#06B6D4,#0E7490)',  // cyan
    'linear-gradient(135deg,#EF4444,#B91C1C)'   // rojo
  ];

  function colorFor(nombre) {
    let hash = 0;
    for (let i = 0; i < nombre.length; i++) hash = (hash * 31 + nombre.charCodeAt(i)) & 0xfffffff;
    return AVATAR_COLORS[hash % AVATAR_COLORS.length];
  }

  function render() {
    const inspectores = window.SBClient.getInspectores();
    const cfg = window.SBClient.getConfig() || {};
    const actual = cfg.operario || '';

    return `
      <div class="screen select-inspector-screen" data-screen="select-inspector">
        <header class="app-header">
          <div>
            <h1 class="app-header__title">🌡️ Temperaturas FTP</h1>
            <div class="app-header__subtitle">Selecciona tu nombre para registrar</div>
          </div>
        </header>

        <div class="screen-content" style="padding: 8px 16px 24px 16px;">
          ${actual ? `
            <div class="card" style="background: rgba(14,165,233,0.08); border: 1px solid rgba(14,165,233,0.20); margin-bottom: 16px; padding: 12px 16px;">
              <div style="font-size: 12px; color: var(--color-text-muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em;">Inspector actual</div>
              <div style="font-size: 18px; font-weight: 800; color: var(--color-text); margin-top: 2px;">${escapeHtml(actual)}</div>
            </div>
          ` : ''}

          <div class="inspectors-grid">
            ${inspectores.map(nombre => {
              const isActive = nombre === actual;
              return `
                <button class="inspector-card ${isActive ? 'inspector-card--active' : ''}"
                        data-inspector="${escapeHtml(nombre)}"
                        aria-label="Seleccionar inspector ${escapeHtml(nombre)}">
                  <div class="inspector-card__avatar" style="background: ${colorFor(nombre)};">
                    ${escapeHtml(getInitials(nombre))}
                  </div>
                  <div class="inspector-card__name">${escapeHtml(nombre)}</div>
                  ${isActive ? '<div class="inspector-card__check">✓</div>' : ''}
                </button>
              `;
            }).join('')}
          </div>

          <div style="margin-top: 24px; text-align: center;">
            <button class="btn btn--ghost" data-action="advanced">
              ⚙️ Configuración avanzada
            </button>
          </div>
        </div>
      </div>
    `;
  }

  function bind() {
    document.querySelectorAll('.inspector-card').forEach(card => {
      card.addEventListener('click', () => {
        const nombre = card.dataset.inspector;
        try {
          // Si no hay config previa, crear con defaults; si hay, solo actualizar operario
          const existing = window.SBClient.getConfig();
          window.SBClient.saveConfig({
            url: existing.url,
            anonKey: existing.anonKey,
            sedeCodigo: existing.sedeCodigo,
            operario: nombre
          });
          // Vibración corta + toast
          try { navigator.vibrate && navigator.vibrate(40); } catch (e) {}
          window.App.toast(`✓ Hola, ${nombre}`, 'success', 1800);
          // Navegar a home
          setTimeout(() => window.App.navigate('home'), 400);
        } catch (e) {
          window.App.toast('Error: ' + (e.message || 'No se pudo guardar'), 'error');
        }
      });
    });

    document.querySelectorAll('[data-action="advanced"]').forEach(b =>
      b.addEventListener('click', () => window.App.navigate('setup'))
    );
  }

  window.ScreenSelectInspector = { render, bind };
})();
