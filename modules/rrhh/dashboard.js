/* ============================================================
   DASHBOARD — KPIs, Charts, Resumen Rápido
   ============================================================ */

function renderDashboard() {
    const activos = getActiveEmps();
    const totalEmps = activos.length;
    const agrarios = activos.filter(e => e.regimen === 'AGRARIO').length;
    const generales = totalEmps - agrarios;
    const totalSueldos = activos.reduce((s,e) => s + e.sueldoBasico, 0);
    const loanActivos = loans.filter(l => l.estado === 'ACTIVO');
    const totalPrestamos = loanActivos.reduce((s,l) => s + l.saldoPendiente, 0);
    const p1 = activos.filter(e => e.planta === 'PLANTA HUAURA').length;
    const p2 = activos.filter(e => e.planta === 'PLANTA PIURA').length;

    // Calcular planilla semanal estimada (agrarios × RDA × 6 días)
    const empsAgrarios = activos.filter(e => e.regimen === 'AGRARIO');
    const costoSemanalAgrario = empsAgrarios.reduce((s,e) => s + calcPagoSemanal(e.sueldoBasico, 6), 0);
    const costoMensualGeneral = activos.filter(e => e.regimen === 'GENERAL').reduce((s,e) => s + e.sueldoBasico, 0);

    document.getElementById('dashKpis').innerHTML = `
        <div class="kpi"><div class="kpi-icon">&#128101;</div><div class="kpi-label">Empleados Activos</div><div class="kpi-val">${totalEmps}</div><div class="kpi-sub">${agrarios} agrarios / ${generales} general</div></div>
        <div class="kpi"><div class="kpi-icon">&#127981;</div><div class="kpi-label">Planta Huaura</div><div class="kpi-val">${p1}</div><div class="kpi-sub">${totalEmps?((p1/totalEmps)*100).toFixed(0):'0'}% del total</div></div>
        <div class="kpi"><div class="kpi-icon">&#127970;</div><div class="kpi-label">Planta Piura</div><div class="kpi-val">${p2}</div><div class="kpi-sub">${totalEmps?((p2/totalEmps)*100).toFixed(0):'0'}% del total</div></div>
        <div class="kpi"><div class="kpi-icon">&#128176;</div><div class="kpi-label">Planilla Mensual (General)</div><div class="kpi-val">${fmt(costoMensualGeneral)}</div><div class="kpi-sub">${generales} empleados — pago fin de mes</div></div>
        <div class="kpi"><div class="kpi-icon">&#128197;</div><div class="kpi-label">Planilla Semanal (Agrario)</div><div class="kpi-val">${fmt(costoSemanalAgrario)}</div><div class="kpi-sub">${agrarios} trabajadores — pago cada sábado</div></div>
        <div class="kpi"><div class="kpi-icon">&#9878;</div><div class="kpi-label">Costo EsSalud Est.</div><div class="kpi-val">${fmt(activos.reduce((s,e)=>s+calcEsSalud(e.sueldoBasico,e.regimen),0))}</div><div class="kpi-sub">9% General / 6% Agrario</div></div>
    `;

    // Charts
    const areas = ['Producción','Calidad','Almacén','Mantenimiento','Administración','Sanidad'];
    const areaData = areas.map(a => activos.filter(e => e.area === a).length);
    const regData = [agrarios, generales];

    document.getElementById('dashCharts').innerHTML = `
        <div class="chart-card"><h3><span class="dot" style="background:var(--green-l)"></span> Empleados por Área</h3>${totalEmps>0?'<canvas id="chArea"></canvas>':'<div style="display:flex;align-items:center;justify-content:center;height:200px;color:var(--t3);flex-direction:column;gap:8px"><div style="font-size:40px">📊</div><div>Cargue empleados para ver el gráfico</div></div>'}</div>
        <div class="chart-card"><h3><span class="dot" style="background:var(--orange-l)"></span> Régimen Laboral</h3>${totalEmps>0?'<canvas id="chRegimen"></canvas>':'<div style="display:flex;align-items:center;justify-content:center;height:200px;color:var(--t3);flex-direction:column;gap:8px"><div style="font-size:40px">📈</div><div>Sin datos disponibles</div></div>'}</div>
    `;

    // Destroy previous chart instances
    if (window._chArea) { window._chArea.destroy(); window._chArea = null; }
    if (window._chRegimen) { window._chRegimen.destroy(); window._chRegimen = null; }

    const tc = theme==='dark'?'#94a3b8':'#475569';
    if (totalEmps > 0) {
        window._chArea = new Chart(document.getElementById('chArea'),{type:'bar',data:{labels:areas,datasets:[{label:'Empleados',data:areaData,backgroundColor:['rgba(34,197,94,.7)','rgba(249,115,22,.7)','rgba(37,99,235,.7)','rgba(139,92,246,.7)','rgba(236,72,153,.7)','rgba(20,184,166,.7)'],borderRadius:6}]},options:{responsive:true,plugins:{legend:{display:false},datalabels:{color:tc,anchor:'end',align:'end',font:{weight:'700',size:11}}},scales:{x:{grid:{display:false},ticks:{color:tc,font:{weight:'600'}}},y:{grid:{color:theme==='dark'?'rgba(148,163,184,.08)':'rgba(0,0,0,.06)'},ticks:{color:tc}}}}});
        window._chRegimen = new Chart(document.getElementById('chRegimen'),{type:'doughnut',data:{labels:['Agrario','General'],datasets:[{data:regData,backgroundColor:['rgba(34,197,94,.7)','rgba(37,99,235,.7)'],borderWidth:0,hoverOffset:10}]},options:{responsive:true,cutout:'65%',plugins:{legend:{position:'bottom',labels:{color:tc,padding:14,font:{size:12,weight:'600'},usePointStyle:true}},datalabels:{color:'#fff',font:{weight:'700',size:14},formatter:(v,c)=>{const t=c.dataset.data.reduce((a,b)=>a+b,0);return t?((v/t)*100).toFixed(0)+'%':'0%';}}}}});
    }

    // Summary
    const onp = activos.filter(e => e.sistPensiones === 'ONP').length;
    const afp = totalEmps - onp;
    const rdaEj = empsAgrarios.length ? calcRDA(empsAgrarios[0].sueldoBasico) : null;
    document.getElementById('dashSummary').innerHTML = `
        <div class="detail-item"><div class="detail-label">ONP</div><div class="detail-value">${onp} empleados</div></div>
        <div class="detail-item"><div class="detail-label">AFP</div><div class="detail-value">${afp} empleados</div></div>
        <div class="detail-item"><div class="detail-label">Turno Día</div><div class="detail-value">${activos.filter(e=>e.turno==='DIA').length}</div></div>
        <div class="detail-item"><div class="detail-label">Turno Noche</div><div class="detail-value">${activos.filter(e=>e.turno==='NOCHE').length}</div></div>
        <div class="detail-item"><div class="detail-label">Pago General</div><div class="detail-value">Mensual (fin de mes)</div></div>
        <div class="detail-item"><div class="detail-label">Pago Agrario</div><div class="detail-value">Semanal (sábado)</div></div>
        ${rdaEj?`<div class="detail-item"><div class="detail-label">RDA Agrario (diaria)</div><div class="detail-value">${fmt(rdaEj.rda)}</div></div>`:''}
        <div class="detail-item"><div class="detail-label">RMV 2026</div><div class="detail-value">${fmt(CFG.rmv)}</div></div>
        <div class="detail-item"><div class="detail-label">UIT 2026</div><div class="detail-value">${fmt(CFG.uit)}</div></div>
        <div class="detail-item"><div class="detail-label">Asig. Familiar</div><div class="detail-value">${fmt(CFG.rmv*0.1)}</div></div>
    `;
    document.getElementById('empCount').textContent = totalEmps;
}
