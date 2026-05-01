/* ============================================================
   setup.js — onboarding inicial: URL Supabase + anonKey + sede + operario
   ============================================================ */

(function () {
  'use strict';

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    })[c]);
  }

  function render(opts = {}) {
    const cfg = window.SBClient.getConfig() || {};
    return `
      <div class="screen setup-wrap" data-screen="setup">
        <div class="setup-wrap__logo">🌡️</div>
        <h1 class="setup-wrap__title">Temperaturas FTP</h1>
        <p class="setup-wrap__subtitle">
          Configura la conexión a Supabase y tu nombre para arrancar.
        </p>

        <form id="setup-form" autocomplete="off">
          <div>
            <label class="label" for="setup-url">URL Supabase</label>
            <input class="input" id="setup-url" type="url"
              placeholder="https://obnvrfvcujsrmifvlqni.supabase.co"
              value="${escapeHtml(cfg.url || '')}" required />
          </div>

          <div>
            <label class="label" for="setup-key">Anon key (public)</label>
            <input class="input" id="setup-key" type="password"
              placeholder="eyJhbGciOi..."
              value="${escapeHtml(cfg.anonKey || '')}" required />
            <small style="color: var(--color-text-muted); font-size: 12px; margin-top: 4px; display:block;">
              La anon key es pública (no es secreto). Pídela al admin del portal.
            </small>
          </div>

          <div>
            <label class="label" for="setup-sede">Sede</label>
            <select class="input" id="setup-sede">
              <option value="FTP-HUA" ${cfg.sedeCodigo === 'FTP-HUA' ? 'selected' : ''}>FTP-HUA — Huaral</option>
              <option value="FTP-PIU" ${cfg.sedeCodigo === 'FTP-PIU' ? 'selected' : ''}>FTP-PIU — Piura</option>
              <option value="PRC-MAQ" ${cfg.sedeCodigo === 'PRC-MAQ' ? 'selected' : ''}>PRC-MAQ — Maquila</option>
            </select>
          </div>

          <div>
            <label class="label" for="setup-operario">Tu nombre</label>
            <input class="input" id="setup-operario" type="text"
              placeholder="Ej: Rodrigo García"
              value="${escapeHtml(cfg.operario || '')}" required />
          </div>

          ${opts.error ? `<div class="status-banner status-banner--alerta">
            <div class="status-banner__icon">⚠</div>
            <div><strong>${escapeHtml(opts.error)}</strong></div>
          </div>` : ''}

          <button type="submit" class="btn btn--primary btn--block btn--lg">
            Guardar y arrancar →
          </button>
        </form>
      </div>
    `;
  }

  function bind() {
    const form = document.getElementById('setup-form');
    if (!form) return;
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const url = document.getElementById('setup-url').value.trim();
      const anonKey = document.getElementById('setup-key').value.trim();
      const sedeCodigo = document.getElementById('setup-sede').value;
      const operario = document.getElementById('setup-operario').value.trim();

      try {
        window.SBClient.saveConfig({ url, anonKey, sedeCodigo, operario });
        // Test rápido: cargar áreas
        const areas = await window.AreasService.getAreas({ forceRefresh: true });
        if (!areas || areas.length === 0) {
          window.App.toast('Conectado, pero no hay áreas activas todavía. Verifica con admin.', 'warning');
        } else {
          window.App.toast(`✓ Conectado — ${areas.length} áreas cargadas`, 'success');
        }
        // Solicitar permiso de notificaciones en BACKGROUND (no bloquea navegación).
        // Si el operario no responde el prompt, la app igual avanza a home.
        if (window.RemindersService && !window.RemindersService.wasPermissionAsked()) {
          const state = window.RemindersService.permissionState();
          if (state === 'default') {
            window.RemindersService.requestPermission().then(granted => {
              if (granted === 'granted') {
                window.App.toast('🔔 Recordatorios horarios activados', 'success');
                window.RemindersService.registerPeriodicSync();
                window.RemindersService.startForegroundReminder();
              }
            }).catch(() => {});
          }
        }
        window.App.navigate('home');
      } catch (e) {
        document.getElementById('app').innerHTML = render({ error: e.message });
        bind();
      }
    });
  }

  window.ScreenSetup = { render, bind };
})();
