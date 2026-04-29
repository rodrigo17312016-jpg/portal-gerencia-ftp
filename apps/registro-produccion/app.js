// ═══════════════ THEME ═══════════════
function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next === 'dark' ? '' : 'light');
  if (next === 'dark') document.documentElement.removeAttribute('data-theme');
  document.getElementById('themeBtn').textContent = next === 'light' ? '☀️' : '🌙';
  localStorage.setItem('prod_reg_theme', next);
  rebuildCharts();
}
(function initTheme() {
  const saved = localStorage.getItem('prod_reg_theme');
  if (saved === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
    document.getElementById('themeBtn').textContent = '☀️';
  }
})();

// ═══════════════ SECTION TOGGLE ═══════════════
function toggleSection(bodyId, chevronId) {
  const body = document.getElementById(bodyId);
  const chev = document.getElementById(chevronId);
  body.classList.toggle('collapsed');
  chev.classList.toggle('collapsed');
}

// ═══════════════ SIN ALMUERZO TOGGLE ═══════════════
// ═══════════════ TURNO CHANGE ═══════════════
function onTurnoChange() {
  const turno = document.getElementById('fTurno').value;
  const hi = document.getElementById('fHoraInicio');
  const hf = document.getElementById('fHoraFin');
  if (turno === 'DIA') {
    if (hi) hi.value = '07:00';
    if (hf) hf.value = '17:00';
  } else {
    if (hi) hi.value = '19:00';
    if (hf) hf.value = '07:00';
  }
  if (typeof actualizarTituloHorario === 'function') actualizarTituloHorario();
  if (typeof cargarHorarioGuardado === 'function') cargarHorarioGuardado();
}

// ═══════════════ REND DEFAULTS POR FRUTA ═══════════════
const REND_DEFAULTS = {
  'MANGO': 43, 'PALTA': 36, 'GRANADA': 33, 'PIÑA': 40, 'ARANDANO': 98, 'FRESA': 85
};
function getRendDefault(fruta) { return REND_DEFAULTS[fruta] != null ? REND_DEFAULTS[fruta] : 40; }

// Flag: true cuando el usuario editó PT manualmente, false si es auto-calculado
let ptManualOverride = false;

// ═══════════════ FRUTA CHANGE → auto-rellenar rendimiento ═══════════════
function onFrutaChange() {
  const fruta = document.getElementById('fFruta').value;
  const rendField = document.getElementById('fRend');
  // Solo sobrescribir si está vacío o tenía el default de otra fruta
  rendField.value = getRendDefault(fruta);
  ptManualOverride = false; // reset override al cambiar fruta
  onConsumoOrRendChange();
}

// ═══════════════ CONSUMO o REND cambió → recalcular PT ═══════════════
function onConsumoOrRendChange() {
  const consumo = parseFloat(document.getElementById('fConsumo').value) || 0;
  const rend = parseFloat(document.getElementById('fRend').value) || 0;
  if (!ptManualOverride && consumo > 0 && rend > 0) {
    const pt = (consumo * rend / 100);
    document.getElementById('fPT').value = pt.toFixed(1);
  }
  calcPreview();
}

// ═══════════════ Usuario editó PT manualmente → marcar override ═══════════════
function onPTManualChange() {
  ptManualOverride = true;
  calcPreview();
}

// ═══════════════ CALC PREVIEW ═══════════════
function calcPreview() {
  const consumo = parseFloat(document.getElementById('fConsumo').value) || 0;
  const pt = parseFloat(document.getElementById('fPT').value) || 0;
  const rendInput = parseFloat(document.getElementById('fRend').value) || 0;
  const personas = parseFloat((document.getElementById('fPersonas') || {}).value) || 0;
  const preview = document.getElementById('calcPreview');

  if (consumo > 0 || pt > 0) {
    preview.style.display = 'flex';
    const rend = rendInput > 0 ? rendInput : (consumo > 0 ? (pt / consumo * 100) : 0);
    const rendEl = document.getElementById('prevRend');
    rendEl.textContent = rend.toFixed(1) + '%';
    rendEl.className = 'calc-value ' + (rend >= 45 ? 'green' : rend >= 40 ? 'amber' : 'red');
    // Productividad preview
    const prodEl = document.getElementById('prevProd');
    if (prodEl) {
      if (personas > 0 && consumo > 0) {
        prodEl.textContent = (consumo / personas).toFixed(1) + ' kg/p';
        prodEl.className = 'calc-value';
      } else {
        prodEl.textContent = '—';
      }
    }
  } else {
    preview.style.display = 'none';
  }
}

// ═══════════════ STORAGE ═══════════════
function getRecords() {
  try { return JSON.parse(localStorage.getItem('prod_registros') || '[]'); }
  catch { return []; }
}
function saveRecords(records) {
  localStorage.setItem('prod_registros', JSON.stringify(records));
  window.dispatchEvent(new Event('storage'));
}

// ═══════════════ SYNC LOCAL -> SUPABASE ═══════════════
async function syncLocalToSupabase() {
  if (typeof supabaseClient === 'undefined' || !supabaseClient) {
    showToast('Supabase no conectado, intenta en unos segundos', true);
    return;
  }
  const btn = document.getElementById('btnSync');
  if (btn) { btn.disabled = true; btn.innerHTML = '⏳ Sincronizando...'; }

  const records = getRecords();
  if (records.length === 0) {
    showToast('No hay registros locales para sincronizar', true);
    if (btn) { btn.disabled = false; btn.innerHTML = '🔄 Sync'; }
    return;
  }

  let synced = 0, errors = 0;
  // Agrupar por lotes de 50 para no saturar
  const batchSize = 50;
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize).map(r => ({
      fecha: r.fecha,
      hora: r.hora,
      turno: r.turno,
      fruta: r.fruta || 'MANGO',
      linea: r.linea || 'Linea 1',
      proyectado_tn: r.proyectado_tn || 16,
      consumo_kg: r.consumo_kg,
      pt_aprox_kg: r.pt_aprox_kg,
      personas: r.personas || 0,
      hora_inicio_turno: r.hora_inicio_turno || null,
      hora_fin_turno: r.hora_fin_turno || null,
      almuerzo_inicio: r.almuerzo_inicio || null,
      almuerzo_fin: r.almuerzo_fin || null,
      supervisor: r.supervisor || null,
      observacion: r.observacion || null
    })).filter(r => r.fecha && r.hora && r.consumo_kg);

    if (batch.length === 0) continue;

    try {
      const { data, error } = await supabaseClient
        .from('registro_produccion')
        .upsert(batch, { onConflict: 'fecha,hora,linea' });

      if (error) {
        console.error('Sync batch error:', error);
        errors += batch.length;
      } else {
        synced += batch.length;
      }
    } catch(e) {
      console.error('Sync exception:', e);
      errors += batch.length;
    }
  }

  if (btn) { btn.disabled = false; btn.innerHTML = '🔄 Sync'; }

  if (errors === 0) {
    showSupabaseToast('Sincronizados ' + synced + ' registros a Supabase', '#16a34a');
  } else {
    showSupabaseToast('Sync parcial: ' + synced + ' OK, ' + errors + ' errores', '#d97706');
  }
}

// ═══════════════ REGISTER ═══════════════
async function registrarHora() {
  if (typeof supabaseClient === 'undefined' || !supabaseClient) {
    showToast('ERROR: Supabase no conectado', true);
    return;
  }
  const consumo = parseFloat(document.getElementById('fConsumo').value);
  const rendInput = parseFloat(document.getElementById('fRend').value);
  let pt = parseFloat(document.getElementById('fPT').value);
  const personas = parseInt(document.getElementById('fPersonas').value) || 0;
  if (!consumo || isNaN(consumo) || consumo <= 0) { showToast('Ingresa el consumo de MP', true); return; }
  if (!rendInput || isNaN(rendInput) || rendInput <= 0) { showToast('Ingresa el rendimiento %', true); return; }
  // Si no hay PT, auto-calcular
  if (!pt || isNaN(pt) || pt <= 0) {
    pt = parseFloat((consumo * rendInput / 100).toFixed(1));
    document.getElementById('fPT').value = pt;
  }

  const supervisor = document.getElementById('fSupervisor').value.trim();
  if (supervisor) localStorage.setItem('prod_reg_supervisor', supervisor);

  // El rendimiento REAL que se guarda debe coincidir con el DB (generado = pt/consumo*100)
  // Así si el usuario override-ó PT, el rend local queda consistente con lo que Supabase calcule.
  const rend = (pt / consumo * 100).toFixed(1);
  const hora = document.getElementById('fHora').value;
  if (!hora || hora.trim() === '') { showToast('Selecciona la hora del registro', true); return; }
  // Obtener almuerzo guardado del dia
  const fecha = document.getElementById('fFecha').value;
  const almGuardado = JSON.parse(localStorage.getItem('almuerzo_' + fecha) || 'null');

  const record = {
    id: Date.now().toString(36) + Math.random().toString(36).substr(2,5),
    fecha: fecha,
    hora: hora,
    turno: document.getElementById('fTurno').value,
    fruta: document.getElementById('fFruta').value,
    linea: document.getElementById('fLinea').value,
    proyectado_tn: parseFloat(document.getElementById('fProyectado').value) || 16,
    consumo_kg: consumo,
    pt_aprox_kg: pt,
    rendimiento: parseFloat(rend),
    personas: personas,
    hora_inicio_turno: (document.getElementById('fHoraInicio') || {}).value || null,
    hora_fin_turno: (document.getElementById('fHoraFin') || {}).value || null,
    almuerzo_inicio: (almGuardado && almGuardado.inicio) || '',
    almuerzo_fin: (almGuardado && almGuardado.fin) || '',
    supervisor: supervisor,
    observacion: document.getElementById('fObs').value.trim(),
    created_at: (function(){const _d=new Date();return _d.getFullYear()+'-'+String(_d.getMonth()+1).padStart(2,'0')+'-'+String(_d.getDate()).padStart(2,'0')+' '+String(_d.getHours()).padStart(2,'0')+':'+String(_d.getMinutes()).padStart(2,'0')+':'+String(_d.getSeconds()).padStart(2,'0')})()
  };

  const records = getRecords();
  records.push(record);
  saveRecords(records);

  // Save to Supabase (cloud sync)
  try {
    const { data, error } = await supabaseClient
      .from('registro_produccion')
      .upsert({
        fecha: record.fecha,
        hora: record.hora,
        turno: record.turno,
        fruta: record.fruta,
        linea: record.linea,
        proyectado_tn: record.proyectado_tn,
        consumo_kg: record.consumo_kg,
        pt_aprox_kg: record.pt_aprox_kg,
        personas: record.personas || 0,
        hora_inicio_turno: record.hora_inicio_turno || null,
        hora_fin_turno: record.hora_fin_turno || null,
        almuerzo_inicio: record.almuerzo_inicio || null,
        almuerzo_fin: record.almuerzo_fin || null,
        supervisor: record.supervisor,
        observacion: record.observacion
      }, { onConflict: 'fecha,hora,linea' });

    if (error) {
      console.error('Supabase error:', error);
      showSupabaseToast('ERROR Supabase: ' + error.message, '#ef4444');
    } else {
      showSupabaseToast('Registrado en Supabase', '#16a34a');
    }
  } catch(e) {
    console.error('Supabase offline:', e);
    showSupabaseToast('Supabase sin conexion - guardado local', '#ef4444');
  }

  showToast('Registro guardado exitosamente');
  limpiarForm();
  refreshAll();
  // Auto-avanzar a la siguiente hora
  avanzarHora();
}

function limpiarForm() {
  document.getElementById('fConsumo').value = '';
  document.getElementById('fPT').value = '';
  document.getElementById('fPersonas').value = '';
  document.getElementById('fObs').value = '';
  document.getElementById('calcPreview').style.display = 'none';
  document.getElementById('prevRend').textContent = '—';
  var pp = document.getElementById('prevProd'); if (pp) pp.textContent = '—';
  ptManualOverride = false;
  // Restaurar rendimiento por defecto según fruta actual
  onFrutaChange();
}

// ═══════════════ AUTO-AVANZAR HORA ═══════════════
function avanzarHora() {
  // Buscar la ultima hora registrada hoy y poner la siguiente
  var records = getRecords();
  var fecha = document.getElementById('fFecha').value;
  var turno = document.getElementById('fTurno').value;
  var hoy = records.filter(function(r) { return r.fecha === fecha && r.turno === turno; });

  if (hoy.length === 0) {
    // Sin registros: poner 07:00-08:00 como default
    document.getElementById('fHora').value = '07:00-08:00';
    return;
  }

  // Encontrar la ultima hora registrada
  var horas = hoy.map(function(r) { return r.hora; }).sort();
  var ultima = horas[horas.length - 1];

  // Buscar la siguiente opcion en el select
  var sel = document.getElementById('fHora');
  var found = false;
  for (var i = 0; i < sel.options.length; i++) {
    if (sel.options[i].value === ultima) {
      // Seleccionar la siguiente si existe
      if (i + 1 < sel.options.length) {
        sel.selectedIndex = i + 1;
      } else {
        sel.selectedIndex = i; // Quedarse en la ultima
      }
      found = true;
      break;
    }
  }
  if (!found) {
    sel.value = '07:00-08:00';
  }
}

// ═══════════════ REGISTRAR HORARIO DEL TURNO (INICIO Y FIN SEPARADOS) ═══════════════
function actualizarTituloHorario() {
  var turno = document.getElementById('fTurno').value;
  var el = document.getElementById('horarioTitleTurno');
  if (el) el.textContent = 'Horario Turno ' + (turno === 'NOCHE' ? 'NOCHE' : 'DIA');
}

function registrarInicio() {
  var el = document.getElementById('fHoraInicio');
  if (!el || !el.value) { showToast('Selecciona la hora de inicio'); return; }
  var fecha = document.getElementById('fFecha').value;
  var key = 'horario_' + fecha;
  var saved = JSON.parse(localStorage.getItem(key) || '{}');
  saved.inicio = el.value;
  localStorage.setItem(key, JSON.stringify(saved));
  actualizarHorarioStatus();
  showToast('Hora de INICIO registrada: ' + el.value);
}

function registrarFin() {
  var el = document.getElementById('fHoraFin');
  if (!el || !el.value) { showToast('Selecciona la hora de fin'); return; }
  var fecha = document.getElementById('fFecha').value;
  var key = 'horario_' + fecha;
  var saved = JSON.parse(localStorage.getItem(key) || '{}');
  saved.fin = el.value;
  localStorage.setItem(key, JSON.stringify(saved));
  actualizarHorarioStatus();
  showToast('Hora de FIN registrada: ' + el.value);
}

function actualizarHorarioStatus() {
  var fecha = document.getElementById('fFecha').value;
  var key = 'horario_' + fecha;
  var saved = JSON.parse(localStorage.getItem(key) || '{}');
  var statusEl = document.getElementById('horarioStatus');
  if (!statusEl) return;
  var textEl = document.getElementById('horarioStatusText');
  var parts = [];
  if (saved.inicio) parts.push('Inicio: <b>' + saved.inicio + '</b>');
  if (saved.fin) parts.push('Fin: <b>' + saved.fin + '</b>');
  if (parts.length > 0 && textEl) {
    statusEl.style.display = 'block';
    textEl.innerHTML = parts.join('  |  ');
  } else {
    statusEl.style.display = 'none';
  }
}

function editarHorario() {
  var el = document.getElementById('horarioStatus');
  if (el) el.style.display = 'none';
}

function cargarHorarioGuardado() {
  var fecha = document.getElementById('fFecha').value;
  var key = 'horario_' + fecha;
  var saved = JSON.parse(localStorage.getItem(key) || '{}');
  var hi = document.getElementById('fHoraInicio');
  var hf = document.getElementById('fHoraFin');
  if (saved.inicio && hi) hi.value = saved.inicio;
  if (saved.fin && hf) hf.value = saved.fin;
  actualizarHorarioStatus();
}

function actualizarTurnoResumen() {
  // Seccion eliminada - no-op
}

// ═══════════════ REGISTRAR ALMUERZO ═══════════════
function registrarAlmuerzo() {
  var inicio = document.getElementById('fAlmInicio').value;
  var fin = document.getElementById('fAlmFin').value;
  if (!inicio || !fin) { showToast('Completa hora inicio y fin del almuerzo', true); return; }

  var fecha = document.getElementById('fFecha').value;
  localStorage.setItem('almuerzo_' + fecha, JSON.stringify({ inicio: inicio, fin: fin }));

  // Actualizar almuerzo en todos los registros existentes del dia
  var records = getRecords();
  var changed = false;
  records.forEach(function(r) {
    if (r.fecha === fecha) { r.almuerzo_inicio = inicio; r.almuerzo_fin = fin; changed = true; }
  });
  if (changed) saveRecords(records);

  showToast('Almuerzo registrado: ' + inicio + ' - ' + fin);
  actualizarTurnoResumen();
  actualizarAlmCenaUI();
  refreshAll();
}

function registrarCena() {
  var inicio = document.getElementById('fCenaInicio').value;
  var fin = document.getElementById('fCenaFin').value;
  if (!inicio || !fin) { showToast('Completa hora inicio y fin de la cena', true); return; }
  var fecha = document.getElementById('fFecha').value;
  localStorage.setItem('cena_' + fecha, JSON.stringify({ inicio: inicio, fin: fin }));

  showToast('Cena registrada: ' + inicio + ' - ' + fin);
  actualizarTurnoResumen();
  actualizarAlmCenaUI();
  refreshAll();
}

function actualizarAlmCenaUI() {
  var fecha = document.getElementById('fFecha').value;
  var almSaved = JSON.parse(localStorage.getItem('almuerzo_' + fecha) || 'null');
  var cenaSaved = JSON.parse(localStorage.getItem('cena_' + fecha) || 'null');
  var almForm = document.getElementById('almuerzoForm');
  var cenaForm = document.getElementById('cenaForm');
  var resumen = document.getElementById('almCenaResumen');
  var tbody = document.getElementById('almCenaResumenBody');

  // Ocultar formularios si ya registrados
  if (almForm) almForm.style.display = (almSaved && almSaved.inicio) ? 'none' : 'block';
  if (cenaForm) cenaForm.style.display = (cenaSaved && cenaSaved.inicio) ? 'none' : 'block';

  // Mostrar/ocultar resumen
  if (!resumen || !tbody) return;
  if (!almSaved && !cenaSaved) { resumen.style.display = 'none'; return; }

  resumen.style.display = 'block';
  var html = '';

  if (almSaved && almSaved.inicio) {
    html += '<tr style="border-bottom:1px solid var(--border)">' +
      '<td style="padding:10px 14px;font-weight:700;color:#ea580c;font-size:13px">🍽️ Almuerzo</td>' +
      '<td style="padding:10px 14px;font-weight:600;font-size:13px">' + almSaved.inicio + ' — ' + almSaved.fin + '</td>' +
      '<td style="padding:10px 6px;text-align:right;white-space:nowrap">' +
        '<button onclick="abrirEditPausa(\'almuerzo\')" style="background:rgba(234,88,12,0.1);border:1px solid rgba(234,88,12,0.3);color:#ea580c;padding:5px 12px;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer">✏️ Editar</button> ' +
        '<button onclick="eliminarPausa(\'almuerzo\')" style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);color:#ef4444;padding:5px 12px;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;margin-left:4px">🗑️ Eliminar</button>' +
      '</td></tr>';
  }
  if (cenaSaved && cenaSaved.inicio) {
    html += '<tr>' +
      '<td style="padding:10px 14px;font-weight:700;color:#8b5cf6;font-size:13px">🌙 Cena</td>' +
      '<td style="padding:10px 14px;font-weight:600;font-size:13px">' + cenaSaved.inicio + ' — ' + cenaSaved.fin + '</td>' +
      '<td style="padding:10px 6px;text-align:right;white-space:nowrap">' +
        '<button onclick="abrirEditPausa(\'cena\')" style="background:rgba(139,92,246,0.1);border:1px solid rgba(139,92,246,0.3);color:#8b5cf6;padding:5px 12px;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer">✏️ Editar</button> ' +
        '<button onclick="eliminarPausa(\'cena\')" style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);color:#ef4444;padding:5px 12px;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;margin-left:4px">🗑️ Eliminar</button>' +
      '</td></tr>';
  }
  tbody.innerHTML = html;
}

// Modal de edicion para Almuerzo/Cena
function abrirEditPausa(tipo) {
  var fecha = document.getElementById('fFecha').value;
  var saved = JSON.parse(localStorage.getItem((tipo === 'almuerzo' ? 'almuerzo_' : 'cena_') + fecha) || 'null');
  var ini = (saved && saved.inicio) || (tipo === 'almuerzo' ? '13:00' : '00:00');
  var fin = (saved && saved.fin) || (tipo === 'almuerzo' ? '14:00' : '01:00');
  var color = tipo === 'almuerzo' ? '#ea580c' : '#8b5cf6';
  var icon = tipo === 'almuerzo' ? '🍽️' : '🌙';
  var titulo = tipo === 'almuerzo' ? 'Editar Almuerzo' : 'Editar Cena';

  var modal = document.getElementById('pausaEditModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'pausaEditModal';
    modal.style.cssText = 'display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.65);backdrop-filter:blur(8px);z-index:1001;justify-content:center;align-items:center;padding:20px';
    modal.addEventListener('click', function(e) { if (e.target === modal) modal.style.display = 'none'; });
    document.body.appendChild(modal);
  }

  modal.innerHTML = '<div style="background:var(--surface-solid,#1a1a2e);border:1px solid var(--border);border-radius:20px;padding:28px;width:100%;max-width:420px;box-shadow:0 20px 60px rgba(0,0,0,0.5);animation:modalIn 0.3s cubic-bezier(0.16,1,0.3,1)">' +
    '<div style="font-size:18px;font-weight:900;margin-bottom:20px;display:flex;align-items:center;gap:8px;color:'+color+'">' + icon + ' ' + titulo + '</div>' +
    '<div class="form-grid" style="grid-template-columns:1fr 1fr">' +
      '<div class="form-group"><label>Hora Inicio</label><input type="time" id="pausaEditInicio" value="'+ini+'"></div>' +
      '<div class="form-group"><label>Hora Fin</label><input type="time" id="pausaEditFin" value="'+fin+'"></div>' +
    '</div>' +
    '<div style="display:flex;gap:12px;margin-top:20px;justify-content:flex-end">' +
      '<button onclick="document.getElementById(\'pausaEditModal\').style.display=\'none\'" style="padding:10px 24px;border:2px solid var(--border);border-radius:12px;font-size:13px;font-weight:700;cursor:pointer;background:transparent;color:var(--muted);font-family:Plus Jakarta Sans,sans-serif">Cancelar</button>' +
      '<button onclick="guardarEditPausa(\''+tipo+'\')" style="padding:10px 24px;border:none;border-radius:12px;font-size:13px;font-weight:700;cursor:pointer;background:'+color+';color:#fff;font-family:Plus Jakarta Sans,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,0.2)">💾 Guardar</button>' +
    '</div>' +
  '</div>';

  modal.style.display = 'flex';
}

function guardarEditPausa(tipo) {
  var inicio = document.getElementById('pausaEditInicio').value;
  var fin = document.getElementById('pausaEditFin').value;
  if (!inicio || !fin) { showToast('Completa ambas horas', true); return; }
  var fecha = document.getElementById('fFecha').value;
  var key = (tipo === 'almuerzo' ? 'almuerzo_' : 'cena_') + fecha;
  localStorage.setItem(key, JSON.stringify({ inicio: inicio, fin: fin }));

  // Actualizar registros si es almuerzo
  if (tipo === 'almuerzo') {
    var records = getRecords();
    records.forEach(function(r) { if (r.fecha === fecha) { r.almuerzo_inicio = inicio; r.almuerzo_fin = fin; } });
    saveRecords(records);
  }

  document.getElementById('pausaEditModal').style.display = 'none';
  showToast((tipo === 'almuerzo' ? 'Almuerzo' : 'Cena') + ' actualizado: ' + inicio + ' - ' + fin);
  actualizarAlmCenaUI();
  // Refrescar tabla localmente
  var filterDate = document.getElementById('filterDate').value;
  var recs = getRecords().filter(function(r) { return r.fecha === filterDate; });
  updateTable(recs);
  rebuildCharts(recs);
}

function eliminarPausa(tipo) {
  var label = tipo === 'almuerzo' ? 'Almuerzo' : 'Cena';
  if (!confirm('¿Eliminar ' + label + ' registrado? Los registros de hoy se actualizarán.')) return;
  var fecha = document.getElementById('fFecha').value;
  var key = (tipo === 'almuerzo' ? 'almuerzo_' : 'cena_') + fecha;
  localStorage.removeItem(key);

  // Si es almuerzo, limpiar campos de los registros
  if (tipo === 'almuerzo') {
    var records = getRecords();
    records.forEach(function(r) {
      if (r.fecha === fecha) {
        r.almuerzo_inicio = '';
        r.almuerzo_fin = '';
      }
    });
    saveRecords(records);
    // Actualizar en Supabase
    if (supabaseClient) {
      supabaseClient.from('registro_produccion')
        .update({ almuerzo_inicio: null, almuerzo_fin: null })
        .eq('fecha', fecha)
        .then(function() { console.log(label + ' eliminado en Supabase'); });
    }
  }
  if (tipo === 'cena') {
    // Cena solo se guarda en localStorage, limpiar
    if (supabaseClient) {
      supabaseClient.from('registro_produccion')
        .update({ cena_inicio: null, cena_fin: null })
        .eq('fecha', fecha)
        .then(function() { console.log(label + ' eliminado en Supabase'); });
    }
  }

  showToast(label + ' eliminado correctamente');
  actualizarAlmCenaUI();
  var filterDate = document.getElementById('filterDate').value;
  var recs = getRecords().filter(function(r) { return r.fecha === filterDate; });
  updateTable(recs);
  rebuildCharts(recs);
}

function cargarAlmuerzoGuardado() {
  var fecha = document.getElementById('fFecha').value;
  var saved = localStorage.getItem('almuerzo_' + fecha);
  if (saved) {
    var data = JSON.parse(saved);
    document.getElementById('fAlmInicio').value = data.inicio || '13:00';
    document.getElementById('fAlmFin').value = data.fin || '14:00';
  }
  actualizarAlmCenaUI();
}

// ═══════════════ EDIT MODAL ═══════════════
let editingProdId = null;
let mPtOverride = false;

function mOnConsumoOrRendChange() {
  const c = parseFloat(document.getElementById('mConsumo').value) || 0;
  const rend = parseFloat(document.getElementById('mRend').value) || 0;
  if (!mPtOverride && c > 0 && rend > 0) {
    document.getElementById('mPT').value = (c * rend / 100).toFixed(1);
  }
}

function openEditModal(id) {
  const records = getRecords();
  const r = records.find(rec => rec.id === id);
  if (!r) return;
  editingProdId = id;
  mPtOverride = true; // al abrir, respetar PT que ya tiene
  document.getElementById('mFecha').value = r.fecha || '';
  document.getElementById('mTurno').value = r.turno || 'DIA';
  document.getElementById('mHora').value = r.hora || '';
  document.getElementById('mFruta').value = r.fruta || 'MANGO';
  document.getElementById('mLinea').value = r.linea || 'Linea 1';
  document.getElementById('mConsumo').value = r.consumo_kg || '';
  document.getElementById('mPT').value = r.pt_aprox_kg || '';
  document.getElementById('mRend').value = r.rendimiento || getRendDefault(r.fruta || 'MANGO');
  document.getElementById('mPersonas').value = r.personas || '';
  document.getElementById('mProyectado').value = r.proyectado_tn || 16;
  document.getElementById('mSupervisor').value = r.supervisor || '';
  document.getElementById('mObs').value = r.observacion || '';
  document.getElementById('editModal').style.display = 'flex';
}

function closeEditModal() {
  document.getElementById('editModal').style.display = 'none';
  editingProdId = null;
}

document.getElementById('editModal').addEventListener('click', function(e) {
  if (e.target === this) closeEditModal();
});

async function guardarEdicion() {
  if (!editingProdId) return;
  const records = getRecords();
  const idx = records.findIndex(r => r.id === editingProdId);
  if (idx === -1) { closeEditModal(); return; }

  const horaVal = document.getElementById('mHora').value;
  if (!horaVal || horaVal.trim() === '') { showToast('ERROR: La hora es obligatoria', true); return; }
  const consumo = parseFloat(document.getElementById('mConsumo').value) || 0;
  if (consumo <= 0) { showToast('Ingresa el consumo de MP', true); return; }
  const pt = parseFloat(document.getElementById('mPT').value) || 0;
  if (pt <= 0) { showToast('Ingresa el P. Terminado', true); return; }
  // El rendimiento en DB es generado (pt/consumo*100). Guardamos el mismo valor
  // en localStorage para mantener consistencia al volver a leer de Supabase.
  const rend = consumo > 0 ? parseFloat((pt / consumo * 100).toFixed(1)) : 0;
  const personas = parseInt(document.getElementById('mPersonas').value) || 0;
  const proyectado = parseFloat(document.getElementById('mProyectado').value) || 16;

  records[idx] = {
    ...records[idx],
    fecha: document.getElementById('mFecha').value,
    turno: document.getElementById('mTurno').value,
    hora: document.getElementById('mHora').value,
    fruta: document.getElementById('mFruta').value,
    linea: document.getElementById('mLinea').value,
    consumo_kg: consumo,
    pt_aprox_kg: pt,
    rendimiento: rend,
    personas: personas,
    proyectado_tn: proyectado,
    supervisor: document.getElementById('mSupervisor').value.trim(),
    observacion: document.getElementById('mObs').value.trim()
  };

  saveRecords(records);

  // Sync to Supabase (await para que termine antes de refrescar)
  if (typeof supabaseClient !== 'undefined' && supabaseClient) {
    try {
      const r = records[idx];
      await supabaseClient.from('registro_produccion').upsert({
        fecha: r.fecha, hora: r.hora, turno: r.turno, fruta: r.fruta, linea: r.linea,
        proyectado_tn: r.proyectado_tn, consumo_kg: r.consumo_kg, pt_aprox_kg: r.pt_aprox_kg,
        personas: r.personas || 0,
        supervisor: r.supervisor, observacion: r.observacion
      }, { onConflict: 'fecha,hora,linea' });
    } catch(e) { console.error('Supabase sync error', e); }
  }

  closeEditModal();
  // Refrescar localmente sin sobreescribir desde Supabase
  const filterDate = document.getElementById('filterDate').value;
  const todayRecs = records.filter(r => r.fecha === filterDate);
  updateKPIs(todayRecs);
  updateTable(todayRecs);
  rebuildCharts(todayRecs);
  showToast('Registro actualizado');
}

function cargarCenaGuardada() {
  var fecha = document.getElementById('fFecha').value;
  var saved = localStorage.getItem('cena_' + fecha);
  if (saved) {
    var data = JSON.parse(saved);
    document.getElementById('fCenaInicio').value = data.inicio || '00:00';
    document.getElementById('fCenaFin').value = data.fin || '01:00';
  }
  actualizarAlmCenaUI();
}

// ═══════════════ DELETE RECORD ═══════════════

async function deleteRecord(id) {
  if (!confirm('¿Eliminar este registro?')) return;
  let records = getRecords();
  const record = records.find(r => r.id === id);
  records = records.filter(r => r.id !== id);
  saveRecords(records);

  // Delete from Supabase
  if (record && typeof supabaseClient !== 'undefined' && supabaseClient) {
    try {
      const { error } = await supabaseClient.from('registro_produccion').delete().eq('fecha', record.fecha).eq('hora', record.hora).eq('linea', record.linea);
      if (error) {
        console.error('Supabase delete error:', error);
        showSupabaseToast('Error al eliminar en Supabase: ' + error.message, '#ef4444');
      }
    } catch(e) {
      console.error('Supabase delete offline', e);
      showSupabaseToast('Sin conexion a Supabase al eliminar', '#ef4444');
    }
  }

  refreshAll();
  showToast('Registro eliminado');
}

// ═══════════════ TOAST ═══════════════
function showToast(msg, isError) {
  const toast = document.getElementById('toast');
  toast.textContent = (isError ? '⚠️ ' : '✅ ') + msg;
  toast.style.background = isError
    ? 'linear-gradient(135deg, #dc2626, #b91c1c)'
    : 'linear-gradient(135deg, #16a34a, #15803d)';
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

// ═══════════════ REFRESH ALL ═══════════════
async function refreshAll() {
  const filterDate = document.getElementById('filterDate').value;

  // Cargar datos de Supabase para la fecha seleccionada
  if (typeof supabaseClient !== 'undefined' && supabaseClient) {
    try {
      // Also load the week of the selected date so Comparativo Turnos chart has data
      const refDate = new Date(filterDate + 'T12:00:00');
      const dayOfWeek = refDate.getDay();
      const mondayDate = new Date(refDate);
      mondayDate.setDate(mondayDate.getDate() + (dayOfWeek === 0 ? -6 : 1 - dayOfWeek));
      const mondayStr = mondayDate.getFullYear() + '-' + String(mondayDate.getMonth()+1).padStart(2,'0') + '-' + String(mondayDate.getDate()).padStart(2,'0');

      const { data: weekData } = await supabaseClient
        .from('registro_produccion')
        .select('*')
        .gte('fecha', mondayStr)
        .order('fecha')
        .order('hora');

      if (weekData && weekData.length > 0) {
        const localRecords = JSON.parse(localStorage.getItem('prod_registros') || '[]');
        const weekDates = new Set(weekData.map(d => d.fecha));
        const otherDays = localRecords.filter(r => !weekDates.has(r.fecha));
        const merged = [...otherDays, ...weekData.map(d => ({
          ...d,
          consumo_kg: parseFloat(d.consumo_kg),
          pt_aprox_kg: parseFloat(d.pt_aprox_kg),
          rendimiento: parseFloat(d.rendimiento),
          personas: parseInt(d.personas) || 0,
          proyectado_tn: parseFloat(d.proyectado_tn)
        }))];
        localStorage.setItem('prod_registros', JSON.stringify(merged));
      }
    } catch(e) {
      console.log('Supabase no disponible, usando localStorage para fecha:', filterDate);
    }
  }

  const records = getRecords();
  const todayRecs = records.filter(r => r.fecha === filterDate);

  updateKPIs(todayRecs);
  updateTable(todayRecs);
  rebuildCharts(todayRecs);
}

// ═══════════════ KPIs ═══════════════
const FRUTA_COLORS = {
  'MANGO': {main:'#ea580c',bg:'rgba(234,88,12,0.08)',grad:'linear-gradient(90deg,#ea580c,#f97316,#fb923c,#ea580c)'},
  'FRESA': {main:'#dc2626',bg:'rgba(220,38,38,0.08)',grad:'linear-gradient(90deg,#dc2626,#ef4444,#f87171,#dc2626)'},
  'PALTA': {main:'#16a34a',bg:'rgba(22,163,74,0.08)',grad:'linear-gradient(90deg,#059669,#16a34a,#22c55e,#059669)'},
  'ARANDANO': {main:'#7c3aed',bg:'rgba(124,58,237,0.08)',grad:'linear-gradient(90deg,#7c3aed,#8b5cf6,#a78bfa,#7c3aed)'},
  'PIÑA': {main:'#d97706',bg:'rgba(217,119,6,0.08)',grad:'linear-gradient(90deg,#d97706,#f59e0b,#fbbf24,#d97706)'},
  'GRANADA': {main:'#be185d',bg:'rgba(190,24,93,0.08)',grad:'linear-gradient(90deg,#be185d,#db2777,#ec4899,#be185d)'}
};
const FRUTA_ICONS = {'MANGO':'🥭','FRESA':'🍓','PALTA':'🥑','ARANDANO':'🫐','PIÑA':'🍍','GRANADA':'🍎'};

function getFrutaColor(fruta) { return FRUTA_COLORS[fruta] || {main:'#2563eb',bg:'rgba(37,99,235,0.08)',grad:'linear-gradient(90deg,#2563eb,#3b82f6,#60a5fa,#2563eb)'}; }

function updateKPIs(recs) {
  const totalConsumo = recs.reduce((s, r) => s + (r.consumo_kg || 0), 0);
  const totalPT = recs.reduce((s, r) => s + (r.pt_aprox_kg || 0), 0);
  const rendProm = totalConsumo > 0 ? (totalPT / totalConsumo * 100) : 0;

  document.getElementById('kpiConsumo').innerHTML = formatNum(totalConsumo) + ' <span class="kpi-unit">kg</span>';
  document.getElementById('kpiPT').innerHTML = formatNum(totalPT) + ' <span class="kpi-unit">kg</span>';
  document.getElementById('kpiRend').innerHTML = rendProm.toFixed(1) + '<span class="kpi-unit">%</span>';
  // Contar horas únicas (cada franja horaria distinta)
const horasUnicas = new Set(recs.map(r => r.hora)).size;
const kgHora = horasUnicas > 0 ? (totalConsumo / horasUnicas) : 0;
document.getElementById('kpiCount').innerHTML = formatNum(kgHora) + ' <span class="kpi-unit">kg/h</span>';
const metaEl = document.getElementById('kpiCountMeta');
if (metaEl) metaEl.textContent = horasUnicas + ' hrs registradas';

  // Mejor Hora
  if (recs.length > 0) {
    const best = recs.reduce((a, b) => (a.rendimiento > b.rendimiento ? a : b));
    document.getElementById('kpiBest').innerHTML = best.hora.split('-')[0] + ' <span class="kpi-unit">(' + best.rendimiento + '%)</span>';
  } else {
    document.getElementById('kpiBest').innerHTML = '—';
  }

  // Mini desglose por fruta dentro de cada KPI card
  buildKpiFrutasInline(recs);

  // Avance Meta Diaria POR FRUTA
  buildAvancePorFruta(recs);
}

function buildKpiFrutasInline(recs) {
  const cCont = document.getElementById('kpiConsumoFrutas');
  const pCont = document.getElementById('kpiPTFrutas');
  const rCont = document.getElementById('kpiRendFrutas');
  const hCont = document.getElementById('kpiCountFrutas');
  if (!cCont) return;

  const frutasMap = {};
  recs.forEach(r => {
    const f = r.fruta || 'MANGO';
    if (!frutasMap[f]) frutasMap[f] = { consumo: 0, pt: 0, horas: 0 };
    frutasMap[f].consumo += (r.consumo_kg || 0);
    frutasMap[f].pt += (r.pt_aprox_kg || 0);
    frutasMap[f].horas++;
  });
  const frutas = Object.keys(frutasMap);
  if (frutas.length <= 1) {
    [cCont, pCont, rCont, hCont].forEach(c => { if (c) c.innerHTML = ''; });
    return;
  }

  let cH = '', pH = '', rH = '', hH = '';
  frutas.forEach(fruta => {
    const d = frutasMap[fruta];
    const rend = d.consumo > 0 ? (d.pt / d.consumo * 100) : 0;
    const fc = getFrutaColor(fruta);
    const icon = FRUTA_ICONS[fruta] || '📦';
    const rendColor = rend >= 50 ? '#16a34a' : rend >= 40 ? '#d97706' : '#ef4444';
    const row = '<div style="display:flex;justify-content:space-between;align-items:center;padding:2px 0;font-size:11px"><span style="display:flex;align-items:center;gap:3px"><span style="width:6px;height:6px;border-radius:50%;background:'+fc.main+';display:inline-block"></span>'+icon+' <b style="color:'+fc.main+'">'+fruta+'</b></span>';
    cH += row + '<span style="font-weight:700">' + formatNum(d.consumo) + ' kg</span></div>';
    pH += row + '<span style="font-weight:700">' + formatNum(d.pt) + ' kg</span></div>';
    rH += row + '<span style="font-weight:700;color:'+rendColor+'">' + rend.toFixed(1) + '%</span></div>';
    var kgH = d.horas > 0 ? (d.consumo / d.horas) : 0;
    hH += row + '<span style="font-weight:700">' + formatNum(kgH) + ' kg/h</span></div>';
  });

  cCont.innerHTML = cH;
  pCont.innerHTML = pH;
  rCont.innerHTML = rH;
  hCont.innerHTML = hH;
}

function buildAvancePorFruta(recs) {
  const container = document.getElementById('avanceFrutasContainer');
  if (!container) return;

  // Agrupar por fruta y obtener el ultimo proyectado de cada fruta
  const frutasMap = {};
  recs.forEach(r => {
    const f = r.fruta || 'MANGO';
    if (!frutasMap[f]) frutasMap[f] = { consumo: 0, proyTN: 16 };
    frutasMap[f].consumo += (r.consumo_kg || 0);
    if (r.proyectado_tn) frutasMap[f].proyTN = parseFloat(r.proyectado_tn);
  });

  const frutas = Object.keys(frutasMap);
  if (frutas.length === 0) {
    container.innerHTML = '';
    return;
  }

  let html = '';
  frutas.forEach(fruta => {
    const data = frutasMap[fruta];
    const proyKg = data.proyTN * 1000;
    const pct = proyKg > 0 ? Math.min(100, Math.round(data.consumo / proyKg * 100)) : 0;
    const fc = getFrutaColor(fruta);
    const icon = FRUTA_ICONS[fruta] || '📦';
    let barGrad;
    if (pct >= 90) barGrad = fc.grad;
    else if (pct >= 60) barGrad = 'linear-gradient(90deg,#d97706,#f59e0b,#fbbf24,#d97706)';
    else barGrad = 'linear-gradient(90deg,#ea580c,#f97316,#fb923c,#ea580c)';

    html += `<div class="card" style="margin-bottom:12px;padding:16px 20px;position:relative;overflow:hidden;border-left:4px solid ${fc.main}">
      <div style="position:absolute;top:0;left:0;right:0;height:3px;background:${fc.grad};background-size:300% 100%;animation:avGradFlow 3s linear infinite"></div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div style="display:flex;align-items:center;gap:8px">
          <div class="avance-pulse" style="background:${fc.main}"></div>
          <div style="font-weight:800;font-size:14px">${icon} Avance Meta — ${fruta}</div>
          <span style="font-size:11px;color:var(--text-secondary,#94a3b8);font-weight:600">Proy: ${data.proyTN} TN</span>
        </div>
        <div style="font-size:22px;font-weight:900;color:${fc.main}">${pct}%</div>
      </div>
      <div class="avance-track">
        <div class="avance-fill" style="width:${pct}%;background:${barGrad};background-size:300% 100%;animation:avBarFlow 3s linear infinite">
          <div class="avance-shine"></div>
          <span class="avance-label">${formatNum(data.consumo)} kg</span>
        </div>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:5px;font-size:11px;color:var(--text-secondary,#94a3b8)">
        <span>0 kg</span>
        <span>Meta: ${formatNum(proyKg)} kg</span>
      </div>
    </div>`;
  });

  container.innerHTML = html;
}

function formatNum(n) {
  return n.toLocaleString('es-PE', { maximumFractionDigits: 1 });
}

// ═══════════════ TABLE ═══════════════
// Funcion para ordenar horas del turno noche: 19,20,21,22,23,00,01,02...
function sortNocheHoras(a, b) {
  const ha = parseInt(a.hora.split(':')[0]);
  const hb = parseInt(b.hora.split(':')[0]);
  const oa = ha >= 19 ? ha - 19 : ha + 5;
  const ob = hb >= 19 ? hb - 19 : hb + 5;
  return oa - ob;
}

// Agrupa registros por fruta en orden de aparicion, manteniendo el orden de horas
function groupByFrutaOrdered(sortedRecs) {
  const groups = [];
  let currentFruta = null;
  let currentGroup = [];
  sortedRecs.forEach(r => {
    if (r.fruta !== currentFruta) {
      if (currentGroup.length > 0) groups.push({ fruta: currentFruta, recs: currentGroup });
      currentFruta = r.fruta;
      currentGroup = [r];
    } else {
      currentGroup.push(r);
    }
  });
  if (currentGroup.length > 0) groups.push({ fruta: currentFruta, recs: currentGroup });
  return groups;
}

// Genera fila de subtotal de fruta
function buildFruitSubRow(fruta, recsArr, colorRgb) {
  const fC = recsArr.reduce((s, r) => s + r.consumo_kg, 0);
  const fPT = recsArr.reduce((s, r) => s + r.pt_aprox_kg, 0);
  const fRend = fC > 0 ? (fPT / fC * 100).toFixed(1) : 0;
  const fPers = recsArr.reduce((s, r) => s + (r.personas || 0), 0);
  const fProdAvg = fPers > 0 ? (fC / fPers) : 0;
  const fc = getFrutaColor(fruta);
  const icon = FRUTA_ICONS[fruta] || '📦';
  return `<tr style="background:${fc.bg};border-top:1px dashed rgba(${colorRgb},0.3)">
    <td style="font-weight:700;color:${fc.main};padding-left:20px" colspan="4">${icon} ${fruta} (${recsArr.length} hrs)</td>
    <td class="num" style="font-weight:700;color:${fc.main}">${formatNum(fC)}</td>
    <td class="num" style="font-weight:700;color:${fc.main}">${formatNum(fPT)}</td>
    <td style="font-weight:700;color:${fc.main}">${fRend}%</td>
    <td class="num" style="font-weight:700;color:${fc.main}">${fPers || '—'}</td>
    <td class="num" style="font-weight:700;color:${fc.main}">${fPers > 0 ? formatNum(fProdAvg) : '—'}</td>
    <td colspan="3"></td>
  </tr>`;
}

function renderTurnoRows(sortedRecs, turnoLabel, almInicio, almFin, cenaData) {
  let rows = '';
  let almRowInserted = false;
  let cenaRowInserted = false;
  const frutaGroups = groupByFrutaOrdered(sortedRecs);
  const multipleFrutas = [...new Set(sortedRecs.map(r => r.fruta))].length > 1;

  frutaGroups.forEach(group => {
    group.recs.forEach(r => {
      const horaStart = r.hora.split('-')[0];

      // Almuerzo inline
      if (almInicio && almFin && !almRowInserted && horaStart >= almInicio) {
        rows += `<tr class="row-almuerzo">
          <td style="font-weight:700" colspan="3">🍽️ ALMUERZO (${almInicio} - ${almFin})</td>
          <td colspan="8" style="color:var(--amber);font-weight:700;font-style:italic">Pausa de almuerzo</td>
          <td style="text-align:center;white-space:nowrap"><button onclick="abrirEditPausa('almuerzo')" title="Editar" style="background:rgba(245,158,11,0.12);color:#f59e0b;border:none;cursor:pointer;font-size:14px;padding:4px;border-radius:8px;width:30px;height:30px;display:inline-flex;align-items:center;justify-content:center">✏️</button><button onclick="eliminarPausa('almuerzo')" title="Eliminar" style="background:rgba(239,68,68,0.12);color:#ef4444;border:none;cursor:pointer;font-size:14px;padding:4px;border-radius:8px;width:30px;height:30px;display:inline-flex;align-items:center;justify-content:center;margin-left:4px">🗑️</button></td>
        </tr>`;
        almRowInserted = true;
      }

      // Cena inline: insertar antes de la hora que es >= cena inicio (en orden noche: 00:00 > 23:00)
      if (cenaData && !cenaRowInserted) {
        const horaNum = parseInt(horaStart);
        const cenaNum = parseInt(cenaData.inicio);
        // En turno noche, horas < 19 son despues de medianoche
        const horaOrd = horaNum >= 19 ? horaNum - 19 : horaNum + 5;
        const cenaOrd = cenaNum >= 19 ? cenaNum - 19 : cenaNum + 5;
        if (horaOrd >= cenaOrd) {
          rows += `<tr class="row-almuerzo" style="background:rgba(139,92,246,0.06)!important">
            <td style="font-weight:700;border-left:3px solid #8b5cf6" colspan="3">🌙 CENA (${cenaData.inicio} - ${cenaData.fin})</td>
            <td colspan="8" style="color:#8b5cf6;font-weight:700;font-style:italic">Pausa de cena</td>
            <td style="text-align:center;white-space:nowrap"><button onclick="abrirEditPausa('cena')" title="Editar" style="background:rgba(139,92,246,0.12);color:#8b5cf6;border:none;cursor:pointer;font-size:14px;padding:4px;border-radius:8px;width:30px;height:30px;display:inline-flex;align-items:center;justify-content:center">✏️</button><button onclick="eliminarPausa('cena')" title="Eliminar" style="background:rgba(239,68,68,0.12);color:#ef4444;border:none;cursor:pointer;font-size:14px;padding:4px;border-radius:8px;width:30px;height:30px;display:inline-flex;align-items:center;justify-content:center;margin-left:4px">🗑️</button></td>
          </tr>`;
          cenaRowInserted = true;
        }
      }

      const rendClass = r.rendimiento >= 45 ? 'badge-green' : r.rendimiento >= 40 ? 'badge-amber' : 'badge-red';
      const obs = r.observacion || '';
      const pers = r.personas || 0;
      const prod = pers > 0 ? (r.consumo_kg / pers) : 0;

      rows += `<tr>
        <td style="font-weight:700">${r.hora}</td>
        <td>${turnoLabel}</td>
        <td>${r.fruta}</td>
        <td>${r.linea}</td>
        <td class="num">${formatNum(r.consumo_kg)}</td>
        <td class="num">${formatNum(r.pt_aprox_kg)}</td>
        <td class="num"><span class="badge ${rendClass}">${r.rendimiento}%</span></td>
        <td class="num" style="font-weight:600">${pers || '—'}</td>
        <td class="num" style="font-weight:700;color:${prod > 0 ? '#0891b2' : 'var(--muted)'}">${prod > 0 ? formatNum(prod) : '—'}</td>
        <td style="max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.supervisor || '—'}</td>
        <td style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${obs}">${obs}</td>
        <td style="text-align:center;white-space:nowrap"><button onclick="openEditModal('${r.id}')" title="Editar" style="background:rgba(37,99,235,0.12);color:#2563eb;border:none;cursor:pointer;font-size:14px;padding:4px;border-radius:8px;width:30px;height:30px;display:inline-flex;align-items:center;justify-content:center;transition:all 0.2s">✏️</button><button class="delete-btn" onclick="deleteRecord('${r.id}')" title="Eliminar">🗑️</button></td>
      </tr>`;
    });

    // Subtotal por fruta despues de cada grupo (solo si hay 2+ frutas)
    if (multipleFrutas) {
      rows += buildFruitSubRow(group.fruta, group.recs, group.recs[0].turno === 'NOCHE' ? '139,92,246' : '22,163,74');
    }
  });

  // Si la cena no se inserto (todos los registros son antes de la hora de cena), agregarla al final
  if (cenaData && !cenaRowInserted) {
    rows += `<tr class="row-almuerzo" style="background:rgba(139,92,246,0.06)!important">
      <td style="font-weight:700;border-left:3px solid #8b5cf6" colspan="3">🌙 CENA (${cenaData.inicio} - ${cenaData.fin})</td>
      <td colspan="8" style="color:#8b5cf6;font-weight:700;font-style:italic">Pausa de cena</td>
      <td style="text-align:center;white-space:nowrap"><button onclick="abrirEditPausa('cena')" title="Editar" style="background:rgba(139,92,246,0.12);color:#8b5cf6;border:none;cursor:pointer;font-size:14px;padding:4px;border-radius:8px;width:30px;height:30px;display:inline-flex;align-items:center;justify-content:center">✏️</button><button onclick="eliminarPausa('cena')" title="Eliminar" style="background:rgba(239,68,68,0.12);color:#ef4444;border:none;cursor:pointer;font-size:14px;padding:4px;border-radius:8px;width:30px;height:30px;display:inline-flex;align-items:center;justify-content:center;margin-left:4px">🗑️</button></td>
    </tr>`;
  }

  return { rows, almInserted: almRowInserted };
}

function updateTable(recs) {
  // Filtrar registros sin hora (datos corruptos)
  recs = recs.filter(r => r.hora && r.hora.trim() !== '');
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

  // Determine almuerzo (desde registros o localStorage)
  let almInicio = '', almFin = '';
  for (const r of recs) {
    if (r.almuerzo_inicio && r.almuerzo_fin) { almInicio = r.almuerzo_inicio; almFin = r.almuerzo_fin; break; }
  }
  if (!almInicio) {
    const fecha = document.getElementById('filterDate').value;
    const almData = JSON.parse(localStorage.getItem('almuerzo_' + fecha) || 'null');
    if (almData && almData.inicio && almData.fin) { almInicio = almData.inicio; almFin = almData.fin; }
  }

  const diaRecs = [...recs.filter(r => r.turno !== 'NOCHE')].sort((a, b) => a.hora.localeCompare(b.hora));
  const nocheRecs = [...recs.filter(r => r.turno === 'NOCHE')].sort(sortNocheHoras);

  let rows = '';

  // ── TURNO DIA ──
  const diaLabel = '<span class="badge" style="background:rgba(22,163,74,0.12);color:#4ade80">DIA</span>';
  const diaResult = renderTurnoRows(diaRecs, diaLabel, almInicio, almFin, null);
  rows += diaResult.rows;

  if (almInicio && almFin && !diaResult.almInserted && diaRecs.length > 0) {
    rows += `<tr class="row-almuerzo"><td style="font-weight:700" colspan="3">🍽️ ALMUERZO (${almInicio} - ${almFin})</td><td colspan="8" style="color:var(--amber);font-weight:700;font-style:italic">Pausa de almuerzo</td><td style="text-align:center;white-space:nowrap"><button onclick="abrirEditPausa('almuerzo')" title="Editar" style="background:rgba(245,158,11,0.12);color:#f59e0b;border:none;cursor:pointer;font-size:14px;padding:4px;border-radius:8px;width:30px;height:30px;display:inline-flex;align-items:center;justify-content:center">✏️</button><button onclick="eliminarPausa('almuerzo')" title="Eliminar" style="background:rgba(239,68,68,0.12);color:#ef4444;border:none;cursor:pointer;font-size:14px;padding:4px;border-radius:8px;width:30px;height:30px;display:inline-flex;align-items:center;justify-content:center;margin-left:4px">🗑️</button></td></tr>`;
  }

  // SUBTOTAL DIA
  if (diaRecs.length > 0) {
    const diaC = diaRecs.reduce((s, r) => s + r.consumo_kg, 0);
    const diaPT = diaRecs.reduce((s, r) => s + r.pt_aprox_kg, 0);
    const diaRend = diaC > 0 ? (diaPT / diaC * 100).toFixed(1) : 0;
    const diaPers = diaRecs.reduce((s, r) => s + (r.personas || 0), 0);
    const diaProd = diaPers > 0 ? (diaC / diaPers) : 0;
    rows += `<tr style="background:rgba(22,163,74,0.08);border-top:2px solid rgba(22,163,74,0.3)">
      <td style="font-weight:800;color:#16a34a" colspan="4">☀️ SUBTOTAL DIA (${diaRecs.length} hrs)</td>
      <td class="num" style="font-weight:700;color:#16a34a">${formatNum(diaC)}</td>
      <td class="num" style="font-weight:700;color:#16a34a">${formatNum(diaPT)}</td>
      <td style="font-weight:700;color:#16a34a">${diaRend}%</td>
      <td class="num" style="font-weight:700;color:#16a34a">${diaPers || '—'}</td>
      <td class="num" style="font-weight:700;color:#16a34a">${diaPers > 0 ? formatNum(diaProd) : '—'}</td>
      <td colspan="3"></td>
    </tr>`;
  }

  // ── TURNO NOCHE ──
  const nocheLabel = '<span class="badge" style="background:rgba(139,92,246,0.12);color:#8b5cf6">NOCHE</span>';
  const fecha = document.getElementById('filterDate').value;
  const cenaData = JSON.parse(localStorage.getItem('cena_' + fecha) || 'null');
  const cenaValid = (cenaData && cenaData.inicio && cenaData.fin) ? cenaData : null;
  const nocheResult = renderTurnoRows(nocheRecs, nocheLabel, '', '', cenaValid);
  rows += nocheResult.rows;

  // SUBTOTAL NOCHE
  if (nocheRecs.length > 0) {
    const nocheC = nocheRecs.reduce((s, r) => s + r.consumo_kg, 0);
    const nochePT = nocheRecs.reduce((s, r) => s + r.pt_aprox_kg, 0);
    const nocheRend = nocheC > 0 ? (nochePT / nocheC * 100).toFixed(1) : 0;
    const nochePers = nocheRecs.reduce((s, r) => s + (r.personas || 0), 0);
    const nocheProd = nochePers > 0 ? (nocheC / nochePers) : 0;
    rows += `<tr style="background:rgba(139,92,246,0.08);border-top:2px solid rgba(139,92,246,0.3)">
      <td style="font-weight:800;color:#8b5cf6" colspan="4">🌙 SUBTOTAL NOCHE (${nocheRecs.length} hrs)</td>
      <td class="num" style="font-weight:700;color:#8b5cf6">${formatNum(nocheC)}</td>
      <td class="num" style="font-weight:700;color:#8b5cf6">${formatNum(nochePT)}</td>
      <td style="font-weight:700;color:#8b5cf6">${nocheRend}%</td>
      <td class="num" style="font-weight:700;color:#8b5cf6">${nochePers || '—'}</td>
      <td class="num" style="font-weight:700;color:#8b5cf6">${nochePers > 0 ? formatNum(nocheProd) : '—'}</td>
      <td colspan="3"></td>
    </tr>`;
  }

  tbody.innerHTML = rows;

  // Footer - TOTAL GENERAL
  const totC = recs.reduce((s, r) => s + r.consumo_kg, 0);
  const totPT = recs.reduce((s, r) => s + r.pt_aprox_kg, 0);
  const totRend = totC > 0 ? (totPT / totC * 100).toFixed(1) : 0;

  const totPers = recs.reduce((s, r) => s + (r.personas || 0), 0);
  const totProd = totPers > 0 ? (totC / totPers) : 0;

  tfoot.innerHTML = `<tr class="table-footer" style="background:rgba(37,99,235,0.08);border-top:3px solid rgba(37,99,235,0.4)">
    <td colspan="4" style="font-weight:900;color:#2563eb">🏭 TOTAL GENERAL (${recs.length} hrs)</td>
    <td class="num" style="font-weight:800;color:#2563eb">${formatNum(totC)}</td>
    <td class="num" style="font-weight:800;color:#2563eb">${formatNum(totPT)}</td>
    <td class="num" style="font-weight:800;color:#2563eb">${totRend}%</td>
    <td class="num" style="font-weight:800;color:#2563eb">${totPers || '—'}</td>
    <td class="num" style="font-weight:800;color:#2563eb">${totPers > 0 ? formatNum(totProd) : '—'}</td>
    <td colspan="3"></td>
  </tr>`;
}

// ═══════════════ CHART FILTERS ═══════════════
let chartFilterTurno = 'AMBOS';
let chartFilterFruta = 'TODAS';
let chartMode = 'CONSOLIDADO'; // CONSOLIDADO | POR_FRUTA

function toggleChartFilter(btn) {
  const filterType = btn.dataset.filter;
  const value = btn.dataset.value;
  // Desactivar hermanos del mismo tipo
  document.querySelectorAll('.chart-filter-chip[data-filter="'+filterType+'"]').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  if (filterType === 'turno') chartFilterTurno = value;
  if (filterType === 'fruta') chartFilterFruta = value;
  if (filterType === 'modo') {
    chartMode = value;
    aplicarModoVista();
  }
  rebuildCharts();
}

// Cambia visibilidad entre modo Consolidado y modo Por Fruta
function aplicarModoVista() {
  const cons = document.getElementById('chartsConsolidado');
  const pf = document.getElementById('chartsPorFruta');
  if (!cons || !pf) return;
  if (chartMode === 'POR_FRUTA') {
    cons.style.display = 'none';
    pf.style.display = 'block';
  } else {
    cons.style.display = 'block';
    pf.style.display = 'none';
    pf.innerHTML = '';
  }
}


// Objetivos de rendimiento por fruta (editables)
const REND_OBJETIVOS = {
  'MANGO': 50, 'FRESA': 85, 'PALTA': 70, 'ARANDANO': 90,
  'PIÑA': 55, 'GRANADA': 45
};
function getRendimientoObjetivo(fruta) {
  return REND_OBJETIVOS[fruta] || 50;
}

function applyChartFilters(recs) {
  let filtered = recs;
  if (chartFilterTurno !== 'AMBOS') {
    filtered = filtered.filter(r => r.turno === chartFilterTurno);
  }
  if (chartFilterFruta !== 'TODAS') {
    filtered = filtered.filter(r => r.fruta === chartFilterFruta);
  }
  return filtered;
}

// ═══════════════ CHARTS ═══════════════
let chartBar = null, chartLine = null, chartAcumulado = null, chartTurnos = null;
// Instancias dinámicas de gráficos en modo POR_FRUTA (para poder destruirlas al re-render)
let chartsPorFrutaInstances = [];

// Helper: ordena registros DIA primero (orden normal) y NOCHE luego (19→23,00→04)
function sortRecsForCharts(recs) {
  const diaC = recs.filter(r => r.turno !== 'NOCHE').sort((a, b) => a.hora.localeCompare(b.hora));
  const nocheC = recs.filter(r => r.turno === 'NOCHE').sort(sortNocheHoras);
  return [...diaC, ...nocheC];
}

// Helper: temas del tema claro/oscuro para los ejes
function getChartTheme() {
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  return {
    gridColor: isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)',
    textColor: isLight ? '#64748b' : '#94a3b8'
  };
}

// Detecta si está en vista móvil — detección automática por ancho de ventana
function isMobileView() {
  return window.innerWidth <= 640;
}

// Rebuild de charts con debounce cuando cambia el tamaño de la ventana.
// Permite que el layout y datalabels se ajusten automaticamente cuando
// el usuario pasa de escritorio a tableta/celular (o rota el telefono).
let _resizeDebounce = null;
let _lastMobileState = isMobileView();
window.addEventListener('resize', function() {
  clearTimeout(_resizeDebounce);
  _resizeDebounce = setTimeout(function() {
    const nowMobile = isMobileView();
    // Solo rebuild cuando cambia el modo (evita rebuilds innecesarios)
    if (nowMobile !== _lastMobileState) {
      _lastMobileState = nowMobile;
      if (typeof rebuildCharts === 'function') rebuildCharts();
    }
  }, 200);
});

// Config compartida de datalabels: evita amontonamiento con display:'auto' y clamp:true.
// En móvil los datalabels se ocultan por defecto (el tooltip los reemplaza).
function getDatalabelsConfig(textColor, opts) {
  opts = opts || {};
  const mobile = isMobileView();
  return {
    display: mobile ? false : (opts.display || 'auto'),
    clamp: true,
    clip: false,
    anchor: opts.anchor || 'end',
    align: opts.align || 'top',
    offset: opts.offset != null ? opts.offset : 2,
    color: opts.color || textColor,
    font: { size: opts.size || 9, weight: '700', family: 'Plus Jakarta Sans' },
    formatter: opts.formatter || function(v) { return v > 0 ? v.toLocaleString('es-PE') : ''; }
  };
}

// Config común de opciones responsivas para móvil vs desktop
function getResponsiveTicks(textColor) {
  const mobile = isMobileView();
  return {
    color: textColor,
    font: { size: mobile ? 9 : 10 },
    maxRotation: mobile ? 60 : 0,
    minRotation: 0,
    autoSkip: true,
    autoSkipPadding: mobile ? 6 : 4
  };
}

// ── Gráfico: Consumo vs PT por Hora ──
function buildChartBarras(ctx, sorted, labels, theme) {
  const mobile = isMobileView();
  const barBgConsumo = sorted.map(r => getFrutaColor(r.fruta).main + 'B3');
  const barBorderConsumo = sorted.map(r => getFrutaColor(r.fruta).main);
  const barBgPT = sorted.map(r => r.turno === 'NOCHE' ? 'rgba(139,92,246,0.55)' : 'rgba(37,99,235,0.55)');
  const barBorderPT = sorted.map(r => r.turno === 'NOCHE' ? '#8b5cf6' : '#2563eb');
  return new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        { label: 'Consumo MP (kg)', data: sorted.map(r => r.consumo_kg), backgroundColor: barBgConsumo, borderColor: barBorderConsumo, borderWidth: 1, borderRadius: 6, barPercentage: 0.72, categoryPercentage: 0.82 },
        { label: 'P. Terminado (kg)', data: sorted.map(r => r.pt_aprox_kg), backgroundColor: barBgPT, borderColor: barBorderPT, borderWidth: 1, borderRadius: 6, barPercentage: 0.72, categoryPercentage: 0.82 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 18 } },
      plugins: {
        legend: { position: mobile ? 'bottom' : 'top', labels: { color: theme.textColor, font: { family: 'Plus Jakarta Sans', weight: '600', size: mobile ? 10 : 11 }, boxWidth: mobile ? 10 : 14, padding: mobile ? 8 : 12 } },
        datalabels: getDatalabelsConfig(theme.textColor, { size: 8, offset: 3 }),
        tooltip: {
          callbacks: {
            title: function(items) { const r = sorted[items[0].dataIndex]; return r.hora + ' — ' + r.fruta + ' (' + r.turno + ')'; }
          }
        }
      },
      scales: {
        x: { ticks: Object.assign(getResponsiveTicks(theme.textColor), { color: function(c) { const r = sorted[c.index]; return r && r.turno === 'NOCHE' ? '#8b5cf6' : theme.textColor; } }), grid: { color: theme.gridColor } },
        y: { ticks: { color: theme.textColor, font: { size: mobile ? 9 : 10 } }, grid: { color: theme.gridColor }, beginAtZero: true }
      }
    },
    plugins: [ChartDataLabels]
  });
}

// ── Gráfico: Productividad (kg/persona) por Hora ──
function buildChartProductividad(ctx, sorted, labels, theme) {
  const mobile = isMobileView();
  const prodData = sorted.map(r => { const p = r.personas || 0; return p > 0 ? parseFloat((r.consumo_kg / p).toFixed(1)) : 0; });
  const pointColors = sorted.map(r => getFrutaColor(r.fruta).main);
  const pointBorders = sorted.map(r => r.turno === 'NOCHE' ? '#8b5cf6' : '#fff');
  const barColorsProd = sorted.map(r => getFrutaColor(r.fruta).main + 'CC');
  const barBordersProd = sorted.map(r => getFrutaColor(r.fruta).main);
  return new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        { label: 'Productividad (kg/persona)', data: prodData, backgroundColor: barColorsProd, borderColor: barBordersProd, borderWidth: 1.5, borderRadius: 6, barPercentage: 0.68, categoryPercentage: 0.85, order: 2 },
        { type: 'line', label: 'Tendencia', data: prodData, borderColor: '#0891b2', backgroundColor: 'rgba(8,145,178,0.08)', fill: false, tension: 0.35, pointRadius: mobile ? 3 : 5, pointBackgroundColor: pointColors, pointBorderColor: pointBorders, pointBorderWidth: 2, borderWidth: 2.5, order: 1 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 22 } },
      plugins: {
        legend: { position: mobile ? 'bottom' : 'top', labels: { color: theme.textColor, font: { family: 'Plus Jakarta Sans', weight: '600', size: mobile ? 10 : 11 }, boxWidth: mobile ? 10 : 14, padding: mobile ? 8 : 12 } },
        datalabels: {
          display: mobile ? false : 'auto',
          clamp: true,
          clip: false,
          anchor: 'end',
          align: 'top',
          offset: 4,
          color: function(c) { if (c.datasetIndex !== 0) return 'transparent'; const r = sorted[c.dataIndex]; return r ? getFrutaColor(r.fruta).main : theme.textColor; },
          font: { weight: '800', size: 8, family: 'Plus Jakarta Sans' },
          formatter: function(value, c) { if (c.datasetIndex !== 0) return ''; return value > 0 ? value.toLocaleString('es-PE') + ' kg/p' : ''; }
        },
        tooltip: {
          callbacks: {
            title: function(items) { const r = sorted[items[0].dataIndex]; if (!r) return ''; const icon = FRUTA_ICONS[r.fruta] || ''; return r.hora + ' — ' + icon + ' ' + r.fruta + ' (' + r.turno + ')'; },
            label: function(item) { const r = sorted[item.dataIndex]; if (!r) return ''; const p = r.personas || 0; if (p === 0) return 'Sin N° personas registrado'; return 'Productividad: ' + item.raw.toLocaleString('es-PE') + ' kg/persona  (' + formatNum(r.consumo_kg) + ' kg ÷ ' + p + ' pers)'; }
          }
        }
      },
      scales: {
        x: { ticks: Object.assign(getResponsiveTicks(theme.textColor), { color: function(c) { const r = sorted[c.index]; return r && r.turno === 'NOCHE' ? '#8b5cf6' : theme.textColor; } }), grid: { color: theme.gridColor } },
        y: { ticks: { color: theme.textColor, font: { size: mobile ? 9 : 10 }, callback: function(v) { return v + ' kg/p'; } }, grid: { color: theme.gridColor }, beginAtZero: true, title: { display: !mobile, text: 'kg / persona', color: theme.textColor, font: { size: 11, weight: '700' } } }
      }
    },
    plugins: [ChartDataLabels]
  });
}

// ── Gráfico: Producción Acumulada por Hora ──
function buildChartAcumulado(ctx, sorted, labels, theme, frutaColor) {
  const mobile = isMobileView();
  const consumoPerHour = sorted.map(r => r.consumo_kg);
  let cumulative = [];
  let runningTotal = 0;
  consumoPerHour.forEach(v => { runningTotal += v; cumulative.push(runningTotal); });
  const barColor = frutaColor || '#ea580c';
  const barBg = frutaColor ? (frutaColor + 'B3') : 'rgba(234,88,12,0.7)';
  const nPts = cumulative.length;
  // Mostrar label solo en el último y en puntos espaciados para que no se amontonen
  const labelStep = nPts > 12 ? 3 : nPts > 8 ? 2 : 1;
  return new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Consumo por Hora (kg)',
          data: consumoPerHour,
          backgroundColor: barBg, borderColor: barColor, borderWidth: 1, borderRadius: 6, barPercentage: 0.72, categoryPercentage: 0.82,
          yAxisID: 'y', order: 2,
          datalabels: { display: false } // No mostrar: info ya visible en gráfico 1 y en tooltip
        },
        {
          label: 'Acumulado Consumo (kg)',
          data: cumulative, type: 'line',
          borderColor: '#16a34a', backgroundColor: 'rgba(22,163,74,0.15)', fill: true, tension: 0.3,
          pointRadius: mobile ? 3 : 5, pointBackgroundColor: '#16a34a', borderWidth: 2.5,
          yAxisID: 'y1', order: 1,
          datalabels: {
            display: function(c) {
              if (mobile) return false;
              // Mostrar solo último punto + cada labelStep
              return c.dataIndex === nPts - 1 || c.dataIndex % labelStep === 0;
            },
            anchor: 'end', align: 'top', offset: 6, clamp: true, clip: false,
            color: '#16a34a', backgroundColor: 'rgba(22,163,74,0.08)', borderRadius: 4, padding: { top: 2, bottom: 2, left: 5, right: 5 },
            font: { size: 9, weight: '800', family: 'Plus Jakarta Sans' },
            formatter: function(v) { return v > 0 ? v.toLocaleString('es-PE') : ''; }
          }
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 22 } },
      plugins: {
        legend: { position: mobile ? 'bottom' : 'top', labels: { color: theme.textColor, font: { family: 'Plus Jakarta Sans', weight: '600', size: mobile ? 10 : 11 }, boxWidth: mobile ? 10 : 14, padding: mobile ? 8 : 12 } },
        datalabels: { display: false }, // Se define a nivel de dataset
        tooltip: {
          callbacks: {
            label: function(item) {
              if (item.datasetIndex === 0) return 'Consumo hora: ' + item.raw.toLocaleString('es-PE') + ' kg';
              return 'Acumulado: ' + item.raw.toLocaleString('es-PE') + ' kg';
            }
          }
        }
      },
      scales: {
        x: { ticks: getResponsiveTicks(theme.textColor), grid: { color: theme.gridColor } },
        y: { type: 'linear', position: 'left', title: { display: !mobile, text: 'Kg/hora', color: theme.textColor, font: { size: 11, weight: '700' } }, ticks: { color: theme.textColor, font: { size: mobile ? 9 : 10 } }, grid: { color: theme.gridColor }, beginAtZero: true },
        y1: { type: 'linear', position: 'right', title: { display: !mobile, text: 'Acumulado (kg)', color: theme.textColor, font: { size: 11, weight: '700' } }, ticks: { color: theme.textColor, font: { size: mobile ? 9 : 10 } }, grid: { drawOnChartArea: false }, beginAtZero: true }
      }
    },
    plugins: [ChartDataLabels]
  });
}

// ── Gráfico: Comparativo Turnos Día vs Noche (semana actual) ──
function buildChartTurnos() {
  if (chartTurnos) chartTurnos.destroy();
  const theme = getChartTheme();
  const ctx = document.getElementById('chartTurnos').getContext('2d');
  const allRecords = getRecords();
  const filterDate = document.getElementById('filterDate').value;
  const refDate = new Date(filterDate + 'T12:00:00');
  const dayOfWeek = refDate.getDay();
  const monday = new Date(refDate);
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  monday.setDate(monday.getDate() + diff);

  const dayNames = ['Lun','Mar','Mie','Jue','Vie','Sab'];
  const diaData = [0,0,0,0,0,0];
  const nocheData = [0,0,0,0,0,0];

  for (let i = 0; i < 6; i++) {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    const dateStr = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
    const dayRecs = allRecords.filter(r => r.fecha === dateStr);
    dayRecs.forEach(r => {
      if (r.turno === 'NOCHE') nocheData[i] += (r.consumo_kg || 0);
      else diaData[i] += (r.consumo_kg || 0);
    });
  }

  const mobile = isMobileView();
  chartTurnos = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: dayNames,
      datasets: [
        { label: 'Turno Dia', data: diaData, backgroundColor: 'rgba(22,163,74,0.7)', borderColor: '#16a34a', borderWidth: 1, borderRadius: 6, barPercentage: 0.72, categoryPercentage: 0.82 },
        { label: 'Turno Noche', data: nocheData, backgroundColor: 'rgba(139,92,246,0.7)', borderColor: '#8b5cf6', borderWidth: 1, borderRadius: 6, barPercentage: 0.72, categoryPercentage: 0.82 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 18 } },
      plugins: {
        legend: { position: mobile ? 'bottom' : 'top', labels: { color: theme.textColor, font: { family: 'Plus Jakarta Sans', weight: '600', size: mobile ? 10 : 11 }, boxWidth: mobile ? 10 : 14, padding: mobile ? 8 : 12 } },
        datalabels: getDatalabelsConfig(theme.textColor, { size: 9, offset: 3 })
      },
      scales: {
        x: { ticks: Object.assign(getResponsiveTicks(theme.textColor), { maxRotation: 0 }), grid: { color: theme.gridColor } },
        y: { ticks: { color: theme.textColor, font: { size: mobile ? 9 : 10 } }, grid: { color: theme.gridColor }, beginAtZero: true, title: { display: !mobile, text: 'Consumo (kg)', color: theme.textColor, font: { size: 11, weight: '700' } } }
      }
    },
    plugins: [ChartDataLabels]
  });
}

// Destruye todas las instancias de los 3 gráficos por fruta
function destruirChartsPorFruta() {
  chartsPorFrutaInstances.forEach(c => { try { c.destroy(); } catch(e) {} });
  chartsPorFrutaInstances = [];
  const pf = document.getElementById('chartsPorFruta');
  if (pf) pf.innerHTML = '';
}

// Destruye las 3 instancias consolidadas
function destruirChartsConsolidado() {
  if (chartBar) { chartBar.destroy(); chartBar = null; }
  if (chartLine) { chartLine.destroy(); chartLine = null; }
  if (chartAcumulado) { chartAcumulado.destroy(); chartAcumulado = null; }
}

// Renderiza los 3 gráficos consolidados en los canvas fijos
function renderChartsConsolidado(recs) {
  destruirChartsConsolidado();
  const theme = getChartTheme();
  const sorted = sortRecsForCharts(recs);
  const labels = sorted.map(r => r.hora.split('-')[0]);
  chartBar = buildChartBarras(document.getElementById('chartBarras').getContext('2d'), sorted, labels, theme);
  chartLine = buildChartProductividad(document.getElementById('chartProductividad').getContext('2d'), sorted, labels, theme);
  chartAcumulado = buildChartAcumulado(document.getElementById('chartAcumulado').getContext('2d'), sorted, labels, theme);
}

// Renderiza una sección por cada fruta detectada (con filtro de fruta opcional)
function renderChartsPorFruta(recs) {
  destruirChartsPorFruta();
  const pf = document.getElementById('chartsPorFruta');
  if (!pf) return;

  // Si hay filtro de fruta específico, quedarse solo con esa fruta
  let recsFiltrados = recs;
  if (chartFilterFruta !== 'TODAS') {
    recsFiltrados = recs.filter(r => r.fruta === chartFilterFruta);
  }

  // Frutas únicas en los registros, preservando el orden de aparición del día
  const frutasSet = [];
  recsFiltrados.forEach(r => {
    const f = r.fruta || 'MANGO';
    if (!frutasSet.includes(f)) frutasSet.push(f);
  });

  if (frutasSet.length === 0) {
    pf.innerHTML = '<div class="card"><div class="empty-state"><div class="empty-icon">🍎</div><div class="empty-text">No hay registros para mostrar</div><div class="empty-sub">Registra producción para ver las gráficas separadas por fruta</div></div></div>';
    return;
  }

  const theme = getChartTheme();

  frutasSet.forEach((fruta, idx) => {
    const recsFruta = recsFiltrados.filter(r => r.fruta === fruta);
    if (recsFruta.length === 0) return;

    const fc = getFrutaColor(fruta);
    const icon = FRUTA_ICONS[fruta] || '📦';
    const totalConsumo = recsFruta.reduce((s, r) => s + (r.consumo_kg || 0), 0);
    const totalPT = recsFruta.reduce((s, r) => s + (r.pt_aprox_kg || 0), 0);
    const rendProm = totalConsumo > 0 ? (totalPT / totalConsumo * 100) : 0;

    // Crear bloque de la fruta
    const block = document.createElement('div');
    block.style.cssText = 'margin-bottom:24px;padding:16px;border-radius:var(--radius);background:var(--surface);border:1px solid var(--border);border-left:4px solid ' + fc.main + ';box-shadow:var(--shadow)';
    block.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:14px;padding-bottom:10px;border-bottom:1px dashed var(--border)">' +
        '<div style="display:flex;align-items:center;gap:10px">' +
          '<div style="font-size:22px">' + icon + '</div>' +
          '<div>' +
            '<div style="font-size:16px;font-weight:900;color:' + fc.main + '">' + fruta + '</div>' +
            '<div style="font-size:11px;color:var(--muted);font-weight:600">' + recsFruta.length + ' hrs · ' + formatNum(totalConsumo) + ' kg MP · ' + formatNum(totalPT) + ' kg PT · Rend ' + rendProm.toFixed(1) + '%</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="grid-2">' +
        '<div class="card" style="margin:0">' +
          '<div class="card-title">📊 Consumo vs PT por Hora</div>' +
          '<div class="chart-wrap"><canvas id="chartBarras_' + idx + '"></canvas></div>' +
        '</div>' +
        '<div class="card" style="margin:0">' +
          '<div class="card-title">👥 Productividad por Hora <span style="font-size:11px;color:var(--muted);font-weight:500">(kg / N° personas)</span></div>' +
          '<div class="chart-wrap"><canvas id="chartProd_' + idx + '"></canvas></div>' +
        '</div>' +
      '</div>' +
      '<div class="card" style="margin-top:14px;margin-bottom:0">' +
        '<div class="card-title">📊 Produccion Acumulada por Hora</div>' +
        '<div class="chart-wrap"><canvas id="chartAcum_' + idx + '"></canvas></div>' +
      '</div>';
    pf.appendChild(block);

    const sorted = sortRecsForCharts(recsFruta);
    const labels = sorted.map(r => r.hora.split('-')[0]);
    const cBar = buildChartBarras(document.getElementById('chartBarras_' + idx).getContext('2d'), sorted, labels, theme);
    const cProd = buildChartProductividad(document.getElementById('chartProd_' + idx).getContext('2d'), sorted, labels, theme);
    const cAcum = buildChartAcumulado(document.getElementById('chartAcum_' + idx).getContext('2d'), sorted, labels, theme, fc.main);
    chartsPorFrutaInstances.push(cBar, cProd, cAcum);
  });
}

function rebuildCharts(recs) {
  if (!recs) {
    const filterDate = document.getElementById('filterDate').value;
    recs = getRecords().filter(r => r.fecha === filterDate);
  }

  if (chartMode === 'POR_FRUTA') {
    // En modo por-fruta solo aplicamos el filtro de turno; la fruta separa las secciones.
    let recsTurno = recs;
    if (chartFilterTurno !== 'AMBOS') recsTurno = recsTurno.filter(r => r.turno === chartFilterTurno);
    destruirChartsConsolidado();
    renderChartsPorFruta(recsTurno);
  } else {
    // Modo Consolidado: aplica filtros de turno + fruta
    const recsFiltered = applyChartFilters(recs);
    destruirChartsPorFruta();
    renderChartsConsolidado(recsFiltered);
  }

  // Comparativo Turnos siempre se construye (toma datos de la semana completa)
  buildChartTurnos();
}

// ═══════════════ SUPABASE LOAD ═══════════════
function getLocalToday() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

function getLocalMonday() {
  const d = new Date();
  const day = d.getDay(); // 0=Sun,1=Mon...6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

async function loadWeekFromSupabase() {
  if (typeof supabaseClient === 'undefined' || !supabaseClient) return;
  try {
    const monday = getLocalMonday();
    const { data, error } = await supabaseClient
      .from('registro_produccion')
      .select('*')
      .gte('fecha', monday)
      .order('fecha')
      .order('hora');

    if (error || !data || data.length === 0) return;

    const localRecords = JSON.parse(localStorage.getItem('prod_registros') || '[]');
    // Get set of dates from the week data to replace
    const weekDates = new Set(data.map(d => d.fecha));
    // Keep local records that are NOT in the week range (older data)
    const otherDays = localRecords.filter(r => !weekDates.has(r.fecha));
    const merged = [...otherDays, ...data.map(d => ({
      ...d,
      consumo_kg: parseFloat(d.consumo_kg),
      pt_aprox_kg: parseFloat(d.pt_aprox_kg),
      rendimiento: parseFloat(d.rendimiento),
      personas: parseInt(d.personas) || 0,
      proyectado_tn: parseFloat(d.proyectado_tn)
    }))];
    localStorage.setItem('prod_registros', JSON.stringify(merged));
  } catch(e) {
    console.log('loadWeekFromSupabase: Supabase offline');
  }
}

async function loadFromSupabase() {
  if (typeof supabaseClient === 'undefined' || !supabaseClient) {
    console.warn('Supabase no disponible, usando solo localStorage');
    showSupabaseToast('Supabase no conectado - usando datos locales', '#ef4444');
    return;
  }
  try {
    // Load full week data so Comparativo Turnos chart has all days
    await loadWeekFromSupabase();

    const { data, error } = await supabaseClient
      .from('registro_produccion')
      .select('*')
      .eq('fecha', getLocalToday())
      .order('hora');

    if (error) {
      console.error('Supabase load error:', error);
      showSupabaseToast('Error al cargar de Supabase: ' + error.message, '#ef4444');
      return;
    }

    if (data && data.length > 0) {
      // Merge with localStorage - Supabase is source of truth for today
      const localRecords = JSON.parse(localStorage.getItem('prod_registros') || '[]');
      const otherDays = localRecords.filter(r => r.fecha !== getLocalToday());
      const merged = [...otherDays, ...data.map(d => ({
        ...d,
        consumo_kg: parseFloat(d.consumo_kg),
        pt_aprox_kg: parseFloat(d.pt_aprox_kg),
        rendimiento: parseFloat(d.rendimiento),
        personas: parseInt(d.personas) || 0,
        proyectado_tn: parseFloat(d.proyectado_tn)
      }))];
      localStorage.setItem('prod_registros', JSON.stringify(merged));
    }

    // Always rebuild after loading week + today data
    if (typeof refreshAll === 'function') refreshAll();
    else if (typeof updateAll === 'function') updateAll();
    else if (typeof renderTabla === 'function') renderTabla();
  } catch(e) {
    console.log('Supabase offline, usando localStorage');
    console.log('Supabase offline - usando datos locales');
  }
}

// ═══════════════ INIT ═══════════════
(function init() {
  // Limpiar residuo de versiones anteriores (toggle movil manual ya eliminado)
  try {
    localStorage.removeItem('prod_force_mobile');
    document.documentElement.removeAttribute('data-force-mobile');
  } catch(e) {}

  // Restore supervisor
  const savedSup = localStorage.getItem('prod_reg_supervisor');
  if (savedSup) document.getElementById('fSupervisor').value = savedSup;

  // Pre-cargar rendimiento por default según fruta actual
  if (typeof onFrutaChange === 'function') onFrutaChange();

  // Set today's date
  const d = new Date();
  const today = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  document.getElementById('fFecha').value = today;
  document.getElementById('filterDate').value = today;

  refreshAll();

  // Auto-avanzar hora al default 07:00-08:00 o la siguiente disponible
  avanzarHora();

  // Cargar horario, almuerzo y cena guardados del dia
  cargarHorarioGuardado();
  cargarAlmuerzoGuardado();
  cargarCenaGuardada();

  // Load from Supabase (cloud sync)
  loadFromSupabase();

  // Check Supabase connection status indicator (con reintentos)
  setTimeout(async () => {
    const ok = await checkSupabaseConnection();
    if (!ok) {
      setTimeout(async () => {
        const ok2 = await checkSupabaseConnection();
        if (!ok2) setTimeout(checkSupabaseConnection, 5000);
      }, 3000);
    }
  }, 1500);
})();
