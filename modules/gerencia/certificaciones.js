/* ════════════════════════════════════════════════════════
   Certificaciones - Modulo de Gestion
   Data real extraida del BI corporativo (Abril 2026)
   ════════════════════════════════════════════════════════ */

const IMG_BASE = '/assets/images/certificaciones/';

// Data real de certificaciones vigentes segun BI de la empresa
const CERTIFICACIONES = [
  {
    id: 'ki-peru',
    nombre: 'Ki Peru (Kosher)',
    entidad: 'Union Israelita del Peru',
    alcance: ['Mango', 'Arandano', 'Granada', 'Palta'],
    resultado: 'Aprobado',
    vence: '2026-11-30',
    imagen: 'kosher.png'
  },
  {
    id: 'smeta',
    nombre: 'SMETA / SEDEX',
    entidad: 'LSQA',
    alcance: ['Planta Congelado'],
    alcanceDescripcion: 'Auditoria Etica en Planta Congelado',
    resultado: 'Aprobado',
    vence: '2026-12-11',
    imagen: 'smeta.png'
  },
  {
    id: 'brcgs',
    nombre: 'BRCGS Food Safety',
    entidad: 'LSQA',
    alcance: ['Mango', 'Palta', 'Pina', 'Banano', 'Fresa', 'Arandano', 'Arilos de Granada'],
    resultado: 'Aprobado',
    vence: '2026-12-15',
    imagen: 'brcgs.png'
  },
  {
    id: 'fda',
    nombre: 'FDA — Food Facility Registration',
    entidad: 'FDA (U.S. Food & Drug Administration)',
    alcance: ['Planta Congelado'],
    alcanceDescripcion: 'Registro Sanitario para Exportacion a EEUU',
    resultado: 'Aprobado',
    vence: '2026-12-31',
    imagen: 'fda.png'
  },
  {
    id: 'gmp',
    nombre: 'GMP — Good Manufacturing Practice',
    entidad: 'LSQA',
    alcance: ['Mango', 'Palta', 'Pina', 'Banano', 'Fresa', 'Arandano', 'Arilos de Granada'],
    resultado: 'Aprobado',
    vence: '2027-01-26',
    imagen: 'gmp.png'
  },
  {
    id: 'haccp',
    nombre: 'HACCP — Analisis de Peligros y Puntos Criticos',
    entidad: 'LSQA',
    alcance: ['Mango', 'Palta', 'Pina', 'Banano', 'Fresa', 'Arandano', 'Arilos de Granada'],
    resultado: 'Aprobado',
    vence: '2027-01-26',
    imagen: 'haccp.png'
  },
  {
    id: 'globalgap',
    nombre: 'GlobalG.A.P. — Buenas Practicas Agricolas',
    entidad: 'LSQA',
    alcance: ['Mango', 'Palta', 'Pina', 'Banano', 'Fresa', 'Arandano', 'Arilos de Granada'],
    resultado: 'Aprobado',
    vence: '2026-10-23',
    imagen: 'globalgap.png'
  },
  {
    id: 'usda',
    nombre: 'USDA Organic (NOP)',
    entidad: 'CERES',
    alcance: ['Mango', 'Pina'],
    resultado: 'Aprobado',
    vence: '2026-08-31',
    imagen: 'usda.png'
  },
  {
    id: 'senasa',
    nombre: 'SENASA — Registro Sanitario',
    entidad: 'SENASA (MIDAGRI - Peru)',
    alcance: ['Mango', 'Palta', 'Pina', 'Banano', 'Fresa', 'Arandano', 'Arilos de Granada', 'Maracuya'],
    resultado: 'Aprobado',
    vence: '2026-08-31',
    imagen: 'senada.png'
  },
  {
    id: 'ana',
    nombre: 'ANA — Autoridad Nacional del Agua',
    entidad: 'ANA',
    alcance: ['Planta Congelado'],
    alcanceDescripcion: 'Uso de Recursos Hidricos en Planta Congelado',
    resultado: 'Aprobado',
    vence: '2027-03-31',
    imagen: 'ana.png'
  }
];

// ── Helpers ──
function diffDays(fechaISO) {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const venc = new Date(fechaISO + 'T00:00:00');
  const ms = venc - hoy;
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

function formatDate(iso) {
  const d = new Date(iso + 'T00:00:00');
  const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  return `${String(d.getDate()).padStart(2,'0')} ${meses[d.getMonth()]} ${d.getFullYear()}`;
}

function statusFromDays(days) {
  if (days < 0) return { key: 'danger', label: 'Vencida', icon: '✗' };
  if (days <= 90) return { key: 'warn', label: 'Proxima a vencer', icon: '⚠' };
  return { key: 'ok', label: 'Vigente', icon: '✓' };
}

// Tiempo restante legible: "8 meses", "45 dias", "1 ano 2 meses"
function formatRemaining(days) {
  if (days < 0) {
    const abs = Math.abs(days);
    if (abs >= 365) return { num: (abs / 365).toFixed(1), unit: 'anos vencida' };
    if (abs >= 30)  return { num: Math.floor(abs / 30), unit: 'meses vencida' };
    return { num: abs, unit: abs === 1 ? 'dia vencida' : 'dias vencida' };
  }
  if (days === 0) return { num: 'HOY', unit: 'vence hoy' };
  if (days >= 365) {
    const anos = Math.floor(days / 365);
    const meses = Math.floor((days % 365) / 30);
    return { num: anos + (meses > 0 ? `a ${meses}m` : 'a'), unit: 'restantes' };
  }
  if (days >= 30) return { num: Math.floor(days / 30), unit: 'meses restantes' };
  return { num: days, unit: days === 1 ? 'dia restante' : 'dias restantes' };
}

// Porcentaje de vigencia restante asumiendo ciclo de ~1 ano
function progressPct(days) {
  if (days <= 0) return 0;
  if (days >= 365) return 100;
  return Math.round((days / 365) * 100);
}

// ── Render ──
function renderCard(cert) {
  const days = diffDays(cert.vence);
  const status = statusFromDays(days);
  const remaining = formatRemaining(days);
  const pct = progressPct(days);

  const fruitsHTML = cert.alcance.map(f =>
    `<span class="cert-fruit-tag">${f}</span>`
  ).join('');

  const statusClass = status.key === 'ok' ? '' : (status.key === 'warn' ? 'status-warn' : 'status-danger');

  return `
    <div class="cert-card ${statusClass}" data-id="${cert.id}">
      <div class="cert-badge ${status.key}">
        <span class="cert-badge-dot"></span>
        <span>${status.icon} ${status.label}</span>
      </div>

      <div class="cert-head">
        <div class="cert-logo-wrap">
          <img src="${IMG_BASE}${cert.imagen}" alt="${cert.nombre}" loading="lazy" onerror="this.style.display='none'">
        </div>
        <div class="cert-head-info">
          <div class="cert-name">${cert.nombre}</div>
          <div class="cert-entity">Entidad: <b>${cert.entidad}</b></div>
        </div>
      </div>

      <div class="cert-body">
        <div class="cert-row">
          <div class="cert-row-label">Alcance</div>
          <div class="cert-row-value">
            ${cert.alcanceDescripcion ? `<div style="margin-bottom:6px;font-style:italic;color:var(--muted)">${cert.alcanceDescripcion}</div>` : ''}
            <div class="cert-fruits">${fruitsHTML}</div>
          </div>
        </div>
        <div class="cert-row">
          <div class="cert-row-label">Resultado</div>
          <div class="cert-row-value" style="color:#15803d;font-weight:700">✓ ${cert.resultado}</div>
        </div>
      </div>

      <div class="cert-foot">
        <div class="cert-expiry">
          <div class="cert-expiry-label">Vigencia hasta</div>
          <div class="cert-expiry-date">${formatDate(cert.vence)}</div>
          <div class="cert-progress">
            <div class="cert-progress-fill ${status.key}" style="width:${pct}%"></div>
          </div>
        </div>
        <div class="cert-countdown ${status.key}">
          <div class="cert-countdown-num">${remaining.num}</div>
          <div class="cert-countdown-label">${remaining.unit}</div>
        </div>
      </div>
    </div>
  `;
}

function renderKpis(stats) {
  document.getElementById('certTotal').textContent = stats.total;
  document.getElementById('certVigentes').textContent = stats.vigentes;
  document.getElementById('certProximas').textContent = stats.proximas;
  document.getElementById('certVencidas').textContent = stats.vencidas;
  const badge = document.getElementById('certBadgeTotal');
  if (badge) badge.textContent = `${stats.total} registradas`;
}

function renderAlertBanner(stats, proximasList, vencidasList) {
  const banner = document.getElementById('certAlertBanner');
  const icon = document.getElementById('certAlertIcon');
  const title = document.getElementById('certAlertTitle');
  const text = document.getElementById('certAlertText');
  if (!banner) return;

  if (stats.vencidas > 0) {
    banner.classList.add('visible', 'danger');
    icon.textContent = '🚨';
    title.textContent = `${stats.vencidas} certificacion${stats.vencidas > 1 ? 'es' : ''} VENCIDA${stats.vencidas > 1 ? 'S' : ''} — Accion inmediata requerida`;
    text.textContent = vencidasList.map(c => c.nombre).join(' · ');
  } else if (stats.proximas > 0) {
    banner.classList.remove('danger');
    banner.classList.add('visible');
    icon.textContent = '⚠️';
    title.textContent = `${stats.proximas} certificacion${stats.proximas > 1 ? 'es' : ''} proxima${stats.proximas > 1 ? 's' : ''} a vencer (menos de 3 meses)`;
    text.textContent = proximasList.map(c => `${c.nombre} (${formatDate(c.vence)})`).join(' · ');
  } else {
    banner.classList.remove('visible', 'danger');
  }
}

// ── Init ──
export async function init(container) {
  // Ordenar por fecha de vencimiento (mas urgentes primero, luego vigentes por fecha)
  const sorted = [...CERTIFICACIONES].sort((a, b) => {
    const da = diffDays(a.vence);
    const db = diffDays(b.vence);
    // Vencidas primero, luego proximas, luego vigentes por fecha asc
    return da - db;
  });

  const stats = { total: sorted.length, vigentes: 0, proximas: 0, vencidas: 0 };
  const proximasList = [];
  const vencidasList = [];

  sorted.forEach(c => {
    const d = diffDays(c.vence);
    if (d < 0) { stats.vencidas++; vencidasList.push(c); }
    else if (d <= 90) { stats.proximas++; proximasList.push(c); }
    else { stats.vigentes++; }
  });

  // Render grid
  const grid = document.getElementById('certGrid');
  if (grid) {
    grid.innerHTML = sorted.map(renderCard).join('');
  }

  // Render KPIs + alerta
  renderKpis(stats);
  renderAlertBanner(stats, proximasList, vencidasList);

  // Recalcular automaticamente cada hora (por si el usuario deja la pestana abierta un dia completo)
  if (!window._certInterval) {
    window._certInterval = setInterval(() => {
      // Solo recalcular si el panel sigue en el DOM
      if (document.getElementById('certGrid')) {
        init(container);
      }
    }, 60 * 60 * 1000);
  }
}
