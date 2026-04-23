// ===================== STORAGE KEYS =====================
const SK_CONFIG = 'costos_config';
const SK_REGISTROS = 'costos_registros';
const SK_PROD = 'prod_registros';
const SK_PERSONAL = 'personal_registros';

// ===================== FRUIT COST DEFAULTS =====================
const COSTO_KG_DEFAULTS = {
  'MANGO': 3.51,
  'FRESA': 3.20,
  'PALTA': 4.10,
  'ARANDANO': 3.80,
  'PIÑA': 2.90,
  'GRANADA': 3.60
};

// ===================== CURRENCY STATE =====================
let monedaSoles = true;

// ===================== CHART INSTANCES & PREV DATA =====================
let chartMOD = null;
let chartCostoKg = null;
let prevChartMODData = '';
let prevChartCostoKgData = '';

// ===================== HOUR SLOTS (dynamic based on turno) =====================
function getHoraSlots() {
  const turno = document.getElementById('fTurno') ? document.getElementById('fTurno').value : 'DIA';
  if (turno === 'NOCHE') {
    return [
      '19:00-20:00','20:00-21:00','21:00-22:00','22:00-23:00','23:00-00:00',
      '00:00-01:00','01:00-02:00','02:00-03:00','03:00-04:00','04:00-05:00',
      '05:00-06:00','06:00-07:00'
    ];
  }
  return [
    '07:00-08:00','08:00-09:00','09:00-10:00','10:00-11:00','11:00-12:00',
    '12:00-13:00','13:00-14:00','14:00-15:00','15:00-16:00','16:00-17:00',
    '17:00-18:00','18:00-19:00'
  ];
}

// ===================== INIT =====================
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initForm();
  calcTarifaUsd();
  readCrossAppData();
  renderAll();

  // Load from Supabase on startup
  loadFromSupabase();
  loadCrossAppFromSupabase();

  // Auto-refresh cross-app data and hora table every 3 seconds (localStorage)
  setInterval(() => {
    readCrossAppData();
    renderHoraTable();
    updateChartMOD();
    updateChartCostoKgHora();
  }, 3000);

  // Auto-refresh cross-app data from Supabase every 10 seconds
  setInterval(() => {
    loadCrossAppFromSupabase();
  }, 10000);

  // Check Supabase connection status indicator
  checkSupabaseConnection();
});

// ===================== THEME =====================
function initTheme() {
  const saved = localStorage.getItem('costos_theme');
  if (saved === 'light') document.documentElement.setAttribute('data-theme', 'light');
}
function toggleTheme() {
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  if (isLight) {
    document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('costos_theme', 'dark');
  } else {
    document.documentElement.setAttribute('data-theme', 'light');
    localStorage.setItem('costos_theme', 'light');
  }
  // Force full chart rebuild on theme change (colors change)
  prevChartMODData = '';
  prevChartCostoKgData = '';
  renderCharts();
}

// ===================== CURRENCY TOGGLE =====================
function toggleMoneda() {
  monedaSoles = !monedaSoles;
  const btn = document.getElementById('btnMoneda');
  if (monedaSoles) {
    btn.textContent = '💱 Mostrar en $';
    btn.classList.add('active-soles');
  } else {
    btn.textContent = '💱 Mostrar en S/';
    btn.classList.remove('active-soles');
  }
  prevChartMODData = '';
  prevChartCostoKgData = '';
  renderKPIs();
  renderHoraTable();
  renderCharts();
  readCrossAppData();
}

// ===================== FORM INIT =====================
function initForm() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  document.getElementById('fFecha').value = `${yyyy}-${mm}-${dd}`;

  // Set default costo kg from fruit
  onFrutaChange();


  // Restore last registrado por
  const lastPor = localStorage.getItem('costos_last_registrado');
  if (lastPor) document.getElementById('fRegistradoPor').value = lastPor;
}

// ===================== FRUIT CHANGE HANDLER =====================
function onFrutaChange() {
  const fruta = document.getElementById('fFruta').value;
  const defaultCosto = COSTO_KG_DEFAULTS[fruta] || 3.51;
  const chk = document.getElementById('chkManualCosto');
  const inp = document.getElementById('fCostoKgManual');
  if (!chk.checked) {
    inp.value = defaultCosto.toFixed(2);
  }
}


// ===================== MANUAL COSTO TOGGLE =====================
function toggleManualCosto() {
  const chk = document.getElementById('chkManualCosto');
  const inp = document.getElementById('fCostoKgManual');
  if (chk.checked) {
    inp.removeAttribute('readonly');
    inp.style.opacity = '1';
    inp.style.cursor = 'text';
    inp.style.background = 'var(--bg-secondary)';
    inp.style.borderColor = 'var(--rojo)';
    inp.placeholder = 'Ingrese costo/kg';
  } else {
    inp.setAttribute('readonly', true);
    inp.style.opacity = '0.7';
    inp.style.cursor = 'default';
    inp.style.background = 'rgba(220,38,38,0.05)';
    inp.style.borderColor = 'rgba(220,38,38,0.2)';
    inp.placeholder = '';
    onFrutaChange();
  }
}

// ===================== CALCULATIONS =====================
function calcTarifaUsd() {
  const sol = parseFloat(document.getElementById('fTarifaSol').value) || 0;
  const tc = parseFloat(document.getElementById('fTipoCambio').value) || 1;
  const usd = sol / tc;
  document.getElementById('fTarifaUsd').value = '$ ' + usd.toFixed(2);
  updatePreview(usd);
}

function updatePreview(tarifaUsd) {
  const fecha = document.getElementById('fFecha').value;
  const crossData = getCrossAppData(fecha);
  const hasRealPersonal = crossData.personal > 0;
  const hasRealPT = crossData.ptKg > 0;

  // Use totalPersonalSum for cost calc (sum across all hours), fallback to single personal value
  const personalTotal = crossData.totalPersonalSum > 0 ? crossData.totalPersonalSum : crossData.personal;
  const numP = hasRealPersonal ? personalTotal : 126;
  const numKg = hasRealPT ? crossData.ptKg : 1000;

  // Costo kg congelado (from form field)
  const costoKgCong = parseFloat(document.getElementById('fCostoKgManual').value) || 3.51;
  // Formula: CostoKgCongelado × SUM(Personal_i) / PT_kg
  const costoKg = numKg > 0 ? (costoKgCong * numP) / numKg : 0;

  const srcP = hasRealPersonal ? 'dato real' : 'ejemplo';
  const srcK = hasRealPT ? 'dato real' : 'ejemplo';

  const sym = monedaSoles ? 'S/' : '$';
  const tc = parseFloat(document.getElementById('fTipoCambio').value) || 1;
  const costoKgCongDisplay = monedaSoles ? (costoKgCong * tc) : costoKgCong;
  const costoDisplay = monedaSoles ? (costoKg * tc) : costoKg;

  document.getElementById('previewContent').innerHTML =
    `Con <strong>${numP}</strong> personas (<em>${srcP}</em>) y <strong>${numKg.toLocaleString('es-PE')}</strong> kg PT (<em>${srcK}</em>) hoy, el costo es:<br>` +
    `<span class="preview-value">(${sym}${costoKgCongDisplay.toFixed(2)} &times; ${numP}) / ${numKg.toLocaleString('es-PE')} = ${sym}${costoDisplay.toFixed(4)}/kg</span>`;
}

// ===================== TARIFA HELPERS =====================
function getCurrentTarifaUsd() {
  const tarifaSol = parseFloat(document.getElementById('fTarifaSol').value) || 0;
  const tc = parseFloat(document.getElementById('fTipoCambio').value) || 1;
  return tarifaSol / tc;
}

function getCurrentTarifaSol() {
  return parseFloat(document.getElementById('fTarifaSol').value) || 0;
}

function getCurrentTC() {
  return parseFloat(document.getElementById('fTipoCambio').value) || 1;
}

function fmtCurrency(val) {
  const sym = monedaSoles ? 'S/ ' : '$ ';
  return sym + val.toFixed(4);
}

function fmtCurrency2(val) {
  const sym = monedaSoles ? 'S/ ' : '$ ';
  return sym + val.toFixed(2);
}

// ===================== GET LUNCH HOUR SLOT =====================
function getLunchSlot() {
  // Read hora_almuerzo from saved costos record for today
  const fecha = document.getElementById('fFecha').value;
  try {
    const registros = JSON.parse(localStorage.getItem(SK_REGISTROS) || '[]');
    const reg = registros.find(r => r.fecha === fecha);
    if (reg && reg.hora_almuerzo) {
      const hh = parseInt(reg.hora_almuerzo.split(':')[0], 10);
      const startH = String(hh).padStart(2, '0') + ':00';
      const endH = String(hh + 1).padStart(2, '0') + ':00';
      return startH + '-' + endH;
    }
  } catch(e) {}

  // Fallback: read from prod_registros if available
  try {
    const prodData = JSON.parse(localStorage.getItem(SK_PROD) || '[]');
    const hoy = prodData.filter(r => r.fecha === fecha);
    if (hoy.length > 0) {
      const withAlmuerzo = hoy.find(r => r.hora_almuerzo);
      if (withAlmuerzo) {
        const hh = parseInt(withAlmuerzo.hora_almuerzo.split(':')[0], 10);
        const startH = String(hh).padStart(2, '0') + ':00';
        const endH = String(hh + 1).padStart(2, '0') + ':00';
        return startH + '-' + endH;
      }
    }
  } catch(e) {}

  return null;
}

// ===================== CROSS-APP DATA =====================
function getCrossAppData(fecha) {
  let personal = 0;
  let ptKg = 0;
  let consumoKg = 0;
  let horasRegistradas = 0;
  let totalPersonalSum = 0;   // Sum of personnel across ALL hours (for cost calc)
  let hoursWithPersonal = 0;  // How many hours had personnel data

  // Read personal_registros
  try {
    const pData = JSON.parse(localStorage.getItem(SK_PERSONAL) || '[]');
    const hoy = pData.filter(r => r.fecha === fecha);
    if (hoy.length > 0) {
      const sorted = [...hoy].sort((a, b) => {
        const ha = a.hora || '';
        const hb = b.hora || '';
        return ha.localeCompare(hb);
      });
      const ultimo = sorted[sorted.length - 1];
      // Check both num_personal and total_personal
      personal = parseFloat(ultimo.num_personal) || parseFloat(ultimo.total_personal) || 0;
      // Sum personnel across all hours for cost calculations
      sorted.forEach(r => {
        const p = parseFloat(r.num_personal) || parseFloat(r.total_personal) || 0;
        if (p > 0) {
          totalPersonalSum += p;
          hoursWithPersonal++;
        }
      });
    }
  } catch(e) {}

  // Read prod_registros
  try {
    const prData = JSON.parse(localStorage.getItem(SK_PROD) || '[]');
    const hoy = prData.filter(r => r.fecha === fecha);
    horasRegistradas = hoy.length;
    if (hoy.length > 0) {
      consumoKg = hoy.reduce((s, r) => s + (parseFloat(r.consumo_kg) || 0), 0);
      ptKg = hoy.reduce((s, r) => s + (parseFloat(r.pt_aprox_kg) || 0), 0);
    }
  } catch(e) {}

  return { personal, ptKg, consumoKg, horasRegistradas, totalPersonalSum, hoursWithPersonal };
}

// ===================== HOUR-BY-HOUR DATA =====================
function getHourlyData(fecha) {
  const HORA_SLOTS = getHoraSlots();
  let prodRecords = [];
  let personalRecords = [];

  try { prodRecords = JSON.parse(localStorage.getItem(SK_PROD) || '[]'); } catch(e) {}
  try { personalRecords = JSON.parse(localStorage.getItem(SK_PERSONAL) || '[]'); } catch(e) {}

  const prodHoy = prodRecords.filter(r => r.fecha === fecha);
  const persHoy = personalRecords.filter(r => r.fecha === fecha);

  const hourlyMap = {};

  HORA_SLOTS.forEach(slot => {
    hourlyMap[slot] = {
      hora: slot,
      consumo: 0,
      pt: 0,
      personal: 0,
      hasData: false,
      hasProd: false,
      hasPersonal: false
    };
  });

  function matchSlot(h) {
    if (hourlyMap[h]) return h;
    for (const slot of HORA_SLOTS) {
      const startH = slot.split('-')[0];
      if (h === startH || h === startH.replace(':00','') || h.padStart(2,'0') === startH.split(':')[0]) return slot;
      const hNorm = h.includes(':') ? h.padStart(5,'0') : h.padStart(2,'0') + ':00';
      if (hNorm === startH) return slot;
    }
    return null;
  }

  // Match prod records
  prodHoy.forEach(r => {
    const h = r.hora || '';
    const matched = matchSlot(h);
    if (matched) {
      hourlyMap[matched].consumo += parseFloat(r.consumo_kg) || 0;
      hourlyMap[matched].pt += parseFloat(r.pt_aprox_kg) || 0;
      hourlyMap[matched].hasData = true;
      hourlyMap[matched].hasProd = true;
    }
  });

  // Match personal records
  persHoy.forEach(r => {
    const h = r.hora || '';
    const matched = matchSlot(h);
    if (matched) {
      hourlyMap[matched].personal = parseFloat(r.num_personal) || parseFloat(r.total_personal) || 0;
      hourlyMap[matched].hasData = true;
      hourlyMap[matched].hasPersonal = true;
    }
  });

  return hourlyMap;
}

// ===================== READ & DISPLAY CROSS-APP DATA =====================
function readCrossAppData() {
  const d = new Date();
  const today = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

  const crossData = getCrossAppData(today);

  // Update cross-app cards
  document.getElementById('caConsumo').textContent = crossData.consumoKg.toLocaleString('es-PE', {maximumFractionDigits:1}) + ' kg';
  document.getElementById('caPT').textContent = crossData.ptKg.toLocaleString('es-PE', {maximumFractionDigits:1}) + ' kg';

  const rendimiento = crossData.consumoKg > 0 ? (crossData.ptKg / crossData.consumoKg * 100) : 0;
  document.getElementById('caRendimiento').textContent = rendimiento.toFixed(1) + '%';

  document.getElementById('caPersonal').textContent = crossData.personal || '0';
  document.getElementById('caHoras').textContent = crossData.horasRegistradas;

  // Costo/Kg calculado: CostoKgCong × SUM(Personal_i) / TotalPT
  // Uses totalPersonalSum because each hour's personnel generates cost independently
  const tarifaUsd = getCurrentTarifaUsd();
  const tarifaSol = getCurrentTarifaSol();
  const tc = getCurrentTC();
  const costoKgCongCA = parseFloat(document.getElementById('fCostoKgManual').value) || 3.51;
  const personalParaCostoCA = crossData.totalPersonalSum > 0 ? crossData.totalPersonalSum : crossData.personal;

  let costoKgCalc = 0;
  if (costoKgCongCA > 0 && personalParaCostoCA > 0 && crossData.ptKg > 0) {
    costoKgCalc = (costoKgCongCA * personalParaCostoCA) / crossData.ptKg;
    document.getElementById('caCostoKgSub').textContent = `$${costoKgCongCA.toFixed(2)} x ${personalParaCostoCA} / ${crossData.ptKg.toLocaleString('es-PE')} kg`;
  } else {
    document.getElementById('caCostoKgSub').textContent = 'Esperando datos...';
  }
  const costoDisplay = monedaSoles ? (costoKgCalc * tc) : costoKgCalc;
  const sym = monedaSoles ? 'S/ ' : '$ ';
  document.getElementById('caCostoKg').textContent = sym + costoDisplay.toFixed(4);

  // Also update KPIs & preview
  renderKPIs();
  updatePreview(tarifaUsd);
}

// ===================== SAVE RECORD =====================
async function guardarRegistro() {
  if (typeof supabaseClient === 'undefined' || !supabaseClient) {
    showToast('ERROR: Supabase no conectado');
    return;
  }
  const fecha = document.getElementById('fFecha').value;
  const turno = document.getElementById('fTurno').value;
  const fruta = document.getElementById('fFruta').value;
  const tarifaSol = parseFloat(document.getElementById('fTarifaSol').value);
  const tipoCambio = parseFloat(document.getElementById('fTipoCambio').value);
  const observacion = document.getElementById('fObservacion').value.trim();
  const registradoPor = document.getElementById('fRegistradoPor').value.trim();
  if (!fecha) { showToast('Seleccione una fecha'); return; }
  if (!tarifaSol || tarifaSol <= 0) { showToast('Ingrese la tarifa'); return; }
  if (!tipoCambio || tipoCambio <= 0) { showToast('Ingrese el tipo de cambio'); return; }
  if (!registradoPor) { showToast('Ingrese quien registra'); return; }

  const tarifaUsd = tarifaSol / tipoCambio;
  const costoKgCongelado = parseFloat(document.getElementById('fCostoKgManual').value) || COSTO_KG_DEFAULTS[fruta] || 3.51;

  const now = new Date();
  const created_at = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + '-' + String(now.getDate()).padStart(2,'0') + ' ' + String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0') + ':' + String(now.getSeconds()).padStart(2,'0');

  const costoHoraHombre = parseFloat(document.getElementById('fCostoHoraHombre').value) || 5.95;

  const registro = {
    id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
    fecha,
    turno,
    fruta,
    tarifa_soles: tarifaSol,
    tarifa_usd: parseFloat(tarifaUsd.toFixed(4)),
    tipo_cambio: tipoCambio,
    costo_kg_congelado: costoKgCongelado,
    costo_hora_hombre: costoHoraHombre,
    hora_almuerzo: null,
    registrado_por: registradoPor,
    created_at,
    observacion,
    // Legacy compat fields
    tarifa_almuerzo_soles: tarifaSol,
    tarifa_almuerzo_usd: parseFloat(tarifaUsd.toFixed(4))
  };

  const registros = getRegistros();
  const idx = registros.findIndex(r => r.fecha === fecha);
  if (idx >= 0) registros.splice(idx, 1);
  registros.push(registro);
  registros.sort((a, b) => b.fecha.localeCompare(a.fecha));
  localStorage.setItem(SK_REGISTROS, JSON.stringify(registros));

  // Save costos_config
  localStorage.setItem(SK_CONFIG, JSON.stringify({
    fecha,
    turno,
    fruta,
    tarifa_soles: tarifaSol,
    tipo_cambio: tipoCambio,
    tarifa_usd: parseFloat(tarifaUsd.toFixed(4)),
    costo_kg_congelado: costoKgCongelado,
    costo_hora_hombre: costoHoraHombre,
    hora_almuerzo: null,
    registrado_por: registradoPor,
    created_at
  }));

  localStorage.setItem('costos_last_registrado', registradoPor);
  window.dispatchEvent(new Event('storage'));
  showToast('Configuracion de costos guardada correctamente');

  // ===== Supabase sync =====
  try {
    const { data, error } = await supabaseClient
      .from('config_costos')
      .upsert({
        fecha: registro.fecha,
        turno: registro.turno,
        fruta: registro.fruta,
        tarifa_almuerzo_soles: parseFloat(registro.tarifa_soles || registro.tarifa_almuerzo_soles),
        tipo_cambio: parseFloat(registro.tipo_cambio),
        costo_kg_congelado: parseFloat(registro.costo_kg_congelado),
        costo_hora_hombre: parseFloat(registro.costo_hora_hombre),
        observacion: registro.observacion,
        registrado_por: registro.registrado_por
      }, { onConflict: 'fecha,turno' });

    if (error) {
      console.error('Supabase error:', error);
      showSupabaseToast('ERROR Supabase: ' + error.message, '#ef4444');
    } else {
      showSupabaseToast('Registrado en Supabase', '#16a34a');
    }
  } catch(e) {
    console.error('Supabase offline', e);
    showSupabaseToast('Supabase sin conexion - guardado local', '#ef4444');
  }

  renderAll();
}

function limpiarForm() {
  document.getElementById('fTarifaSol').value = '10.00';
  document.getElementById('fTipoCambio').value = '3.35';
  document.getElementById('fObservacion').value = '';
  document.getElementById('fTurno').value = 'DIA';
  document.getElementById('fFruta').value = 'MANGO';
  document.getElementById('fCostoHoraHombre').value = '5.95';
  document.getElementById('chkManualCosto').checked = false;
  toggleManualCosto();
  initForm();
  calcTarifaUsd();
}

// ===================== DATA HELPERS =====================
function getRegistros() {
  try { return JSON.parse(localStorage.getItem(SK_REGISTROS) || '[]'); }
  catch(e) { return []; }
}

function getTodayStr() {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`;
}

function getWeekDates() {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);
  }
  return dates;
}

function deleteRegistro(id) {
  let registros = getRegistros();
  registros = registros.filter(r => r.id !== id);
  localStorage.setItem(SK_REGISTROS, JSON.stringify(registros));
  window.dispatchEvent(new Event('storage'));
  showToast('Registro eliminado');
  renderAll();
}

// ===================== COLLAPSIBLE HISTORIAL =====================
function toggleHistorial() {
  const header = document.getElementById('historialHeader');
  const body = document.getElementById('historialBody');
  header.classList.toggle('open');
  body.classList.toggle('open');
}

// ===================== RENDER ALL =====================
function renderAll() {
  renderKPIs();
  renderTable();
  renderHoraTable();
  renderCharts();
}

// ===================== KPIs =====================
function renderKPIs() {
  const registros = getRegistros();
  const hoy = getTodayStr();
  const regHoy = registros.find(r => r.fecha === hoy);

  const tarifaSolForm = parseFloat(document.getElementById('fTarifaSol').value) || 0;
  const tcForm = parseFloat(document.getElementById('fTipoCambio').value) || 1;

  const tarifaSol = tarifaSolForm;
  const tarifaUsd = tarifaSolForm / tcForm;
  document.getElementById('kpiTarifaSol').textContent = 'S/ ' + tarifaSol.toFixed(2);
  const costoKgCongKpi2 = parseFloat(document.getElementById('fCostoKgManual').value) || 3.51;
  const frutaActual = document.getElementById('fFruta').value || 'MANGO';
  document.getElementById('kpiTarifaUsd').textContent = '$ ' + costoKgCongKpi2.toFixed(2);
  document.getElementById('kpiTarifaUsdSub').textContent = 'Precio por kg congelado - ' + frutaActual;

  // Currency-aware labels
  const sym = monedaSoles ? 'S/' : '$';
  document.getElementById('kpiCostoKgLabel').textContent = `Costo/Kg Estimado (${sym})`;
  document.getElementById('kpiCostoDiarioLabel').textContent = `Costo Diario Est. (${sym})`;
  document.getElementById('kpiSemanalLabel').textContent = `Costo Semanal Acum (${sym})`;

  // KPI 3: Costo/Kg estimado = CostoKgCongelado × SUM(Personal_i) / TotalPT
  // Uses totalPersonalSum (sum across all hours) because each hour's personnel generates cost independently
  const crossData = getCrossAppData(hoy);
  const costoKgCongVal = parseFloat(document.getElementById('fCostoKgManual').value) || 3.51;
  const personalParaCosto = crossData.totalPersonalSum > 0 ? crossData.totalPersonalSum : crossData.personal;
  let costoKg = 0;
  if (costoKgCongVal > 0 && personalParaCosto > 0 && crossData.ptKg > 0) {
    costoKg = (costoKgCongVal * personalParaCosto) / crossData.ptKg;
    document.getElementById('kpiCostoKgSub').textContent = `$${costoKgCongVal.toFixed(2)} x ${personalParaCosto} / ${crossData.ptKg.toLocaleString('es-PE')} kg`;
  } else {
    document.getElementById('kpiCostoKgSub').textContent = 'Sin datos de produccion hoy';
  }
  const costoKgDisplay = monedaSoles ? (costoKg * tcForm) : costoKg;
  document.getElementById('kpiCostoKg').textContent = `${sym} ` + costoKgDisplay.toFixed(4);

  // KPI 4: Costo diario estimado
  const costoDiario = tarifaUsd * (crossData.personal || 0);
  const costoDiarioDisplay = monedaSoles ? (costoDiario * tcForm) : costoDiario;
  document.getElementById('kpiCostoDiario').textContent = `${sym} ` + costoDiarioDisplay.toFixed(2);

  // KPI 5: Costo semanal acumulado
  const weekDates = getWeekDates();
  let costoSemanal = 0;
  weekDates.forEach(fecha => {
    const reg = registros.find(r => r.fecha === fecha);
    if (reg) {
      const regTarifaUsd = reg.tarifa_usd || reg.tarifa_almuerzo_usd || 0;
      const regCrossData = getCrossAppData(reg.fecha);
      costoSemanal += regTarifaUsd * (regCrossData.personal || 0);
    }
  });
  if (!regHoy && costoDiario > 0) {
    costoSemanal += costoDiario;
  }
  const costoSemanalDisplay = monedaSoles ? (costoSemanal * tcForm) : costoSemanal;
  document.getElementById('kpiSemanal').textContent = `${sym} ` + costoSemanalDisplay.toFixed(2);

  // KPI 6: Variacion vs ayer
  const ayer = new Date();
  ayer.setDate(ayer.getDate() - 1);
  const ayerStr = `${ayer.getFullYear()}-${String(ayer.getMonth()+1).padStart(2,'0')}-${String(ayer.getDate()).padStart(2,'0')}`;
  const regAyer = registros.find(r => r.fecha === ayerStr);

  let variacion = 0;
  let variacionClass = 'neutral';
  const costoKgAyer = regAyer && regAyer.costo_kg_congelado ? regAyer.costo_kg_congelado : 0;

  if (costoKg > 0 && costoKgAyer > 0) {
    variacion = ((costoKg - costoKgAyer) / costoKgAyer) * 100;
    variacionClass = variacion > 0 ? 'down' : variacion < 0 ? 'up' : 'neutral';
  } else if (regHoy && regAyer) {
    const tarifaHoy = regHoy.tarifa_usd || regHoy.tarifa_almuerzo_usd || 0;
    const tarifaAyer = regAyer.tarifa_usd || regAyer.tarifa_almuerzo_usd || 0;
    if (tarifaAyer > 0) {
      variacion = ((tarifaHoy - tarifaAyer) / tarifaAyer) * 100;
      variacionClass = variacion > 0 ? 'down' : variacion < 0 ? 'up' : 'neutral';
    }
  }

  const kpiVar = document.getElementById('kpiVariacion');
  kpiVar.innerHTML = `${variacion >= 0 ? '+' : ''}${variacion.toFixed(1)}% <span class="kpi-trend ${variacionClass}" style="font-size:11px;margin-left:4px">${variacion > 0 ? '▲ Subio' : variacion < 0 ? '▼ Bajo' : '= Igual'}</span>`;
  const symVar = monedaSoles ? 'S/' : '$';
  const costoKgAyerDisplay = monedaSoles ? (costoKgAyer * tcForm) : costoKgAyer;
  const tarifaAyerDisplay = regAyer ? (monedaSoles ? (regAyer.tarifa_soles || regAyer.tarifa_almuerzo_soles || 0) : (regAyer.tarifa_usd || regAyer.tarifa_almuerzo_usd || 0)) : 0;
  document.getElementById('kpiVariacionSub').textContent = costoKgAyer > 0 ? `Ayer: ${symVar}${costoKgAyerDisplay.toFixed(4)}/kg` : (regAyer ? `Ayer: ${symVar}${tarifaAyerDisplay.toFixed(2)}` : 'Sin dato de ayer');
}

// ===================== HORA A HORA TABLE =====================
function renderHoraTable() {
  const today = getTodayStr();
  const hourlyMap = getHourlyData(today);
  const HORA_SLOTS = getHoraSlots();
  const tbody = document.getElementById('tbodyHoraHora');
  const tfoot = document.getElementById('tfootHoraHora');
  const emptyEl = document.getElementById('emptyStateHora');

  const tarifaUsd = getCurrentTarifaUsd();
  const tarifaSol = getCurrentTarifaSol();
  const tc = getCurrentTC();
  const sym = monedaSoles ? 'S/' : '$';
  const lunchSlot = getLunchSlot();

  // Update column headers
  document.getElementById('thCostoMOD').textContent = `Costo MOD (${sym})`;
  document.getElementById('thCostoKg').textContent = `Costo/Kg Cong. (${sym})`;

  // Check if any hour has data
  const hasAnyData = HORA_SLOTS.some(slot => hourlyMap[slot] && hourlyMap[slot].hasData);

  if (!hasAnyData) {
    tbody.innerHTML = '';
    tfoot.innerHTML = '';
    emptyEl.style.display = 'block';
    return;
  }
  emptyEl.style.display = 'none';

  let totalConsumo = 0;
  let totalPT = 0;
  let totalCostoMOD = 0;
  let totalPersonalSum = 0;    // Sum of personnel across all hours (for cost calc)
  let hoursWithPersonal = 0;   // Count of hours that had personnel data
  let rowsHtml = '';

  HORA_SLOTS.forEach(slot => {
    const data = hourlyMap[slot];
    if (!data) return;
    const isLunch = (lunchSlot && slot === lunchSlot);
    const rowClass = isLunch ? 'hora-row-lunch' : '';

    if (!data.hasData && !isLunch) return;
    if (!data.hasData && isLunch) {
      rowsHtml += `<tr class="${rowClass}">
        <td><strong>🍽️ ${slot}</strong></td>
        <td class="num" style="color:var(--amber-light)">ALMUERZO</td>
        <td class="num">-</td>
        <td class="num">-</td>
        <td class="num">-</td>
        <td class="num">-</td>
        <td class="num">-</td>
      </tr>`;
      return;
    }

    totalConsumo += data.consumo;
    totalPT += data.pt;
    if (data.personal > 0) {
      totalPersonalSum += data.personal;
      hoursWithPersonal++;
    }

    // Rendimiento
    const rend = data.consumo > 0 ? (data.pt / data.consumo * 100) : 0;
    let rendClass = 'rend-bad';
    if (rend >= 45) rendClass = 'rend-good';
    else if (rend >= 40) rendClass = 'rend-warn';

    // Costo MOD for this hour (CostoHoraHombre x personal)
    const costoHH = getCurrentCostoHoraHombre();
    const costoMODSoles = costoHH * data.personal;
    const costoMOD = monedaSoles ? costoMODSoles : (costoMODSoles / tc);
    totalCostoMOD += costoMODSoles;

    // Costo/Kg congelado for this hour: CostoKgCong × Personal / PT
    const costoKgCong = parseFloat(document.getElementById('fCostoKgManual').value) || 3.51;
    let costoKg = 0;
    let costoKgStr = '-';
    let costClass = '';
    if (data.pt > 0 && data.personal > 0) {
      const costoKgUsd = (costoKgCong * data.personal) / data.pt;
      costoKg = monedaSoles ? (costoKgUsd * tc) : costoKgUsd;
      costoKgStr = sym + costoKg.toFixed(4);
      if (costoKgUsd < 0.50) costClass = 'cost-good';
      else if (costoKgUsd < 1.00) costClass = 'cost-warn';
      else costClass = 'cost-bad';
    }

    const lunchIcon = isLunch ? '🍽️ ' : '';

    rowsHtml += `<tr class="${rowClass}">
      <td><strong>${lunchIcon}${slot}</strong></td>
      <td class="num">${data.consumo > 0 ? data.consumo.toLocaleString(undefined,{maximumFractionDigits:1}) : '-'}</td>
      <td class="num">${data.pt > 0 ? data.pt.toLocaleString(undefined,{maximumFractionDigits:1}) : '-'}</td>
      <td class="num ${rendClass}">${data.consumo > 0 ? rend.toFixed(1) + '%' : '-'}</td>
      <td class="num">${data.personal > 0 ? data.personal : '-'}</td>
      <td class="num">${data.personal > 0 ? sym + costoMOD.toFixed(2) : '-'}</td>
      <td class="num ${costClass}">${costoKgStr}</td>
    </tr>`;
  });

  tbody.innerHTML = rowsHtml;

  // Footer with totals
  const totalRend = totalConsumo > 0 ? (totalPT / totalConsumo * 100) : 0;
  let totalRendClass = 'rend-bad';
  if (totalRend >= 45) totalRendClass = 'rend-good';
  else if (totalRend >= 40) totalRendClass = 'rend-warn';

  const totalCostoMODDisplay = monedaSoles ? totalCostoMOD : (totalCostoMOD / tc);

  // Personal promedio for display (average across hours with data)
  const personalPromedio = hoursWithPersonal > 0 ? Math.round(totalPersonalSum / hoursWithPersonal) : 0;
  const personalDisplay = hoursWithPersonal > 0 ? `${personalPromedio} prom` : '-';

  // Costo/Kg total: CostoKgCong × SUM(Personal_i) / TotalPT
  // Each hour's personnel generates cost independently
  let avgCostoKg = 0;
  let avgCostoKgStr = '-';
  let avgCostClass = '';
  if (totalPT > 0 && totalPersonalSum > 0) {
    const costoKgCongFooter = parseFloat(document.getElementById('fCostoKgManual').value) || 3.51;
    const avgUsd = (costoKgCongFooter * totalPersonalSum) / totalPT;
    avgCostoKg = monedaSoles ? (avgUsd * tc) : avgUsd;
    avgCostoKgStr = sym + avgCostoKg.toFixed(4);
    if (avgUsd < 0.50) avgCostClass = 'cost-good';
    else if (avgUsd < 1.00) avgCostClass = 'cost-warn';
    else avgCostClass = 'cost-bad';
  }

  tfoot.innerHTML = `<tr>
    <td><strong>TOTALES</strong></td>
    <td class="num"><strong>${totalConsumo.toLocaleString(undefined,{maximumFractionDigits:1})}</strong></td>
    <td class="num"><strong>${totalPT.toLocaleString(undefined,{maximumFractionDigits:1})}</strong></td>
    <td class="num ${totalRendClass}"><strong>${totalRend.toFixed(1)}%</strong></td>
    <td class="num"><strong>${personalDisplay}</strong></td>
    <td class="num"><strong>${sym}${totalCostoMODDisplay.toFixed(2)}</strong></td>
    <td class="num ${avgCostClass}"><strong>${avgCostoKgStr}</strong></td>
  </tr>`;
}

// ===================== HISTORIAL TABLE =====================
function renderTable() {
  const registros = getRegistros();
  const tbody = document.getElementById('tbodyCostos');
  const emptyEl = document.getElementById('emptyState');

  if (registros.length === 0) {
    tbody.innerHTML = '';
    emptyEl.style.display = 'block';
    return;
  }
  emptyEl.style.display = 'none';

  tbody.innerHTML = registros.map(r => {
    const symHist = monedaSoles ? 'S/' : '$';
    const tcHist = monedaSoles ? (r.tipo_cambio || 1) : 1;
    const tarifaSol = r.tarifa_soles || r.tarifa_almuerzo_soles || 0;
    const tarifaUsd = r.tarifa_usd || r.tarifa_almuerzo_usd || 0;
    let costoKg = '-';
    if (r.costo_kg_congelado && r.costo_kg_congelado > 0) {
      costoKg = '$' + r.costo_kg_congelado.toFixed(2);
    }
    const fechaDisplay = formatFecha(r.fecha);
    return `<tr>
      <td><strong>${fechaDisplay}</strong></td>
      <td>${r.turno || '-'}</td>
      <td>${r.fruta || '-'}</td>
      <td class="num">S/ ${tarifaSol.toFixed(2)}</td>
      <td class="num" style="color:var(--rojo-light);font-weight:700">$ ${tarifaUsd.toFixed(2)}</td>
      <td class="num">${(r.tipo_cambio || 0).toFixed(2)}</td>
      <td class="num" style="color:var(--verde-light);font-weight:700">${costoKg}</td>
      <td>${r.registrado_por || '-'}</td>
      <td><button class="btn-delete" onclick="deleteRegistro('${r.id}')">Eliminar</button></td>
    </tr>`;
  }).join('');
}

function formatFecha(fechaStr) {
  const parts = fechaStr.split('-');
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

// ===================== CHARTS =====================
function renderCharts() {
  prevChartMODData = '';
  prevChartCostoKgData = '';
  buildChartMOD();
  buildChartCostoKgHora();
}

// ===== Chart: Costo MOD por Hora del Dia =====
function buildChartMOD() {
  const { labels, values, bgColors, borderColors, dataKey } = getChartMODData();
  prevChartMODData = dataKey;

  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  const gridColor = isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)';
  const textColor = isLight ? '#475569' : '#94a3b8';
  const sym = monedaSoles ? 'S/' : '$';

  document.getElementById('chartModBadge').textContent = `${sym} CostoHH x Personal`;

  if (chartMOD) chartMOD.destroy();
  const ctx = document.getElementById('chartMOD').getContext('2d');

  chartMOD = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: `Costo MOD (${sym})`,
        data: values,
        backgroundColor: bgColors,
        borderColor: borderColors,
        borderWidth: 2,
        borderRadius: 8,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: 'index' },
      plugins: {
        legend: { display: false },
        datalabels: {
          display: (ctx) => ctx.dataset.data[ctx.dataIndex] !== null && ctx.dataset.data[ctx.dataIndex] > 0,
          color: textColor,
          anchor: 'end',
          align: 'top',
          font: { size: 10, weight: 700, family: 'Inter' },
          formatter: v => v !== null ? sym + v.toFixed(2) : ''
        }
      },
      scales: {
        x: { grid: { color: gridColor }, ticks: { color: textColor, font: { size: 10, family: 'Inter' }, maxRotation: 45 } },
        y: { grid: { color: gridColor }, ticks: { color: textColor, font: { size: 11, family: 'Inter' }, callback: v => sym + v.toFixed(0) }, beginAtZero: true }
      }
    },
    plugins: [ChartDataLabels]
  });
}

function getChartMODData() {
  const today = getTodayStr();
  const hourlyMap = getHourlyData(today);
  const HORA_SLOTS = getHoraSlots();
  const costoHH = getCurrentCostoHoraHombre();
  const tc = getCurrentTC();
  const sym = monedaSoles ? 'S/' : '$';

  const labels = [];
  const values = [];
  const bgColors = [];
  const borderColors = [];

  HORA_SLOTS.forEach(slot => {
    const data = hourlyMap[slot];
    if (!data || !data.hasProd || !data.hasPersonal) return;

    labels.push(slot);
    // MOD = costo_hora_hombre (S/) x personal
    const modSoles = costoHH * data.personal;
    const displayVal = monedaSoles ? modSoles : (modSoles / tc);
    values.push(displayVal > 0 ? displayVal : 0);

    bgColors.push('rgba(124,58,237,0.6)');
    borderColors.push('#7c3aed');
  });

  const dataKey = JSON.stringify({ labels, values, monedaSoles, costoHH });
  return { labels, values, bgColors, borderColors, dataKey };
}

function updateChartMOD() {
  const { labels, values, bgColors, borderColors, dataKey } = getChartMODData();
  if (dataKey === prevChartMODData) return;
  prevChartMODData = dataKey;

  if (!chartMOD) {
    buildChartMOD();
    return;
  }

  const sym = monedaSoles ? 'S/' : '$';
  document.getElementById('chartModBadge').textContent = `${sym} CostoHH x Personal`;

  chartMOD.data.labels = labels;
  chartMOD.data.datasets[0].data = values;
  chartMOD.data.datasets[0].backgroundColor = bgColors;
  chartMOD.data.datasets[0].borderColor = borderColors;
  chartMOD.data.datasets[0].label = `Costo MOD (${sym})`;
  chartMOD.update();
}

// ===== Chart: Costo/Kg por Hora =====
function buildChartCostoKgHora() {
  const { labels, values, bgColors, borderColors, dataKey } = getChartCostoKgData();
  prevChartCostoKgData = dataKey;

  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  const gridColor = isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)';
  const textColor = isLight ? '#475569' : '#94a3b8';
  const sym = monedaSoles ? 'S/' : '$';

  document.getElementById('chartCostoKgBadge').textContent = sym + '/kg congelado';

  if (chartCostoKg) chartCostoKg.destroy();
  const ctx = document.getElementById('chartCostoKg').getContext('2d');

  chartCostoKg = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: `Costo/Kg (${sym})`,
        data: values,
        backgroundColor: bgColors,
        borderColor: borderColors,
        borderWidth: 2,
        borderRadius: 8,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: 'index' },
      plugins: {
        legend: { display: false },
        datalabels: {
          display: (ctx) => ctx.dataset.data[ctx.dataIndex] !== null,
          color: textColor,
          anchor: 'end',
          align: 'top',
          font: { size: 11, weight: 700, family: 'Inter' },
          formatter: v => v !== null ? sym + v.toFixed(4) : ''
        }
      },
      scales: {
        x: { grid: { color: gridColor }, ticks: { color: textColor, font: { size: 10, family: 'Inter' }, maxRotation: 45 } },
        y: { grid: { color: gridColor }, ticks: { color: textColor, font: { size: 11, family: 'Inter' }, callback: v => sym + v.toFixed(3) }, beginAtZero: true }
      }
    },
    plugins: [ChartDataLabels]
  });
}

function getChartCostoKgData() {
  const today = getTodayStr();
  const hourlyMap = getHourlyData(today);
  const HORA_SLOTS = getHoraSlots();
  const costoKgCong = parseFloat(document.getElementById('fCostoKgManual').value) || 3.51;
  const tc = getCurrentTC();
  const sym = monedaSoles ? 'S/' : '$';

  const labels = [];
  const values = [];
  const bgColors = [];
  const borderColors = [];

  HORA_SLOTS.forEach(slot => {
    const data = hourlyMap[slot];
    if (!data || !data.hasData) return;

    labels.push(slot);
    let costoKgUsd = 0;
    if (data.pt > 0 && data.personal > 0 && costoKgCong > 0) {
      costoKgUsd = (costoKgCong * data.personal) / data.pt;
    }
    const displayVal = monedaSoles ? (costoKgUsd * tc) : costoKgUsd;
    values.push(displayVal > 0 ? displayVal : null);

    if (costoKgUsd < 0.50) {
      bgColors.push('rgba(22,163,74,0.6)');
      borderColors.push('#16a34a');
    } else if (costoKgUsd < 1.00) {
      bgColors.push('rgba(217,119,6,0.6)');
      borderColors.push('#d97706');
    } else {
      bgColors.push('rgba(220,38,38,0.6)');
      borderColors.push('#dc2626');
    }
  });

  const dataKey = JSON.stringify({ labels, values, monedaSoles, costoKgCong });
  return { labels, values, bgColors, borderColors, dataKey };
}

function updateChartCostoKgHora() {
  const { labels, values, bgColors, borderColors, dataKey } = getChartCostoKgData();
  if (dataKey === prevChartCostoKgData) return;
  prevChartCostoKgData = dataKey;

  if (!chartCostoKg) {
    buildChartCostoKgHora();
    return;
  }

  const sym = monedaSoles ? 'S/' : '$';
  document.getElementById('chartCostoKgBadge').textContent = sym + '/kg congelado';

  chartCostoKg.data.labels = labels;
  chartCostoKg.data.datasets[0].data = values;
  chartCostoKg.data.datasets[0].backgroundColor = bgColors;
  chartCostoKg.data.datasets[0].borderColor = borderColors;
  chartCostoKg.data.datasets[0].label = `Costo/Kg (${sym})`;
  chartCostoKg.update();
}


// ===================== COSTO HORA HOMBRE HANDLER =====================
function onCostoHoraHombreChange() {
  // Trigger recalculations
  prevChartMODData = '';
  renderHoraTable();
  updateChartMOD();
  renderKPIs();
}

function getCurrentCostoHoraHombre() {
  return parseFloat(document.getElementById('fCostoHoraHombre').value) || 5.95;
}

// ===================== SUPABASE HELPERS =====================
function getLocalToday() {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`;
}

function showSupabaseToast(msg, color) {
  const existing = document.getElementById('supaToast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.id = 'supaToast';
  toast.textContent = msg;
  toast.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);padding:12px 28px;border-radius:12px;color:#fff;font-weight:700;font-size:14px;z-index:99999;box-shadow:0 8px 32px rgba(0,0,0,0.3);background:'+(color||'#16a34a')+';transition:opacity 0.3s';
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3000);
}

async function loadFromSupabase() {
  if (typeof supabaseClient === 'undefined' || !supabaseClient) {
    console.warn('Supabase no disponible');
    showSupabaseToast('Supabase no conectado - usando datos locales', '#ef4444');
    return;
  }
  try {
    const { data, error } = await supabaseClient
      .from('config_costos')
      .select('*')
      .eq('fecha', getLocalToday())
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Supabase load error:', error);
      showSupabaseToast('Error al cargar de Supabase: ' + error.message, '#ef4444');
      return;
    }

    if (data && data.length > 0) {
      const config = data[0];
      localStorage.setItem('costos_config', JSON.stringify(config));
      const el = (id) => document.getElementById(id);
      if (el('fTarifaSol')) el('fTarifaSol').value = config.tarifa_almuerzo_soles;
      if (el('fTipoCambio')) el('fTipoCambio').value = config.tipo_cambio;
      if (el('fCostoKgManual')) el('fCostoKgManual').value = config.costo_kg_congelado;
      if (el('fCostoHoraHombre')) el('fCostoHoraHombre').value = config.costo_hora_hombre;
    }
  } catch(e) {
    console.log('Supabase offline');
    console.log('Supabase offline - usando datos locales');
  }
}

async function loadCrossAppFromSupabase() {
  if (typeof supabaseClient === 'undefined' || !supabaseClient) return;
  try {
    const today = getLocalToday();
    const [prodRes, persRes] = await Promise.all([
      supabaseClient.from('registro_produccion').select('*').eq('fecha', today).order('hora'),
      supabaseClient.from('registro_personal').select('*').eq('fecha', today).order('hora')
    ]);
    if (prodRes.error) { console.error('Supabase prod load error:', prodRes.error); }
    if (persRes.error) { console.error('Supabase pers load error:', persRes.error); }
    if (prodRes.data) localStorage.setItem('prod_registros', JSON.stringify(prodRes.data));
    if (persRes.data) localStorage.setItem('personal_registros', JSON.stringify(persRes.data));
  } catch(e) {
    console.log('Supabase cross-app load offline');
  }
}

// ===================== TOAST =====================
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

// ===================== DATE/TURNO CHANGE LISTENERS =====================
document.getElementById('fFecha').addEventListener('change', () => {
  calcTarifaUsd();
  readCrossAppData();
  renderHoraTable();
  prevChartMODData = '';
  prevChartCostoKgData = '';
  renderCharts();
});

document.getElementById('fTurno').addEventListener('change', () => {
  renderHoraTable();
  prevChartMODData = '';
  prevChartCostoKgData = '';
  renderCharts();
});

// ===================== LISTEN FOR CROSS-APP UPDATES =====================
window.addEventListener('storage', () => {
  readCrossAppData();
  renderHoraTable();
  updateChartMOD();
  updateChartCostoKgHora();
  calcTarifaUsd();
});
