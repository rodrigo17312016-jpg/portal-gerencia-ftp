/* Rendimientos */
import { supabase } from '../../assets/js/config/supabase.js';
import { fmt, fmtPct } from '../../assets/js/utils/formatters.js';
import { createChart, getColors, getDefaultOptions } from '../../assets/js/utils/chart-helpers.js';

export async function init(container) { await loadData(container); }

async function loadData(container) {
  try {
    const since = new Date(); since.setDate(since.getDate() - 30);
    const { data } = await supabase.from('registro_produccion')
      .select('fecha, fruta, consumo_mp, producto_terminado, turno')
      .gte('fecha', since.toLocaleDateString('en-CA', { timeZone: 'America/Lima' }))
      .order('fecha', { ascending: false });

    if (!data || data.length === 0) return;

    // KPIs por fruta
    const byFruta = {};
    data.forEach(r => {
      const f = (r.fruta || 'mango').toLowerCase();
      if (!byFruta[f]) byFruta[f] = { mp: 0, pt: 0 };
      byFruta[f].mp += r.consumo_mp || 0;
      byFruta[f].pt += r.producto_terminado || 0;
    });

    const rendFruta = (f) => byFruta[f] && byFruta[f].mp > 0 ? fmtPct(byFruta[f].pt / byFruta[f].mp * 100) : '—';
    setVal(container, 'rendMango', rendFruta('mango'));
    setVal(container, 'rendArandano', rendFruta('arandano'));
    setVal(container, 'rendGranada', rendFruta('granada'));

    const totalMP = data.reduce((s, r) => s + (r.consumo_mp || 0), 0);
    const totalPT = data.reduce((s, r) => s + (r.producto_terminado || 0), 0);
    setVal(container, 'rendPromedio', totalMP > 0 ? fmtPct(totalPT / totalMP * 100) : '—');

    // Charts
    const colors = getColors();
    const fechas = [...new Set(data.map(r => r.fecha))].sort().slice(-14);
    const rendPorFecha = fechas.map(f => {
      const recs = data.filter(r => r.fecha === f);
      const mp = recs.reduce((s, r) => s + (r.consumo_mp || 0), 0);
      const pt = recs.reduce((s, r) => s + (r.producto_terminado || 0), 0);
      return mp > 0 ? (pt / mp * 100).toFixed(1) : 0;
    });

    createChart('chartRendHistorico', {
      type: 'line',
      data: { labels: fechas.map(f => f.slice(5)), datasets: [{ label: 'Rendimiento %', data: rendPorFecha, borderColor: colors.verde.border, backgroundColor: colors.verde.bg, fill: true, tension: 0.4, pointRadius: 3 }] },
      options: getDefaultOptions('line')
    });

    // Dia vs Noche
    const dia = data.filter(r => r.turno === 'DIA' || r.turno === 'TURNO DIA');
    const noche = data.filter(r => r.turno !== 'DIA' && r.turno !== 'TURNO DIA');
    const diaMP = dia.reduce((s, r) => s + (r.consumo_mp || 0), 0);
    const diaPT = dia.reduce((s, r) => s + (r.producto_terminado || 0), 0);
    const nocheMP = noche.reduce((s, r) => s + (r.consumo_mp || 0), 0);
    const nochePT = noche.reduce((s, r) => s + (r.producto_terminado || 0), 0);

    createChart('chartRendTurno', {
      type: 'bar',
      data: {
        labels: ['Turno Dia', 'Turno Noche'],
        datasets: [{
          label: 'Rendimiento %',
          data: [diaMP > 0 ? (diaPT / diaMP * 100).toFixed(1) : 0, nocheMP > 0 ? (nochePT / nocheMP * 100).toFixed(1) : 0],
          backgroundColor: [colors.amber.bg, colors.azul.bg],
          borderColor: [colors.amber.border, colors.azul.border],
          borderWidth: 2, borderRadius: 8
        }]
      },
      options: getDefaultOptions('bar')
    });

    // Tabla
    const tbody = container.querySelector('#rendTabla');
    if (tbody) {
      tbody.innerHTML = data.slice(0, 20).map(r => {
        const rend = r.consumo_mp > 0 ? (r.producto_terminado / r.consumo_mp * 100).toFixed(1) : '-';
        return `<tr><td>${r.fecha}</td><td>${r.fruta || '—'}</td><td style="font-family:monospace">${fmt(r.consumo_mp)}</td><td style="font-family:monospace;font-weight:700">${fmt(r.producto_terminado)}</td><td style="color:var(--verde);font-weight:600">${rend}%</td><td><span class="badge badge-${r.turno === 'DIA' ? 'amber' : 'azul'}">${r.turno || '—'}</span></td></tr>`;
      }).join('');
    }
  } catch (err) { console.error('Error rendimientos:', err); }
}

function setVal(c, id, v) { const el = c.querySelector('#' + id); if (el) el.textContent = v; }
export function refresh() { const c = document.getElementById('panel-rendimientos'); if (c) loadData(c); }
