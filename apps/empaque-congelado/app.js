// ═══════════════════════════════════════════════════
// EMPAQUE CONGELADO — FULL APP
// ═══════════════════════════════════════════════════

// ═══════════════ CUTS CONFIG ═══════════════
const CORTES_POR_FRUTA = {
  FRESA:    ['ENTER', 'SMOOTHIE'],
  PALTA:    ['HALVES', 'SLICES', 'PURE', 'CHUNKS'],
  GRANADA:  ['ARILOS'],
  ARANDANO: ['ENTERO'],
  PIÑA:     ['CUBOS'],
  MANGO:    ['CHUNKS', 'B & P']
};

// ═══════════════ THEME ═══════════════
function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'light' ? 'dark' : 'light';
  if (next === 'dark') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', 'light');
  document.getElementById('themeBtn').textContent = next === 'light' ? '\u2600\uFE0F' : '\uD83C\uDF19';
  localStorage.setItem('empaque_cong_theme', next);
  rebuildCharts();
}
(function initTheme() {
  const saved = localStorage.getItem('empaque_cong_theme');
  if (saved === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
    document.getElementById('themeBtn').textContent = '\u2600\uFE0F';
  }
})();

// ═══════════════ SECTION TOGGLE ═══════════════
function toggleSection(bodyId, chevronId) {
  document.getElementById(bodyId).classList.toggle('collapsed');
  document.getElementById(chevronId).classList.toggle('collapsed');
}

// ═══════════════ FRUIT CHANGE → poblar dropdown de Corte ═══════════════
function onFrutaChange() {
  const fruta = document.getElementById('fFruta').value;
  const corteSel = document.getElementById('fCorte');
  if (!corteSel) return;

  if (!fruta || !CORTES_POR_FRUTA[fruta]) {
    corteSel.innerHTML = '<option value="">-- Selecciona fruta primero --</option>';
    corteSel.disabled = true;
    return;
  }

  const cortes = CORTES_POR_FRUTA[fruta];
  corteSel.disabled = false;
  corteSel.innerHTML = cortes.map(c => `<option value="${c}">${c}</option>`).join('');
}

// ═══════════════ TIPO REGISTRO CHANGE (PROCESO / REEMPAQUE) ═══════════════
function onTipoRegistroChange() {
  // Hook para lecciones futuras (ej: esconder campos que no aplican a reempaque).
  // Por ahora solo actualiza el preview si hay datos.
  calcPreview();
}

// ═══════════════ PRESENTATION CHANGE ═══════════════
function onPresentacionChange() {
  const val = document.getElementById('fKgPresentacion').value;
  document.getElementById('kgOtroGroup').style.display = val === 'OTRO' ? 'flex' : 'none';
  if (val !== 'OTRO') document.getElementById('fKgOtro').value = '';
  calcPreview();
}

function getKgPresentacion() {
  const val = document.getElementById('fKgPresentacion').value;
  if (val === 'OTRO') return parseFloat(document.getElementById('fKgOtro').value) || 0;
  return parseFloat(val) || 0;
}

// ═══════════════ CALC CUTS TOTALS (LEGACY NO-OP) ═══════════════
// Ya no existen inputs multiples por corte. Se mantiene la funcion por si algun
// HTML legacy aun la invoca (no-op).
function calcCutsTotals() { calcPreview(); }

// ═══════════════ CALC PREVIEW ═══════════════
function calcPreview() {
  const cajas = parseInt(document.getElementById('fCajas').value) || 0;
  const kgPres = getKgPresentacion();
  const operarios = parseInt(document.getElementById('fOperarios').value) || 0;
  const preview = document.getElementById('calcPreview');

  if (cajas > 0 && kgPres > 0) {
    preview.style.display = 'flex';
    const kgPT = cajas * kgPres;
    document.getElementById('fKgPT').value = kgPT.toFixed(1);
    document.getElementById('prevKgPT').textContent = formatNum(kgPT) + ' kg';
    const cjHrOp = operarios > 0 ? (cajas / operarios).toFixed(1) : '—';
    document.getElementById('prevCjHrOp').textContent = cjHrOp;
  } else {
    preview.style.display = 'none';
    document.getElementById('fKgPT').value = '';
  }
}

// ═══════════════ MODAL CALC ═══════════════
function calcModalPT() {
  const cajas = parseInt(document.getElementById('mCajas').value) || 0;
  const kgPres = parseFloat(document.getElementById('mKgPres').value) || 0;
  document.getElementById('mKgPT').value = (cajas * kgPres).toFixed(1);
}

// ═══════════════ STORAGE ═══════════════
const STORAGE_KEY = 'empaque_congelado_registros';
function getRecords() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
  catch { return []; }
}
function saveRecords(records) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

// ═══════════════ GET CORTE (dropdown unico) ═══════════════
// Toma el corte seleccionado en el dropdown. Si la fruta tiene un solo corte
// valido y el dropdown esta vacio, devuelve ese default.
function getCorteFromCuts() {
  const corteSel = document.getElementById('fCorte');
  const selected = corteSel && corteSel.value ? corteSel.value.trim() : '';
  if (selected) return selected;
  const fruta = document.getElementById('fFruta').value;
  if (fruta && CORTES_POR_FRUTA[fruta]) return CORTES_POR_FRUTA[fruta][0] || '';
  return '';
}

// Genera cuts_detail para compatibilidad con registros existentes. Asigna TODAS
// las cajas al corte seleccionado (ya no hay distribucion multi-corte).
function getCutsDetail() {
  const fruta = document.getElementById('fFruta').value;
  if (!fruta || !CORTES_POR_FRUTA[fruta]) return {};
  const cajas = parseInt(document.getElementById('fCajas').value) || 0;
  const corte = getCorteFromCuts();
  const detail = {};
  CORTES_POR_FRUTA[fruta].forEach(c => { detail[c] = 0; });
  if (corte && detail.hasOwnProperty(corte)) detail[corte] = cajas;
  return detail;
}

// ═══════════════ REGISTER ═══════════════
async function registrarEmpaque() {
  const fruta = document.getElementById('fFruta').value;
  if (!fruta) { showToast('Selecciona un producto/fruta', true); return; }

  const cajas = parseInt(document.getElementById('fCajas').value) || 0;
  if (cajas <= 0) { showToast('Ingresa el numero de cajas', true); return; }

  const kgPres = getKgPresentacion();
  if (kgPres <= 0) { showToast('Selecciona o ingresa el KG de presentacion', true); return; }

  const supervisor = document.getElementById('fSupervisor').value.trim();
  if (supervisor) localStorage.setItem('empaque_cong_supervisor', supervisor);

  const cliente = document.getElementById('fCliente').value.trim();
  if (cliente) localStorage.setItem('empaque_cong_cliente', cliente);

  const kgPT = cajas * kgPres;
  const operarios = parseInt(document.getElementById('fOperarios').value) || 0;
  const cjHr = cajas;
  const cjHrOp = operarios > 0 ? parseFloat((cajas / operarios).toFixed(2)) : 0;
  const corte = getCorteFromCuts();
  const cutsDetail = getCutsDetail();

  const record = {
    id: Date.now().toString(36) + Math.random().toString(36).substr(2,5),
    fecha: document.getElementById('fFecha').value,
    hora: document.getElementById('fHora').value,
    turno: document.getElementById('fTurno').value,
    turno_origen: document.getElementById('fTurnoOrigen').value,
    tipo_registro: document.getElementById('fTipoRegistro').value || 'PROCESO',
    fruta: fruta,
    tipo: document.getElementById('fTipo').value,
    corte: corte,
    cuts_detail: JSON.stringify(cutsDetail),
    kg_presentacion: kgPres,
    cajas: cajas,
    kg_pt: parseFloat(kgPT.toFixed(1)),
    cj_hr: cjHr,
    cj_hr_op: cjHrOp,
    operarios: operarios,
    cliente: cliente,
    lote_mp: document.getElementById('fLoteMP').value.trim(),
    cod_trazabilidad: document.getElementById('fCodTraz').value.trim(),
    supervisor: supervisor,
    observacion: document.getElementById('fObs').value.trim(),
    created_at: new Date().toISOString()
  };

  const records = getRecords();
  records.push(record);
  saveRecords(records);

  // Supabase sync
  await syncToSupabase(record);

  showToast('Registro de empaque guardado');
  limpiarForm();
  refreshAll();
  avanzarHora();
}

async function syncToSupabase(record) {
  if (typeof supabaseClient === 'undefined' || !supabaseClient) return;
  try {
    const { error } = await supabaseClient
      .from('registro_empaque_congelado')
      .upsert({
        fecha: record.fecha,
        hora: record.hora,
        turno: record.turno,
        turno_origen: record.turno_origen,
        tipo_registro: record.tipo_registro || 'PROCESO',
        fruta: record.fruta,
        tipo: record.tipo,
        corte: record.corte,
        cuts_detail: record.cuts_detail,
        kg_presentacion: record.kg_presentacion,
        cajas: record.cajas,
        kg_pt: record.kg_pt,
        cj_hr: record.cj_hr,
        cj_hr_op: record.cj_hr_op,
        operarios: record.operarios,
        cliente: record.cliente,
        lote_mp: record.lote_mp,
        cod_trazabilidad: record.cod_trazabilidad,
        supervisor: record.supervisor,
        observacion: record.observacion
      }, { onConflict: 'fecha,hora,turno' });

    if (error) {
      console.error('Supabase error:', error);
      showSupabaseToast('Error Supabase: ' + error.message, '#ef4444');
    } else {
      showSupabaseToast('Sincronizado con Supabase', '#16a34a');
    }
  } catch(e) {
    console.error('Supabase offline:', e);
    showSupabaseToast('Sin conexion - guardado local', '#ef4444');
  }
}

function limpiarForm() {
  document.getElementById('fCajas').value = '';
  document.getElementById('fKgPT').value = '';
  document.getElementById('fObs').value = '';
  document.getElementById('fLoteMP').value = '';
  document.getElementById('fCodTraz').value = '';
  document.getElementById('calcPreview').style.display = 'none';
  // No hay mas cutsGrid inputs que limpiar (corte ahora es dropdown unico).
}

function avanzarHora() {
  const records = getRecords();
  const fecha = document.getElementById('fFecha').value;
  const turno = document.getElementById('fTurno').value;
  const hoy = records.filter(r => r.fecha === fecha && r.turno === turno);
  if (hoy.length === 0) return;

  const horas = hoy.map(r => r.hora).sort();
  const ultima = horas[horas.length - 1];
  const sel = document.getElementById('fHora');
  for (let i = 0; i < sel.options.length; i++) {
    if (sel.options[i].value === ultima && i + 1 < sel.options.length) {
      sel.selectedIndex = i + 1;
      break;
    }
  }
}

// ═══════════════ EDIT / DELETE ═══════════════
let editingId = null;

function openEditModal(id) {
  const records = getRecords();
  const r = records.find(rec => rec.id === id);
  if (!r) return;
  editingId = id;

  document.getElementById('mFecha').value = r.fecha || '';
  document.getElementById('mTurno').value = r.turno || 'DIA';
  document.getElementById('mTipoRegistro').value = r.tipo_registro || 'PROCESO';
  document.getElementById('mTurnoOrigen').value = r.turno_origen || 'DIA';
  document.getElementById('mHora').value = r.hora || '';
  document.getElementById('mFruta').value = r.fruta || '';
  document.getElementById('mCorte').value = r.corte || '';
  document.getElementById('mTipo').value = r.tipo || 'CONVENCIONAL';
  document.getElementById('mCliente').value = r.cliente || '';
  document.getElementById('mCajas').value = r.cajas || '';
  document.getElementById('mKgPres').value = r.kg_presentacion || '';
  document.getElementById('mKgPT').value = r.kg_pt || '';
  document.getElementById('mOperarios').value = r.operarios || '';
  document.getElementById('mLoteMP').value = r.lote_mp || '';
  document.getElementById('mCodTraz').value = r.cod_trazabilidad || '';
  document.getElementById('mSupervisor').value = r.supervisor || '';
  document.getElementById('mObs').value = r.observacion || '';

  document.getElementById('editModal').classList.add('active');
}

function closeModal() {
  document.getElementById('editModal').classList.remove('active');
  editingId = null;
}

async function guardarEdicion() {
  if (!editingId) return;
  const records = getRecords();
  const idx = records.findIndex(r => r.id === editingId);
  if (idx === -1) { closeModal(); return; }

  const cajas = parseInt(document.getElementById('mCajas').value) || 0;
  const kgPres = parseFloat(document.getElementById('mKgPres').value) || 0;
  const operarios = parseInt(document.getElementById('mOperarios').value) || 0;
  const kgPT = cajas * kgPres;
  const cjHrOp = operarios > 0 ? parseFloat((cajas / operarios).toFixed(2)) : 0;

  const oldRecord = records[idx];

  records[idx] = {
    ...records[idx],
    fecha: document.getElementById('mFecha').value,
    hora: document.getElementById('mHora').value,
    turno: document.getElementById('mTurno').value,
    turno_origen: document.getElementById('mTurnoOrigen').value,
    tipo_registro: document.getElementById('mTipoRegistro').value || 'PROCESO',
    fruta: document.getElementById('mFruta').value,
    corte: document.getElementById('mCorte').value,
    tipo: document.getElementById('mTipo').value,
    cliente: document.getElementById('mCliente').value.trim(),
    cajas: cajas,
    kg_presentacion: kgPres,
    kg_pt: parseFloat(kgPT.toFixed(1)),
    cj_hr: cajas,
    cj_hr_op: cjHrOp,
    operarios: operarios,
    lote_mp: document.getElementById('mLoteMP').value.trim(),
    cod_trazabilidad: document.getElementById('mCodTraz').value.trim(),
    supervisor: document.getElementById('mSupervisor').value.trim(),
    observacion: document.getElementById('mObs').value.trim()
  };

  saveRecords(records);

  // Sync updated record to Supabase
  await syncToSupabase(records[idx]);

  closeModal();
  refreshAll();
  showToast('Registro actualizado');
}

async function deleteRecord(id) {
  if (!confirm('Eliminar este registro?')) return;
  let records = getRecords();
  const record = records.find(r => r.id === id);
  records = records.filter(r => r.id !== id);
  saveRecords(records);

  // Delete from Supabase
  if (record && typeof supabaseClient !== 'undefined' && supabaseClient) {
    try {
      await supabaseClient.from('registro_empaque_congelado').delete()
        .eq('fecha', record.fecha).eq('hora', record.hora).eq('turno', record.turno);
    } catch(e) { console.error('Supabase delete error', e); }
  }

  refreshAll();
  showToast('Registro eliminado');
}

// Close modal on overlay click
document.getElementById('editModal').addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});

// ═══════════════ TOAST ═══════════════
function showToast(msg, isError) {
  const toast = document.getElementById('toast');
  toast.textContent = (isError ? '\u26A0\uFE0F ' : '\u2705 ') + msg;
  toast.style.background = isError
    ? 'linear-gradient(135deg, #dc2626, #b91c1c)'
    : 'linear-gradient(135deg, #16a34a, #15803d)';
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

// ═══════════════ FORMAT ═══════════════
function formatNum(n) {
  return n.toLocaleString('es-PE', { maximumFractionDigits: 1 });
}

// ═══════════════ REFRESH ALL ═══════════════
function refreshAll() {
  const filterDate = document.getElementById('filterDate').value;
  const records = getRecords();
  const todayRecs = records.filter(r => r.fecha === filterDate);

  updateKPIs(todayRecs);
  updateTable(todayRecs);
  rebuildCharts(todayRecs);
  // Rendimiento se recarga con datos propios (cruza produccion + empaque)
  if (typeof renderRendimiento === 'function') renderRendimiento();
}

// ═══════════════ KPIs ═══════════════
function updateKPIs(recs) {
  const totalCajas = recs.reduce((s, r) => s + (r.cajas || 0), 0);
  const totalKgPT = recs.reduce((s, r) => s + (r.kg_pt || 0), 0);
  const avgCjHr = recs.length > 0 ? Math.round(totalCajas / recs.length) : 0;
  const totalOp = recs.reduce((s, r) => s + (r.operarios || 0), 0);
  const avgOp = recs.length > 0 ? totalOp / recs.length : 0;
  const avgCjHrOp = avgOp > 0 ? (avgCjHr / avgOp).toFixed(1) : '0';

  document.getElementById('kpiCajas').textContent = formatNum(totalCajas);
  document.getElementById('kpiKgPT').innerHTML = formatNum(totalKgPT) + ' <span class="kpi-unit">kg</span>';
  document.getElementById('kpiCjHr').textContent = avgCjHr;
  document.getElementById('kpiCjHrOp').textContent = avgCjHrOp;
  document.getElementById('kpiHoras').textContent = recs.length;

  if (recs.length > 0) {
    const best = recs.reduce((a, b) => (a.cajas > b.cajas ? a : b));
    document.getElementById('kpiBest').innerHTML = best.hora.split('-')[0] + ' <span class="kpi-unit">(' + best.cajas + ' cj)</span>';
  } else {
    document.getElementById('kpiBest').innerHTML = '—';
  }
}

// ═══════════════ TABLE ═══════════════
function updateTable(recs) {
  const tbody = document.getElementById('historyBody');
  const tfoot = document.getElementById('historyFoot');
  const empty = document.getElementById('emptyState');

  if (recs.length === 0) {
    tbody.innerHTML = '';
    tfoot.innerHTML = '';
    empty.style.display = 'block';
    document.querySelector('.table-wrap').style.display = 'none';
    return;
  }

  empty.style.display = 'none';
  document.querySelector('.table-wrap').style.display = 'block';

  const sorted = [...recs].sort((a, b) => a.hora.localeCompare(b.hora));
  let rows = '';

  sorted.forEach(r => {
    const cajasColor = r.cajas >= 90 ? 'color:var(--verde)' : r.cajas >= 70 ? 'color:var(--amber)' : 'color:var(--rojo)';
    const cjhrColor = r.cj_hr >= 90 ? 'color:var(--verde)' : r.cj_hr >= 70 ? 'color:var(--amber)' : 'color:var(--rojo)';
    const tipoBadge = r.tipo === 'ORGANICO' ? 'badge-green' : 'badge-purple';
    const isReempaque = (r.tipo_registro || 'PROCESO') === 'REEMPAQUE';
    const procBadgeClass = isReempaque ? 'badge-reempaque' : 'badge-proceso';
    const procBadgeLabel = isReempaque ? 'REEMPAQUE' : 'EMPAQUE';

    rows += '<tr>' +
      '<td style="font-weight:700">' + r.hora + '</td>' +
      '<td><span class="' + procBadgeClass + '">' + procBadgeLabel + '</span></td>' +
      '<td>' + r.fruta + '</td>' +
      '<td>' + (r.corte || '—') + '</td>' +
      '<td><span class="badge ' + tipoBadge + '">' + (r.tipo || 'CONV') + '</span></td>' +
      '<td class="num" style="' + cajasColor + ';font-weight:800">' + r.cajas + '</td>' +
      '<td class="num">' + formatNum(r.kg_pt) + '</td>' +
      '<td class="num" style="' + cjhrColor + ';font-weight:800">' + r.cj_hr + '</td>' +
      '<td class="num">' + (r.cj_hr_op || '—') + '</td>' +
      '<td class="num">' + (r.operarios || '—') + '</td>' +
      '<td>' + (r.cliente || '—') + '</td>' +
      '<td>' + (r.supervisor || '—') + '</td>' +
      '<td style="text-align:center;white-space:nowrap">' +
        '<button class="edit-btn-tbl" onclick="openEditModal(\'' + r.id + '\')" title="Editar">&#9998;&#65039;</button>' +
        '<button class="delete-btn" onclick="deleteRecord(\'' + r.id + '\')" title="Eliminar">&#128465;&#65039;</button>' +
      '</td>' +
    '</tr>';
  });

  tbody.innerHTML = rows;

  // Footer
  const totCajas = recs.reduce((s, r) => s + (r.cajas || 0), 0);
  const totKgPT = recs.reduce((s, r) => s + (r.kg_pt || 0), 0);
  const avgCjHr = recs.length > 0 ? Math.round(totCajas / recs.length) : 0;
  const totOp = recs.reduce((s, r) => s + (r.operarios || 0), 0);
  const avgOp = recs.length > 0 ? Math.round(totOp / recs.length) : 0;
  const avgCjHrOp = avgOp > 0 ? (avgCjHr / avgOp).toFixed(1) : '—';
  const cntProc = recs.filter(r => (r.tipo_registro || 'PROCESO') === 'PROCESO').length;
  const cntReemp = recs.length - cntProc;
  const mixLbl = cntReemp === 0 ? 'Todo proceso' : cntProc === 0 ? 'Todo reempaque' : (cntProc + ' proc / ' + cntReemp + ' reemp');

  tfoot.innerHTML = '<tr class="table-footer">' +
    '<td style="font-weight:800">TOTAL</td>' +
    '<td style="font-size:10.5px;color:var(--muted)">' + mixLbl + '</td>' +
    '<td>' + recs.length + ' hrs</td>' +
    '<td></td><td></td>' +
    '<td class="num">' + formatNum(totCajas) + '</td>' +
    '<td class="num">' + formatNum(totKgPT) + '</td>' +
    '<td class="num">' + avgCjHr + ' avg</td>' +
    '<td class="num">' + avgCjHrOp + '</td>' +
    '<td class="num">' + avgOp + '</td>' +
    '<td></td><td></td><td></td>' +
  '</tr>';
}

// ═══════════════ CHARTS ═══════════════
let chartKgPT = null, chartAcumulado = null, chartRendimiento = null;

function rebuildCharts(recs) {
  if (!recs) {
    const filterDate = document.getElementById('filterDate').value;
    recs = getRecords().filter(r => r.fecha === filterDate);
  }

  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  const gridColor = isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)';
  const textColor = isLight ? '#64748b' : '#94a3b8';

  const sorted = [...recs].sort((a, b) => a.hora.localeCompare(b.hora));
  const labels = sorted.map(r => r.hora.split('-')[0]);

  // ── BAR: KG PT por Hora ──
  if (chartKgPT) chartKgPT.destroy();
  chartKgPT = new Chart(document.getElementById('chartKgPT').getContext('2d'), {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'KG PT',
        data: sorted.map(r => r.kg_pt),
        backgroundColor: 'rgba(234,88,12,0.7)',
        borderColor: '#ea580c',
        borderWidth: 1,
        borderRadius: 6,
        barPercentage: 0.7
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: textColor, font: { family: 'Plus Jakarta Sans', weight: '600', size: 11 } } },
        datalabels: {
          align: 'top', color: textColor,
          font: { weight: '800', size: 10, family: 'Plus Jakarta Sans' },
          formatter: v => v ? formatNum(v) : ''
        }
      },
      scales: {
        x: { ticks: { color: textColor, font: { size: 10 } }, grid: { color: gridColor } },
        y: { ticks: { color: textColor, font: { size: 10 } }, grid: { color: gridColor }, beginAtZero: true }
      }
    },
    plugins: [ChartDataLabels]
  });

  // ── COMBO: Produccion Acumulada Cajas ──
  if (chartAcumulado) chartAcumulado.destroy();
  const cajasPerHour = sorted.map(r => r.cajas);
  let cumulative = []; let running = 0;
  cajasPerHour.forEach(v => { running += v; cumulative.push(running); });

  chartAcumulado = new Chart(document.getElementById('chartAcumulado').getContext('2d'), {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Cajas por Hora',
          data: cajasPerHour,
          backgroundColor: 'rgba(6,182,212,0.65)',
          borderColor: '#06b6d4',
          borderWidth: 1, borderRadius: 6,
          barPercentage: 0.7, yAxisID: 'y', order: 2
        },
        {
          label: 'Acumulado',
          data: cumulative,
          type: 'line',
          borderColor: '#16a34a',
          backgroundColor: 'rgba(22,163,74,0.15)',
          fill: true, tension: 0.3,
          pointRadius: 5, pointBackgroundColor: '#16a34a',
          borderWidth: 2.5, yAxisID: 'y1', order: 1
        }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: textColor, font: { family: 'Plus Jakarta Sans', weight: '600', size: 11 } } },
        datalabels: { display: false }
      },
      scales: {
        x: { ticks: { color: textColor, font: { size: 10 } }, grid: { color: gridColor } },
        y: {
          position: 'left',
          title: { display: true, text: 'Cajas/hora', color: textColor, font: { size: 11, weight: '700' } },
          ticks: { color: textColor }, grid: { color: gridColor }, beginAtZero: true
        },
        y1: {
          position: 'right',
          title: { display: true, text: 'Acumulado', color: textColor, font: { size: 11, weight: '700' } },
          ticks: { color: textColor }, grid: { drawOnChartArea: false }, beginAtZero: true
        }
      }
    },
    plugins: [ChartDataLabels]
  });

}

// ═══════════════ RENDIMIENTO POR FRUTA Y CORTE ═══════════════
// Estandares de rendimiento (kg PT / kg MP * 100) por fruta. Benchmark vs REND_DEFAULTS produccion.
const REND_STD = { 'MANGO':43, 'PALTA':36, 'GRANADA':33, 'PI\u00d1A':40, 'PINA':40, 'ARANDANO':98, 'FRESA':85 };

// Paleta distintiva por corte
const CORTE_COLORS = {
  'CHUNKS':'#ea580c', 'B & P':'#eab308', 'B&P':'#eab308',
  'HALVES':'#10b981', 'SLICES':'#3b82f6', 'PURE':'#8b5cf6',
  'ENTER':'#ef4444', 'SMOOTHIE':'#ec4899',
  'ARILOS':'#f43f5e', 'ENTERO':'#06b6d4', 'CUBOS':'#f59e0b'
};
function colorForCorte(c) {
  if (CORTE_COLORS[c]) return CORTE_COLORS[c];
  let h = 0; for (let i=0;i<c.length;i++) h = (h*31 + c.charCodeAt(i)) >>> 0;
  return 'hsl(' + (h % 360) + ',65%,55%)';
}

let rendPeriod = 'day';       // 'day' | 'week'
let rendTurno = 'TODOS';      // 'TODOS' | 'DIA' | 'NOCHE'
let rendTipo = 'PROCESO';     // 'PROCESO' | 'REEMPAQUE' | 'TODOS'
let rendFruta = 'TODAS';      // 'TODAS' | 'MANGO' | 'FRESA' | ...

function setRendPeriod(p) {
  rendPeriod = p;
  document.querySelectorAll('#rendPeriodGroup .rend-toggle').forEach(b =>
    b.classList.toggle('active', b.dataset.period === p));
  renderRendimiento();
}
function setRendTurno(t) {
  rendTurno = t;
  document.querySelectorAll('#rendTurnoGroup .rend-toggle').forEach(b =>
    b.classList.toggle('active', b.dataset.turno === t));
  renderRendimiento();
}
function setRendTipo(t) {
  rendTipo = t;
  document.querySelectorAll('#rendTipoGroup .rend-toggle').forEach(b =>
    b.classList.toggle('active', b.dataset.tipo === t));
  renderRendimiento();
}
function setRendFruta(f) {
  rendFruta = f || 'TODAS';
  renderRendimiento();
}

// Devuelve { desde, hasta } en ISO YYYY-MM-DD para la semana lunes->domingo que contiene dateStr
function getWeekRangeMonSun(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const dow = d.getDay();
  const diffToMonday = (dow === 0 ? -6 : 1 - dow);
  const monday = new Date(d); monday.setDate(d.getDate() + diffToMonday);
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
  const fmt = dt => dt.getFullYear() + '-' + String(dt.getMonth()+1).padStart(2,'0') + '-' + String(dt.getDate()).padStart(2,'0');
  return { desde: fmt(monday), hasta: fmt(sunday) };
}

function normFruta(f) { return (f || '').toString().toUpperCase().trim(); }
function turnoMatches(regTurno) {
  if (rendTurno === 'TODOS') return true;
  const t = (regTurno || '').toUpperCase();
  return t.includes(rendTurno);
}

async function renderRendimiento() {
  const chartEl = document.getElementById('chartRendimiento');
  const summaryEl = document.getElementById('rendSummary');
  const noticeEl = document.getElementById('rendReempaqueNotice');
  if (!chartEl || !summaryEl) return;
  if (noticeEl) noticeEl.style.display = 'none';

  if (typeof supabaseClient === 'undefined' || !supabaseClient) {
    summaryEl.innerHTML = '<div class="rend-empty">Supabase no disponible</div>';
    if (chartRendimiento) { chartRendimiento.destroy(); chartRendimiento = null; }
    return;
  }

  const filterDate = document.getElementById('filterDate').value || getLocalToday();
  let desde, hasta, rangeLabel;
  if (rendPeriod === 'week') {
    const r = getWeekRangeMonSun(filterDate);
    desde = r.desde; hasta = r.hasta;
    rangeLabel = 'Semana ' + desde + ' \u2192 ' + hasta;
  } else {
    desde = hasta = filterDate;
    rangeLabel = 'D\u00cda ' + filterDate;
  }

  let prodRows = [], empRows = [];
  try {
    const [prodRes, empRes] = await Promise.all([
      supabaseClient.from('registro_produccion')
        .select('fecha,hora,turno,fruta,consumo_kg,pt_aprox_kg')
        .gte('fecha', desde).lte('fecha', hasta),
      supabaseClient.from('registro_empaque_congelado')
        .select('fecha,hora,turno,fruta,tipo_registro,cajas,kg_pt,kg_presentacion,corte,cuts_detail')
        .gte('fecha', desde).lte('fecha', hasta)
    ]);
    if (prodRes.error) console.warn('rend prod err:', prodRes.error);
    if (empRes.error) console.warn('rend emp err:', empRes.error);
    prodRows = (prodRes.data || []).filter(r => turnoMatches(r.turno));
    empRows  = (empRes.data  || []).filter(r => turnoMatches(r.turno));
  } catch(e) {
    console.error('rend load err', e);
    summaryEl.innerHTML = '<div class="rend-empty">Error al cargar datos</div>';
    if (chartRendimiento) { chartRendimiento.destroy(); chartRendimiento = null; }
    return;
  }

  // Filtro fruta
  if (rendFruta && rendFruta !== 'TODAS') {
    prodRows = prodRows.filter(r => normFruta(r.fruta) === rendFruta);
    empRows  = empRows.filter(r => normFruta(r.fruta) === rendFruta);
  }

  // Filtro tipo_registro (PROCESO / REEMPAQUE / TODOS)
  // PROCESO  → solo empaque directo del dia (cuenta para rendimiento).
  // REEMPAQUE → solo re-empaque (NO aplica rendimiento: se muestra notice).
  // TODOS    → mezcla ambos pero solo el PROCESO cuenta para el calculo.
  const empProceso  = empRows.filter(r => (r.tipo_registro || 'PROCESO') === 'PROCESO');
  const empReempaque = empRows.filter(r => r.tipo_registro === 'REEMPAQUE');

  let empForRend;
  if (rendTipo === 'PROCESO') empForRend = empProceso;
  else if (rendTipo === 'REEMPAQUE') empForRend = []; // no se calcula rendimiento
  else empForRend = empProceso; // TODOS → usa solo PROCESO para el calculo

  // Caso reempaque: mostrar notice y no calcular
  const isReempaqueView = (rendTipo === 'REEMPAQUE') || (rendTipo !== 'PROCESO' && empProceso.length === 0 && empReempaque.length > 0);
  if (isReempaqueView) {
    if (noticeEl) {
      const totKg = empReempaque.reduce((s,r) => s + (parseFloat(r.kg_pt) || 0), 0);
      const totCj = empReempaque.reduce((s,r) => s + (parseInt(r.cajas) || 0), 0);
      noticeEl.innerHTML = '&#128230; Datos de <b>REEMPAQUE</b> en ' + rangeLabel +
        ' &mdash; ' + formatNum(totCj) + ' cajas / ' + formatNum(totKg) + ' kg. ' +
        'No aplica c&aacute;lculo de rendimiento (no es proceso de MP).';
      noticeEl.style.display = 'block';
    }
    summaryEl.innerHTML = '';
    if (chartRendimiento) { chartRendimiento.destroy(); chartRendimiento = null; }
    return;
  }

  const mpByFruit = {};
  prodRows.forEach(r => {
    const f = normFruta(r.fruta);
    if (!f) return;
    mpByFruit[f] = (mpByFruit[f] || 0) + (parseFloat(r.consumo_kg) || 0);
  });

  const kgByFruitCorte = {};
  empForRend.forEach(r => {
    const f = normFruta(r.fruta);
    if (!f) return;
    kgByFruitCorte[f] = kgByFruitCorte[f] || {};
    let detail = null;
    if (r.cuts_detail) {
      try { detail = typeof r.cuts_detail === 'string' ? JSON.parse(r.cuts_detail) : r.cuts_detail; }
      catch(e) { detail = null; }
    }
    const kgPres = parseFloat(r.kg_presentacion) || 0;
    const cajasTot = parseInt(r.cajas) || 0;
    const totalCortesCajas = detail ? Object.values(detail).reduce((s,v)=>s+(parseInt(v)||0),0) : 0;
    if (detail && typeof detail === 'object' && totalCortesCajas > 0 && kgPres > 0) {
      Object.entries(detail).forEach(([corte, cajas]) => {
        const n = parseInt(cajas) || 0;
        if (n > 0) kgByFruitCorte[f][corte] = (kgByFruitCorte[f][corte] || 0) + n * kgPres;
      });
      // Remanente: si el detalle no cubre todas las cajas del registro, asignar al corte principal
      const remanente = cajasTot - totalCortesCajas;
      if (remanente > 0) {
        const corteMain = ((r.corte || '').toString().split(',')[0] || '').trim() || 'SIN DETALLE';
        kgByFruitCorte[f][corteMain] = (kgByFruitCorte[f][corteMain] || 0) + remanente * kgPres;
      }
    } else {
      // Sin cuts_detail o kg_presentacion: usar kg_pt total en el corte principal
      const corte = ((r.corte || '').toString().split(',')[0] || '').trim() || 'SIN CORTE';
      const kg = parseFloat(r.kg_pt) || 0;
      if (kg > 0) kgByFruitCorte[f][corte] = (kgByFruitCorte[f][corte] || 0) + kg;
    }
  });

  const frutasConMP = Object.keys(mpByFruit).filter(f => mpByFruit[f] > 0);
  const frutasSoloEmp = Object.keys(kgByFruitCorte).filter(f => !mpByFruit[f] || mpByFruit[f] <= 0);
  const frutas = [...frutasConMP, ...frutasSoloEmp];

  if (frutas.length === 0) {
    let filtros = [];
    if (rendFruta !== 'TODAS') filtros.push('Fruta: ' + rendFruta);
    if (rendTurno !== 'TODOS') filtros.push('Turno: ' + rendTurno);
    if (rendTipo !== 'TODOS') filtros.push('Tipo: ' + (rendTipo === 'PROCESO' ? 'PROCESO' : rendTipo));
    const extra = filtros.length ? ' (' + filtros.join(', ') + ')' : '';
    summaryEl.innerHTML = '<div class="rend-empty">Sin datos de proceso en ' + rangeLabel + extra + '</div>';
    if (chartRendimiento) { chartRendimiento.destroy(); chartRendimiento = null; }
    return;
  }

  const cortesSet = new Set();
  frutas.forEach(f => Object.keys(kgByFruitCorte[f] || {}).forEach(c => cortesSet.add(c)));
  const cortes = Array.from(cortesSet);

  let html = '<div style="width:100%;font-size:10.5px;color:var(--muted);font-weight:700;letter-spacing:0.3px;margin-bottom:2px;">' + rangeLabel.toUpperCase() + '</div>';
  frutas.forEach(f => {
    const mp = mpByFruit[f] || 0;
    const totalKg = Object.values(kgByFruitCorte[f] || {}).reduce((s,v)=>s+v,0);
    const pct = mp > 0 ? (totalKg / mp * 100) : null;
    const std = REND_STD[f] != null ? REND_STD[f] : 40;
    let cls = '', icon = '\u26aa';
    if (pct == null) { cls = 'mid'; icon = '\u26a0\ufe0f'; }
    else if (pct >= std) { cls = ''; icon = '\ud83d\udfe2'; }
    else if (pct >= std * 0.9) { cls = 'mid'; icon = '\ud83d\udfe1'; }
    else { cls = 'low'; icon = '\ud83d\udd34'; }
    const pctTxt = pct == null ? 'S/ MP' : pct.toFixed(1) + '%';
    html += '<div class="rend-fruit-chip ' + cls + '">' +
      '<span class="rend-icon">' + icon + '</span>' +
      '<span class="rend-name">' + f + '</span>' +
      '<span class="rend-pct">' + pctTxt + '</span>' +
      '<span class="rend-std">Std ' + std + '%</span>' +
      '<span class="rend-mp">MP ' + formatNum(mp) + ' kg</span>' +
    '</div>';
  });
  summaryEl.innerHTML = html;

  const datasets = cortes.map(corte => {
    const data = frutas.map(f => {
      const mp = mpByFruit[f] || 0;
      const kg = (kgByFruitCorte[f] || {})[corte] || 0;
      return mp > 0 ? parseFloat((kg / mp * 100).toFixed(2)) : 0;
    });
    const kgData = frutas.map(f => (kgByFruitCorte[f] || {})[corte] || 0);
    const mpData = frutas.map(f => mpByFruit[f] || 0);
    const ds = {
      label: corte,
      data: data,
      backgroundColor: colorForCorte(corte),
      borderColor: colorForCorte(corte),
      borderWidth: 0,
      borderSkipped: false,
      borderRadius: 4
    };
    ds.kgData = kgData; ds.mpData = mpData;
    return ds;
  });

  if (chartRendimiento) chartRendimiento.destroy();
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  const textColor = isLight ? '#0f172a' : '#e2e8f0';
  const gridColor = isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)';

  chartRendimiento = new Chart(chartEl.getContext('2d'), {
    type: 'bar',
    data: { labels: frutas, datasets: datasets },
    options: {
      indexAxis: 'y',
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: textColor, font: { family: 'Plus Jakarta Sans', weight: '600', size: 11 }, padding: 10, boxWidth: 12, boxHeight: 12 }
        },
        tooltip: {
          callbacks: {
            label: function(ctx) {
              const ds = ctx.dataset;
              const kg = ds.kgData ? ds.kgData[ctx.dataIndex] : 0;
              return ' ' + ds.label + ': ' + (ctx.raw).toFixed(1) + '%  (' + formatNum(kg) + ' kg)';
            },
            footer: function(items) {
              if (!items.length) return '';
              const idx = items[0].dataIndex;
              const ds0 = items[0].dataset;
              const mp = ds0.mpData ? ds0.mpData[idx] : 0;
              let total = 0;
              chartRendimiento.data.datasets.forEach(d => { total += (d.data[idx] || 0); });
              const fruta = chartRendimiento.data.labels[idx];
              const std = REND_STD[fruta] != null ? REND_STD[fruta] : 40;
              const vsStd = total - std;
              const sign = vsStd >= 0 ? '+' : '';
              return 'MP: ' + formatNum(mp) + ' kg  |  Rend total: ' + total.toFixed(1) + '%  (' + sign + vsStd.toFixed(1) + ' vs Std ' + std + '%)';
            }
          }
        },
        datalabels: {
          color: '#fff',
          font: { weight: '800', size: 10.5, family: 'Plus Jakarta Sans' },
          formatter: function(v) { return (v && v >= 3) ? v.toFixed(1) + '%' : ''; },
          display: function(ctx) { return ctx.raw >= 3; }
        }
      },
      scales: {
        x: {
          stacked: true,
          ticks: { color: textColor, font: { size: 10 }, callback: function(v){ return v + '%'; } },
          grid: { color: gridColor },
          title: { display: true, text: 'Rendimiento (kg empacado / kg MP)', color: textColor, font: { size: 10.5, weight: '700' } }
        },
        y: {
          stacked: true,
          ticks: { color: textColor, font: { size: 12, weight: '800' } },
          grid: { display: false }
        }
      }
    },
    plugins: [ChartDataLabels]
  });
}

// ═══════════════ SUPABASE LOAD ═══════════════
// Carga los registros de Supabase para la fecha dada (o la del filtro / hoy por defecto)
// y los fusiona con localStorage. Supabase tiene prioridad y gana en duplicados (fecha|hora|turno).
async function loadFromSupabase(targetFecha) {
  if (typeof supabaseClient === 'undefined' || !supabaseClient) {
    console.warn('Supabase no disponible');
    refreshAll();
    return;
  }
  try {
    const filterEl = document.getElementById('filterDate');
    const fecha = targetFecha
      || (filterEl && filterEl.value)
      || getLocalToday();

    const { data, error } = await supabaseClient
      .from('registro_empaque_congelado')
      .select('*')
      .eq('fecha', fecha)
      .order('hora');

    if (error) {
      console.error('Supabase load error:', error);
      refreshAll();
      return;
    }

    const supaRecords = (data || []).map(d => ({
      ...d,
      id: d.id != null ? String(d.id) : (Date.now().toString(36) + Math.random().toString(36).substr(2,5)),
      cajas: parseInt(d.cajas) || 0,
      kg_pt: parseFloat(d.kg_pt) || 0,
      kg_presentacion: parseFloat(d.kg_presentacion) || 0,
      operarios: parseInt(d.operarios) || 0,
      cj_hr: parseInt(d.cj_hr) || 0,
      cj_hr_op: parseFloat(d.cj_hr_op) || 0
    }));

    const localRecords = getRecords();
    const otherDays = localRecords.filter(r => r.fecha !== fecha);
    const localSameDay = localRecords.filter(r => r.fecha === fecha);

    // Dedup por fecha|hora|turno, Supabase gana
    const dedup = new Map();
    const keyOf = r => (r.fecha || '') + '|' + (r.hora || '') + '|' + (r.turno || '');
    supaRecords.forEach(r => dedup.set(keyOf(r), r));
    localSameDay.forEach(r => { const k = keyOf(r); if (!dedup.has(k)) dedup.set(k, r); });

    const mergedSameDay = Array.from(dedup.values());
    const merged = [...otherDays, ...mergedSameDay];
    saveRecords(merged);
    refreshAll();
  } catch(e) {
    console.log('Supabase offline', e);
    refreshAll();
  }
}

async function checkSupabaseConnectionEmpaque() {
  const indicator = document.getElementById('supabaseStatus');
  if (!indicator) return;
  if (typeof supabaseClient === 'undefined' || !supabaseClient) {
    indicator.style.background = '#ef4444';
    indicator.title = 'Supabase: NO conectado';
    return;
  }
  try {
    // Try a simple query; table may not exist yet so we handle gracefully
    const { error } = await supabaseClient.from('registro_empaque_congelado').select('fecha').limit(1);
    if (error) {
      indicator.style.background = '#f59e0b';
      indicator.title = 'Supabase: Tabla pendiente - ' + error.message;
    } else {
      indicator.style.background = '#16a34a';
      indicator.title = 'Supabase: Conectado';
    }
  } catch(e) {
    indicator.style.background = '#ef4444';
    indicator.title = 'Supabase: Sin conexion';
  }
}

// ═══════════════ INIT ═══════════════
(function init() {
  // Restore saved fields
  const savedSup = localStorage.getItem('empaque_cong_supervisor');
  if (savedSup) document.getElementById('fSupervisor').value = savedSup;
  const savedCliente = localStorage.getItem('empaque_cong_cliente');
  if (savedCliente) document.getElementById('fCliente').value = savedCliente;

  // Set today's date
  const d = new Date();
  const today = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  document.getElementById('fFecha').value = today;
  document.getElementById('filterDate').value = today;

  // Set default hour based on current time
  const currentHour = d.getHours();
  const hourStr = String(currentHour).padStart(2,'0') + ':00-' + String(currentHour + 1).padStart(2,'0') + ':00';
  const horaSelect = document.getElementById('fHora');
  for (let i = 0; i < horaSelect.options.length; i++) {
    if (horaSelect.options[i].value === hourStr) {
      horaSelect.selectedIndex = i;
      break;
    }
  }

  refreshAll();
  loadFromSupabase();
  checkSupabaseConnectionEmpaque();
})();
