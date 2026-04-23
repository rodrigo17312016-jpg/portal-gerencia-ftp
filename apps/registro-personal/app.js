/* ===== SUPABASE HELPERS ===== */
function getLocalToday(){
  const d = new Date();
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}

function showSupabaseToast(msg, color){
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
      .from('registro_personal')
      .select('*')
      .eq('fecha', getLocalToday())
      .order('hora');

    if (error) {
      console.error('Supabase load error:', error);
      showSupabaseToast('Error al cargar de Supabase: ' + error.message, '#ef4444');
      return;
    }

    if (data && data.length > 0) {
      const localRecords = JSON.parse(localStorage.getItem('personal_registros') || '[]');
      const otherDays = localRecords.filter(r => r.fecha !== getLocalToday());
      const merged = [...otherDays, ...data.map(d => ({...d, num_personal: parseInt(d.num_personal)}))];
      localStorage.setItem('personal_registros', JSON.stringify(merged));
      if (typeof renderHistorial === 'function') renderHistorial();
      if (typeof updateKPIs === 'function') updateKPIs();
      if (typeof updateCharts === 'function') updateCharts();
    }
  } catch(e) {
    console.log('Supabase offline - usando datos locales');
  }
}

async function loadLaboresFromSupabase() {
  if (typeof supabaseClient === 'undefined' || !supabaseClient) return;
  try {
    const { data, error } = await supabaseClient.from('labores_custom').select('*').eq('activo', true);
    if (error) console.error('Supabase labores error:', error);
    if (data) localStorage.setItem('personal_labores_custom', JSON.stringify(data));
  } catch(e) { console.log('Labores Supabase offline'); }
}

async function saveLaborToSupabase(labor) {
  if (typeof supabaseClient === 'undefined' || !supabaseClient) return;
  try {
    const { error } = await supabaseClient.from('labores_custom').upsert(labor);
    if (error) console.error('Supabase save labor error:', error);
  } catch(e) { console.log('Save labor Supabase offline'); }
}

/* ===== DISTRIBUTION POSITIONS (by area from Excel) ===== */
const POSITIONS = {
  recepcion: [
    {key:'descarga',label:'Descarga',def:8},
    {key:'seleccion_rec',label:'Seleccion',def:4},
    {key:'desinfeccion_rec',label:'Desinfeccion',def:1},
    {key:'maduracion',label:'Maduracion (traslado)',def:1},
    {key:'desinfeccion_rec2',label:'Desinfeccion',def:1},
    {key:'descarte_rec',label:'Descarte',def:2}
  ],
  acondicionado: [
    {key:'abastecimiento',label:'Abastecimiento',def:1},
    {key:'control_servis',label:'Control de servis',def:1},
    {key:'pelado',label:'Pelado',def:10},
    {key:'despepado',label:'Despepado',def:5},
    {key:'descarte_acon',label:'Descarte',def:2},
    {key:'inspeccion',label:'Inspeccion',def:4},
    {key:'cubeteo',label:'Cubeteo',def:4},
    {key:'seleccion_acon',label:'Seleccion',def:2},
    {key:'pcc',label:'PCC',def:0},
    {key:'abast_bandejas',label:'Abastecimiento de bandejas',def:1},
    {key:'zaranda',label:'Zaranda',def:1},
    {key:'embandejado',label:'Embandejado',def:9},
    {key:'paletizado_acon',label:'Paletizado',def:2},
    {key:'lavado_bandejas',label:'Lavado de bandejas',def:3},
    {key:'lavado_laminas',label:'Lavado de laminas',def:2},
    {key:'laminado',label:'Laminado',def:6}
  ],
  empaque: [
    {key:'tunel',label:'Tunel',def:2},
    {key:'lanzado',label:'Lanzado',def:2},
    {key:'retiro_bandejas',label:'Retiro de bandejas',def:2},
    {key:'retiro_lamina',label:'Retiro de lamina',def:2},
    {key:'chancado',label:'Chancado',def:3},
    {key:'seleccion_emp',label:'Seleccion',def:6},
    {key:'recepcion_emp',label:'Recepcion',def:1},
    {key:'pesado',label:'Pesado',def:1},
    {key:'encintado_dm',label:'Encintado, DM y paletizado',def:1},
    {key:'codificado',label:'Codificado',def:2},
    {key:'camara_apt',label:'Camara APT',def:2}
  ],
  calidad: [
    {key:'bpm',label:'BPM',def:4},
    {key:'lavado_jabas',label:'Lavado de jabas',def:2},
    {key:'control_plagas',label:'Control de plagas',def:1},
    {key:'inspector_calidad',label:'Inspector de calidad',def:5},
    {key:'sanidad',label:'Sanidad',def:6},
    {key:'jardinero',label:'Jardinero',def:1}
  ],
  rrhh: [
    {key:'lavanderia',label:'Lavanderia',def:1}
  ],
  vigilancia: [
    {key:'ssgg',label:'SSGG',def:2}
  ],
  mantenimiento: [
    {key:'mtto',label:'MTTO.',def:3}
  ],
  ti: [
    {key:'soporte_ti',label:'Soporte de TI',def:1}
  ],
  produccion: [
    {key:'inspector_produccion',label:'Inspector de produccion',def:3},
    {key:'asistente',label:'Asistente',def:1},
    {key:'planillas',label:'Planillas',def:1}
  ]
};

const AREA_LABELS = {
  recepcion:'RECEPCION',
  acondicionado:'ACONDICIONADO',
  empaque:'EMPAQUE',
  calidad:'CALIDAD',
  rrhh:'RRHH',
  vigilancia:'VIGILANCIA',
  mantenimiento:'MANTENIMIENTO',
  ti:'TI',
  produccion:'PRODUCCION'
};

const AREA_COLORS = {
  recepcion:'#ea580c',
  acondicionado:'#16a34a',
  empaque:'#7c3aed',
  calidad:'#0891b2',
  rrhh:'#d97706',
  vigilancia:'#64748b',
  mantenimiento:'#2563eb',
  ti:'#6366f1',
  produccion:'#dc2626'
};

/* ===== CUSTOM LABORES ===== */
const LS_CUSTOM_KEY = 'personal_labores_custom';
function getCustomLabores(){ return JSON.parse(localStorage.getItem(LS_CUSTOM_KEY)||'[]'); }
function saveCustomLabores(arr){ localStorage.setItem(LS_CUSTOM_KEY, JSON.stringify(arr)); }

function getAllPositions(){
  // Deep clone POSITIONS and merge custom labores
  const merged = {};
  Object.keys(POSITIONS).forEach(a => { merged[a] = [...POSITIONS[a]]; });
  getCustomLabores().forEach(cl => {
    if(!merged[cl.area]) merged[cl.area] = [];
    merged[cl.area].push({key:cl.key, label:cl.label, def:cl.def||0, custom:true});
  });
  return merged;
}

/* ===== INIT ===== */
let chartHora = null;
let chartArea = null;
const LS_KEY = 'personal_registros';

function getRegistros(){ return JSON.parse(localStorage.getItem(LS_KEY)||'[]'); }
function saveRegistros(arr){ localStorage.setItem(LS_KEY, JSON.stringify(arr)); window.dispatchEvent(new Event('storage')); }

document.addEventListener('DOMContentLoaded', () => {
  // Default date
  document.getElementById('fFecha').value = todayStr();
  // Restore registrado
  const lastReg = localStorage.getItem('personal_last_registrado');
  if(lastReg) document.getElementById('fRegistrado').value = lastReg;
  // Build admin area select
  populateAdminAreaSelect();
  // Build dist inputs
  buildAllDistInputs();
  // Render admin table
  renderAdminTable();
  // Theme
  const savedTheme = localStorage.getItem('personal_theme');
  if(savedTheme === 'light') { document.documentElement.setAttribute('data-theme','light'); document.getElementById('themeBtn').textContent = '☀️'; }
  initCharts();
  updateDashboard();
  // Load from Supabase
  loadFromSupabase().then(() => updateDashboard());
  loadLaboresFromSupabase().then(() => { buildAllDistInputs(); renderAdminTable(); });
  // Check Supabase connection status indicator
  checkSupabaseConnection();
});

function todayStr(){
  const d = new Date();
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}

function buildAllDistInputs(){
  const container = document.getElementById('distContainer');
  container.innerHTML = '';
  const allPos = getAllPositions();
  Object.keys(allPos).forEach(area => {
    const color = AREA_COLORS[area];
    // Area header
    const header = document.createElement('div');
    header.className = 'dist-area-header';
    header.style.background = hexToRgba(color, 0.12);
    header.style.color = color;
    header.style.borderLeft = `4px solid ${color}`;
    header.innerHTML = `<span>${AREA_LABELS[area]}</span><span class="area-subtotal" id="subtotal-${area}">0</span>`;
    container.appendChild(header);
    // Grid
    const grid = document.createElement('div');
    grid.className = 'dist-grid';
    grid.id = 'dist-'+area;
    allPos[area].forEach(p => {
      const div = document.createElement('div');
      div.className = 'dist-item';
      const badge = p.custom ? '<span class="custom-badge">Custom</span>' : '';
      div.innerHTML = `<label title="${p.label}">${p.label}${badge}</label><input type="number" min="0" value="${p.def||0}" data-dist="${p.key}" data-area="${area}" oninput="updateDistTotal()">`;
      grid.appendChild(div);
    });
    container.appendChild(grid);
  });
  updateDistTotal();
}

function hexToRgba(hex, alpha){
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function updateDistTotal(){
  let grandTotal = 0;
  const allAreas = Object.keys(getAllPositions());
  allAreas.forEach(area => {
    let sub = 0;
    document.querySelectorAll(`[data-area="${area}"]`).forEach(inp => { sub += parseInt(inp.value)||0; });
    const el = document.getElementById('subtotal-'+area);
    if(el) el.textContent = sub;
    grandTotal += sub;
  });
  document.getElementById('distTotalValue').textContent = grandTotal;
  const fTotal = parseInt(document.getElementById('fTotal').value)||0;
  const warn = document.getElementById('distWarning');
  if(fTotal > 0 && grandTotal !== fTotal){
    warn.style.display = 'flex';
    warn.textContent = `⚠️ Total distribuido (${grandTotal}) no coincide con N° Total Personal (${fTotal})`;
  } else {
    warn.style.display = 'none';
  }
}
document.addEventListener('input', e => { if(e.target.id === 'fTotal') updateDistTotal(); });

/* ===== THEME (no chart destroy/recreate) ===== */
function toggleTheme(){
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  if(isLight){
    document.documentElement.removeAttribute('data-theme');
    document.getElementById('themeBtn').textContent = '🌙';
    localStorage.setItem('personal_theme','dark');
  } else {
    document.documentElement.setAttribute('data-theme','light');
    document.getElementById('themeBtn').textContent = '☀️';
    localStorage.setItem('personal_theme','light');
  }
  updateChartsTheme();
}

function updateChartsTheme(){
  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
  const gridColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';
  const tickColor = isDark ? '#94a3b8' : '#64748b';
  const legendColor = isDark ? '#e2e8f0' : '#0f172a';

  if(chartHora){
    chartHora.options.scales.y.grid.color = gridColor;
    chartHora.options.scales.y.ticks.color = tickColor;
    chartHora.options.scales.x.ticks.color = tickColor;
    chartHora.options.plugins.datalabels.color = legendColor;
    chartHora.update('none');
  }
  if(chartArea){
    chartArea.options.plugins.legend.labels.color = legendColor;
    chartArea.update('none');
  }
}

/* ===== SAVE ===== */
async function guardarRegistro(){
  if (typeof supabaseClient === 'undefined' || !supabaseClient) {
    showToast('ERROR: Supabase no conectado');
    return;
  }
  const fecha = document.getElementById('fFecha').value;
  const hora = document.getElementById('fHora').value;
  const fruta = document.getElementById('fFruta').value;
  const linea = document.getElementById('fLinea').value;
  const turno = document.getElementById('fTurno').value;
  const total = parseInt(document.getElementById('fTotal').value)||0;
  const registrado = document.getElementById('fRegistrado').value.trim();

  if(!fecha||!hora||!fruta||!linea||!turno||!total){
    showToast('⚠️ Completa todos los campos obligatorios','warning');
    return;
  }

  // Build distribution object grouped by area (includes custom labores)
  const allPos = getAllPositions();
  const distribucion = {};
  Object.keys(allPos).forEach(area => {
    distribucion[area] = {};
    allPos[area].forEach(p => {
      const inp = document.querySelector(`[data-dist="${p.key}"]`);
      distribucion[area][p.key] = parseInt(inp ? inp.value : 0)||0;
    });
  });

  const registro = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2,6),
    fecha, hora, fruta, linea, turno,
    num_personal: total,
    distribucion,
    observacion: document.getElementById('fObs').value.trim(),
    registrado_por: registrado,
    created_at: (function(){const _d=new Date();return _d.getFullYear()+'-'+String(_d.getMonth()+1).padStart(2,'0')+'-'+String(_d.getDate()).padStart(2,'0')+' '+String(_d.getHours()).padStart(2,'0')+':'+String(_d.getMinutes()).padStart(2,'0')+':'+String(_d.getSeconds()).padStart(2,'0')})()
  };

  const registros = getRegistros();
  registros.push(registro);
  saveRegistros(registros);

  // Save to Supabase
  try {
    const { data, error } = await supabaseClient
      .from('registro_personal')
      .upsert({
        fecha: registro.fecha,
        hora: registro.hora,
        turno: registro.turno,
        fruta: registro.fruta,
        linea: registro.linea,
        num_personal: registro.num_personal,
        distribucion: registro.distribucion,
        observacion: registro.observacion,
        registrado_por: registro.registrado_por
      }, { onConflict: 'fecha,hora,linea' });

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

  // Remember registrado
  if(registrado) localStorage.setItem('personal_last_registrado', registrado);

  showToast('✅ Registro guardado correctamente');
  limpiarForm();
  updateDashboard();
}

function limpiarForm(){
  document.getElementById('fFecha').value = todayStr();
  document.getElementById('fHora').value = '';
  document.getElementById('fFruta').value = '';
  document.getElementById('fLinea').value = '';
  document.getElementById('fTurno').value = '';
  document.getElementById('fTotal').value = '';
  document.getElementById('fObs').value = '';
  // Reset dist to defaults
  buildAllDistInputs();
}

async function eliminarRegistro(id){
  if(!confirm('¿Eliminar este registro?')) return;
  // Find the record before deleting for Supabase delete
  const allRegistros = getRegistros();
  const toDelete = allRegistros.find(r => r.id === id);
  const registros = allRegistros.filter(r => r.id !== id);
  saveRegistros(registros);

  // Delete from Supabase
  if (toDelete && typeof supabaseClient !== 'undefined' && supabaseClient) {
    try {
      const { error } = await supabaseClient
        .from('registro_personal')
        .delete()
        .eq('fecha', toDelete.fecha)
        .eq('hora', toDelete.hora)
        .eq('linea', toDelete.linea);
      if (error) {
        console.error('Supabase delete error:', error);
        showSupabaseToast('Error al eliminar en Supabase: ' + error.message, '#ef4444');
      }
    } catch(e) {
      console.error('Supabase offline', e);
      showSupabaseToast('Sin conexion a Supabase al eliminar', '#ef4444');
    }
  }

  updateDashboard();
  showToast('🗑️ Registro eliminado');
}

/* ===== DASHBOARD UPDATE ===== */
function updateDashboard(){
  const todos = getRegistros();
  const hoy = todayStr();
  const regHoy = todos.filter(r => r.fecha === hoy);

  // KPIs
  const totales = regHoy.map(r => r.num_personal);
  const actual = totales.length ? totales[totales.length - 1] : 0;
  const promedio = totales.length ? Math.round(totales.reduce((a,b)=>a+b,0)/totales.length) : 0;
  const maxVal = totales.length ? Math.max(...totales) : 0;
  const minVal = totales.length ? Math.min(...totales) : 0;

  document.getElementById('kpiActual').innerHTML = `${actual} <span class="kpi-unit">personas</span>`;
  document.getElementById('kpiPromedio').innerHTML = `${promedio} <span class="kpi-unit">personas</span>`;
  document.getElementById('kpiRegistros').textContent = regHoy.length;
  document.getElementById('kpiMax').innerHTML = `${maxVal} <span class="kpi-unit">personas</span>`;
  document.getElementById('kpiMin').innerHTML = `${minVal} <span class="kpi-unit">personas</span>`;
  document.getElementById('kpiVar').innerHTML = `${maxVal - minVal} <span class="kpi-unit">personas</span>`;

  // Charts
  updateCharts(regHoy);

  // Table
  renderTable(regHoy);
}

/* ===== CHARTS ===== */
function getChartColors(){
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  return {
    text: isLight ? '#0f172a' : '#e2e8f0',
    grid: isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)',
    tooltipBg: isLight ? '#fff' : '#1e293b',
    tooltipText: isLight ? '#0f172a' : '#e2e8f0'
  };
}

function initCharts(){
  const cc = getChartColors();
  const ctx1 = document.getElementById('chartHora').getContext('2d');
  chartHora = new Chart(ctx1, {
    type: 'bar',
    data: { labels:[], datasets:[{label:'Personal',data:[],backgroundColor:'rgba(217,119,6,0.6)',borderColor:'#d97706',borderWidth:2,borderRadius:8}] },
    options: {
      responsive:true, maintainAspectRatio:false,
      plugins:{legend:{display:false},datalabels:{anchor:'end',align:'top',color:cc.text,font:{weight:'bold',size:11}}},
      scales:{
        x:{ticks:{color:cc.text,font:{size:10}},grid:{display:false}},
        y:{beginAtZero:true,ticks:{color:cc.text},grid:{color:cc.grid}}
      }
    },
    plugins:[ChartDataLabels]
  });

  const ctx2 = document.getElementById('chartArea').getContext('2d');
  chartArea = new Chart(ctx2, {
    type: 'doughnut',
    data: {
      labels: Object.values(AREA_LABELS),
      datasets:[{data:new Array(Object.keys(AREA_LABELS).length).fill(0),backgroundColor:Object.values(AREA_COLORS),borderWidth:0,hoverOffset:8}]
    },
    options: {
      responsive:true, maintainAspectRatio:false, cutout:'60%',
      plugins:{
        legend:{position:'bottom',labels:{color:cc.text,font:{size:11,weight:'bold'},padding:12,usePointStyle:true}},
        datalabels:{color:'#fff',font:{weight:'bold',size:12},formatter:(v)=> v > 0 ? v : ''}
      }
    },
    plugins:[ChartDataLabels]
  });
}

function updateCharts(regHoy){
  if(!chartHora || !chartArea) return;

  // Bar chart - personal by hour
  const horaMap = {};
  regHoy.forEach(r => {
    if(!horaMap[r.hora]) horaMap[r.hora] = 0;
    horaMap[r.hora] += r.num_personal;
  });
  const allHours = ['05:00-06:00','06:00-07:00','07:00-08:00','08:00-09:00','09:00-10:00','10:00-11:00','11:00-12:00','12:00-13:00','13:00-14:00','14:00-15:00','15:00-16:00','16:00-17:00','17:00-18:00','18:00-19:00','19:00-20:00','20:00-21:00','21:00-22:00','22:00-23:00','23:00-00:00','00:00-01:00','01:00-02:00','02:00-03:00','03:00-04:00','04:00-05:00'];
  const labels = allHours.filter(h => horaMap[h]);
  const data = labels.map(h => horaMap[h]);

  chartHora.data.labels = labels.map(h => h.split('-')[0]);
  chartHora.data.datasets[0].data = data;
  chartHora.update();

  // Doughnut - areas (support both old flat format and new grouped format)
  const allPos = getAllPositions();
  const areaSums = {};
  Object.keys(allPos).forEach(a => { areaSums[a] = 0; });

  regHoy.forEach(r => {
    if(!r.distribucion) return;
    const firstKey = Object.keys(r.distribucion)[0];
    if(firstKey && typeof r.distribucion[firstKey] === 'object'){
      Object.keys(allPos).forEach(area => {
        if(r.distribucion[area]){
          Object.values(r.distribucion[area]).forEach(v => { areaSums[area] += (v||0); });
        }
      });
    } else {
      Object.entries(r.distribucion).forEach(([k,v]) => {
        for(const area of Object.keys(allPos)){
          if(allPos[area].find(p => p.key === k)){
            areaSums[area] += v;
            break;
          }
        }
      });
    }
  });

  chartArea.data.datasets[0].data = Object.keys(allPos).map(a => areaSums[a]);
  chartArea.update();
}

/* ===== TABLE ===== */
function renderTable(regHoy){
  const container = document.getElementById('historyContent');
  if(!regHoy.length){
    container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📭</div><div class="empty-state-title">No hay registros</div><div class="empty-state-text">Los registros de personal apareceran aqui al guardarlos</div></div>`;
    return;
  }

  // Sort by hora
  const sorted = [...regHoy].sort((a,b) => a.hora.localeCompare(b.hora));
  const totalSum = sorted.reduce((a,r)=>a+r.num_personal,0);
  const avg = Math.round(totalSum/sorted.length);

  let html = `<div class="table-wrap"><table class="data-table">
    <thead><tr>
      <th>Hora</th><th>Turno</th><th>Fruta</th><th>Linea</th><th class="num">N° Personal</th><th>Distribucion</th><th>Observacion</th><th>Acciones</th>
    </tr></thead><tbody>`;

  sorted.forEach(r => {
    const distSummary = getDistSummary(r.distribucion);
    html += `<tr>
      <td><strong>${r.hora}</strong></td>
      <td style="font-size:10px;font-weight:700;">${r.turno||'-'}</td>
      <td>${r.fruta}</td>
      <td>${r.linea}</td>
      <td class="num">${r.num_personal}</td>
      <td>
        ${distSummary}
        <button class="dist-expand-btn" onclick="toggleDistDetail('${r.id}')">Ver detalle</button>
        <div class="dist-detail" id="detail-${r.id}">${getDistDetail(r.distribucion)}</div>
      </td>
      <td style="font-size:11px;max-width:120px;">${r.observacion||'-'}</td>
      <td><button class="btn btn-danger btn-sm" onclick="eliminarRegistro('${r.id}')">🗑️</button></td>
    </tr>`;
  });

  html += `</tbody><tfoot><tr>
    <td colspan="4"><strong>PROMEDIOS</strong></td>
    <td class="num"><strong>${avg}</strong></td>
    <td colspan="3"></td>
  </tr></tfoot></table></div>`;

  container.innerHTML = html;
}

function getAreaSumsFromDist(dist){
  if(!dist) return {};
  const allPos = getAllPositions();
  const sums = {};
  Object.keys(allPos).forEach(area => { sums[area] = 0; });
  const firstKey = Object.keys(dist)[0];
  if(firstKey && typeof dist[firstKey] === 'object'){
    Object.keys(allPos).forEach(area => {
      if(dist[area]) Object.values(dist[area]).forEach(v => { sums[area] += (v||0); });
    });
  } else {
    Object.entries(dist).forEach(([k,v]) => {
      for(const area of Object.keys(allPos)){
        if(allPos[area].find(p => p.key === k)){ sums[area] += v; break; }
      }
    });
  }
  return sums;
}

function getDistSummary(dist){
  if(!dist) return '-';
  const sums = getAreaSumsFromDist(dist);
  return Object.entries(sums).filter(([,v])=>v>0).map(([k,v]) => `<span style="color:${AREA_COLORS[k]};font-weight:700;font-size:10px;">${AREA_LABELS[k]}: ${v}</span>`).join(' | ');
}

function getDistDetail(dist){
  if(!dist) return '';
  let html = '';
  const allPos = getAllPositions();
  const firstKey = Object.keys(dist)[0];
  const isGrouped = firstKey && typeof dist[firstKey] === 'object';

  Object.keys(allPos).forEach(area => {
    html += `<div class="dist-detail-group"><span class="dist-detail-group-title" style="color:${AREA_COLORS[area]}">${AREA_LABELS[area]}:</span> `;
    html += allPos[area].map(p => {
      let val = 0;
      if(isGrouped && dist[area]) val = dist[area][p.key]||0;
      else val = dist[p.key]||0;
      return `<span class="dist-detail-item">${p.label}: <b>${val}</b></span>`;
    }).join(', ');
    html += '</div>';
  });
  return html;
}

function toggleDistDetail(id){
  const el = document.getElementById('detail-'+id);
  if(el) el.classList.toggle('show');
}

/* ===== TOAST ===== */
function showToast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'),3000);
}

/* ===== ADMIN PANEL ===== */
function toggleAdminPanel(){
  const header = document.getElementById('adminCollapseHeader');
  const body = document.getElementById('adminCollapseBody');
  header.classList.toggle('open');
  body.classList.toggle('open');
}

function populateAdminAreaSelect(){
  const sel = document.getElementById('adminLaborArea');
  sel.innerHTML = '<option value="">Seleccionar...</option>';
  Object.keys(AREA_LABELS).forEach(k => {
    sel.innerHTML += `<option value="${k}">${AREA_LABELS[k]}</option>`;
  });
}

function agregarLaborCustom(){
  const nombre = document.getElementById('adminLaborNombre').value.trim();
  const area = document.getElementById('adminLaborArea').value;
  const def = parseInt(document.getElementById('adminLaborDefault').value)||0;
  if(!nombre||!area){ showToast('⚠️ Completa nombre y area'); return; }
  const key = 'custom_'+nombre.toLowerCase().replace(/[^a-z0-9]+/g,'_')+'_'+Date.now().toString(36);
  const customs = getCustomLabores();
  const newLabor = {key, label:nombre, area, def, activo:true};
  customs.push(newLabor);
  saveCustomLabores(customs);
  saveLaborToSupabase(newLabor);
  // Reset form
  document.getElementById('adminLaborNombre').value = '';
  document.getElementById('adminLaborArea').value = '';
  document.getElementById('adminLaborDefault').value = '0';
  // Rebuild
  buildAllDistInputs();
  renderAdminTable();
  showToast('✅ Labor personalizada agregada');
}

function renderAdminTable(){
  const customs = getCustomLabores();
  const container = document.getElementById('adminLaboresTable');
  if(!customs.length){
    container.innerHTML = '<p style="font-size:11px;color:var(--muted);margin-top:8px;">No hay labores personalizadas aun.</p>';
    return;
  }
  let html = `<table class="admin-table"><thead><tr><th>Labor</th><th>Area</th><th>Valor Predet.</th><th>Acciones</th></tr></thead><tbody>`;
  customs.forEach((cl,i) => {
    html += `<tr id="admin-row-${i}">
      <td><span id="admin-label-${i}">${cl.label}</span></td>
      <td><span id="admin-area-${i}" style="color:${AREA_COLORS[cl.area]};font-weight:700;">${AREA_LABELS[cl.area]}</span></td>
      <td><span id="admin-def-${i}">${cl.def||0}</span></td>
      <td style="white-space:nowrap;">
        <button class="btn-icon edit" onclick="editarLaborCustom(${i})" title="Editar">✏️</button>
        <button class="btn-icon delete" onclick="eliminarLaborCustom(${i})" title="Eliminar">🗑️</button>
      </td>
    </tr>`;
  });
  html += '</tbody></table>';
  container.innerHTML = html;
}

function editarLaborCustom(idx){
  const customs = getCustomLabores();
  const cl = customs[idx];
  const row = document.getElementById('admin-row-'+idx);
  if(!row) return;
  const areaOptions = Object.keys(AREA_LABELS).map(k => `<option value="${k}" ${k===cl.area?'selected':''}>${AREA_LABELS[k]}</option>`).join('');
  row.innerHTML = `
    <td><input type="text" value="${cl.label}" id="edit-label-${idx}" style="width:100%;"></td>
    <td><select id="edit-area-${idx}">${areaOptions}</select></td>
    <td><input type="number" value="${cl.def||0}" id="edit-def-${idx}" min="0" style="width:60px;"></td>
    <td style="white-space:nowrap;">
      <button class="btn-icon save" onclick="guardarEditLaborCustom(${idx})" title="Guardar">✅</button>
      <button class="btn-icon cancel" onclick="renderAdminTable()" title="Cancelar">❌</button>
    </td>`;
}

function guardarEditLaborCustom(idx){
  const label = document.getElementById('edit-label-'+idx).value.trim();
  const area = document.getElementById('edit-area-'+idx).value;
  const def = parseInt(document.getElementById('edit-def-'+idx).value)||0;
  if(!label||!area){ showToast('⚠️ Completa nombre y area'); return; }
  const customs = getCustomLabores();
  customs[idx].label = label;
  customs[idx].area = area;
  customs[idx].def = def;
  saveCustomLabores(customs);
  saveLaborToSupabase(customs[idx]);
  buildAllDistInputs();
  renderAdminTable();
  showToast('✅ Labor actualizada');
}

async function eliminarLaborCustom(idx){
  if(!confirm('¿Eliminar esta labor personalizada?')) return;
  const customs = getCustomLabores();
  const removed = customs.splice(idx,1)[0];
  saveCustomLabores(customs);
  // Delete from Supabase
  if (removed && typeof supabaseClient !== 'undefined' && supabaseClient) {
    try {
      await supabaseClient.from('labores_custom').delete().eq('key', removed.key);
    } catch(e) { console.log('Supabase delete labor offline'); }
  }
  buildAllDistInputs();
  renderAdminTable();
  showToast('🗑️ Labor eliminada');
}

/* ===== INITIAL DIST TOTAL ===== */
setTimeout(updateDistTotal, 100);
