/* ════════════════════════════════════════════════════════
   TRAZABILIDAD MP→CLIENTE · App principal
   8 vistas: Torre · Guías · Tránsito · Paleticket · Acond. ·
            Túneles · Empaque · Cámara
   ════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  if (window.__ftpAuthOk === false) return; // auth-guard ya redirigió

  // ─── Estado global del módulo ───
  const STATE = {
    currentView: 'torre',
    switchToken: 0, // monotonic counter para invalidar callbacks de vistas obsoletas
    truck: { progress: 0, animationId: null, marker: null, map: null, route: null, totalKm: 0 },
    tunnelTickerId: null,
    clockId: null
  };

  // ─── Constantes ───
  const VIEWS = [
    { k: 'torre',         icon: '📡', label: 'Torre de Control', sub: 'Dashboard ejecutivo' },
    { k: 'guias',         icon: '📄', label: 'Guías SUNAT',      sub: 'OCR + autocompletar' },
    { k: 'transito',      icon: '🚚', label: 'Tránsito Live',    sub: 'Piura → Huaura' },
    { k: 'paleticket',    icon: '🏷️', label: 'Paleticket QR',    sub: 'Recepción' },
    { k: 'acondicionado', icon: '⚙️', label: 'Acondicionado',    sub: 'Hora a hora' },
    { k: 'tuneles',       icon: '❄️', label: 'Túneles',          sub: 'Congelado IQF' },
    { k: 'empaque',       icon: '📦', label: 'Empaque',          sub: 'Cajas + etiquetas' },
    { k: 'camara',        icon: '🏢', label: 'Cámara PT',        sub: 'Mapa de slots' }
  ];

  // ─── Helpers locales ───
  const $ = (sel, ctx) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));

  function fmtN(n, d) { return (typeof formatNum === 'function') ? formatNum(n, d) : (n == null ? '0' : Number(n).toLocaleString('es-PE')); }
  // Escapa contenido para usarse dentro de atributo HTML (p.ej. onclick="fn('${id}')")
  // Previene XSS si los datos vienen de una fuente no confiable (Supabase/usuario).
  function escAttr(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/'/g, '&#39;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
  function fmtDate(date) {
    if (!date) return '—';
    const d = (typeof date === 'string') ? new Date(date) : date;
    if (isNaN(d.getTime())) {
      // Soporte 'YYYY-MM-DD'
      if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        const [y, m, dd] = date.split('-');
        return `${dd}/${m}/${y}`;
      }
      return date;
    }
    return d.toLocaleDateString('es-PE');
  }
  function toast(msg, type) { if (typeof showToast === 'function') showToast(msg, { type: type || 'info' }); else console.log(msg); }
  function statusBadgeClass(estado) {
    const map = {
      'Recibido': 'ok', 'Completado': 'ok', 'Listo': 'ok', 'Pagado': 'ok',
      'En tránsito': 'info', 'En empaque': 'info', 'En túnel': 'info', 'En proceso': 'info', 'En acond.': 'info', 'Cargando': 'info', 'Congelando': 'info',
      'Programado': 'warn', 'En espera': 'warn', 'Pendiente': 'warn',
      'Asignado': 'neutral'
    };
    return 'trz-badge trz-badge-' + (map[estado] || 'neutral');
  }

  /* ════════════════════════════════════════════════════════
     ARRANQUE
     ════════════════════════════════════════════════════════ */
  document.addEventListener('DOMContentLoaded', init);

  function init() {
    if (typeof applyThemeFromStorage === 'function') applyThemeFromStorage('trz_theme');
    renderHubNav();
    startClock();
    initSupabasePing();
    switchView(STATE.currentView);
  }

  function startClock() {
    if (STATE.clockId) clearInterval(STATE.clockId);
    const tick = () => {
      const now = new Date();
      const el = document.getElementById('trzClock');
      if (el) el.textContent = now.toLocaleTimeString('es-PE', { hour12: false });
    };
    tick();
    STATE.clockId = setInterval(tick, 1000);
  }

  function initSupabasePing() {
    const dot = document.getElementById('trzConnDot');
    const lbl = document.getElementById('trzConnLabel');
    if (!dot || !lbl) return;
    if (typeof checkSupabaseConnection === 'function') {
      checkSupabaseConnection().then(ok => {
        dot.classList.add(ok ? 'ok' : 'err');
        lbl.textContent = ok ? 'Supabase OK' : 'Sin conexión';
      }).catch(() => {
        dot.classList.add('err');
        lbl.textContent = 'Sin conexión';
      });
    } else {
      // Si supabase-config.js aún no expone el helper, marcar como modo demo
      dot.classList.add('ok');
      lbl.textContent = 'Modo demo (data mock)';
    }
  }

  /* ════════════════════════════════════════════════════════
     ROUTER DE VISTAS
     ════════════════════════════════════════════════════════ */
  function renderHubNav() {
    const nav = document.getElementById('trzHubNav');
    if (!nav) return;
    nav.innerHTML = VIEWS.map(v => `
      <button class="trz-hub-btn ${STATE.currentView === v.k ? 'active' : ''}"
              data-view="${v.k}" role="tab" aria-selected="${STATE.currentView === v.k}">
        <span class="trz-hub-icon" aria-hidden="true">${v.icon}</span>
        <span class="trz-hub-text">
          <span class="trz-hub-label">${v.label}</span>
          <span class="trz-hub-sub">${v.sub}</span>
        </span>
      </button>
    `).join('');
    nav.addEventListener('click', (e) => {
      const btn = e.target.closest('.trz-hub-btn');
      if (btn) switchView(btn.dataset.view);
    });
  }

  window.trzSwitchView = switchView;
  function switchView(view) {
    stopTruckAnimation();
    stopTunnelTicker();
    // Cleanup Leaflet map al salir (evita leak + handles huérfanos)
    if (STATE.truck.map && typeof STATE.truck.map.remove === 'function') {
      try { STATE.truck.map.remove(); } catch (e) { /* noop */ }
      STATE.truck.map = null;
      STATE.truck.marker = null;
      STATE.truck.route = null;
    }
    const token = ++STATE.switchToken;
    STATE.currentView = view;
    $$('.trz-hub-btn').forEach(b => {
      const isActive = b.dataset.view === view;
      b.classList.toggle('active', isActive);
      b.setAttribute('aria-selected', String(isActive));
    });
    const target = document.getElementById('trzView');
    const r = renderers[view];
    target.innerHTML = r ? r() : '<p class="trz-empty">Vista no disponible</p>';
    const after = afterRenders[view];
    if (after) setTimeout(() => {
      // Si el usuario cambió de vista en estos 50ms, abortar
      if (token !== STATE.switchToken) return;
      after();
    }, 50);
  }

  /* ════════════════════════════════════════════════════════
     VISTA: TORRE DE CONTROL
     ════════════════════════════════════════════════════════ */
  function renderTorre() {
    const t = window.TRZ;
    const guiasEnTransito = t.guiasSunat.filter(g => g.estado === 'En tránsito').length;
    const guiasProgramadas = t.guiasSunat.filter(g => g.estado === 'Programado').length;
    const totalKgEnPlanta = t.paletickets.reduce((s, p) => s + p.pesoNeto, 0);
    const palletsActivos = t.paletickets.length;
    const tunelesActivos = t.tuneles.filter(x => x.estado === 'Congelando').length;
    const tunelesListos = t.tuneles.filter(x => /Listo/.test(x.estado)).length;
    const empaqueActivo = t.ordenesEmpaque.filter(o => o.estado === 'En proceso').length;
    const camaraOcupada = t.camaraSlots.filter(s => s.ocupado).length;
    const camaraTotal = t.camaraSlots.length;
    const camaraPct = Math.round((camaraOcupada / camaraTotal) * 100);

    return `
      <section class="trz-section">
        <header class="trz-section-header">
          <h2>📡 Torre de Control</h2>
          <p>Estado en tiempo real · Cadena de frío · GS1-128 · FSMA 204 · HACCP · EU 178/2002</p>
        </header>

        <div class="trz-kpi-grid">
          ${kpiCard('Guías en tránsito',     guiasEnTransito,                       `${guiasProgramadas} programadas · ETA < 48h`,    '🚚', 'primary')}
          ${kpiCard('Palets activos',        palletsActivos,                         `${(totalKgEnPlanta/1000).toFixed(1)} Tn · lote 17C`, '🟧', 'info')}
          ${kpiCard('Túneles operando',      `${tunelesActivos}/${t.tuneles.length}`, `${tunelesListos} listos · descargar urgente`,    '❄️', 'warn')}
          ${kpiCard('Cámara PT ocupación',   `${camaraPct}%`,                        `${camaraOcupada}/${camaraTotal} slots · ${empaqueActivo} OE empaque`, '🏢', 'danger')}
        </div>

        <article class="trz-card">
          <h3>🔄 Pipeline operativo · estado en tiempo real</h3>
          <div class="trz-pipeline">
            ${[
              { icon: '🤝', count: t.guiasSunat.length, label: 'Guías SUNAT',         sub: 'Total documentadas' },
              { icon: '🚛', count: guiasEnTransito,     label: 'En camino',           sub: 'Piura/Olmos → Vegueta' },
              { icon: '✅', count: palletsActivos,      label: 'Palets recibidos',    sub: 'Lote activo 17C' },
              { icon: '🛠️', count: t.paletickets.filter(p => p.estado === 'En acond.').length, label: 'En acondicionado', sub: 'Calibre + selección' },
              { icon: '🧊', count: tunelesActivos,      label: 'Congelando',          sub: 'IQF 2-3h · -35°C' },
              { icon: '📦', count: empaqueActivo,       label: 'OE en proceso',       sub: 'Cajas con QR cliente' },
              { icon: '🏬', count: camaraOcupada,       label: 'Slots ocupados',      sub: '-22°C continuo' },
              { icon: '🚢', count: t.contenedores.filter(c => c.estado === 'Listo').length, label: 'Contenedores listos', sub: 'Callao · MSC/CMA' }
            ].map((s, i, arr) => `
              <div class="trz-pipe-step">
                <div class="trz-pipe-icon">${s.icon}</div>
                <div class="trz-pipe-count">${s.count}</div>
                <div class="trz-pipe-label">${s.label}</div>
                <div class="trz-pipe-sub">${s.sub}</div>
                ${i < arr.length - 1 ? '<span class="trz-pipe-arrow">›</span>' : ''}
              </div>
            `).join('')}
          </div>
        </article>

        <div class="trz-grid-2">
          <article class="trz-card">
            <h3>📈 Producción IQF · últimas 24 h (Tn)</h3>
            <div class="trz-chart-wrap"><canvas id="trzChartProd"></canvas></div>
          </article>
          <article class="trz-card">
            <h3>🌡️ Temperatura cadena de frío (°C)</h3>
            <div class="trz-chart-wrap"><canvas id="trzChartTemp"></canvas></div>
          </article>
        </div>

        <article class="trz-card trz-ai-card">
          <h3>🧠 Sugerencias del Motor de IA Predictiva</h3>
          <ul class="trz-ai-list">
            <li><span class="trz-ai-tag warn">⚡</span> <b>Túnel #1</b>: tendencia de temperatura indica fin congelado <b>11:48</b> (12 min antes) · liberar para próximo lote.</li>
            <li><span class="trz-ai-tag info">⏱️</span> <b>Recepción</b>: con 19 palets/4h, calcular cuadrilla extra para guía <b>EG07-00004382</b> (palta · ETA 04:00).</li>
            <li><span class="trz-ai-tag ok">🍃</span> <b>Lote 17C</b>: mango pintón estimado <b>+38h</b> a maduración óptima · derivar palets 7-14 a cámara reposo.</li>
            <li><span class="trz-ai-tag danger">🛡️</span> <b>HACCP</b>: 0 desviaciones críticas en últimas 24 h · auditoría BRC lista para próxima inspección.</li>
          </ul>
        </article>
      </section>
    `;
  }

  function afterTorre() {
    if (typeof Chart === 'undefined') return;
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const grid = isDark ? '#1f2937' : '#e2e8f0';
    const text = isDark ? '#94a3b8' : '#64748b';

    const c1 = document.getElementById('trzChartProd');
    if (c1) new Chart(c1.getContext('2d'), {
      type: 'bar',
      data: {
        labels: ['00h','03h','06h','09h','12h','15h','18h','21h'],
        datasets: [{ label: 'Tn IQF', data: [0,0,2.1,4.8,5.6,6.2,5.4,3.1], backgroundColor: '#16a34a', borderRadius: 6 }]
      },
      options: { responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { color: text } } },
        scales: { x: { grid: { color: grid }, ticks: { color: text } }, y: { grid: { color: grid }, ticks: { color: text } } } }
    });

    const c2 = document.getElementById('trzChartTemp');
    if (c2) new Chart(c2.getContext('2d'), {
      type: 'line',
      data: {
        labels: Array.from({ length: 12 }, (_, i) => `${i*2}h`),
        datasets: [
          { label: 'Túnel #1', data: [-2,-12,-22,-31,-34,-35,-35,-34.8,-35,-35,-34.5,-34.2], borderColor: '#3b82f6', tension: 0.3, fill: false },
          { label: 'Túnel #2', data: [-35,-35,-35,-36,-36,-36,-36,-36,-36,-36,-35.8,-36],     borderColor: '#16a34a', tension: 0.3, fill: false },
          { label: 'Cámara PT', data: [-22,-22.1,-22.3,-22.2,-22.4,-22.5,-22.4,-22.6,-22.5,-22.4,-22.5,-22.4], borderColor: '#ef4444', tension: 0.3, fill: false }
        ]
      },
      options: { responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { color: text } } },
        scales: { x: { grid: { color: grid }, ticks: { color: text } }, y: { grid: { color: grid }, ticks: { color: text } } } }
    });
  }

  /* ════════════════════════════════════════════════════════
     VISTA: GUÍAS SUNAT + OCR
     ════════════════════════════════════════════════════════ */
  function renderGuias() {
    const t = window.TRZ;
    return `
      <section class="trz-section">
        <header class="trz-section-header">
          <h2>📄 Guías SUNAT</h2>
          <p>Suba la guía de remisión electrónica (PDF) y autocompletamos los registros internos.</p>
        </header>

        <div class="trz-grid-2">
          <article class="trz-card">
            <h3>☁️ Cargar guía SUNAT (PDF)</h3>
            <div class="trz-dropzone" id="trzDropZone" tabindex="0" role="button" aria-label="Cargar PDF de guía SUNAT">
              <div class="trz-dropzone-icon">📄</div>
              <p class="trz-dropzone-title">Arrastra el PDF aquí</p>
              <p class="trz-dropzone-sub">o haz clic · OCR + parser automáticos</p>
              <input type="file" id="trzFileInput" accept="application/pdf" hidden>
            </div>
            <div id="trzDropStatus" class="trz-drop-status" aria-live="polite"></div>
            <div class="trz-tip">
              <span class="trz-tip-icon">💡</span>
              <div><b>Tip:</b> el sistema extrae automáticamente RUC, remitente, ruta, producto, lote, peso y datos del transportista.
              Si el PDF es escaneado, se usa <b>Tesseract.js</b> como fallback.</div>
            </div>
          </article>

          <article class="trz-card">
            <h3>✨ Datos extraídos · listos para registro</h3>
            <div id="trzOcrFields" class="trz-ocr-fields trz-ocr-empty">
              <div class="trz-ocr-empty-icon">←</div>
              <p>Carga un PDF para autocompletar.</p>
              <button class="trz-btn trz-btn-outline" onclick="trzLoadDemoOcr()">🧪 Cargar demo (EG07-00004381)</button>
            </div>
          </article>
        </div>

        <article class="trz-card">
          <h3>📋 Guías de remisión registradas</h3>
          <div class="trz-table-wrap">
            <table class="ftp-table">
              <thead><tr>
                <th>N° Guía</th><th>Fecha</th><th>Remitente</th><th>Origen</th><th>Producto</th>
                <th class="trz-tar">Peso Neto</th><th class="trz-tar">Palets</th><th>Estado</th><th>Hash</th><th>Acciones</th>
              </tr></thead>
              <tbody>
                ${t.guiasSunat.map(g => `
                  <tr>
                    <td><b>${g.id}</b></td>
                    <td>${fmtDate(g.fechaEmision)}<br><small class="trz-muted">${g.horaEmision || ''}</small></td>
                    <td>${g.remitente.razonSocial}<br><small class="trz-muted">RUC ${g.remitente.ruc}</small></td>
                    <td>${(g.puntoPartida || '').split('·')[0]}</td>
                    <td>${g.producto.fruta} ${g.producto.variedad}<br><small class="trz-muted">Lote ${g.producto.lote} · ${g.producto.tipo}</small></td>
                    <td class="trz-tar"><b>${fmtN(g.pesoNeto)}</b> kg</td>
                    <td class="trz-tar">${g.paletsGenerados || '—'}</td>
                    <td><span class="${statusBadgeClass(g.estado)}">${g.estado}</span></td>
                    <td><code class="trz-hash">${g.hashBlockchain.substring(0, 14)}</code></td>
                    <td>
                      <button class="trz-icon-btn" title="Ver detalle" onclick="trzVerGuia('${escAttr(g.id)}')">👁️</button>
                      <button class="trz-icon-btn" title="Trazabilidad" onclick="trzVerTrazabilidad('${escAttr(g.id)}')">🔗</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </article>
      </section>
    `;
  }

  function afterGuias() {
    const dz = document.getElementById('trzDropZone');
    const input = document.getElementById('trzFileInput');
    if (!dz || !input) return;
    dz.addEventListener('click', () => input.click());
    dz.addEventListener('keypress', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
    dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('drag-over'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('drag-over'));
    dz.addEventListener('drop', async (e) => {
      e.preventDefault(); dz.classList.remove('drag-over');
      const f = e.dataTransfer.files[0];
      if (f) await processPdf(f);
    });
    input.addEventListener('change', async (e) => {
      const f = e.target.files[0];
      if (f) await processPdf(f);
    });
  }

  async function processPdf(file) {
    const status = document.getElementById('trzDropStatus');
    if (!status) return; // usuario cambió de vista mientras se disparaba el handler
    status.innerHTML = `<span class="trz-spinner-inline"></span> Procesando <b>${escAttr(file.name)}</b> (${(file.size/1024).toFixed(0)} KB)…`;
    try {
      if (typeof pdfjsLib === 'undefined') {
        if (document.body.contains(status)) status.innerHTML = `⚠️ PDF.js no disponible · usando datos demo`;
        setTimeout(() => { if (document.getElementById('trzOcrFields')) trzLoadDemoOcr(); }, 600);
        return;
      }
      const ab = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: ab }).promise;
      let text = '';
      for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);
        const c = await page.getTextContent();
        text += c.items.map(it => it.str).join(' ') + '\n';
      }
      // Verificar si la vista sigue activa antes de pintar
      if (!document.body.contains(status) || !document.getElementById('trzOcrFields')) return;
      const parsed = parseSunatText(text);
      if (parsed && parsed.numero) {
        status.innerHTML = `✅ Guía <b>${escAttr(parsed.serie + '-' + parsed.numero)}</b> extraída exitosamente.`;
        paintOcrFields(parsed);
      } else {
        status.innerHTML = `⚠️ Texto extraído pero patrón no reconocido · cargando demo.`;
        setTimeout(() => { if (document.getElementById('trzOcrFields')) trzLoadDemoOcr(); }, 600);
      }
    } catch (err) {
      console.error('[TRZ] OCR error', err);
      if (document.body.contains(status)) status.innerHTML = `❌ Error: ${escAttr(err.message)} · cargando demo.`;
      setTimeout(() => { if (document.getElementById('trzOcrFields')) trzLoadDemoOcr(); }, 600);
    }
  }

  function parseSunatText(text) {
    const grab = (re) => { const m = text.match(re); return m ? m[1].trim() : null; };
    const guia = grab(/N°?\s*(EG\d{2}\s*-\s*\d+)/i);
    if (!guia) return null;
    const fechaEmision = grab(/Fecha y hora de emisi[oó]n\s*:?\s*(\d{2}\/\d{2}\/\d{4})/i);
    const horaEmision = grab(/Fecha y hora de emisi[oó]n\s*:.*?(\d{2}:\d{2}\s*(?:AM|PM)?)/i);
    const fechaInicio = grab(/Fecha de inicio de Traslado\s*:?\s*(\d{2}\/\d{2}\/\d{4})/i);
    const partida = grab(/Punto de Partida\s+([^\n]+?)(?:\s+Motivo|$)/i);
    const llegada = grab(/Punto de llegada\s+([^\n]+?)(?:\s+Datos|$)/i);
    const motivo = grab(/Motivo de Traslado\s*:?\s*([^\n]+?)(?:Punto|$)/i);
    const destinatarioName = grab(/Datos del Destinatario\s*:?\s*([^\-\n]+?)(?:\s*-\s*REGISTRO|$)/i);
    const destRuc = grab(/Datos del Destinatario\s*:.*?CONTRIBUYENTES?\s*N[°º]?\s*(\d{11})/i);
    const remRuc = grab(/RUC\s*N[°º]?\s*(\d{11})/);
    const remName = grab(/^([A-ZÑ&\s\.,]+?(?:S\.?A\.?C\.?|S\.?R\.?L\.?|EIRL|S\.?A\.?))\s+RUC/im);
    const cantidad = grab(/KILOGRAMO\s+([\d,]+\.?\d*)/i);
    const pesoBruto = grab(/Peso Bruto total de la carga\s*:?\s*([\d,]+)/i);
    const lote = grab(/LOTE:?\s*([A-Z0-9\-]+)/);
    const placa = grab(/N[uú]mero de placa\s*:?\s*([A-Z0-9\-]+)/i);
    const conductorNombre = grab(/Principal\s*:?\s*([A-ZÑ\s]+)\s*-\s*DOCUMENTO/i);
    const conductorDni = grab(/DOCUMENTO NACIONAL DE IDENTIDAD\s*N[°º]?\s*(\d{8})/i);
    const transportista = grab(/Datos del transportista[\s\S]+?([A-ZÑ&\s\.,]+?(?:EMPRESA INDIVIDUAL[\s\S]*?LIMITADA|S\.?A\.?C?\.?|S\.?R\.?L\.?|EIRL))/i);
    const tipo = /ORG[ÁA]NICO/i.test(text) ? 'Orgánico' : 'Convencional';
    const variedad = grab(/\((KENT|HASS|EDWARD|TOMMY|HADEN|ATAULFO)\)/i) || 'Kent';
    const fruta = /MANGO/i.test(text) ? 'Mango' : /PALTA|AVOCADO/i.test(text) ? 'Palta' : 'Fruta';

    const [serie, numero] = guia.replace(/\s/g, '').split('-');
    const dmy2iso = (d) => { if (!d) return null; const [dd, mm, yy] = d.split('/'); return `${yy}-${mm}-${dd}`; };
    return {
      guia: guia.replace(/\s/g, ''), serie, numero,
      fechaEmision: dmy2iso(fechaEmision),
      horaEmision: horaEmision || null,
      fechaInicio: dmy2iso(fechaInicio),
      remitente: { razonSocial: remName || '—', ruc: remRuc || '—' },
      destinatario: { razonSocial: destinatarioName || 'FRUTOS TROPICALES PERU EXPORT S.A.C.', ruc: destRuc || '20607892955' },
      puntoPartida: partida || '—',
      puntoLlegada: llegada || '—',
      motivo: motivo || 'Venta sujeta a confirmación del comprador',
      producto: { fruta, variedad, tipo, lote: lote || '—' },
      cantidad: cantidad ? parseFloat(cantidad.replace(/,/g, '')) : null,
      pesoBruto: pesoBruto ? parseFloat(pesoBruto.replace(/,/g, '')) : null,
      transportista: transportista ? transportista.trim() : '—',
      placa: placa || '—',
      conductorNombre: conductorNombre || '—',
      conductorDni: conductorDni || '—'
    };
  }

  window.trzLoadDemoOcr = function () {
    const g = window.TRZ.guiasSunat[0];
    paintOcrFields({
      guia: g.id, serie: g.serie, numero: g.numero,
      fechaEmision: g.fechaEmision, horaEmision: g.horaEmision, fechaInicio: g.fechaInicio,
      remitente: g.remitente, destinatario: g.destinatario,
      puntoPartida: g.puntoPartida, puntoLlegada: g.puntoLlegada, motivo: g.motivo,
      producto: g.producto,
      cantidad: g.pesoNeto, pesoBruto: g.pesoBruto,
      transportista: 'AGROTRANSPORTES E INVERSIONES J. BERRU EIRL',
      placa: g.vehiculoPlaca,
      conductorNombre: 'Maximino Alberto Acosta García',
      conductorDni: g.conductorDni
    });
    const status = document.getElementById('trzDropStatus');
    if (status) status.innerHTML = `🧪 Demo cargada · datos guía <b>${g.id}</b>`;
  };

  function paintOcrFields(d) {
    const target = document.getElementById('trzOcrFields');
    if (!target) return;
    target.classList.remove('trz-ocr-empty');
    target.innerHTML = `
      <div class="trz-ocr-grid">
        ${ocrField('N° Guía', `<b>${d.guia || '—'}</b>`)}
        ${ocrField('Fecha emisión', `${d.fechaEmision ? fmtDate(d.fechaEmision) : '—'} ${d.horaEmision || ''}`)}
        ${ocrField('Remitente', `${d.remitente?.razonSocial || '—'}<br><small class="trz-muted">RUC ${d.remitente?.ruc || '—'}</small>`)}
        ${ocrField('Destinatario', `${d.destinatario?.razonSocial || '—'}<br><small class="trz-muted">RUC ${d.destinatario?.ruc || '—'}</small>`)}
        ${ocrField('Punto de partida', d.puntoPartida || '—')}
        ${ocrField('Punto de llegada', d.puntoLlegada || '—')}
        ${ocrField('Producto', `${d.producto?.fruta || '—'} ${d.producto?.variedad || ''} <span class="trz-badge trz-badge-info">${d.producto?.tipo || ''}</span>`)}
        ${ocrField('Lote', `<code>${d.producto?.lote || '—'}</code>`)}
        ${ocrField('Peso neto', `<b>${d.cantidad ? fmtN(d.cantidad) : '—'}</b> kg`)}
        ${ocrField('Peso bruto', `${d.pesoBruto ? fmtN(d.pesoBruto) : '—'} kg`)}
        ${ocrField('Transportista', d.transportista || '—')}
        ${ocrField('Placa', `<code>${d.placa || '—'}</code>`)}
        ${ocrField('Conductor', `${d.conductorNombre || '—'} <small class="trz-muted">DNI ${d.conductorDni || '—'}</small>`, true)}
      </div>
      <div class="trz-ocr-actions">
        <button class="trz-btn trz-btn-primary" onclick="trzConfirmGuia('${escAttr(d.guia)}')">✓ Confirmar y registrar</button>
        <button class="trz-btn trz-btn-outline" onclick="trzGenerarPaletickets('${escAttr(d.guia)}', ${Number(d.cantidad) || 0})">🏷️ Generar Paletickets</button>
      </div>
    `;
  }
  function ocrField(label, value, full) {
    return `<div class="trz-ocr-field${full ? ' trz-ocr-field-full' : ''}"><label>${label}</label><div>${value}</div></div>`;
  }

  window.trzConfirmGuia = (guia) => toast(`Guía ${guia} ingresada al sistema`, 'success');
  window.trzGenerarPaletickets = (guia, kg) => {
    const numPalets = Math.ceil(kg / 1000);
    toast(`${numPalets} palets serán generados al confirmar recepción`, 'info');
    setTimeout(() => switchView('paleticket'), 600);
  };
  window.trzVerGuia = (id) => {
    const g = window.TRZ.guiasSunat.find(x => x.id === id);
    if (!g) return;
    const desc = g.producto?.descripcion || `${g.producto?.fruta || ''} ${g.producto?.variedad || ''} ${g.producto?.tipo ? '(' + g.producto.tipo + ')' : ''}`.trim() || '—';
    openModal(`📄 Guía ${g.id}`, `
      <p><b>Remitente:</b> ${g.remitente?.razonSocial || '—'} · RUC ${g.remitente?.ruc || '—'}</p>
      <p><b>Destinatario:</b> ${g.destinatario?.razonSocial || '—'} · RUC ${g.destinatario?.ruc || '—'}</p>
      <p><b>Ruta:</b> ${g.puntoPartida || '—'} → ${g.puntoLlegada || '—'}</p>
      <p><b>Producto:</b> ${desc}</p>
      <p><b>Lote:</b> ${g.producto?.lote || '—'} · <b>Peso neto:</b> ${fmtN(g.pesoNeto)} kg · <b>Peso bruto:</b> ${fmtN(g.pesoBruto)} kg · <b>Mallas:</b> ${g.mallas || '—'}</p>
      <p><b>Vehículo:</b> ${g.vehiculoPlaca || '—'} · <b>ETA:</b> ${g.eta || '—'}</p>
      <p><b>Estado:</b> <span class="${statusBadgeClass(g.estado)}">${g.estado}</span></p>
      <p><b>Hash blockchain:</b> <code>${g.hashBlockchain || '—'}</code></p>
    `);
  };
  window.trzVerTrazabilidad = (id) => {
    const ev = window.TRZ.eventos;
    const lista = ev.map(e => `
      <li class="trz-tl-event">
        <div class="trz-tl-time">${e.ts}</div>
        <div class="trz-tl-actor">⚪ ${e.actor}</div>
        <div class="trz-tl-action">${e.accion}</div>
        <div class="trz-tl-hash"><code>${e.hash}</code></div>
      </li>`).join('');
    openModal(`🔗 Trazabilidad blockchain · ${id}`, `<ul class="trz-timeline">${lista}</ul>`);
  };

  /* ════════════════════════════════════════════════════════
     VISTA: TRÁNSITO LIVE
     ════════════════════════════════════════════════════════ */
  function renderTransito() {
    const t = window.TRZ;
    return `
      <section class="trz-section">
        <header class="trz-section-header">
          <h2>🚚 Tránsito Live</h2>
          <p>Camión B4R-935 · Tropical Food Inc → FTP Vegueta · 18,870 kg mango Kent orgánico</p>
        </header>

        <div class="trz-transit-layout">
          <article class="trz-card trz-card-flush">
            <div id="trzMap" class="trz-map"></div>
          </article>

          <article class="trz-card">
            <h3>🚛 Camión en ruta</h3>
            <div class="trz-truck-info">
              <div class="trz-truck-row"><span>🪪</span> <b>B4R-935</b> · Volvo FH-440</div>
              <div class="trz-truck-row"><span>👤</span> M.A. Acosta García · DNI 15953605</div>
              <div class="trz-truck-row"><span>🥭</span> 18,870 kg · Mango Kent Orgánico · Lote 17C</div>
            </div>
            <hr class="trz-hr">
            <div class="trz-eta-grid">
              <div><label>Origen</label><div>Tambo Grande</div></div>
              <div><label>Destino</label><div>Vegueta · Huaura</div></div>
              <div><label>Distancia</label><div><b id="trzDist">— km</b></div></div>
              <div><label>Velocidad</label><div><b>65 km/h</b></div></div>
              <div><label>ETA</label><div><b id="trzEta" class="trz-text-primary">— h</b></div></div>
              <div><label>Avance</label><div><b id="trzPct">0%</b></div></div>
            </div>
            <hr class="trz-hr">
            <div class="trz-truck-actions">
              <button class="trz-btn trz-btn-primary" id="trzPlayBtn" onclick="trzToggleAnim()">▶ Iniciar simulación</button>
              <button class="trz-btn trz-btn-outline" onclick="trzResetAnim()">↺ Reiniciar</button>
            </div>

            <hr class="trz-hr">
            <h3>📋 Eventos en ruta</h3>
            <ul class="trz-events" id="trzEvents">
              <li class="trz-event done">✅ 19/02 19:55 · Salida de Tambo Grande</li>
              <li class="trz-event">⚪ 20/02 04:30 · Paso Olmos</li>
              <li class="trz-event">⚪ 20/02 12:15 · Paso Trujillo</li>
              <li class="trz-event">⚪ 20/02 22:00 · Paso Huacho</li>
              <li class="trz-event">🏁 21/02 06:30 · Llegada FTP Vegueta</li>
            </ul>
          </article>
        </div>

        <article class="trz-card">
          <h3>🛻 Tránsito multi-flota</h3>
          <div class="trz-fleet-grid">
            ${t.guiasSunat.map(g => `
              <div class="trz-fleet-card">
                <div class="trz-fleet-head">
                  <span class="${statusBadgeClass(g.estado)}">${g.estado}</span>
                  <code>${g.vehiculoPlaca}</code>
                </div>
                <h4>${g.id}</h4>
                <div>📍 ${(g.puntoPartida || '').split('·')[0]} → ${(g.puntoLlegada || '').split('·')[0]}</div>
                <div>📦 ${g.producto.fruta} ${g.producto.variedad} · ${fmtN(g.pesoNeto)} kg</div>
                <div>⏰ ETA: <b>${g.eta || '—'}</b></div>
              </div>
            `).join('')}
          </div>
        </article>
      </section>
    `;
  }

  function afterTransito() {
    const mapEl = document.getElementById('trzMap');
    if (!mapEl) return;
    if (typeof L === 'undefined') {
      mapEl.innerHTML = `<div class="trz-map-fallback">
        <div class="trz-map-fb-icon">🗺️</div>
        <p><b>Leaflet no disponible offline.</b></p>
        <p class="trz-muted">El mapa cargará cuando haya conexión a internet.</p>
      </div>`;
      return;
    }
    const map = L.map('trzMap', { zoomControl: true }).setView([-8.5, -78.5], 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18, attribution: '© OpenStreetMap'
    }).addTo(map);

    const piura    = L.latLng(-4.9230, -80.3408);
    const olmos    = L.latLng(-5.9893, -79.7479);
    const trujillo = L.latLng(-8.1116, -79.0287);
    const huacho   = L.latLng(-11.1067, -77.6050);
    const huaura   = L.latLng(-11.0270, -77.6478);

    L.marker(piura).bindPopup('<b>Tambo Grande · Piura</b><br>Tropical Food Inc S.A.C.').addTo(map);
    L.marker(huaura).bindPopup('<b>Vegueta · Huaura</b><br>FTP Frutos Tropicales Perú Export').addTo(map);

    const route = [piura, olmos, trujillo, huacho, huaura];
    L.polyline(route, { color: '#16a34a', weight: 4, opacity: 0.7, dashArray: '8, 8' }).addTo(map);

    const truckIcon = L.divIcon({
      html: `<div class="trz-truck-marker">🚛</div>`,
      className: 'trz-truck-marker-wrapper',
      iconSize: [44, 44], iconAnchor: [22, 22]
    });
    STATE.truck.marker = L.marker(piura, { icon: truckIcon }).addTo(map);
    STATE.truck.map = map;
    STATE.truck.route = route;

    setTimeout(() => map.fitBounds(route, { padding: [40, 40] }), 100);

    let totalKm = 0;
    for (let i = 1; i < route.length; i++) totalKm += route[i-1].distanceTo(route[i]) / 1000;
    STATE.truck.totalKm = totalKm;
    const distEl = document.getElementById('trzDist'); if (distEl) distEl.textContent = `${totalKm.toFixed(0)} km`;
    const etaEl  = document.getElementById('trzEta');  if (etaEl)  etaEl.textContent  = `${(totalKm/65).toFixed(1)} h`;
  }

  window.trzToggleAnim = function () {
    const btn = document.getElementById('trzPlayBtn');
    if (STATE.truck.animationId) {
      stopTruckAnimation();
      if (btn) btn.innerHTML = '▶ Continuar';
      return;
    }
    if (btn) btn.innerHTML = '⏸ Pausar';
    animateTruck();
  };
  window.trzResetAnim = function () {
    stopTruckAnimation();
    STATE.truck.progress = 0;
    if (STATE.truck.marker && STATE.truck.route) STATE.truck.marker.setLatLng(STATE.truck.route[0]);
    const pct = document.getElementById('trzPct'); if (pct) pct.textContent = '0%';
    const eta = document.getElementById('trzEta'); if (eta) eta.textContent = `${(STATE.truck.totalKm/65).toFixed(1)} h`;
    $$('#trzEvents .trz-event').forEach((el, i) => el.classList.toggle('done', i === 0));
    const btn = document.getElementById('trzPlayBtn'); if (btn) btn.innerHTML = '▶ Iniciar simulación';
  };

  function animateTruck() {
    const route = STATE.truck.route;
    if (!route || !STATE.truck.marker) return;
    const SEG_DURATIONS = [120, 280, 220, 80];
    const totalT = SEG_DURATIONS.reduce((a, b) => a + b, 0);
    const SPEED = 0.0008;
    const tick = () => {
      STATE.truck.progress = Math.min(1, STATE.truck.progress + SPEED);
      const p = STATE.truck.progress;
      let acc = 0, segIdx = 0;
      const tProg = p * totalT;
      while (segIdx < SEG_DURATIONS.length && acc + SEG_DURATIONS[segIdx] < tProg) {
        acc += SEG_DURATIONS[segIdx]; segIdx++;
      }
      if (segIdx >= route.length - 1) segIdx = route.length - 2;
      const segP = (tProg - acc) / SEG_DURATIONS[segIdx];
      const a = route[segIdx], b = route[segIdx + 1];
      STATE.truck.marker.setLatLng([a.lat + (b.lat - a.lat) * segP, a.lng + (b.lng - a.lng) * segP]);
      const pctEl = document.getElementById('trzPct'); if (pctEl) pctEl.textContent = Math.round(p * 100) + '%';
      const etaEl = document.getElementById('trzEta'); if (etaEl) etaEl.textContent = ((1 - p) * (STATE.truck.totalKm / 65)).toFixed(2) + ' h';
      const events = $$('#trzEvents .trz-event');
      const milestones = [0, 0.18, 0.55, 0.85, 1];
      events.forEach((el, i) => el.classList.toggle('done', p >= milestones[i]));
      if (p < 1) STATE.truck.animationId = requestAnimationFrame(tick);
      else {
        stopTruckAnimation();
        const btn = document.getElementById('trzPlayBtn'); if (btn) btn.innerHTML = '🏁 Llegada';
        toast('Camión B4R-935 arribó a FTP Vegueta · iniciar recepción', 'success');
      }
    };
    STATE.truck.animationId = requestAnimationFrame(tick);
  }
  function stopTruckAnimation() { if (STATE.truck.animationId) { cancelAnimationFrame(STATE.truck.animationId); STATE.truck.animationId = null; } }

  /* ════════════════════════════════════════════════════════
     VISTA: PALETICKET QR
     ════════════════════════════════════════════════════════ */
  function renderPaleticket() {
    const t = window.TRZ;
    const totals = t.paletickets.reduce((acc, p) => ({
      jabas: acc.jabas + p.nJabas,
      bruto: acc.bruto + p.pesoBruto,
      palet: acc.palet + p.pesoPalet,
      neto:  acc.neto  + p.pesoNeto
    }), { jabas: 0, bruto: 0, palet: 0, neto: 0 });

    return `
      <section class="trz-section">
        <header class="trz-section-header">
          <h2>🏷️ Paleticket QR</h2>
          <p>Guía activa: <b>EG07-00004381</b> · 19 palets · Mango Kent Orgánico · Lote 17C</p>
          <div class="trz-actions-inline">
            <button class="trz-btn trz-btn-outline" onclick="trzPrintAll()">🖨️ Imprimir TODO</button>
            <button class="trz-btn trz-btn-primary" onclick="trzExportPalZip()">📦 Exportar PDF</button>
          </div>
        </header>

        <div class="trz-paleticket-grid">
          ${t.paletickets.map(p => paleticketHtml(p)).join('')}
        </div>

        <article class="trz-card">
          <h3>📊 Reporte de recepción · resumen</h3>
          <div class="trz-table-wrap">
            <table class="ftp-table trz-recep-table">
              <thead><tr>
                <th>N° Palet</th><th>Lote/F.</th><th>Cod. Trazab.</th><th>Hora</th>
                <th class="trz-tar">Jabas</th><th class="trz-tar">Bruto</th><th class="trz-tar">Palet</th><th class="trz-tar">Neto</th>
                <th>Madurez/Destino</th><th>Estado</th>
              </tr></thead>
              <tbody>
                ${t.paletickets.map(p => `
                  <tr>
                    <td><b>${p.numeroPalet}</b></td>
                    <td><code>${p.lote} ${fmtDate(p.fechaIngreso)}</code></td>
                    <td><code class="trz-hash">${p.codTrazabilidad}</code></td>
                    <td>${p.horaRegistro}</td>
                    <td class="trz-tar">${p.nJabas}</td>
                    <td class="trz-tar">${fmtN(p.pesoBruto)}</td>
                    <td class="trz-tar">${p.pesoPalet}</td>
                    <td class="trz-tar"><b>${fmtN(p.pesoNeto)}</b></td>
                    <td>${p.madurez} / ${p.destino}</td>
                    <td><span class="${statusBadgeClass(p.estado)}">${p.estado}</span></td>
                  </tr>
                `).join('')}
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="4"><b>TOTAL</b></td>
                  <td class="trz-tar"><b>${totals.jabas}</b></td>
                  <td class="trz-tar"><b>${fmtN(totals.bruto)}</b></td>
                  <td class="trz-tar"><b>${fmtN(totals.palet)}</b></td>
                  <td class="trz-tar"><b>${fmtN(totals.neto)}</b></td>
                  <td colspan="2"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </article>
      </section>
    `;
  }

  function paleticketHtml(p) {
    return `
      <div class="trz-paleticket" data-id="${p.id}">
        <div class="trz-pt-header">
          <div class="trz-pt-logo">FTP</div>
          <div class="trz-pt-title">PALETICKET DE MATERIA PRIMA</div>
          <div class="trz-pt-original">ORIGINAL</div>
        </div>
        <div class="trz-pt-body">
          <div class="trz-pt-fields">
            <div class="trz-pt-row"><b>PRODUCTO:</b> MANGO ✓ <span class="trz-pt-checks">PALTA □ FRESA □ OTROS ____</span></div>
            <div class="trz-pt-row"><b>VIAJE:</b> ${p.viaje} <span class="trz-pt-r">N° PALET: <b class="trz-pt-numero">${p.numeroPalet}</b></span></div>
            <div class="trz-pt-row"><b>TIPO:</b> ${p.tipo.toUpperCase()}</div>
            <div class="trz-pt-row"><b>VARIEDAD:</b> ${p.variedad}</div>
            <div class="trz-pt-row"><b>FECHA DE ING.:</b> ${fmtDate(p.fechaIngreso)}</div>
            <div class="trz-pt-row"><b>JULIANO DE ING.:</b> ${p.julianoIngreso}</div>
            <div class="trz-pt-row"><b>LOTE:</b> ${p.lote}</div>
            <div class="trz-pt-row"><b>PROVEEDOR:</b> ${p.proveedor}</div>
            <div class="trz-pt-row"><b>COD. DE TRAZABILIDAD:</b> <code>${p.codTrazabilidad}</code></div>
            <div class="trz-pt-row"><b>F. MADURACIÓN:</b> ${p.fechaMaduracion || '___________'}</div>
          </div>
          <div class="trz-pt-qr"><div class="trz-pt-qrbox" id="qr-${p.id}"></div></div>
        </div>
        <div class="trz-pt-table">
          <table>
            <thead>
              <tr><th colspan="4">DATOS</th><th colspan="2">OBSERVACIONES</th></tr>
              <tr><th>JABAS</th><th>BRUTO</th><th>PALET</th><th>NETO</th><th colspan="2">MADUREZ / DESTINO</th></tr>
            </thead>
            <tbody><tr>
              <td>${p.nJabas}</td>
              <td>${fmtN(p.pesoBruto)}</td>
              <td>${p.pesoPalet}</td>
              <td><b>${fmtN(p.pesoNeto)}</b></td>
              <td colspan="2">${p.madurez} / ${p.destino}</td>
            </tr></tbody>
          </table>
        </div>
        <div class="trz-pt-footer">
          <span>FTP.PDG.FRT.13.003</span>
          <i>Confidencial: prohibido reproducir total o parcialmente sin autorización del G.G.</i>
          <span>v01</span>
        </div>
        <div class="trz-pt-actions">
          <button class="trz-btn trz-btn-outline trz-btn-sm" onclick="trzPrintPalet('${escAttr(p.id)}')">🖨️ Imprimir</button>
          <button class="trz-btn trz-btn-outline trz-btn-sm" onclick="trzScanPalet('${escAttr(p.id)}')">📷 Escanear</button>
        </div>
      </div>
    `;
  }

  function afterPaleticket() {
    if (typeof QRCode !== 'undefined') {
      window.TRZ.paletickets.forEach(p => {
        const div = document.getElementById(`qr-${p.id}`);
        if (div && !div.firstChild) {
          try { new QRCode(div, { text: p.qrPayload, width: 90, height: 90, correctLevel: QRCode.CorrectLevel.M }); }
          catch (e) { console.warn('[TRZ] QR err', e); }
        }
      });
    } else {
      window.TRZ.paletickets.forEach(p => {
        const div = document.getElementById(`qr-${p.id}`);
        if (div) div.innerHTML = `<div class="trz-qr-fallback">QR<br><small>${p.numeroPalet}</small></div>`;
      });
    }
  }

  window.trzPrintAll      = () => { toast('19 paletickets enviados a Zebra ZT411', 'info'); setTimeout(() => window.print(), 400); };
  window.trzExportPalZip  = () => toast('19 paletickets generados en PDF', 'success');
  window.trzPrintPalet    = (id) => toast(`Paleticket ${id.split('-').pop()} enviado a Zebra ZT411`, 'info');
  window.trzScanPalet     = (id) => {
    const p = window.TRZ.paletickets.find(x => x.id === id);
    if (!p) return;
    openModal(`📷 Escaneo simulado · Palet ${p.numeroPalet}`, `
      <div class="trz-scan-success">✅ QR validado · trazabilidad confirmada</div>
      <p><b>Producto:</b> ${p.variedad} ${p.tipo} · ${fmtN(p.pesoNeto)} kg</p>
      <p><b>Lote:</b> ${p.lote} · <b>Cod. Traz.:</b> <code>${p.codTrazabilidad}</code></p>
      <p><b>Madurez:</b> ${p.madurez} → <b>Destino:</b> ${p.destino}</p>
      <p><b>Estado actual:</b> <span class="${statusBadgeClass(p.estado)}">${p.estado}</span></p>
    `, [
      { label: '→ Avanzar etapa', cls: 'trz-btn-primary', onclick: `closeModal(); trzAdvance('${escAttr(id)}')` }
    ]);
  };
  window.trzAdvance = (id) => toast(`Palet ${id.split('-').pop()} avanzó a la siguiente etapa`, 'success');

  /* ════════════════════════════════════════════════════════
     VISTA: ACONDICIONADO
     ════════════════════════════════════════════════════════ */
  function renderAcondicionado() {
    const t = window.TRZ;
    const enAcond  = t.paletickets.filter(p => p.estado === 'En acond.');
    const enEspera = t.paletickets.filter(p => p.estado === 'En espera');
    const total = t.paletickets.length;

    return `
      <section class="trz-section">
        <header class="trz-section-header">
          <h2>⚙️ Acondicionado</h2>
          <p>Sala de acondicionamiento · selección, calibre y pesado · escaneo QR en cada ingreso</p>
        </header>

        <div class="trz-kpi-grid">
          ${kpiCard('En proceso', enAcond.length, `${fmtN(enAcond.reduce((s,p) => s+p.pesoNeto, 0))} kg activos`, '⚙️', 'info')}
          ${kpiCard('En espera',  enEspera.length, 'Listos para escanear', '⏳', 'warn')}
          ${kpiCard('Avance del lote', `${Math.round((1 - enEspera.length/total)*100)}%`, `${total - enEspera.length}/${total} liberados`, '📊', 'primary')}
          ${kpiCard('Kg/h-h',     128, 'Productividad / operario', '📈', 'danger')}
        </div>

        <article class="trz-card">
          <div class="trz-acond-header">
            <div><label>Producto</label><div>MANGO</div></div>
            <div><label>Tipo</label><div>Orgánico ✓</div></div>
            <div><label>Fecha</label><div>${fmtDate('2026-02-21')}</div></div>
            <div><label>Juliano</label><div>52</div></div>
            <div><label>Turno</label><div>DÍA</div></div>
            <div><label>Hora inicio</label><div><b>07:12</b></div></div>
            <div><label>Hora final est.</label><div>11:30</div></div>
            <div><label>Operarios</label><div><b>14</b></div></div>
            <div><label>Kg/Hr</label><div><b>1,820</b></div></div>
          </div>
          <div class="trz-actions-inline">
            <button class="trz-btn trz-btn-outline" onclick="trzScanInput()">📷 Escanear QR</button>
            <button class="trz-btn trz-btn-primary" onclick="trzAcondNew()">+ Nuevo registro</button>
          </div>

          <div class="trz-acond-grid">
            ${t.paletickets.slice(0, 12).map(p => `
              <div class="trz-acond-card ${p.estado === 'En acond.' ? 'active' : p.estado === 'En espera' ? 'waiting' : 'done'}">
                <div class="trz-acond-card-head">
                  <span class="trz-acond-num">P${p.numeroPalet}</span>
                  <span class="${statusBadgeClass(p.estado)}">${p.estado}</span>
                </div>
                <div class="trz-acond-card-body">
                  <div>⚖️ ${fmtN(p.pesoNeto)} kg</div>
                  <div>✂️ Chunks 19mm</div>
                  <div>❄️ Por congelar: ${p.estado === 'En empaque' || p.estado === 'En túnel' ? Math.round(p.pesoNeto * 0.92) : '—'} kg</div>
                  <div>🎯 Rend.: ${p.estado === 'En empaque' || p.estado === 'En túnel' ? '92.3%' : '—'}</div>
                  <div>👥 4 op</div>
                  <div>📈 158 kg/h-h</div>
                </div>
              </div>
            `).join('')}
          </div>
        </article>

        <article class="trz-card">
          <h3>📈 Consumo de materia prima · hora a hora</h3>
          <div class="trz-chart-wrap"><canvas id="trzAcondChart"></canvas></div>
        </article>
      </section>
    `;
  }

  function afterAcondicionado() {
    if (typeof Chart === 'undefined') return;
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const grid = isDark ? '#1f2937' : '#e2e8f0';
    const text = isDark ? '#94a3b8' : '#64748b';
    const c = document.getElementById('trzAcondChart');
    if (c) new Chart(c.getContext('2d'), {
      type: 'line',
      data: {
        labels: ['07h','08h','09h','10h','11h','12h','13h','14h','15h'],
        datasets: [
          { label: 'Kg ingresados', data: [1000,1820,1820,1820,1700,1500,1820,1820,1500], borderColor: '#16a34a', backgroundColor: 'rgba(22,163,74,0.15)', tension: 0.3, fill: true },
          { label: 'Kg congelados', data: [0, 0, 920, 1675, 1675, 1564, 1380, 1675, 1675],   borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.10)', tension: 0.3, fill: true }
        ]
      },
      options: { responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { color: text } } },
        scales: { x: { grid: { color: grid }, ticks: { color: text } }, y: { grid: { color: grid }, ticks: { color: text } } } }
    });
  }

  window.trzScanInput = () => {
    openModal('📷 Esperando escaneo…', `
      <div class="trz-scan-wait">
        <div class="trz-barcode-anim">||||  |  ||||  ||  ||||</div>
        <p><b>Apunta el escáner Zebra DS3608-ER al paleticket</b></p>
        <p class="trz-muted">Simulación: usa el botón abajo para procesar palet aleatorio</p>
      </div>
    `, [
      { label: '⚡ Procesar', cls: 'trz-btn-primary', onclick: `trzScanRandomPalet()` }
    ]);
  };
  // Helper extraído para evitar inyección compleja en string onclick
  // y para guard si no hay paletickets cargados.
  window.trzScanRandomPalet = function () {
    closeModal();
    const ps = window.TRZ?.paletickets;
    if (!ps || !ps.length) { toast('Sin paletickets para escanear', 'warn'); return; }
    const p = ps[Math.floor(Math.random() * ps.length)];
    trzScanPalet(p.id);
  };
  window.trzAcondNew = () => toast('Formulario de acondicionado abierto · datos auto desde QR', 'info');

  /* ════════════════════════════════════════════════════════
     VISTA: TÚNELES
     ════════════════════════════════════════════════════════ */
  function renderTuneles() {
    const t = window.TRZ;
    return `
      <section class="trz-section">
        <header class="trz-section-header">
          <h2>❄️ Túneles de Congelado IQF</h2>
          <p>Planta Vegueta · 3 túneles estáticos · sondas LoRaWAN -40°C · ANDON visual</p>
          <div class="trz-actions-inline">
            <button class="trz-btn trz-btn-outline" onclick="trzAsignarTunel()">↔ Asignación auto IA</button>
          </div>
        </header>

        <div class="trz-tunnels-grid">
          ${t.tuneles.map(tu => tunnelCard(tu)).join('')}
        </div>

        <article class="trz-card">
          <h3>🕒 Histórico de carga · últimas 24 h</h3>
          <div class="trz-table-wrap">
            <table class="ftp-table">
              <thead><tr>
                <th>Túnel</th><th>Lote</th><th>Inicio</th><th>Fin</th><th class="trz-tar">Palets</th>
                <th class="trz-tar">Kg</th><th class="trz-tar">Tiempo</th><th>Temp. final</th><th>Estado</th>
              </tr></thead>
              <tbody>
                <tr><td><b>T1</b></td><td>17C-01</td><td>09:30</td><td>12:00</td><td class="trz-tar">6</td><td class="trz-tar">5,520</td><td class="trz-tar">2h 30m</td><td>-35.0°C</td><td><span class="trz-badge trz-badge-info">En curso</span></td></tr>
                <tr><td><b>T2</b></td><td>16B-04</td><td>06:30</td><td>09:00</td><td class="trz-tar">4</td><td class="trz-tar">3,680</td><td class="trz-tar">2h 30m</td><td>-36.0°C</td><td><span class="trz-badge trz-badge-warn">Listo</span></td></tr>
                <tr><td><b>T3</b></td><td>17C-02</td><td>—</td><td>—</td><td class="trz-tar">2</td><td class="trz-tar">1,840</td><td class="trz-tar">—</td><td>4.5°C</td><td><span class="trz-badge trz-badge-neutral">Cargando</span></td></tr>
                <tr><td><b>T1</b></td><td>16B-03</td><td>02:00</td><td>05:30</td><td class="trz-tar">8</td><td class="trz-tar">7,360</td><td class="trz-tar">3h 30m</td><td>-35.5°C</td><td><span class="trz-badge trz-badge-ok">Completado</span></td></tr>
              </tbody>
            </table>
          </div>
        </article>
      </section>
    `;
  }

  function tunnelCard(tu) {
    const enCarga = tu.estado === 'Cargando';
    const congelando = tu.estado === 'Congelando';
    const listo = /Listo/.test(tu.estado);
    let cls = 'idle';
    if (enCarga) cls = 'loading';
    else if (congelando) cls = 'freezing';
    else if (listo) cls = 'ready';
    return `
      <div class="trz-tunnel-card trz-tunnel-${cls}">
        <div class="trz-tunnel-head">
          <div class="trz-tunnel-id">${tu.nombre}</div>
          <div class="trz-tunnel-status">${tu.estado}</div>
        </div>
        <div class="trz-tunnel-body">
          <div class="trz-tunnel-temp">
            <div class="trz-temp-actual ${tu.tempActual > 0 ? 'warm' : ''}">${tu.tempActual.toFixed(1)}°C</div>
            <div class="trz-temp-obj">objetivo ${tu.tempObjetivo}°C</div>
          </div>
          <div class="trz-progress"><div class="trz-progress-fill" style="width: ${tu.progreso}%"></div></div>
          <div class="trz-progress-label">${tu.progreso}% · ${tu.palets.length}/${tu.capacidadPalets} palets</div>
          <div class="trz-tunnel-meta">
            <div>🌡️ ${tu.tempActual.toFixed(1)}°C</div>
            <div>💧 ${tu.humedad}% RH</div>
            <div>🕒 ${tu.estimadoFin || '—'}</div>
          </div>
          <div class="trz-tunnel-pallets">
            ${Array.from({length: tu.capacidadPalets}, (_, i) => {
              const occ = i < tu.palets.length;
              return `<div class="trz-pallet-slot ${occ ? 'occupied' : ''}" title="${occ ? tu.palets[i] : 'Vacío'}">📦</div>`;
            }).join('')}
          </div>
        </div>
        <div class="trz-tunnel-actions">
          ${enCarga    ? `<button class="trz-btn trz-btn-primary trz-btn-sm" onclick="trzTunnelStart('${tu.id}')">▶ Iniciar congelado</button>` : ''}
          ${listo      ? `<button class="trz-btn trz-btn-warning trz-btn-sm" onclick="trzTunnelUnload('${tu.id}')">↑ Descargar</button>` : ''}
          <button class="trz-btn trz-btn-outline trz-btn-sm" onclick="trzTunnelDetail('${tu.id}')">👁️ Detalle</button>
        </div>
      </div>
    `;
  }

  function afterTuneles() { startTunnelTicker(); }
  function startTunnelTicker() {
    stopTunnelTicker();
    STATE.tunnelTickerId = setInterval(() => {
      $$('.trz-tunnel-freezing .trz-progress-fill').forEach(el => {
        const w = parseFloat(el.style.width) || 0;
        if (w < 99) el.style.width = (w + 0.2) + '%';
      });
    }, 1500);
  }
  function stopTunnelTicker() { if (STATE.tunnelTickerId) { clearInterval(STATE.tunnelTickerId); STATE.tunnelTickerId = null; } }

  window.trzAsignarTunel = () => toast('IA asignó palets P07-P08 a Túnel #3', 'success');
  window.trzTunnelStart  = (id) => toast(`${id} comenzó ciclo IQF · ETA 2h 30m`, 'info');
  window.trzTunnelUnload = (id) => toast(`${id} liberado · palets a Cámara PT`, 'success');
  window.trzTunnelDetail = (id) => {
    const tu = window.TRZ.tuneles.find(x => x.id === id);
    if (!tu) return;
    openModal(`❄️ ${tu.nombre} · Detalle`, `
      <p><b>Estado:</b> ${tu.estado}</p>
      <p><b>Temperatura actual:</b> ${tu.tempActual}°C · objetivo ${tu.tempObjetivo}°C</p>
      <p><b>Humedad:</b> ${tu.humedad}% RH</p>
      <p><b>Inicio:</b> ${tu.inicio || '—'} · <b>Fin estimado:</b> ${tu.estimadoFin || '—'}</p>
      <p><b>Palets:</b> ${tu.palets.length}/${tu.capacidadPalets}</p>
      <p><b>Lista:</b><br><code>${tu.palets.join('<br>')}</code></p>
    `);
  };

  /* ════════════════════════════════════════════════════════
     VISTA: EMPAQUE
     ════════════════════════════════════════════════════════ */
  function renderEmpaque() {
    const t = window.TRZ;
    return `
      <section class="trz-section">
        <header class="trz-section-header">
          <h2>📦 Empaque & Etiquetas</h2>
          <p>Cajas con QR cliente · GS1-128 · USDA Organic · trazabilidad FSMA 204</p>
        </header>

        <div class="trz-kpi-grid">
          ${kpiCard('OE en proceso', t.ordenesEmpaque.filter(o => o.estado === 'En proceso').length, 'McCormick · Carmencita', '📦', 'primary')}
          ${kpiCard('Cajas hoy',      412, 'Meta diaria: 1,280', '🟫', 'info')}
          ${kpiCard('Kg empacados',   '4,120', 'Productividad: 7.7 kg/h-h', '⚖️', 'warn')}
          ${kpiCard('Etiquetas QR',   412, 'GS1-128 · FSMA 204 ready', '🏷️', 'danger')}
        </div>

        <article class="trz-card">
          <h3>🛠️ Órdenes de empaque activas</h3>
          <div class="trz-emp-grid">
            ${t.ordenesEmpaque.map(o => `
              <div class="trz-emp-card ${o.estado === 'Completado' ? 'done' : 'active'}">
                <div class="trz-emp-head">
                  <h4>${o.id}</h4>
                  <span class="${statusBadgeClass(o.estado)}">${o.estado}</span>
                </div>
                <div class="trz-emp-meta">
                  <div>👤 ${o.clienteNombre}</div>
                  <div>🧾 ${o.pedido}</div>
                  <div>🚢 Cont. ${o.contenedor}</div>
                  <div>🥭 ${o.fruta}</div>
                  <div>✂️ ${o.tipoCorte}</div>
                  <div>📦 ${o.presentacion}</div>
                </div>
                <div class="trz-emp-progress">
                  <div class="trz-emp-prog-row"><span>Cajas</span><b>${o.cajasEmpacadas} / ${o.cajasObjetivo}</b></div>
                  <div class="trz-progress"><div class="trz-progress-fill" style="width:${(o.cajasEmpacadas/o.cajasObjetivo*100).toFixed(1)}%"></div></div>
                  <div class="trz-emp-prog-row"><span>Kilos</span><b>${fmtN(o.kilosEmpacados)} / ${fmtN(o.kilosObjetivo)}</b></div>
                  <div class="trz-progress"><div class="trz-progress-fill" style="width:${(o.kilosEmpacados/o.kilosObjetivo*100).toFixed(1)}%"></div></div>
                </div>
                <div class="trz-actions-inline">
                  <button class="trz-btn trz-btn-outline trz-btn-sm" onclick="trzPreviewEtiqueta('${escAttr(o.id)}')">🏷️ Etiqueta cliente</button>
                  <button class="trz-btn trz-btn-outline trz-btn-sm" onclick="trzEmpDetail('${escAttr(o.id)}')">📋 Reporte h/h</button>
                </div>
              </div>
            `).join('')}
          </div>
        </article>

        <article class="trz-card">
          <h3>🕒 Reporte de empaque · hora a hora</h3>
          <div class="trz-table-wrap">
            <table class="ftp-table">
              <thead><tr>
                <th>Hora inicio</th><th>Hora final</th><th>Tipo corte</th><th>Presentación</th>
                <th class="trz-tar">Cajas</th><th class="trz-tar">Kilos</th><th>Cliente</th><th>Lote</th>
                <th>Cod. Trazab.</th><th class="trz-tar">Op</th><th class="trz-tar">Prod./Op</th>
              </tr></thead>
              <tbody>
                ${[
                  { hi: '11:00', hf: '12:00', cajas: 65, kg: 650, prod: 1.13 },
                  { hi: '12:00', hf: '13:00', cajas: 78, kg: 780, prod: 1.36 },
                  { hi: '13:00', hf: '14:00', cajas: 82, kg: 820, prod: 1.43 },
                  { hi: '14:00', hf: '15:00', cajas: 88, kg: 880, prod: 1.53 },
                  { hi: '15:00', hf: '16:00', cajas: 99, kg: 990, prod: 1.72 }
                ].map(r => `
                  <tr>
                    <td>${r.hi}</td><td>${r.hf}</td><td>Chunks 19mm</td><td>Bolsa 1kg</td>
                    <td class="trz-tar"><b>${r.cajas}</b></td><td class="trz-tar">${fmtN(r.kg)}</td>
                    <td>McCormick</td><td><code>17C</code></td>
                    <td><code class="trz-hash">FTP-MGK-26-0517C-EMP01</code></td>
                    <td class="trz-tar">24</td><td class="trz-tar"><b>${r.prod}</b></td>
                  </tr>`).join('')}
                <tr class="trz-row-total">
                  <td colspan="4"><b>TOTAL</b></td>
                  <td class="trz-tar"><b>412</b></td><td class="trz-tar"><b>4,120</b></td>
                  <td colspan="3"></td><td class="trz-tar"><b>24</b></td><td class="trz-tar"><b>7.17</b></td>
                </tr>
              </tbody>
            </table>
          </div>
        </article>
      </section>
    `;
  }

  function afterEmpaque() {}

  window.trzPreviewEtiqueta = (id) => {
    const o = window.TRZ.ordenesEmpaque.find(x => x.id === id);
    if (!o) return;
    const payload = JSON.stringify({ p: o.pedido, c: o.contenedor, lt: o.lote, cli: o.cliente, fr: 'MGK-O', kg: 10 });
    openModal(`🏷️ Etiqueta cliente · ${o.id}`, `
      <div class="trz-etiqueta">
        <div class="trz-etiqueta-head">
          <div><b>FRUTOS TROPICALES PERU EXPORT S.A.C.</b><br><small>RUC 20607892955 · Vegueta · Huaura</small></div>
          <div class="trz-etiqueta-org">USDA<br>ORGANIC</div>
        </div>
        <div class="trz-etiqueta-body">
          <div class="trz-etiqueta-fields">
            <div><b>PRODUCTO:</b> ${o.fruta}</div>
            <div><b>PRESENTACIÓN:</b> ${o.presentacion}</div>
            <div><b>TIPO CORTE:</b> ${o.tipoCorte}</div>
            <div><b>LOTE MP:</b> ${o.lote}</div>
            <div><b>COD. TRAZAB.:</b> <code>${o.codTraz}</code></div>
            <div><b>PEDIDO:</b> ${o.pedido}</div>
            <div><b>CONTENEDOR:</b> ${o.contenedor}</div>
            <div><b>CLIENTE:</b> ${o.clienteNombre}</div>
            <div><b>F. PROD.:</b> ${fmtDate('2026-02-21')} · <b>F. EXP.:</b> ${fmtDate('2028-02-21')}</div>
          </div>
          <div class="trz-etiqueta-qr"><div id="trzEtiquetaQr"></div></div>
        </div>
        <div class="trz-etiqueta-foot">GS1-128 · FSMA 204 · HACCP plan · BRC v9</div>
      </div>
    `, [
      { label: '🖨️ Imprimir 412 etiquetas', cls: 'trz-btn-primary', onclick: `trzPrintLabels()` }
    ]);
    setTimeout(() => {
      const el = document.getElementById('trzEtiquetaQr');
      if (el && typeof QRCode !== 'undefined') new QRCode(el, { text: payload, width: 130, height: 130 });
      else if (el) el.innerHTML = `<div class="trz-qr-fallback">QR</div>`;
    }, 80);
  };
  window.trzPrintLabels = () => toast('412 etiquetas enviadas a Zebra ZT411', 'info');
  window.trzEmpDetail = (id) => toast(`Abriendo detalle de ${id}`, 'info');

  /* ════════════════════════════════════════════════════════
     VISTA: CÁMARA PT
     ════════════════════════════════════════════════════════ */
  function renderCamara() {
    const t = window.TRZ;
    const ocupados = t.camaraSlots.filter(s => s.ocupado).length;
    const total = t.camaraSlots.length;
    const pct = (ocupados / total * 100).toFixed(0);
    const kgTotal = t.camaraSlots.reduce((s, x) => s + x.kilos, 0);
    return `
      <section class="trz-section">
        <header class="trz-section-header">
          <h2>🏢 Cámara de Producto Terminado</h2>
          <p>Layout 6 racks × 4 niveles × 5 slots = 120 ubicaciones · sondas LoRaWAN · -22°C continuo</p>
        </header>

        <div class="trz-kpi-grid">
          ${kpiCard('Ocupación',         `${pct}%`,                                 `${ocupados}/${total} slots`, '🏢', 'primary')}
          ${kpiCard('Kg almacenados',    fmtN(kgTotal),                             'Mantenimiento -22°C ±1', '⚖️', 'info')}
          ${kpiCard('Temp. actual',      '-22.4°C',                                 '7 sondas LoRaWAN activas', '🌡️', 'warn')}
          ${kpiCard('Contenedores listos', t.contenedores.filter(c => c.estado === 'Listo').length, 'Despacho próximo Callao', '🚢', 'danger')}
        </div>

        <article class="trz-card">
          <div class="trz-actions-inline trz-cam-controls">
            <h3>🗺️ Mapa visual de slots</h3>
            <div>
              <span class="trz-cam-legend"><span class="trz-cam-dot empty"></span> Vacío</span>
              <span class="trz-cam-legend"><span class="trz-cam-dot mc"></span> McCormick</span>
              <span class="trz-cam-legend"><span class="trz-cam-dot ca"></span> Carmencita</span>
            </div>
          </div>
          <div class="trz-camara-map">
            ${[1,2,3,4,5,6].map(r => `
              <div class="trz-rack">
                <div class="trz-rack-label">Rack ${r}</div>
                ${[4,3,2,1].map(n => `
                  <div class="trz-rack-row">
                    <span class="trz-rack-level">N${n}</span>
                    ${[1,2,3,4,5].map(s => {
                      const slot = t.camaraSlots.find(x => x.rack === r && x.nivel === n && x.slot === s);
                      if (!slot) return '';
                      const cls = slot.ocupado ? (slot.cliente === 'McCormick' ? 'mc' : 'ca') : 'empty';
                      return `<div class="trz-slot ${cls}" title="${escAttr(slot.id)} · ${slot.ocupado ? slot.cajas + ' cajas · ' + fmtN(slot.kilos) + ' kg' : 'vacío'}" onclick="trzSlotInfo('${escAttr(slot.id)}')"></div>`;
                    }).join('')}
                  </div>
                `).join('')}
              </div>
            `).join('')}
          </div>
        </article>

        <article class="trz-card">
          <h3>🚢 Contenedores en preparación</h3>
          <div class="trz-cont-grid">
            ${t.contenedores.map(c => `
              <div class="trz-cont-card">
                <div class="trz-cont-head">
                  <code>${c.id}</code>
                  <span class="${statusBadgeClass(c.estado)}">${c.estado}</span>
                </div>
                <div>👤 ${c.cliente}</div>
                <div>🌎 ${c.pais} · ${c.naviera}</div>
                <div>⚓ Pto. ${c.puerto} · ${c.booking}</div>
                <div class="trz-progress trz-mt"><div class="trz-progress-fill" style="width:${c.ocupacionPct}%"></div></div>
                <div class="trz-muted trz-mt-sm">Ocupación: ${c.ocupacionPct}% · Cierre ${fmtDate(c.fechaCierre)}</div>
              </div>
            `).join('')}
          </div>
        </article>
      </section>
    `;
  }

  function afterCamara() {}

  window.trzSlotInfo = (id) => {
    const s = window.TRZ.camaraSlots.find(x => x.id === id);
    if (!s) return;
    if (!s.ocupado) { toast(`Slot ${id} disponible`, 'info'); return; }
    const temp = (s.tempActual != null && !isNaN(s.tempActual)) ? s.tempActual.toFixed(1) + '°C' : '—';
    openModal(`🟫 Slot ${escAttr(s.id)}`, `
      <p><b>Cliente:</b> ${s.cliente || '—'}</p>
      <p><b>Cajas:</b> ${s.cajas || 0} · <b>Kg:</b> ${fmtN(s.kilos)}</p>
      <p><b>Fecha ingreso:</b> ${fmtDate(s.fechaIngreso)}</p>
      <p><b>Temp. actual:</b> ${temp}</p>
    `);
  };

  /* ════════════════════════════════════════════════════════
     HELPERS UI
     ════════════════════════════════════════════════════════ */
  function kpiCard(label, value, footer, icon, variant) {
    return `
      <div class="trz-kpi trz-kpi-${variant || 'primary'}">
        <div class="trz-kpi-head">
          <div>
            <div class="trz-kpi-label">${label}</div>
            <div class="trz-kpi-value">${value}</div>
          </div>
          <div class="trz-kpi-icon">${icon}</div>
        </div>
        <div class="trz-kpi-foot">${footer}</div>
      </div>
    `;
  }

  function openModal(title, body, actions) {
    const overlay = document.getElementById('trzModalOverlay');
    document.getElementById('trzModalTitle').innerHTML = title;
    document.getElementById('trzModalBody').innerHTML = body;
    const footer = document.getElementById('trzModalFooter');
    footer.innerHTML = (actions || []).map(a => `<button class="trz-btn ${a.cls || 'trz-btn-outline'}" onclick="${a.onclick}">${a.label}</button>`).join('') +
      `<button class="trz-btn trz-btn-outline" onclick="closeModal()">Cerrar</button>`;
    overlay.classList.add('open');
  }
  window.closeModal = () => document.getElementById('trzModalOverlay').classList.remove('open');
  window.trzCloseModal = () => closeModal();
  window.trzCloseModalIfOverlay = (e) => { if (e.target.id === 'trzModalOverlay') closeModal(); };

  // Theme toggle
  window.trzToggleTheme = function () {
    const next = (typeof toggleThemeShared === 'function')
      ? toggleThemeShared('trz_theme')
      : (function(){
          const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
          const n = isDark ? 'light' : 'dark';
          if (n === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
          else document.documentElement.removeAttribute('data-theme');
          try { localStorage.setItem('trz_theme', n); } catch(_){}
          return n;
        })();
    // Re-render para refrescar charts con colores correctos
    switchView(STATE.currentView);
  };

  /* ────────── Mapas de renderers ────────── */
  const renderers = {
    torre: renderTorre, guias: renderGuias, transito: renderTransito,
    paleticket: renderPaleticket, acondicionado: renderAcondicionado,
    tuneles: renderTuneles, empaque: renderEmpaque, camara: renderCamara
  };
  const afterRenders = {
    torre: afterTorre, guias: afterGuias, transito: afterTransito,
    paleticket: afterPaleticket, acondicionado: afterAcondicionado,
    tuneles: afterTuneles, empaque: afterEmpaque, camara: afterCamara
  };
})();
