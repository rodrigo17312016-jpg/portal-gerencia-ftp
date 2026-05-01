/* ============================================================
   success.js — comprobante visual estilo WhatsApp + compartir.
   Recibe: { area, temperatura, estado, hora, turno, synced,
             fotoBlob, observaciones, accionTomada }
   ============================================================ */

(function () {
  'use strict';

  // Estado de la pantalla
  let state = {
    area: null,
    temperatura: 0,
    estado: 'OK',
    hora: '',
    turno: '',
    synced: false,
    fotoBlob: null,
    observaciones: '',
    accionTomada: '',
    cardBlob: null,
    cardURL: null
  };

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    })[c]);
  }

  function renderShell() {
    const estadoBadge = ({
      OK:      '<span class="badge badge--ok">✅ Dentro de rango</span>',
      ALERTA:  '<span class="badge badge--alerta">⚠ Fuera de rango</span>',
      CRITICO: '<span class="badge badge--critico">🚨 CRÍTICO</span>'
    })[state.estado] || '<span class="badge">?</span>';

    return `
      <div class="screen success-screen" data-screen="success">
        <div class="success-check success-check--small">✓</div>
        <h1 class="success-screen__title">Registro guardado</h1>

        <div class="success-screen__sync">
          ${state.synced
            ? '<span style="color: var(--color-success);">↑ Sincronizado a Supabase</span>'
            : '<span style="color: var(--color-warning);">📡 Pendiente — se subirá al recuperar señal</span>'}
        </div>

        <!-- Comprobante (preview) -->
        <div class="receipt-card" id="receipt-card">
          <div class="receipt-card__loading">
            <div class="spinner" style="margin: 24px auto;"></div>
            <div style="text-align:center; color: var(--color-text-muted); font-size: 14px;">
              Generando comprobante…
            </div>
          </div>
        </div>

        <div class="success-screen__actions">
          <button class="btn btn--primary btn--block btn--lg" data-action="share" id="btn-share" disabled>
            📤 Compartir comprobante
          </button>
          <button class="btn btn--secondary btn--block" data-action="another">
            📷 Registrar otra área
          </button>
          <button class="btn btn--ghost btn--block" data-action="home">
            🏠 Volver a inicio
          </button>
        </div>
      </div>
    `;
  }

  async function generateReceipt() {
    const cfg = window.SBClient.getConfig() || {};
    const anio = new Date().getFullYear();

    const data = {
      fotoBlob: state.fotoBlob,
      inspector: cfg.operario || 'Inspector',
      areaNombre: state.area.nombre,
      temperatura: state.temperatura,
      estado: state.estado,
      limite: state.area.limite_max,
      critico: state.area.critico_max,
      hora: state.hora.slice(0,5),
      observaciones: state.accionTomada || state.observaciones || '',
      anio
    };

    try {
      const blob = await window.ShareCard.generateCard(data);
      state.cardBlob = blob;
      state.cardURL = URL.createObjectURL(blob);
      mountReceiptPreview();
    } catch (e) {
      console.error('[success] generateCard failed', e);
      const slot = document.getElementById('receipt-card');
      if (slot) {
        slot.innerHTML = `
          <div style="padding: 24px; text-align:center; color: var(--color-text-muted);">
            ⚠️ No se pudo generar el comprobante visual.<br>
            Igual puedes compartir el texto.
          </div>
        `;
      }
      // Igual habilitar el botón share (compartirá solo texto)
      const btn = document.getElementById('btn-share');
      if (btn) btn.disabled = false;
    }
  }

  function mountReceiptPreview() {
    const slot = document.getElementById('receipt-card');
    if (!slot || !state.cardURL) return;
    slot.innerHTML = `
      <img class="receipt-card__img" src="${state.cardURL}" alt="Comprobante de registro" />
    `;
    const btn = document.getElementById('btn-share');
    if (btn) btn.disabled = false;
  }

  async function handleShare() {
    const cfg = window.SBClient.getConfig() || {};
    const anio = new Date().getFullYear();
    const data = {
      inspector: cfg.operario || 'Inspector',
      areaNombre: state.area.nombre,
      temperatura: state.temperatura,
      estado: state.estado,
      limite: state.area.limite_max,
      critico: state.area.critico_max,
      hora: state.hora.slice(0,5),
      observaciones: state.accionTomada || state.observaciones || '',
      anio
    };
    const text = window.ShareCard.composeText(data);
    const title = `Temperatura ${data.areaNombre}`;

    try {
      const res = await window.ShareCard.share({ blob: state.cardBlob, text, title });
      if (res.ok) {
        if (res.method === 'fallback-clipboard-download') {
          window.App.toast('📋 Texto copiado · imagen descargada', 'success');
        } else if (res.method !== 'cancelled') {
          window.App.toast('✓ Compartido', 'success', 1500);
        }
      } else if (res.method === 'cancelled') {
        // Usuario canceló — no mostrar nada
      }
    } catch (e) {
      console.error('[success] share failed', e);
      window.App.toast('No se pudo compartir: ' + (e.message || ''), 'error');
    }
  }

  function render(props) {
    state = {
      area: props.area,
      temperatura: props.temperatura,
      estado: props.estado || 'OK',
      hora: props.hora || '',
      turno: props.turno || '',
      synced: !!props.synced,
      fotoBlob: props.fotoBlob || null,
      observaciones: props.observaciones || '',
      accionTomada: props.accionTomada || '',
      cardBlob: null,
      cardURL: null
    };

    return renderShell();
  }

  function bind() {
    document.querySelectorAll('[data-action="home"]').forEach(b =>
      b.addEventListener('click', () => {
        cleanup();
        window.App.navigate('home');
      })
    );
    document.querySelectorAll('[data-action="another"]').forEach(b =>
      b.addEventListener('click', () => {
        cleanup();
        window.App.navigate('home');
      })
    );
    document.querySelectorAll('[data-action="share"]').forEach(b =>
      b.addEventListener('click', handleShare)
    );

    // Generar comprobante en background (no bloquea UI)
    setTimeout(generateReceipt, 100);
  }

  function cleanup() {
    if (state.cardURL) {
      try { URL.revokeObjectURL(state.cardURL); } catch (e) {}
      state.cardURL = null;
    }
    state.cardBlob = null;
    // No revocamos fotoBlob aquí: lo gestiona offline-queue cuando termina sync.
  }

  window.ScreenSuccess = { render, bind };
})();
