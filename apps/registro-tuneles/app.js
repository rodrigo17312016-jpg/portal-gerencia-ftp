/* ═══════════════ CONSTANTS ═══════════════ */
const LS_KEY = 'tuneles_registros';
const SUPA_TABLE = 'registro_tuneles';
const STD_HRS_DEFAULT = { MANGO:1.5, FRESA:1.5, PALTA:2, ARANDANO:2, 'PIÑA':1.5, GRANADA:1.8 };
const STD_HRS = Object.assign({}, STD_HRS_DEFAULT);
const LS_STD_KEY = 'tuneles_std_custom';

// Load custom standards from localStorage
(function loadCustomStd() {
  try {
    const raw = localStorage.getItem(LS_STD_KEY);
    if (raw) {
      const custom = JSON.parse(raw);
      Object.keys(custom).forEach(k => { STD_HRS[k] = custom[k]; });
    }
  } catch(e) {}
})();

/* ═══════════════ ICE CURSOR TRAIL ═══════════════ */
(function() {
  let lastTrail = 0;
  document.addEventListener('mousemove', function(e) {
    const now = Date.now();
    if (now - lastTrail < 50) return;
    lastTrail = now;
    const dot = document.createElement('div');
    dot.className = 'ice-trail';
    dot.style.left = (e.clientX + (Math.random() * 10 - 5)) + 'px';
    dot.style.top = (e.clientY + (Math.random() * 10 - 5)) + 'px';
    document.body.appendChild(dot);
    setTimeout(function() { dot.remove(); }, 600);
  });
})();

let records = [];
let editIndex = -1;
let chartInstances = {};
let activeCyclesTimer = null;
let previousChartDataJSON = '';

// Filter chip state
let chipFilters = { turno: '', tunel: '', estado: '' };

/* ═══════════════ LIVE CLOCK ═══════════════ */
function updateLiveClock() {
  const now = getPeruDate();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  const el = document.getElementById('liveClock');
  if (el) el.textContent = hh + ':' + mm + ':' + ss;
}
setInterval(updateLiveClock, 1000);
updateLiveClock();

/* ═══════════════ STANDARD CYCLE DISPLAY ═══════════════ */
function updateStdCycleDisplay() {
  const fruta = document.getElementById('fFruta').value;
  const std = STD_HRS[fruta] || 1.5;
  const defaultStd = STD_HRS_DEFAULT[fruta] || 1.5;
  const isCustom = std !== defaultStd;
  const el = document.getElementById('stdCycleValue');
  if (el) el.textContent = std + ' hrs (' + fruta + ')' + (isCustom ? ' *' : '');

  // Hide edit input, show value
  const inp = document.getElementById('stdCycleInput');
  const editBtn = document.getElementById('stdCycleEditBtn');
  const restoreBtn = document.getElementById('stdCycleRestoreBtn');
  if (inp) inp.style.display = 'none';
  if (editBtn) editBtn.style.display = '';
  if (restoreBtn) restoreBtn.style.display = isCustom ? '' : 'none';
  if (el) el.style.display = '';
}

function enableStdCycleEdit() {
  const fruta = document.getElementById('fFruta').value;
  const std = STD_HRS[fruta] || 1.5;
  const el = document.getElementById('stdCycleValue');
  const inp = document.getElementById('stdCycleInput');
  const editBtn = document.getElementById('stdCycleEditBtn');
  if (el) el.style.display = 'none';
  if (editBtn) editBtn.style.display = 'none';
  if (inp) {
    inp.value = std;
    inp.style.display = '';
    inp.focus();
    inp.select();
  }
}

function saveCustomStd() {
  const fruta = document.getElementById('fFruta').value;
  const inp = document.getElementById('stdCycleInput');
  const val = parseFloat(inp.value);
  if (!val || val <= 0) { updateStdCycleDisplay(); return; }
  STD_HRS[fruta] = +val.toFixed(2);
  // Persist custom values
  try {
    const raw = localStorage.getItem(LS_STD_KEY);
    const custom = raw ? JSON.parse(raw) : {};
    custom[fruta] = STD_HRS[fruta];
    localStorage.setItem(LS_STD_KEY, JSON.stringify(custom));
  } catch(e) {}
  updateStdCycleDisplay();
  showToast('Ciclo estandar de ' + fruta + ' actualizado a ' + STD_HRS[fruta] + ' hrs', '#0891b2');
}

function restoreDefaultStd() {
  const fruta = document.getElementById('fFruta').value;
  STD_HRS[fruta] = STD_HRS_DEFAULT[fruta] || 1.5;
  // Remove from custom storage
  try {
    const raw = localStorage.getItem(LS_STD_KEY);
    const custom = raw ? JSON.parse(raw) : {};
    delete custom[fruta];
    localStorage.setItem(LS_STD_KEY, JSON.stringify(custom));
  } catch(e) {}
  updateStdCycleDisplay();
  showToast('Ciclo estandar de ' + fruta + ' restaurado a valor por defecto', '#16a34a');
}

/* ═══════════════ FILTER CHIPS ═══════════════ */
function setFilterChip(btn) {
  const filterType = btn.getAttribute('data-filter');
  const filterValue = btn.getAttribute('data-value');
  chipFilters[filterType] = filterValue;

  // Update active state for this group
  const group = btn.parentElement;
  group.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');

  renderAll();
}

/* ═══════════════ INIT ═══════════════ */
document.addEventListener('DOMContentLoaded', async () => {
  const today = getLocalToday();
  document.getElementById('fFecha').value = today;
  document.getElementById('filterDate').value = today;

  // Restore operator
  const savedOp = localStorage.getItem('tunel_operador');
  if (savedOp) document.getElementById('fOperador').value = savedOp;

  // Auto-set turno (Peru: DIA 07:00-19:00, NOCHE 19:00-06:00 del dia siguiente)
  const peruNow = getPeruDate();
  const hour = peruNow.getHours();
  document.getElementById('fTurno').value = (hour >= 7 && hour < 19) ? 'TURNO DIA' : 'TURNO NOCHE';

  // Si es turno noche (00:00-06:00), la fecha de produccion es del dia ANTERIOR
  const prodDate = getProductionDate();
  document.getElementById('fFecha').value = prodDate;
  document.getElementById('filterDate').value = prodDate;

  // Init standard cycle display
  updateStdCycleDisplay();

  // Load data
  await loadData();

  // Auto-refresh data every 30 seconds
  setInterval(async () => { await loadData(); }, 30000);

  // Active cycles timer: update elapsed time every 5 seconds
  activeCyclesTimer = setInterval(() => { renderActiveCycles(); renderTunnelCards(); }, 5000);

  // Check supabase connection
  checkSupabaseConnectionTunel();
});

/* ═══════════════ THEME ═══════════════ */
function toggleTheme() {
  const curr = document.documentElement.getAttribute('data-theme');
  document.documentElement.setAttribute('data-theme', curr === 'light' ? '' : 'light');
  localStorage.setItem('tunel_theme', curr === 'light' ? 'dark' : 'light');
  // Force chart rebuild with new theme colors
  previousChartDataJSON = '';
  renderAll();
}
(function() {
  const saved = localStorage.getItem('tunel_theme');
  if (saved === 'light') document.documentElement.setAttribute('data-theme', 'light');
})();

/* ═══════════════ SUPABASE CONNECTION CHECK ═══════════════ */
async function checkSupabaseConnectionTunel() {
  const indicator = document.getElementById('supabaseStatus');
  const label = document.getElementById('supabaseStatusLabel');
  if (!indicator) return;
  const setStatus = (connected, text, tooltip) => {
    indicator.style.background = connected ? '#16a34a' : '#ef4444';
    indicator.title = tooltip || text;
    if (label) {
      label.textContent = text;
      label.classList.toggle('connected', connected);
    }
  };
  if (typeof supabaseClient === 'undefined' || !supabaseClient) {
    setStatus(false, 'SIN CONEXION', 'Supabase: NO conectado');
    return false;
  }
  try {
    const { error } = await supabaseClient.from(SUPA_TABLE).select('fecha').limit(1);
    if (error) {
      setStatus(false, 'ERROR', 'Supabase: ' + error.message);
      return false;
    }
    setStatus(true, 'CONECTADO', 'Supabase: Conectado');
    return true;
  } catch(e) {
    setStatus(false, 'SIN CONEXION', 'Supabase: Sin conexion');
    return false;
  }
}

/* ═══════════════ DATA LOAD / SAVE ═══════════════ */
async function loadData() {
  const today = document.getElementById('filterDate').value || getLocalToday();
  let supaRecords = [];
  let localRecords = [];

  // Load from Supabase
  if (typeof supabaseClient !== 'undefined' && supabaseClient) {
    try {
      const { data, error } = await supabaseClient
        .from(SUPA_TABLE)
        .select('*')
        .eq('fecha', today)
        .order('hora_inicio', { ascending: true });
      if (!error && data) supaRecords = data;
    } catch(e) { console.warn('Supabase load error:', e); }
  }

  // Load from localStorage
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const all = JSON.parse(raw);
      localRecords = all.filter(r => r.fecha === today);
    }
  } catch(e) {}

  // Normalize hora_inicio / hora_fin: strip seconds so "07:00:00" becomes "07:00"
  const normalizeTime = (r) => {
    if (r.hora_inicio && r.hora_inicio.length > 5) r.hora_inicio = r.hora_inicio.substring(0, 5);
    if (r.hora_fin && r.hora_fin.length > 5) r.hora_fin = r.hora_fin.substring(0, 5);
    return r;
  };
  supaRecords.forEach(normalizeTime);
  localRecords.forEach(normalizeTime);

  // Merge: Supabase takes priority, deduplicate by fecha|tunel|hora_inicio
  const dedup = new Map();
  const makeKey = r => r.fecha + '|' + r.tunel + '|' + r.hora_inicio;
  // Supabase records first (higher priority)
  supaRecords.forEach(r => dedup.set(makeKey(r), r));
  // Local records only if not already present
  localRecords.forEach(r => { const k = makeKey(r); if (!dedup.has(k)) dedup.set(k, r); });
  records = Array.from(dedup.values());

  records.sort((a,b) => (a.hora_inicio || '').localeCompare(b.hora_inicio || ''));
  renderAll();
  checkSupabaseConnectionTunel();
}

async function saveRecord(rec) {
  // Save to localStorage
  try {
    const raw = localStorage.getItem(LS_KEY);
    let all = raw ? JSON.parse(raw) : [];
    // Remove existing with same key
    all = all.filter(r => !(r.fecha === rec.fecha && r.tunel === rec.tunel && r.hora_inicio === rec.hora_inicio));
    all.push(rec);
    localStorage.setItem(LS_KEY, JSON.stringify(all));
  } catch(e) {}

  // Save operator
  if (rec.operador) localStorage.setItem('tunel_operador', rec.operador);

  // Save to Supabase
  if (typeof supabaseClient !== 'undefined' && supabaseClient) {
    try {
      const { error } = await supabaseClient
        .from(SUPA_TABLE)
        .upsert(rec, { onConflict: 'fecha,tunel,hora_inicio' });
      if (error) {
        console.error('Supabase upsert error:', error);
        showToast('Error Supabase: ' + error.message, '#ef4444');
      } else {
        showToast('Guardado en Supabase \u2705', '#16a34a');
      }
    } catch(e) {
      showToast('Sin conexion - guardado local', '#f59e0b');
    }
  } else {
    showToast('Guardado local (sin Supabase)', '#f59e0b');
  }
}

async function deleteRecord(idx) {
  const rec = records[idx];
  if (!rec) return;
  if (!confirm('Eliminar este ciclo?')) return;

  // Remove from localStorage
  try {
    const raw = localStorage.getItem(LS_KEY);
    let all = raw ? JSON.parse(raw) : [];
    all = all.filter(r => !(r.fecha === rec.fecha && r.tunel === rec.tunel && r.hora_inicio === rec.hora_inicio));
    localStorage.setItem(LS_KEY, JSON.stringify(all));
  } catch(e) {}

  // Remove from Supabase
  if (typeof supabaseClient !== 'undefined' && supabaseClient) {
    try {
      await supabaseClient
        .from(SUPA_TABLE)
        .delete()
        .eq('fecha', rec.fecha)
        .eq('tunel', rec.tunel)
        .eq('hora_inicio', rec.hora_inicio);
    } catch(e) {}
  }

  records.splice(idx, 1);
  renderAll();
  showToast('Registro eliminado', '#ef4444');
}

/* ═══════════════ CALCULATIONS ═══════════════ */
function calcHrs(hi, hf) {
  if (!hi || !hf) return null;
  const [h1,m1] = hi.split(':').map(Number);
  const [h2,m2] = hf.split(':').map(Number);
  let mins = (h2*60+m2) - (h1*60+m1);
  if (mins < 0) mins += 1440; // crosses midnight
  return +(mins / 60).toFixed(2);
}

function calcEfic(hrs, fruta) {
  if (!hrs || hrs <= 0) return null;
  const std = STD_HRS[fruta] || 1.5;
  return +((std / hrs) * 100).toFixed(1);
}

function getEficClass(efic) {
  if (efic === null || efic === undefined) return '';
  if (efic >= 100) return 'green';
  if (efic >= 80) return 'amber';
  return 'red';
}

function getEficBadge(efic) {
  if (efic === null || efic === undefined) return '--';
  const cls = efic >= 100 ? 'badge-green' : efic >= 80 ? 'badge-amber' : 'badge-red';
  return `<span class="badge ${cls}">${efic}%</span>`;
}

/* ═══════════════ ELAPSED TIME ═══════════════ */
function getElapsedStr(horaInicio) {
  if (!horaInicio) return '--';
  const now = new Date();
  const [h, m] = horaInicio.split(':').map(Number);
  const start = new Date(now);
  start.setHours(h, m, 0, 0);
  // If start is in the future (crossed midnight scenario), adjust
  if (start > now) start.setDate(start.getDate() - 1);
  let diffMs = now - start;
  if (diffMs < 0) diffMs = 0;
  const totalMin = Math.floor(diffMs / 60000);
  const hrs = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  return hrs + 'h ' + String(mins).padStart(2, '0') + 'm';
}

function getElapsedMinutes(horaInicio) {
  if (!horaInicio) return 0;
  const now = new Date();
  const [h, m] = horaInicio.split(':').map(Number);
  const start = new Date(now);
  start.setHours(h, m, 0, 0);
  if (start > now) start.setDate(start.getDate() - 1);
  let diffMs = now - start;
  if (diffMs < 0) diffMs = 0;
  return Math.floor(diffMs / 60000);
}

function getRemainingStr(horaInicio, fruta) {
  if (!horaInicio) return '--';
  const stdMinutes = (STD_HRS[fruta] || 1.5) * 60;
  const elapsedMin = getElapsedMinutes(horaInicio);
  const remaining = stdMinutes - elapsedMin;
  if (remaining > 0) {
    const hrs = Math.floor(remaining / 60);
    const mins = Math.round(remaining % 60);
    return hrs > 0 ? hrs + 'h ' + String(mins).padStart(2,'0') + 'm' : mins + 'm';
  } else {
    const exceeded = Math.abs(Math.round(remaining));
    return '\u26a0\ufe0f EXCEDIDO +' + exceeded + 'm';
  }
}

function isTimeExceeded(horaInicio, fruta) {
  if (!horaInicio) return false;
  const stdMinutes = (STD_HRS[fruta] || 1.5) * 60;
  const elapsedMin = getElapsedMinutes(horaInicio);
  return elapsedMin > stdMinutes;
}

/* ═══════════════ STEP 1: REGISTRAR INICIO DE CICLO ═══════════════ */
function registrarInicioCiclo() {
  const fecha = document.getElementById('fFecha').value;
  const turno = document.getElementById('fTurno').value;
  const tunel = document.getElementById('fTunel').value;
  const fruta = document.getElementById('fFruta').value;
  const hora_inicio = document.getElementById('fHoraInicio').value;
  const coches = parseInt(document.getElementById('fCoches').value) || 0;
  const kg = parseFloat(document.getElementById('fKg').value) || 0;
  const temp_ingreso = parseFloat(document.getElementById('fTempIn').value) || 0;
  const operador = document.getElementById('fOperador').value.trim();
  const observacion = document.getElementById('fObservacion').value.trim();

  if (!fecha || !hora_inicio) {
    showToast('Completa fecha y hora inicio', '#ef4444');
    return;
  }
  if (!operador) {
    showToast('Ingresa el nombre del operador', '#ef4444');
    return;
  }

  // Check if this tunnel already has an active cycle today
  const activeCycle = records.find(r => r.tunel === tunel && !r.hora_fin && r.fecha === fecha);
  if (activeCycle) {
    showToast('Este tunel ya tiene un ciclo activo. Finalicelo primero.', '#ef4444');
    return;
  }

  const rec = {
    fecha, turno, tunel, fruta, hora_inicio,
    hora_fin: null,
    coches, kg, temp_ingreso,
    temp_final: null,
    hrs_congelamiento: null,
    eficiencia: null,
    operador, observacion
  };

  saveRecord(rec).then(() => loadData());
  limpiarFormulario();
  showToast('Inicio de ciclo registrado - Tunel CONGELANDO', '#0891b2');
}

/* ═══════════════ STEP 2: FINALIZAR CICLO ═══════════════ */
async function finalizarCiclo(idx) {
  const rec = records[idx];
  if (!rec) return;

  const tempInput = document.getElementById('tempFinal_' + idx);
  const tempFinal = tempInput ? parseFloat(tempInput.value) : null;

  if (tempFinal === null || isNaN(tempFinal)) {
    showToast('Ingresa la Temp. Final para finalizar', '#ef4444');
    return;
  }

  // Use the manual hora_fin input if available
  const horaFinInput = document.getElementById('horaFin_' + idx);
  let hora_fin;
  if (horaFinInput && horaFinInput.value) {
    hora_fin = horaFinInput.value;
  } else {
    const now = new Date();
    hora_fin = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
  }

  const hrs_congelamiento = calcHrs(rec.hora_inicio, hora_fin);
  const eficiencia = calcEfic(hrs_congelamiento, rec.fruta);

  const updatedRec = {
    ...rec,
    hora_fin,
    temp_final: tempFinal,
    hrs_congelamiento,
    eficiencia
  };

  await saveRecord(updatedRec);
  await loadData();
  showToast('Ciclo finalizado - ' + rec.tunel + ' DISPONIBLE', '#16a34a');
}

function limpiarFormulario() {
  document.getElementById('fHoraInicio').value = '';
  document.getElementById('fCoches').value = '10';
  document.getElementById('fKg').value = '850';
  document.getElementById('fTempIn').value = '';
  document.getElementById('fObservacion').value = '';
  editIndex = -1;
  updateStdCycleDisplay();
}

/* ═══════════════ EDIT MODAL ═══════════════ */
function editRecord(idx) {
  const r = records[idx];
  if (!r) return;
  if (!r.hora_fin) {
    showToast('Este ciclo esta en proceso. Use "Finalizar Ciclo" para completarlo.', '#f59e0b');
    return;
  }
  editIndex = idx;

  // Populate modal fields
  document.getElementById('editFecha').value = r.fecha || '';
  document.getElementById('editTurno').value = r.turno || 'TURNO DIA';
  document.getElementById('editTunel').value = r.tunel || 'TUNEL ESTATICO 1';
  document.getElementById('editFruta').value = r.fruta || 'MANGO';
  document.getElementById('editHoraInicio').value = r.hora_inicio || '';
  document.getElementById('editHoraFin').value = r.hora_fin || '';
  document.getElementById('editCoches').value = r.coches || 0;
  document.getElementById('editKg').value = r.kg || 0;
  document.getElementById('editTempIn').value = r.temp_ingreso || '';
  document.getElementById('editTempOut').value = r.temp_final || '';
  document.getElementById('editOperador').value = r.operador || '';
  document.getElementById('editObservacion').value = r.observacion || '';

  document.getElementById('editModalOverlay').style.display = 'flex';
}

function closeEditModal(event) {
  if (event && event.target !== event.currentTarget) return;
  document.getElementById('editModalOverlay').style.display = 'none';
  editIndex = -1;
}

async function saveEditModal() {
  if (editIndex < 0) return;
  const oldRec = records[editIndex];

  // First delete the old record
  try {
    const raw = localStorage.getItem(LS_KEY);
    let all = raw ? JSON.parse(raw) : [];
    all = all.filter(r => !(r.fecha === oldRec.fecha && r.tunel === oldRec.tunel && r.hora_inicio === oldRec.hora_inicio));
    localStorage.setItem(LS_KEY, JSON.stringify(all));
  } catch(e) {}

  if (typeof supabaseClient !== 'undefined' && supabaseClient) {
    try {
      await supabaseClient
        .from(SUPA_TABLE)
        .delete()
        .eq('fecha', oldRec.fecha)
        .eq('tunel', oldRec.tunel)
        .eq('hora_inicio', oldRec.hora_inicio);
    } catch(e) {}
  }

  // Build updated record
  const fecha = document.getElementById('editFecha').value;
  const turno = document.getElementById('editTurno').value;
  const tunel = document.getElementById('editTunel').value;
  const fruta = document.getElementById('editFruta').value;
  const hora_inicio = document.getElementById('editHoraInicio').value;
  const hora_fin = document.getElementById('editHoraFin').value;
  const coches = parseInt(document.getElementById('editCoches').value) || 0;
  const kg = parseFloat(document.getElementById('editKg').value) || 0;
  const temp_ingreso = parseFloat(document.getElementById('editTempIn').value) || 0;
  const temp_final = parseFloat(document.getElementById('editTempOut').value) || null;
  const operador = document.getElementById('editOperador').value.trim();
  const observacion = document.getElementById('editObservacion').value.trim();

  const hrs_congelamiento = calcHrs(hora_inicio, hora_fin);
  const eficiencia = calcEfic(hrs_congelamiento, fruta);

  const updatedRec = {
    fecha, turno, tunel, fruta, hora_inicio, hora_fin,
    coches, kg, temp_ingreso, temp_final,
    hrs_congelamiento, eficiencia,
    operador, observacion
  };

  await saveRecord(updatedRec);
  document.getElementById('editModalOverlay').style.display = 'none';
  editIndex = -1;
  await loadData();
  showToast('Registro actualizado correctamente', '#16a34a');
}

/* ═══════════════ UI HELPERS ═══════════════ */
function toggleSection(id) {
  const body = document.getElementById(id);
  const chev = document.getElementById(id + 'Chev');
  body.classList.toggle('collapsed');
  if (chev) chev.classList.toggle('collapsed');
}

function showToast(msg, color) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  t.style.background = color || '#16a34a';
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 3000);
}

function getCurrentTimeStr() {
  const now = new Date();
  return String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
}

/* ═══════════════ RENDER ALL ═══════════════ */
function renderAll() {
  // Deduplicate records by fecha|tunel|hora_inicio (keep latest version)
  const dedupMap = new Map();
  records.forEach(r => {
    const key = (r.fecha||'') + '|' + (r.tunel||'') + '|' + (r.hora_inicio||'');
    dedupMap.set(key, r);
  });
  records = Array.from(dedupMap.values());
  records.sort((a,b) => (a.hora_inicio || '').localeCompare(b.hora_inicio || ''));

  // Apply chip filters + date filter
  let filtered = records;

  if (chipFilters.turno) {
    filtered = filtered.filter(r => r.turno === chipFilters.turno);
  }
  if (chipFilters.tunel) {
    filtered = filtered.filter(r => r.tunel === chipFilters.tunel);
  }
  if (chipFilters.estado === 'completado') {
    filtered = filtered.filter(r => r.hora_fin);
  } else if (chipFilters.estado === 'en_proceso') {
    filtered = filtered.filter(r => !r.hora_fin);
  }

  renderTunnelCards();
  renderActiveCycles();
  renderKPIs(filtered);
  renderTable(filtered);
  renderCharts(filtered);
}

/* ═══════════════ TUNNEL STATUS CARDS ═══════════════ */
function renderTunnelCards() {
  [1,2,3].forEach(n => {
    const tunel = 'TUNEL ESTATICO ' + n;
    const card = document.getElementById('tunnel' + n + 'Card');
    const badge = document.getElementById('tunnel' + n + 'Badge');
    const cochesEl = document.getElementById('tunnel' + n + 'Coches');
    const tempEl = document.getElementById('tunnel' + n + 'Temp');
    const lastEl = document.getElementById('tunnel' + n + 'Last');
    const timersEl = document.getElementById('tunnel' + n + 'Timers');
    const elapsedEl = document.getElementById('tunnel' + n + 'Elapsed');
    const remainingEl = document.getElementById('tunnel' + n + 'Remaining');

    const tunelRecs = records.filter(r => r.tunel === tunel);
    const lastRec = tunelRecs.length > 0 ? tunelRecs[tunelRecs.length - 1] : null;

    if (lastRec) {
      const isActive = lastRec.hora_fin === null || lastRec.hora_fin === '' || lastRec.hora_fin === '--' || !lastRec.hora_fin;

      // Manage fog element
      let fog = card.querySelector('.tunnel-fog');
      if (isActive) {
        if (!fog) { fog = document.createElement('div'); fog.className = 'tunnel-fog'; card.appendChild(fog); }
        card.className = 'tunnel-card congelando';
        badge.className = 'tunnel-status-badge congelando';
        badge.textContent = 'CONGELANDO';

        // Show timer boxes
        timersEl.style.display = 'grid';
        elapsedEl.textContent = getElapsedStr(lastRec.hora_inicio);
        const remStr = getRemainingStr(lastRec.hora_inicio, lastRec.fruta);
        remainingEl.textContent = remStr;
        if (isTimeExceeded(lastRec.hora_inicio, lastRec.fruta)) {
          remainingEl.className = 'ttb-value exceeded';
        } else {
          remainingEl.className = 'ttb-value';
        }
      } else {
        if (fog) fog.remove();
        card.className = 'tunnel-card espera';
        badge.className = 'tunnel-status-badge espera';
        badge.textContent = 'DISPONIBLE';
        timersEl.style.display = 'none';
      }

      cochesEl.textContent = lastRec.coches || 0;
      tempEl.textContent = lastRec.temp_final ? lastRec.temp_final + '\u00B0C' : (isActive ? 'En proceso' : '--');
      lastEl.textContent = lastRec.hora_inicio || '--';
    } else {
      card.className = 'tunnel-card espera';
      badge.className = 'tunnel-status-badge espera';
      badge.textContent = 'DISPONIBLE';
      cochesEl.textContent = '0';
      tempEl.textContent = '--';
      lastEl.textContent = '--';
      timersEl.style.display = 'none';
    }
  });
}

/* ═══════════════ ACTIVE CYCLES LIST ═══════════════ */
function renderActiveCycles() {
  const container = document.getElementById('activeCyclesList');
  const today = getLocalToday();
  const activeCycles = records.filter(r => !r.hora_fin && r.fecha === today);

  if (activeCycles.length === 0) {
    container.innerHTML = '<div class="no-active-cycles">No hay ciclos activos en este momento</div>';
    return;
  }

  // Preserve user input values before re-render
  const savedInputs = {};
  activeCycles.forEach(r => {
    const idx = records.indexOf(r);
    const hfEl = document.getElementById('horaFin_' + idx);
    const tfEl = document.getElementById('tempFinal_' + idx);
    if (hfEl) savedInputs['horaFin_' + idx] = hfEl.value;
    if (tfEl && tfEl.value) savedInputs['tempFinal_' + idx] = tfEl.value;
  });

  // Only do full rebuild if cycle count changed
  const existingItems = container.querySelectorAll('.active-cycle-item').length;
  const needsRebuild = existingItems !== activeCycles.length;

  if (!needsRebuild) {
    // Just update timers, don't touch inputs
    activeCycles.forEach(r => {
      const idx = records.indexOf(r);
      const elapsed = getElapsedStr(r.hora_inicio);
      const remaining = getRemainingStr(r.hora_inicio, r.fruta);
      const exceeded = isTimeExceeded(r.hora_inicio, r.fruta);
      const elapsedEl = document.getElementById('elapsed_' + idx);
      const remainEl = document.getElementById('remain_' + idx);
      if (elapsedEl) elapsedEl.textContent = elapsed;
      if (remainEl) {
        remainEl.textContent = remaining;
        remainEl.style.color = exceeded ? 'var(--rojo)' : '';
      }
    });
    return;
  }

  let html = '';
  activeCycles.forEach(r => {
    const idx = records.indexOf(r);
    const elapsed = getElapsedStr(r.hora_inicio);
    const remaining = getRemainingStr(r.hora_inicio, r.fruta);
    const exceeded = isTimeExceeded(r.hora_inicio, r.fruta);
    const currentTime = getCurrentTimeStr();

    html += `<div class="active-cycle-item">
      <div class="active-cycle-info">
        <div class="active-cycle-stat">
          <div class="stat-label">Tunel</div>
          <div class="stat-value"><span class="badge badge-cyan">${r.tunel}</span></div>
        </div>
        <div class="active-cycle-stat">
          <div class="stat-label">Fruta</div>
          <div class="stat-value">${r.fruta}</div>
        </div>
        <div class="active-cycle-stat">
          <div class="stat-label">Hora Inicio</div>
          <div class="stat-value">${r.hora_inicio}</div>
        </div>
        <div class="active-cycle-stat">
          <div class="stat-label">Coches</div>
          <div class="stat-value">${r.coches}</div>
        </div>
        <div class="active-cycle-stat">
          <div class="stat-label">Kg</div>
          <div class="stat-value">${r.kg}</div>
        </div>
        <div class="active-cycle-stat">
          <div class="stat-label">Tiempo Transcurrido</div>
          <div class="stat-value timer" id="elapsed_${idx}">${elapsed}</div>
        </div>
        <div class="active-cycle-stat">
          <div class="stat-label">Tiempo Restante</div>
          <div class="stat-value timer" id="remain_${idx}" style="${exceeded ? 'color:var(--rojo)' : ''}">${remaining}</div>
        </div>
      </div>
      <div class="active-cycle-actions">
        <div class="form-group" style="margin:0;gap:3px">
          <label style="font-size:9px">Hora Final</label>
          <input type="time" id="horaFin_${idx}" value="${savedInputs['horaFin_'+idx] || currentTime}" step="60">
        </div>
        <div class="form-group" style="margin:0;gap:3px">
          <label style="font-size:9px">Temp. Final &deg;C</label>
          <input type="number" id="tempFinal_${idx}" placeholder="-22" step="0.1" value="${savedInputs['tempFinal_'+idx] || ''}">
        </div>
        <button class="btn btn-success" onclick="finalizarCiclo(${idx})" style="padding:10px 18px;font-size:13px">\u2705 Finalizar Ciclo</button>
      </div>
    </div>`;
  });

  container.innerHTML = html;
}

/* ═══════════════ KPIs ═══════════════ */
function renderKPIs(data) {
  const completados = data.filter(r => r.hora_fin).length;
  const enProceso = data.filter(r => !r.hora_fin).length;
  const coches = data.reduce((s,r) => s + (r.coches || 0), 0);
  const kg = data.reduce((s,r) => s + (r.kg || 0), 0);
  const completedData = data.filter(r => r.hora_fin);
  const efics = completedData.filter(r => r.eficiencia != null).map(r => r.eficiencia);
  const avgEfic = efics.length ? (efics.reduce((a,b)=>a+b,0)/efics.length).toFixed(1) : '--';
  const hrsArr = completedData.filter(r => r.hrs_congelamiento != null).map(r => r.hrs_congelamiento);
  const avgHrs = hrsArr.length ? (hrsArr.reduce((a,b)=>a+b,0)/hrsArr.length).toFixed(2) : '--';
  const temps = completedData.filter(r => r.temp_final != null && r.temp_final !== 0).map(r => r.temp_final);
  const avgTemp = temps.length ? (temps.reduce((a,b)=>a+b,0)/temps.length).toFixed(1) : '--';

  // Best tunnel by efficiency
  const tunelEfic = {};
  completedData.forEach(r => {
    if (r.eficiencia != null) {
      if (!tunelEfic[r.tunel]) tunelEfic[r.tunel] = [];
      tunelEfic[r.tunel].push(r.eficiencia);
    }
  });
  let bestTunel = '--';
  let bestAvg = 0;
  Object.entries(tunelEfic).forEach(([t, arr]) => {
    const avg = arr.reduce((a,b)=>a+b,0)/arr.length;
    if (avg > bestAvg) { bestAvg = avg; bestTunel = t; }
  });

  // Fastest tunnel by avg congelamiento time
  const tunelHrs = {};
  completedData.forEach(r => {
    if (r.hrs_congelamiento != null) {
      if (!tunelHrs[r.tunel]) tunelHrs[r.tunel] = [];
      tunelHrs[r.tunel].push(r.hrs_congelamiento);
    }
  });
  let fastestTunel = '--';
  let fastestAvg = Infinity;
  Object.entries(tunelHrs).forEach(([t, arr]) => {
    const avg = arr.reduce((a,b)=>a+b,0)/arr.length;
    if (avg < fastestAvg) { fastestAvg = avg; fastestTunel = t; }
  });

  document.getElementById('kpiCiclos').textContent = completados;
  document.getElementById('kpiEnProceso').textContent = enProceso;
  document.getElementById('kpiCoches').textContent = coches;
  document.getElementById('kpiKg').innerHTML = kg.toLocaleString() + ' <span class="kpi-unit">kg</span>';
  document.getElementById('kpiEfic').innerHTML = avgEfic + ' <span class="kpi-unit">%</span>';
  document.getElementById('kpiHrsAvg').textContent = avgHrs;
  document.getElementById('kpiTempAvg').innerHTML = avgTemp + ' <span class="kpi-unit">\u00B0C</span>';
  document.getElementById('kpiMejorTunel').textContent = bestTunel !== '--' ? bestTunel + ' (' + bestAvg.toFixed(1) + '%)' : '--';
  document.getElementById('kpiTunelRapido').textContent = fastestTunel !== '--' ? fastestTunel + ' (' + fastestAvg.toFixed(2) + 'h)' : '--';
}

/* ═══════════════ TABLE ═══════════════ */
function renderTable(data) {
  const tbody = document.getElementById('tableBodyRows');
  const tfoot = document.getElementById('tableFoot');

  if (data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="14" style="text-align:center;color:var(--muted);padding:30px">Sin registros para esta fecha</td></tr>';
    tfoot.innerHTML = '';
    return;
  }

  let html = '';
  data.forEach((r, i) => {
    // Find original index in records array for actions
    const origIdx = records.indexOf(r);
    const isActive = !r.hora_fin;
    const hrsDisplay = r.hrs_congelamiento != null ? r.hrs_congelamiento.toFixed(2) : (isActive ? '<span style="color:var(--amber)">En proceso...</span>' : '--');
    const eficDisplay = r.eficiencia != null ? getEficBadge(r.eficiencia) : (isActive ? '<span style="color:var(--amber)">En proceso...</span>' : '--');
    const tempOutDisplay = r.temp_final != null ? r.temp_final + '\u00B0' : (isActive ? '--' : '--');
    const estadoBadge = isActive
      ? '<span class="badge badge-amber">\u2744 CONGELANDO</span>'
      : '<span class="badge badge-green">\u2705 Completado</span>';

    html += `<tr>
      <td>${r.turno || '--'}</td>
      <td>${r.hora_inicio || '--'}</td>
      <td>${r.hora_fin || '--'}</td>
      <td><span class="badge badge-cyan">${r.tunel}</span></td>
      <td>${r.fruta}</td>
      <td class="num">${r.coches}</td>
      <td class="num">${r.kg}</td>
      <td class="num">${hrsDisplay}</td>
      <td>${eficDisplay}</td>
      <td class="num">${r.temp_ingreso}\u00B0</td>
      <td class="num">${tempOutDisplay}</td>
      <td>${estadoBadge}</td>
      <td>${r.operador || '--'}</td>
      <td>
        <button class="action-btn" onclick="editRecord(${origIdx})" title="Editar">&#9998;</button>
        <button class="action-btn delete" onclick="deleteRecord(${origIdx})" title="Eliminar">&#128465;</button>
      </td>
    </tr>`;
  });
  tbody.innerHTML = html;

  // Footer totals (only from completed cycles)
  const completed = data.filter(r => r.hora_fin);
  const totCoches = data.reduce((s,r) => s + (r.coches||0), 0);
  const totKg = data.reduce((s,r) => s + (r.kg||0), 0);
  const hrsArr = completed.filter(r=>r.hrs_congelamiento!=null).map(r=>r.hrs_congelamiento);
  const avgHrs = hrsArr.length ? (hrsArr.reduce((a,b)=>a+b,0)/hrsArr.length).toFixed(2) : '--';
  const efics = completed.filter(r=>r.eficiencia!=null).map(r=>r.eficiencia);
  const avgEfic = efics.length ? (efics.reduce((a,b)=>a+b,0)/efics.length).toFixed(1) + '%' : '--';

  tfoot.innerHTML = `<tr>
    <td colspan="5" style="font-weight:800">TOTALES / PROMEDIOS</td>
    <td class="num">${totCoches}</td>
    <td class="num">${totKg.toLocaleString()}</td>
    <td class="num">${avgHrs}</td>
    <td>${avgEfic}</td>
    <td colspan="5"></td>
  </tr>`;
}

/* ═══════════════ CHARTS ═══════════════ */
function renderCharts(data, forceRebuild) {
  // Check if data has changed to avoid flickering
  const currentDataJSON = JSON.stringify(data);
  if (!forceRebuild && currentDataJSON === previousChartDataJSON && Object.keys(chartInstances).length > 0) {
    return; // Data hasn't changed, skip rebuild
  }
  previousChartDataJSON = currentDataJSON;

  const txtColor = getComputedStyle(document.documentElement).getPropertyValue('--muted').trim() || '#64748b';
  const gridColor = 'rgba(100,116,139,0.15)';

  // Destroy previous
  Object.values(chartInstances).forEach(c => { try { c.destroy(); } catch(e){} });
  chartInstances = {};

  // 1. Ciclos por Tunel (grouped bar)
  const tuneles = ['TUNEL ESTATICO 1','TUNEL ESTATICO 2','TUNEL ESTATICO 3'];
  const completados = tuneles.map(t => data.filter(r => r.tunel === t && r.hora_fin).length);
  const enProceso = tuneles.map(t => data.filter(r => r.tunel === t && !r.hora_fin).length);

  chartInstances.ciclosTunel = new Chart(document.getElementById('chartCiclosTunel'), {
    type: 'bar',
    data: {
      labels: tuneles,
      datasets: [
        { label: 'Completados', data: completados, backgroundColor: 'rgba(8,145,178,0.7)', borderRadius: 6 },
        { label: 'En Proceso', data: enProceso, backgroundColor: 'rgba(245,158,11,0.7)', borderRadius: 6 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: txtColor, font: { family: 'Plus Jakarta Sans', weight: '700' } } },
        datalabels: { color: '#fff', font: { weight: 'bold', size: 12 }, anchor: 'center' }
      },
      scales: {
        x: { ticks: { color: txtColor }, grid: { display: false } },
        y: { beginAtZero: true, ticks: { color: txtColor, stepSize: 1 }, grid: { color: gridColor } }
      }
    },
    plugins: [ChartDataLabels]
  });

  // 2. Eficiencia por Ciclo (line with 100% target) - only completed
  const completedData = data.filter(r => r.hora_fin);
  const tunelShort = { 'TUNEL ESTATICO 1': 'T1', 'TUNEL ESTATICO 2': 'T2', 'TUNEL ESTATICO 3': 'T3' };
  const tunelColorMap = { 'TUNEL ESTATICO 1': '#0891b2', 'TUNEL ESTATICO 2': '#16a34a', 'TUNEL ESTATICO 3': '#d97706' };
  // Label con rango: "08:30\u219210:13 T1" muestra ciclo completo (inicio\u2192fin)
  const labels2 = completedData.map((r,i) => {
    const ini = r.hora_inicio || ('C'+(i+1));
    const fin = r.hora_fin || '--:--';
    const tag = tunelShort[r.tunel] || '';
    return ini + '\u2192' + fin + ' ' + tag;
  });
  const pointColors = completedData.map(r => tunelColorMap[r.tunel] || '#64748b');
  const eficData = completedData.map(r => r.eficiencia);
  const target100 = completedData.map(() => 100);

  const chartTooltipCallback = {
    title: function(ctx) {
      const idx = ctx[0].dataIndex;
      const rec = completedData[idx];
      if (!rec) return ctx[0].label;
      const ini = rec.hora_inicio || '--';
      const fin = rec.hora_fin || '--';
      return ini + ' \u2192 ' + fin + '  \u2022  ' + (rec.tunel || '--') + '  \u2022  ' + (rec.fruta || '--');
    }
  };

  chartInstances.eficiencia = new Chart(document.getElementById('chartEficiencia'), {
    type: 'line',
    data: {
      labels: labels2,
      datasets: [
        { label: 'Eficiencia %', data: eficData, borderColor: '#0891b2', backgroundColor: 'rgba(8,145,178,0.1)', fill: true, tension: 0.3, pointRadius: 6, pointHoverRadius: 8, pointBackgroundColor: pointColors, pointBorderColor: '#fff', pointBorderWidth: 2 },
        { label: 'Meta 100%', data: target100, borderColor: '#ef4444', borderDash: [6,4], pointRadius: 0, borderWidth: 2 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: txtColor, font: { family: 'Plus Jakarta Sans', weight: '700' } } },
        datalabels: { display: false },
        tooltip: { callbacks: chartTooltipCallback }
      },
      scales: {
        x: { ticks: { color: txtColor, maxRotation: 45, font: { weight: '700' } }, grid: { display: false } },
        y: { beginAtZero: false, ticks: { color: txtColor, callback: v => v + '%' }, grid: { color: gridColor } }
      }
    }
  });

  // 3. Temperatura por Ciclo - only completed (FIXED: label changed + tunnel identification)
  const tempIn = completedData.map(r => r.temp_ingreso);
  const tempOut = completedData.map(r => r.temp_final);
  const limit30 = completedData.map(() => -22);

  chartInstances.temperatura = new Chart(document.getElementById('chartTemperatura'), {
    type: 'line',
    data: {
      labels: labels2,
      datasets: [
        { label: 'Temp Ingreso', data: tempIn, borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.1)', fill: false, tension: 0.3, pointRadius: 5, pointHoverRadius: 7, pointBackgroundColor: pointColors, pointBorderColor: '#f59e0b', pointBorderWidth: 2 },
        { label: 'Temp Final', data: tempOut, borderColor: '#0891b2', backgroundColor: 'rgba(8,145,178,0.1)', fill: false, tension: 0.3, pointRadius: 5, pointHoverRadius: 7, pointBackgroundColor: pointColors, pointBorderColor: '#0891b2', pointBorderWidth: 2 },
        { label: 'Temp. Minima -22\u00B0C', data: limit30, borderColor: '#ef4444', borderDash: [6,4], pointRadius: 0, borderWidth: 2 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: txtColor, font: { family: 'Plus Jakarta Sans', weight: '700' } } },
        datalabels: { display: false },
        tooltip: { callbacks: chartTooltipCallback }
      },
      scales: {
        x: { ticks: { color: txtColor, maxRotation: 45, font: { weight: '700' } }, grid: { display: false } },
        y: { ticks: { color: txtColor, callback: v => v + '\u00B0C' }, grid: { color: gridColor } }
      }
    }
  });

  // 4. Hrs Congelamiento vs Estandar - redise\u00f1o: barra por t\u00fanel + l\u00ednea estandar + delta
  const hrsActual = completedData.map(r => r.hrs_congelamiento);
  const hrsStd = completedData.map(r => STD_HRS[r.fruta] || 1.5);
  const hrsBarColors = completedData.map(r => {
    const actual = r.hrs_congelamiento;
    const std = STD_HRS[r.fruta] || 1.5;
    if (actual == null) return '#64748b80';
    const tolerance = std * 0.05;
    const tColor = tunelColorMap[r.tunel] || '#0891b2';
    if (actual < std - tolerance) return tColor + 'CC';
    if (actual > std + tolerance) return '#ef4444CC';
    return tColor + '80';
  });
  const hrsBarBorders = completedData.map(r => {
    const actual = r.hrs_congelamiento;
    const std = STD_HRS[r.fruta] || 1.5;
    if (actual == null) return '#64748b';
    const tolerance = std * 0.05;
    if (actual > std + tolerance) return '#ef4444';
    return tunelColorMap[r.tunel] || '#0891b2';
  });
  const stdByFruta = {};
  completedData.forEach(r => { stdByFruta[r.fruta] = STD_HRS[r.fruta] || 1.5; });
  const stdSummary = Object.entries(stdByFruta).map(([f,h]) => f + ': ' + h + 'h').join('  \u2022  ');
  const stdBadge = document.getElementById('stdHrsBadge');
  if (stdBadge) stdBadge.textContent = stdSummary || 'Sin datos';

  chartInstances.hrsVsStd = new Chart(document.getElementById('chartHrsVsStd'), {
    type: 'bar',
    data: {
      labels: labels2,
      datasets: [
        { label: 'Hrs Congelamiento', data: hrsActual, backgroundColor: hrsBarColors, borderColor: hrsBarBorders, borderWidth: 2, borderRadius: 8, barPercentage: 0.65, categoryPercentage: 0.85 },
        { label: 'L\u00ednea Est\u00e1ndar', data: hrsStd, type: 'line', borderColor: '#16a34a', backgroundColor: 'rgba(22,163,74,0.08)', borderDash: [8,4], borderWidth: 2.5, pointRadius: 0, pointHoverRadius: 4, pointBackgroundColor: '#16a34a', fill: false, tension: 0, stepped: true }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: txtColor, font: { family: 'Plus Jakarta Sans', weight: '700' }, usePointStyle: true } },
        datalabels: {
          color: '#fff',
          font: { weight: 'bold', size: 11 },
          anchor: 'end',
          align: 'top',
          offset: 2,
          formatter: (v, ctx) => {
            if (ctx.datasetIndex !== 0 || v == null) return '';
            const rec = completedData[ctx.dataIndex];
            const std = STD_HRS[rec.fruta] || 1.5;
            const delta = v - std;
            const deltaStr = (delta >= 0 ? '+' : '') + delta.toFixed(1);
            const tunelLabel = (rec.tunel || '').replace(' ESTATICO', '');
            return tunelLabel + '\n' + v.toFixed(1) + 'h\n(' + deltaStr + ')';
          },
          textAlign: 'center',
          backgroundColor: (ctx) => {
            if (ctx.datasetIndex !== 0) return null;
            const rec = completedData[ctx.dataIndex];
            const v = rec.hrs_congelamiento;
            const std = STD_HRS[rec.fruta] || 1.5;
            if (v == null) return null;
            const tolerance = std * 0.05;
            if (v > std + tolerance) return 'rgba(239,68,68,0.85)';
            if (v < std - tolerance) return 'rgba(22,163,74,0.85)';
            return 'rgba(8,145,178,0.85)';
          },
          borderRadius: 6,
          padding: { top: 3, bottom: 3, left: 6, right: 6 }
        },
        tooltip: {
          callbacks: Object.assign({}, chartTooltipCallback, {
            label: function(ctx) {
              if (ctx.datasetIndex === 1) return 'Est\u00e1ndar: ' + ctx.parsed.y + 'h';
              const rec = completedData[ctx.dataIndex];
              const std = STD_HRS[rec.fruta] || 1.5;
              const delta = ctx.parsed.y - std;
              const status = delta > 0.05 ? '\u26A0 sobre estandar' : (delta < -0.05 ? '\u2714 bajo estandar' : '\u2248 en rango');
              return ['Actual: ' + ctx.parsed.y.toFixed(2) + 'h', 'Est\u00e1ndar: ' + std + 'h', 'Delta: ' + (delta>=0?'+':'') + delta.toFixed(2) + 'h  ' + status];
            }
          })
        }
      },
      scales: {
        x: { ticks: { color: txtColor, maxRotation: 45, font: { weight: '700' } }, grid: { display: false } },
        y: { beginAtZero: true, ticks: { color: txtColor, callback: v => v + 'h' }, grid: { color: gridColor } }
      }
    },
    plugins: [ChartDataLabels]
  });

  // 5. Comparativo de Eficiencia por Tunel (bar chart)
  const tunelColors = { 'TUNEL ESTATICO 1': '#0891b2', 'TUNEL ESTATICO 2': '#16a34a', 'TUNEL ESTATICO 3': '#d97706' };
  const tunelAvgEfic = tuneles.map(t => {
    const recs = completedData.filter(r => r.tunel === t && r.eficiencia != null);
    return recs.length ? +(recs.reduce((s,r) => s + r.eficiencia, 0) / recs.length).toFixed(1) : 0;
  });

  chartInstances.eficTunel = new Chart(document.getElementById('chartEficTunel'), {
    type: 'bar',
    data: {
      labels: tuneles,
      datasets: [
        {
          label: 'Eficiencia Promedio %',
          data: tunelAvgEfic,
          backgroundColor: tuneles.map(t => tunelColors[t]),
          borderRadius: 8,
          barPercentage: 0.6
        },
        {
          label: 'Meta 100%',
          data: [100, 100, 100],
          type: 'line',
          borderColor: '#ef4444',
          borderDash: [6, 4],
          borderWidth: 2,
          pointRadius: 0,
          fill: false
        }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: txtColor, font: { family: 'Plus Jakarta Sans', weight: '700' } } },
        datalabels: {
          color: '#fff',
          font: { weight: 'bold', size: 13 },
          anchor: 'center',
          formatter: v => typeof v === 'number' ? v.toFixed(1) + '%' : ''
        }
      },
      scales: {
        x: { ticks: { color: txtColor }, grid: { display: false } },
        y: { beginAtZero: true, max: 140, ticks: { color: txtColor, callback: v => v + '%' }, grid: { color: gridColor } }
      }
    },
    plugins: [ChartDataLabels]
  });

  // 6. Ranking de Tuneles — Radar chart (FIXED: Velocity metric)
  const radarData = tuneles.map(t => {
    const recs = completedData.filter(r => r.tunel === t);
    const ciclos = recs.length;
    const eficArr = recs.filter(r => r.eficiencia != null).map(r => r.eficiencia);
    const avgEf = eficArr.length ? +(eficArr.reduce((a,b) => a+b, 0) / eficArr.length).toFixed(1) : 0;
    const hrsA = recs.filter(r => r.hrs_congelamiento != null).map(r => r.hrs_congelamiento);
    const avgH = hrsA.length ? +(hrsA.reduce((a,b) => a+b, 0) / hrsA.length).toFixed(2) : 0;
    const kgTotal = recs.reduce((s,r) => s + (r.kg || 0), 0);

    return {
      raw: [ciclos, avgEf, avgH, kgTotal],
      normalized: [
        Math.min(ciclos, 15),
        Math.min(avgEf / 10, 15),
        avgH > 0 ? Math.min((1 / avgH) * 10, 15) : 0,
        Math.min(kgTotal / 1000, 15)
      ]
    };
  });

  const radarColors = [
    { bg: 'rgba(8,145,178,0.2)', border: '#0891b2' },
    { bg: 'rgba(22,163,74,0.2)', border: '#16a34a' },
    { bg: 'rgba(217,119,6,0.2)', border: '#d97706' }
  ];

  chartInstances.radarTuneles = new Chart(document.getElementById('chartRadarTuneles'), {
    type: 'radar',
    data: {
      labels: ['Ciclos', 'Eficiencia %', 'Hrs Promedio', 'Kg Procesados'],
      datasets: tuneles.map((t, i) => ({
        label: t,
        data: radarData[i].normalized,
        backgroundColor: radarColors[i].bg,
        borderColor: radarColors[i].border,
        borderWidth: 2,
        pointBackgroundColor: radarColors[i].border,
        pointRadius: 4
      }))
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: txtColor, font: { family: 'Plus Jakarta Sans', weight: '700' } } },
        datalabels: { display: false },
        tooltip: {
          callbacks: {
            label: function(ctx) {
              const tIdx = ctx.datasetIndex;
              const mIdx = ctx.dataIndex;
              const raw = radarData[tIdx].raw[mIdx];
              const metricNames = ['Ciclos', 'Eficiencia', 'Hrs Promedio', 'Kg Procesados'];
              const suffix = ['', '%', ' hrs', ' kg'];
              return ctx.dataset.label + ': ' + raw + suffix[mIdx];
            }
          }
        }
      },
      scales: {
        r: {
          beginAtZero: true,
          max: 15,
          ticks: { color: txtColor, backdropColor: 'transparent', stepSize: 3 },
          grid: { color: gridColor },
          pointLabels: { color: txtColor, font: { family: 'Plus Jakarta Sans', weight: '700', size: 11 } },
          angleLines: { color: gridColor }
        }
      }
    }
  });
}

/* ═══════════════ HELPER ═══════════════ */
function getPeruDate() {
  // Retorna fecha/hora en zona horaria Peru (America/Lima UTC-5)
  const peru = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Lima' }));
  return peru;
}
function getLocalToday() {
  const d = getPeruDate();
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}
function getProductionDate() {
  // Para turno noche (00:00-06:00), la fecha de produccion es del dia anterior
  const peru = getPeruDate();
  const hour = peru.getHours();
  if (hour >= 0 && hour < 6) {
    peru.setDate(peru.getDate() - 1);
  }
  return peru.getFullYear() + '-' + String(peru.getMonth()+1).padStart(2,'0') + '-' + String(peru.getDate()).padStart(2,'0');
}
