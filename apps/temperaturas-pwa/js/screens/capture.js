/* ============================================================
   capture.js — pantalla de cámara con guía visual.
   ============================================================ */

(function () {
  'use strict';

  let currentArea = null;

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    })[c]);
  }

  function render({ area }) {
    currentArea = area;
    const tipo = area.tipo_equipo === 'termoregistro' ? 'el termoregistro'
               : area.tipo_equipo === 'termometro_portatil' ? 'el termómetro'
               : 'el visor';
    return `
      <div class="screen capture-screen" data-screen="capture">
        <header class="capture-header">
          <button class="capture-header__back" data-action="back" aria-label="Volver">←</button>
          <h1 class="capture-header__title">${escapeHtml(area.nombre)}</h1>
        </header>

        <div class="camera-stage" id="camera-stage">
          <video id="camera-video" autoplay muted playsinline></video>
          <div class="camera-guide" aria-hidden="true">
            <span style="color: white; font-size: 13px;">Apunta al display</span>
          </div>
          <div class="camera-tip">💡 Asegúrate que el número de ${escapeHtml(tipo)} se vea completo</div>
        </div>

        <div class="capture-actions">
          <button class="skip-photo-btn" data-action="skip-photo">⊙ Saltar foto y digitar</button>
          <button class="shutter-btn" data-action="shutter" aria-label="Tomar foto">📷</button>
          <div style="color: rgba(255,255,255,0.7); font-size: 12px;">Toca el círculo para capturar</div>
        </div>
      </div>
    `;
  }

  async function bind({ area }) {
    const videoEl = document.getElementById('camera-video');
    const stageEl = document.getElementById('camera-stage');

    // Iniciar stream
    try {
      await window.CameraService.startStream(videoEl);
    } catch (e) {
      stageEl.innerHTML = `
        <div style="padding: 32px; text-align: center; color: white;">
          <div style="font-size: 48px;">🚫</div>
          <h3>No se pudo abrir la cámara</h3>
          <p style="opacity: 0.7;">${escapeHtml(e.message || 'Permite acceso a la cámara y reintenta.')}</p>
          <button class="btn btn--secondary" data-action="back">← Volver</button>
        </div>
      `;
    }

    document.querySelectorAll('[data-action="back"]').forEach(b =>
      b.addEventListener('click', () => {
        window.CameraService.stopStream();
        window.App.navigate('home');
      })
    );

    const shutterBtn = document.querySelector('[data-action="shutter"]');
    if (shutterBtn) {
      shutterBtn.addEventListener('click', async () => {
        // Vibración corta
        try { navigator.vibrate && navigator.vibrate(40); } catch (e) {}
        shutterBtn.disabled = true;
        try {
          const blob = await window.CameraService.capturePhoto(videoEl);
          window.CameraService.stopStream();
          window.App.navigate('confirm', { area, photoBlob: blob, withOCR: true });
        } catch (e) {
          window.App.toast('Error al capturar: ' + (e.message || e), 'error');
          shutterBtn.disabled = false;
        }
      });
    }

    const skipBtn = document.querySelector('[data-action="skip-photo"]');
    if (skipBtn) {
      skipBtn.addEventListener('click', () => {
        window.CameraService.stopStream();
        window.App.navigate('confirm', { area, photoBlob: null, withOCR: false });
      });
    }
  }

  window.ScreenCapture = { render, bind };
})();
