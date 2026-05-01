/* ============================================================
   home.js — pantalla principal: tabs por formato + cards de áreas.
   ============================================================ */

(function () {
  'use strict';

  let currentFormato = 'mp';
  let areasCache = [];
  let registrosHoy = [];

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    })[c]);
  }

  function getOnlineStatus() {
    if (!navigator.onLine) return { cls: 'offline', text: 'Sin conexión' };
    return { cls: 'online', text: 'En línea' };
  }

  function getUltimoRegistro(codigo) {
    const matches = registrosHoy.filter(r => r.area === codigo);
    if (!matches.length) return null;
    matches.sort((a, b) => (b.hora || '').localeCompare(a.hora || ''));
    return matches[0];
  }

  function minutesAgo(timestampStr) {
    if (!timestampStr) return null;
    const [hh, mm] = timestampStr.split(':').map(Number);
    if (isNaN(hh) || isNaN(mm)) return null;
    const now = new Date();
    const peruNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/Lima' }));
    const recordTime = new Date(peruNow);
    recordTime.setHours(hh, mm, 0, 0);
    const diffMs = peruNow - recordTime;
    return Math.floor(diffMs / 60000);
  }

  function renderAreaCard(area) {
    const colorClass = window.AreasService.getColorClassByTipo(area);
    const emoji = window.AreasService.getEmojiByTipo(area);
    const ultimo = getUltimoRegistro(area.codigo);
    const minsAgo = ultimo ? minutesAgo(ultimo.hora) : null;

    let metaHtml = '';
    let statusDot = 'pendiente';
    let statusText = 'Pendiente';

    if (ultimo) {
      const estadoLow = (ultimo.estado || 'OK').toLowerCase();
      statusDot = estadoLow === 'ok' ? 'ok' : estadoLow === 'critico' ? 'critico' : 'alerta';
      const tempStr = `${Number(ultimo.temperatura).toFixed(1)}°C`;
      const agoStr = (minsAgo !== null) ? `${minsAgo} min` : '';
      metaHtml = `Última: <strong>${escapeHtml(tempStr)}</strong> · ${escapeHtml(agoStr)}`;
      statusText = ultimo.estado || 'OK';
    } else {
      metaHtml = `Límite ≤ ${area.limite_max}°C · Crítico > ${area.critico_max}°C`;
    }

    return `
      <button class="area-card" data-area="${escapeHtml(area.codigo)}"
              aria-label="Registrar ${escapeHtml(area.nombre)}">
        <div class="area-card__icon area-card__icon--${colorClass}">${emoji}</div>
        <div class="area-card__body">
          <h3 class="area-card__name">${escapeHtml(area.nombre)}</h3>
          <div class="area-card__meta">
            <span>${metaHtml}</span>
          </div>
        </div>
        <div class="area-card__status" aria-label="Estado: ${escapeHtml(statusText)}">
          <span class="area-card__status-dot ${statusDot}"></span>
        </div>
      </button>
    `;
  }

  function counterByFormato(formato) {
    const total = areasCache.filter(a => a.formato === formato).length;
    const conRegistro = areasCache
      .filter(a => a.formato === formato)
      .filter(a => getUltimoRegistro(a.codigo))
      .length;
    return `${conRegistro}/${total}`;
  }

  function render() {
    const cfg = window.SBClient.getConfig() || {};
    const turno = window.SBClient.getTurnoActual();
    const status = getOnlineStatus();
    const filteredAreas = areasCache.filter(a => a.formato === currentFormato);
    const formatosDisponibles = ['mp', 'proceso', 'empaque'];

    return `
      <div class="screen" data-screen="home">
        <header class="app-header">
          <div>
            <h1 class="app-header__title">🌡️ Temperaturas</h1>
            <div class="app-header__subtitle">${escapeHtml(turno)}</div>
          </div>
          <div class="app-header__actions">
            <span class="status-pill ${status.cls}" id="online-status">${status.text}</span>
            <button class="icon-btn" data-action="open-settings" aria-label="Configuración">⚙️</button>
          </div>
        </header>

        <div class="screen-content">
          <div class="home-greeting">
            <h2 class="home-greeting__hello">Hola, ${escapeHtml(cfg.operario || 'operario')}</h2>
            <div class="home-greeting__hint">Selecciona un área para registrar</div>
          </div>

          <div class="format-tabs" role="tablist">
            ${formatosDisponibles.map(fmt => {
              const meta = window.AreasService.getFormatoMeta(fmt);
              const active = currentFormato === fmt;
              return `
                <button class="format-tab ${active ? 'format-tab--active' : ''}"
                        role="tab" aria-selected="${active}"
                        data-formato="${fmt}">
                  <span class="format-tab__emoji">${meta.emoji}</span>
                  <span>${escapeHtml(meta.label)}</span>
                  <span class="format-tab__counter">${counterByFormato(fmt)}</span>
                </button>
              `;
            }).join('')}
          </div>

          ${filteredAreas.length === 0 ? `
            <div class="empty-state">
              <div class="empty-state__emoji">📭</div>
              <div class="empty-state__title">Sin áreas en este grupo</div>
              <div>No hay áreas activas para "${escapeHtml(currentFormato)}"</div>
            </div>
          ` : `
            <div class="areas-list">
              ${filteredAreas.map(renderAreaCard).join('')}
            </div>
          `}
        </div>

        <nav class="bottom-nav" role="navigation">
          <button class="bottom-nav__item bottom-nav__item--active" data-tab="home">
            <span class="bottom-nav__item-icon">🏠</span>
            <span>Inicio</span>
          </button>
          <button class="bottom-nav__item" data-action="quick-capture">
            <span class="bottom-nav__item-icon">📷</span>
            <span>Capturar</span>
          </button>
          <button class="bottom-nav__item" data-action="open-settings">
            <span class="bottom-nav__item-icon">⚙️</span>
            <span>Ajustes</span>
          </button>
        </nav>
      </div>
    `;
  }

  function bind() {
    document.querySelectorAll('.format-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        currentFormato = btn.dataset.formato;
        rerender();
      });
    });

    document.querySelectorAll('.area-card').forEach(card => {
      card.addEventListener('click', () => {
        const codigo = card.dataset.area;
        const area = areasCache.find(a => a.codigo === codigo);
        if (!area) return;
        window.App.navigate('capture', { area });
      });
    });

    document.querySelectorAll('[data-action="open-settings"]').forEach(btn =>
      btn.addEventListener('click', () => window.App.navigate('select-inspector'))
    );

    document.querySelectorAll('[data-action="quick-capture"]').forEach(btn =>
      btn.addEventListener('click', () => {
        // Va al primer área del formato actual
        const first = areasCache.find(a => a.formato === currentFormato);
        if (first) window.App.navigate('capture', { area: first });
      })
    );
  }

  function rerender() {
    document.getElementById('app').innerHTML = render();
    bind();
  }

  async function load() {
    document.getElementById('app').innerHTML = `
      <div class="screen setup-wrap" role="status">
        <div class="setup-wrap__logo">🌡️</div>
        <p class="setup-wrap__subtitle">Cargando áreas…</p>
        <div class="spinner" style="margin: 0 auto;"></div>
      </div>
    `;
    try {
      const [areas, regsRes] = await Promise.all([
        window.AreasService.getAreas(),
        window.SBClient.fetchRegistrosHoy(200).catch(() => ({ ok: false, data: [] }))
      ]);
      areasCache = (areas || []).filter(a => a.activa !== false);
      registrosHoy = (regsRes.ok ? regsRes.data : []) || [];
    } catch (e) {
      console.error('[home] load error', e);
      areasCache = [];
      registrosHoy = [];
    }
    rerender();
  }

  window.ScreenHome = { render: load, bind: () => {}, refresh: load };
})();
