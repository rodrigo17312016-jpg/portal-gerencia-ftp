/* Productividad */
import { supabase } from '../../assets/js/config/supabase.js';
import { fmt, fmtPct, today } from '../../assets/js/utils/formatters.js';
import { createChart, getColors, getDefaultOptions } from '../../assets/js/utils/chart-helpers.js';

export async function init(container) {
  try {
    const hoy = today();
    const { data } = await supabase.from('registro_produccion').select('hora, producto_terminado, personal, turno, consumo_mp').eq('fecha', hoy).order('hora');
    const recs = data || [];
    const totalPT = recs.reduce((s, r) => s + (r.producto_terminado || 0), 0);
    const totalPers = recs.reduce((s, r) => s + (r.personal || 0), 0);
    const kgHr = recs.length > 0 ? totalPT / recs.length : 0;

    setVal(container, 'prodKgHr', fmt(kgHr, 0) + ' kg/hr');
    setVal(container, 'prodProy', fmt(kgHr * 1.1, 0) + ' kg/hr');
    setVal(container, 'prodHHTN', totalPT > 0 ? fmt(totalPers / (totalPT / 1000), 1) : '—');
    setVal(container, 'prodOEE', totalPT > 0 ? fmtPct(Math.min(95, kgHr / (kgHr * 1.1) * 100)) : '—');

    if (recs.length > 0) {
      const colors = getColors();
      const horas = [...new Set(recs.map(r => r.hora?.slice(0, 5)))].sort();
      createChart('chartKgHr', {
        type: 'line',
        data: { labels: horas, datasets: [
          { label: 'Real', data: horas.map(h => recs.filter(r => r.hora?.startsWith(h)).reduce((s, r) => s + (r.producto_terminado || 0), 0)), borderColor: colors.verde.border, backgroundColor: colors.verde.bg, fill: true, tension: 0.4 },
          { label: 'Proyectado', data: horas.map(() => kgHr * 1.1), borderColor: colors.azul.border, borderDash: [5, 5], fill: false, tension: 0 }
        ]},
        options: { ...getDefaultOptions('line'), plugins: { legend: { display: true, labels: { color: '#64748b', font: { size: 11 } } } } }
      });
      const dia = recs.filter(r => r.turno === 'DIA' || r.turno === 'TURNO DIA');
      const noche = recs.filter(r => r.turno !== 'DIA' && r.turno !== 'TURNO DIA');
      createChart('chartProdTurno', {
        type: 'bar',
        data: { labels: ['Dia', 'Noche'], datasets: [{ label: 'Kg/Hr', data: [dia.length > 0 ? dia.reduce((s, r) => s + (r.producto_terminado || 0), 0) / dia.length : 0, noche.length > 0 ? noche.reduce((s, r) => s + (r.producto_terminado || 0), 0) / noche.length : 0], backgroundColor: [colors.amber.bg, colors.azul.bg], borderColor: [colors.amber.border, colors.azul.border], borderWidth: 2, borderRadius: 8 }] },
        options: getDefaultOptions('bar')
      });
    }
  } catch (err) { console.error('Error productividad:', err); }
}

function setVal(c, id, v) { const el = c.querySelector('#' + id); if (el) el.textContent = v; }
