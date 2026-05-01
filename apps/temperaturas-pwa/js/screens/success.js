/* ============================================================
   success.js — confirmación visual y vuelta a home.
   ============================================================ */

(function () {
  'use strict';

  let autoReturnTimer = null;

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    })[c]);
  }

  function render({ area, temperatura, estado, hora, turno, synced }) {
    const estadoBadge = ({
      OK:      '<span class="badge badge--ok">✓ OK</span>',
      ALERTA:  '<span class="badge badge--alerta">⚠ Alerta</span>',
      CRITICO: '<span class="badge badge--critico">🚨 CRÍTICO</span>'
    })[estado] || '<span class="badge">?</span>';

    return `
      <div class="screen success-screen" data-screen="success">
        <div class="success-check">✓</div>
        <h1 class="success-screen__title">Registro guardado</h1>

        <div class="success-screen__detail">
          <div class="success-screen__detail-area">${escapeHtml(area.nombre)}</div>
          <div class="success-screen__detail-temp">${escapeHtml(temperatura.toFixed(1))} °C</div>
          <div class="success-screen__detail-meta">
            ${estadoBadge} · ${escapeHtml(hora.slice(0,5))} · ${escapeHtml(turno)}
          </div>
        </div>

        <div class="success-screen__sync">
          ${synced
            ? '<span style="color: var(--color-success);">↑ Sincronizado a Supabase</span>'
            : '<span style="color: var(--color-warning);">📡 Pendiente — se subirá al recuperar señal</span>'}
        </div>

        <div class="success-screen__actions">
          <button class="btn btn--primary btn--block btn--lg" data-action="home">
            🏠 Volver a inicio
          </button>
          <button class="btn btn--secondary btn--block" data-action="another">
            📷 Registrar otra área
          </button>
        </div>
      </div>
    `;
  }

  function bind() {
    document.querySelectorAll('[data-action="home"]').forEach(b =>
      b.addEventListener('click', () => {
        clearTimer();
        window.App.navigate('home');
      })
    );
    document.querySelectorAll('[data-action="another"]').forEach(b =>
      b.addEventListener('click', () => {
        clearTimer();
        window.App.navigate('home');
      })
    );

    // Auto-return después de 5s
    clearTimer();
    autoReturnTimer = setTimeout(() => {
      window.App.navigate('home');
    }, 5000);
  }

  function clearTimer() {
    if (autoReturnTimer) {
      clearTimeout(autoReturnTimer);
      autoReturnTimer = null;
    }
  }

  window.ScreenSuccess = { render, bind };
})();
