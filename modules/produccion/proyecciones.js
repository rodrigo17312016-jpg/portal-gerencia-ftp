/* Proyecciones */
import { supabase } from '../../assets/js/config/supabase.js';
import { fmt, fmtPct } from '../../assets/js/utils/formatters.js';
import { createChart, getColors, getDefaultOptions } from '../../assets/js/utils/chart-helpers.js';

export async function init(container) { await loadData(container); }

async function loadData(container) {
  try {
    const since = new Date(); since.setDate(since.getDate() - 30);
    const { data } = await supabase.from('registro_produccion')
      .select('fecha, pt_aprox_kg')
      .gte('fecha', since.toLocaleDateString('en-CA', { timeZone: 'America/Lima' }))
      .order('fecha');

    const recs = data || [];
    if (recs.length === 0) return;

    // Agrupar por fecha
    const byFecha = {};
    recs.forEach(r => {
      if (!byFecha[r.fecha]) byFecha[r.fecha] = 0;
      byFecha[r.fecha] += r.pt_aprox_kg || 0;
    });
    const fechas = Object.keys(byFecha).sort();
    const valores = fechas.map(f => byFecha[f]);
    const diasConDatos = fechas.length;

    // Promedio diario y proyecciones
    const promedioDia = valores.reduce((s, v) => s + v, 0) / diasConDatos;
    const proySemanal = promedioDia * 7;
    const proyMensual = promedioDia * 30;

    // Tendencia: comparar primera mitad vs segunda mitad
    const mitad = Math.floor(diasConDatos / 2);
    const promPrimera = valores.slice(0, mitad).reduce((s, v) => s + v, 0) / Math.max(mitad, 1);
    const promSegunda = valores.slice(mitad).reduce((s, v) => s + v, 0) / Math.max(diasConDatos - mitad, 1);
    const tendenciaPct = promPrimera > 0 ? ((promSegunda - promPrimera) / promPrimera * 100) : 0;
    const tendenciaLabel = tendenciaPct > 2 ? '↑ Alza' : tendenciaPct < -2 ? '↓ Baja' : '→ Estable';

    setVal(container, 'proySemanal', fmt(proySemanal));
    setVal(container, 'proyMensual', fmt(proyMensual));
    setVal(container, 'proyTendencia', tendenciaLabel);
    setVal(container, 'proyDias', diasConDatos.toString());

    // Chart con linea de tendencia proyectada
    const colors = getColors();
    const labels = [...fechas.map(f => f.slice(5))];
    const proyLabels = [];
    const proyValues = [];
    const lastDate = new Date(fechas[fechas.length - 1] + 'T00:00:00');
    for (let i = 1; i <= 7; i++) {
      const nd = new Date(lastDate); nd.setDate(lastDate.getDate() + i);
      proyLabels.push((nd.getMonth() + 1).toString().padStart(2, '0') + '-' + nd.getDate().toString().padStart(2, '0'));
      proyValues.push(Math.round(promedioDia * (1 + tendenciaPct / 100 * i / 7)));
    }

    const allLabels = [...labels, ...proyLabels];
    const realData = [...valores, ...Array(7).fill(null)];
    const proyData = [...Array(valores.length - 1).fill(null), valores[valores.length - 1], ...proyValues];

    createChart('chartProyTendencia', {
      type: 'line',
      data: {
        labels: allLabels,
        datasets: [
          { label: 'Real', data: realData, borderColor: colors.verde.border, backgroundColor: colors.verde.bg, fill: true, tension: 0.4, pointRadius: 3 },
          { label: 'Proyeccion', data: proyData, borderColor: colors.amber.border, borderDash: [6, 4], fill: false, tension: 0.3, pointRadius: 2 }
        ]
      },
      options: { ...getDefaultOptions('line'), plugins: { legend: { display: true, labels: { color: '#64748b', font: { size: 11 } } } } }
    });
  } catch (err) { console.error('Error proyecciones:', err); }
}

function setVal(c, id, v) { const el = c.querySelector('#' + id); if (el) el.textContent = v; }
export function refresh() { const c = document.getElementById('panel-proyecciones'); if (c) loadData(c); }
