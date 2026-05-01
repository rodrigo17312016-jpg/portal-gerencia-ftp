/* ============================================================
   confirm.js — confirmación del valor (con OCR autocompletado).
   ============================================================ */

(function () {
  'use strict';

  let state = {
    area: null,
    photoBlob: null,
    photoURL: null,
    ocrResult: null,
    tempInput: '',
    observaciones: '',
    accionTomada: ''  // obligatorio si CRITICO
  };

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    })[c]);
  }

  function calcEstado(temp) {
    return window.SBClient.calcEstado(state.area, parseFloat(temp));
  }

  function renderProcessingScreen() {
    return `
      <div class="screen ocr-processing" data-screen="confirm-processing">
        ${state.photoURL ? `<img class="ocr-processing__photo" src="${state.photoURL}" alt="Captura" />` : ''}
        <div class="spinner" style="width:48px;height:48px;"></div>
        <h2 class="ocr-processing__title">🔍 Leyendo número…</h2>
        <p class="ocr-processing__hint">Procesando localmente en tu celular (sin enviar a servidor)</p>
        <div class="progress progress--indeterminate ocr-processing__progress" id="ocr-progress">
          <div class="progress__bar" style="width: 10%;"></div>
        </div>
      </div>
    `;
  }

  function statusBannerHtml(temp) {
    if (temp === '' || temp === null || isNaN(parseFloat(temp))) {
      return `
        <div class="status-banner" style="background: var(--color-surface-2); color: var(--color-text-muted);">
          <div class="status-banner__icon" style="background: var(--color-text-soft); color: white;">?</div>
          <div>
            <h3 class="status-banner__title">Ingresa la temperatura</h3>
            <div class="status-banner__detail">Límite ≤ ${state.area.limite_max}°C · Crítico > ${state.area.critico_max}°C</div>
          </div>
        </div>
      `;
    }
    const estado = calcEstado(temp);
    const map = {
      OK:      { cls: 'ok',      title: '✅ Dentro de rango',   icon: '✓' },
      ALERTA:  { cls: 'alerta',  title: '⚠ Alerta — fuera de límite', icon: '!' },
      CRITICO: { cls: 'critico', title: '🚨 CRÍTICO',           icon: '!' }
    };
    const m = map[estado] || map.OK;
    return `
      <div class="status-banner status-banner--${m.cls}">
        <div class="status-banner__icon">${m.icon}</div>
        <div>
          <h3 class="status-banner__title">${m.title}</h3>
          <div class="status-banner__detail">Límite ≤ ${state.area.limite_max}°C · Crítico > ${state.area.critico_max}°C</div>
        </div>
      </div>
    `;
  }

  function renderConfirmScreen() {
    const ocr = state.ocrResult;
    const ocrLabel = ocr && ocr.value !== null
      ? `${ocr.value.toFixed(1)} °C`
      : (ocr ? 'No se pudo leer' : 'Foto omitida');
    const ocrConfidence = ocr && ocr.value !== null ? ` · ${Math.round(ocr.confidence)}% confianza` : '';

    return `
      <div class="screen" data-screen="confirm">
        <header class="capture-header">
          <button class="capture-header__back" data-action="back" aria-label="Volver">←</button>
          <h1 class="capture-header__title">${escapeHtml(state.area.nombre)}</h1>
        </header>

        <div class="confirm-screen">
          ${state.photoURL || ocr ? `
            <div class="confirm-photo-row">
              ${state.photoURL ? `<img class="confirm-photo-row__thumb" src="${state.photoURL}" alt="Captura" />`
                : `<div class="confirm-photo-row__thumb" style="display:flex;align-items:center;justify-content:center;font-size:32px;color:var(--color-text-soft);">📷</div>`}
              <div class="confirm-photo-row__info">
                <div class="confirm-photo-row__label">Detectado por OCR${escapeHtml(ocrConfidence)}</div>
                <div class="confirm-photo-row__value">${escapeHtml(ocrLabel)}</div>
              </div>
            </div>
          ` : ''}

          <div class="temp-input-card">
            <label class="label" for="temp-input" style="display:none;">Temperatura</label>
            <input class="input input--big" id="temp-input" type="number"
              step="0.1" inputmode="decimal" autocomplete="off"
              value="${escapeHtml(state.tempInput)}"
              placeholder="0.0" />
            <div class="temp-input-card__unit">°C</div>
            <div class="stepper">
              <button class="stepper__btn" data-action="dec" aria-label="Disminuir 0.1">−</button>
              <button class="stepper__btn" data-action="inc" aria-label="Aumentar 0.1">+</button>
            </div>
          </div>

          <div id="status-banner-slot">${statusBannerHtml(state.tempInput)}</div>

          <div id="accion-slot">${
            calcEstado(state.tempInput) === 'CRITICO' ? `
              <div class="fields-stack">
                <div>
                  <label class="label" for="accion-tomada">Acción tomada (obligatoria por estado crítico)</label>
                  <textarea class="textarea" id="accion-tomada"
                    placeholder="Ej: Reportado a supervisor, equipo en revisión...">${escapeHtml(state.accionTomada)}</textarea>
                </div>
              </div>
            ` : ''
          }</div>

          <div>
            <label class="label" for="observaciones">Observaciones (opcional)</label>
            <textarea class="textarea" id="observaciones" placeholder="Notas...">${escapeHtml(state.observaciones)}</textarea>
          </div>

          <button class="btn btn--primary btn--block btn--xl" id="btn-save">
            💾 Guardar registro
          </button>
        </div>
      </div>
    `;
  }

  async function render({ area, photoBlob, withOCR }) {
    state = {
      area,
      photoBlob: photoBlob || null,
      photoURL: photoBlob ? window.CameraService.blobToObjectURL(photoBlob) : null,
      ocrResult: null,
      tempInput: '',
      observaciones: '',
      accionTomada: ''
    };

    const app = document.getElementById('app');

    if (withOCR && photoBlob) {
      app.innerHTML = renderProcessingScreen();
      try {
        const result = await window.OCRService.detectFromBlob(photoBlob, (pct) => {
          const bar = document.querySelector('#ocr-progress .progress__bar');
          if (bar) {
            bar.style.width = pct + '%';
            document.querySelector('#ocr-progress')?.classList.remove('progress--indeterminate');
          }
        });
        state.ocrResult = result;
        state.tempInput = (result && result.value !== null) ? String(result.value) : '';
      } catch (e) {
        console.warn('[confirm] OCR falló', e);
        state.ocrResult = { value: null, raw: '', confidence: 0, error: e.message };
        window.App.toast('No se pudo leer el número, digitalo manualmente', 'warning');
      }
    }

    app.innerHTML = renderConfirmScreen();
    bindEvents();
  }

  function bindEvents() {
    document.querySelectorAll('[data-action="back"]').forEach(b =>
      b.addEventListener('click', () => {
        cleanup();
        window.App.navigate('home');
      })
    );

    const tempInput = document.getElementById('temp-input');
    if (tempInput) {
      tempInput.addEventListener('input', (e) => {
        state.tempInput = e.target.value;
        rerenderStatus();
      });
    }

    document.querySelectorAll('[data-action="dec"]').forEach(b =>
      b.addEventListener('click', () => stepTemp(-0.1)));
    document.querySelectorAll('[data-action="inc"]').forEach(b =>
      b.addEventListener('click', () => stepTemp(+0.1)));

    const obs = document.getElementById('observaciones');
    if (obs) obs.addEventListener('input', e => state.observaciones = e.target.value);

    const acc = document.getElementById('accion-tomada');
    if (acc) acc.addEventListener('input', e => state.accionTomada = e.target.value);

    const saveBtn = document.getElementById('btn-save');
    if (saveBtn) saveBtn.addEventListener('click', save);
  }

  function stepTemp(delta) {
    const cur = parseFloat(state.tempInput);
    const next = (isFinite(cur) ? cur : 0) + delta;
    state.tempInput = next.toFixed(1);
    const ip = document.getElementById('temp-input');
    if (ip) ip.value = state.tempInput;
    rerenderStatus();
    try { navigator.vibrate && navigator.vibrate(15); } catch (e) {}
  }

  function rerenderStatus() {
    // Solo actualiza el banner de status y la sección de acción.
    // NO re-renderiza toda la pantalla (preservamos foco del input).
    const bannerSlot = document.getElementById('status-banner-slot');
    if (bannerSlot) bannerSlot.innerHTML = statusBannerHtml(state.tempInput);

    const accionSlot = document.getElementById('accion-slot');
    if (accionSlot) {
      const isCrit = calcEstado(state.tempInput) === 'CRITICO';
      const hasAccionField = !!document.getElementById('accion-tomada');
      if (isCrit && !hasAccionField) {
        accionSlot.innerHTML = `
          <div class="fields-stack">
            <div>
              <label class="label" for="accion-tomada">Acción tomada (obligatoria por estado crítico)</label>
              <textarea class="textarea" id="accion-tomada"
                placeholder="Ej: Reportado a supervisor, equipo en revisión...">${escapeHtml(state.accionTomada)}</textarea>
            </div>
          </div>`;
        const acc = document.getElementById('accion-tomada');
        if (acc) acc.addEventListener('input', e => state.accionTomada = e.target.value);
      } else if (!isCrit && hasAccionField) {
        accionSlot.innerHTML = '';
        state.accionTomada = '';
      }
    }
  }

  async function save() {
    const tempStr = (state.tempInput || '').trim();
    const tempNum = parseFloat(tempStr);
    if (!isFinite(tempNum)) {
      window.App.toast('Ingresa una temperatura válida', 'error');
      return;
    }
    const estado = calcEstado(tempNum);
    if (estado === 'CRITICO' && !state.accionTomada.trim()) {
      window.App.toast('Por estado CRÍTICO es obligatorio describir la acción tomada', 'warning');
      return;
    }

    const cfg = window.SBClient.getConfig();
    const now = new Date();
    // Fecha/hora en zona Perú robusto (independiente del timezone del cliente)
    const fechaFmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit'
    });
    const horaFmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    });
    const fecha = fechaFmt.format(now);            // YYYY-MM-DD (en-CA da formato ISO)
    const hora  = horaFmt.format(now);             // HH:MM:SS
    const turno = window.SBClient.getTurnoActual(now);

    const observacionesFinal = [
      state.accionTomada ? `Acción: ${state.accionTomada}` : null,
      state.observaciones || null
    ].filter(Boolean).join(' | ');

    const syncOfflineId = window.OfflineQueue.uuid();

    const payload = {
      fecha,
      hora,
      area: state.area.codigo,
      temperatura: tempNum,
      estado,
      operario: cfg.operario || 'Anónimo',
      turno,
      observaciones: observacionesFinal || null,
      sede_codigo: cfg.sedeCodigo || 'FTP-HUA',
      origen: state.photoBlob ? 'pwa_ocr' : 'pwa_manual',
      ocr_valor_detectado: state.ocrResult && state.ocrResult.value !== null ? state.ocrResult.value : null,
      ocr_confianza: state.ocrResult && state.ocrResult.confidence ? Math.round(state.ocrResult.confidence) : null,
      sync_offline_id: syncOfflineId
    };

    // Capturamos la referencia al blob ANTES de cleanup() para pasarla a success
    const fotoBlobRef = state.photoBlob;

    // 1) Guardar en queue offline (siempre, para tener garantía)
    await window.OfflineQueue.addPending(payload, state.photoBlob);

    const saveBtn = document.getElementById('btn-save');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = '⏳ Guardando…';
    }

    // No revocamos el photoURL aquí — success lo necesita.
    // El cleanup() se hace cuando success se desmonta o expira el auto-return.

    // 2) Intento inmediato de sync (si hay red)
    let synced = false;
    if (navigator.onLine && window.SBClient.isConfigured()) {
      const flushRes = await window.OfflineQueue.flush().catch(() => ({ synced: 0, failed: 1 }));
      synced = flushRes.synced > 0;
    }

    window.App.navigate('success', {
      area: state.area,
      temperatura: tempNum,
      estado,
      hora,
      turno,
      synced,
      fotoBlob: fotoBlobRef,
      observaciones: state.observaciones,
      accionTomada: state.accionTomada
    });
  }

  function cleanup() {
    if (state.photoURL) {
      window.CameraService.revokeObjectURL(state.photoURL);
      state.photoURL = null;
    }
  }

  window.ScreenConfirm = { render, bind: () => {} };
})();
