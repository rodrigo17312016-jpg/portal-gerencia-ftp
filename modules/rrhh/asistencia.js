/* ============================================================
   ASISTENCIA — Control diario de asistencia
   ============================================================ */

let tempAttendance = {};

function renderAsistencia() {
    const fecha = document.getElementById('attDate').value;
    if (!fecha) return;
    const fPlanta = document.getElementById('attPlanta').value;
    const fTurno = document.getElementById('attTurno').value;

    let emps = getActiveEmps();
    if (fPlanta) emps = emps.filter(e => e.planta === fPlanta);
    if (fTurno) emps = emps.filter(e => e.turno === fTurno);

    const existing = attendance.filter(a => a.fecha === fecha);
    tempAttendance = {};
    existing.forEach(a => { tempAttendance[a.empleadoId] = a.tipo; });
    emps.forEach(e => { if (!tempAttendance[e.id]) tempAttendance[e.id] = 'ASISTENCIA'; });

    const present = Object.values(tempAttendance).filter(t => t === 'ASISTENCIA').length;
    const absent = Object.values(tempAttendance).filter(t => t === 'FALTA').length;
    const late = Object.values(tempAttendance).filter(t => t === 'TARDANZA').length;
    const leave = Object.values(tempAttendance).filter(t => t === 'PERMISO' || t === 'VACACIONES').length;

    document.getElementById('attKpis').innerHTML = `
        <div class="kpi"><div class="kpi-icon">&#9989;</div><div class="kpi-label">Presentes</div><div class="kpi-val">${present}</div></div>
        <div class="kpi"><div class="kpi-icon">&#10060;</div><div class="kpi-label">Faltas</div><div class="kpi-val">${absent}</div></div>
        <div class="kpi"><div class="kpi-icon">&#9888;</div><div class="kpi-label">Tardanzas</div><div class="kpi-val">${late}</div></div>
        <div class="kpi"><div class="kpi-icon">&#128197;</div><div class="kpi-label">Permisos/Vac.</div><div class="kpi-val">${leave}</div></div>
    `;

    document.getElementById('attGrid').innerHTML = emps.map(e => {
        const t = tempAttendance[e.id] || 'ASISTENCIA';
        return `<div class="att-card">
            <div class="att-info"><div class="att-name">${empName(e)}</div><div class="att-meta">${e.codigo} &bull; ${e.area} &bull; ${e.planta}</div></div>
            <div class="att-btns">
                <button class="att-btn ${t==='ASISTENCIA'?'sel-present':''}" onclick="setAtt('${e.id}','ASISTENCIA')" title="Presente">&#9989;</button>
                <button class="att-btn ${t==='FALTA'?'sel-absent':''}" onclick="setAtt('${e.id}','FALTA')" title="Falta">&#10060;</button>
                <button class="att-btn ${t==='TARDANZA'?'sel-late':''}" onclick="setAtt('${e.id}','TARDANZA')" title="Tardanza">&#9888;</button>
                <button class="att-btn ${t==='PERMISO'?'sel-leave':''}" onclick="setAtt('${e.id}','PERMISO')" title="Permiso">&#128197;</button>
            </div>
        </div>`;
    }).join('');
}

function setAtt(empId, tipo) {
    tempAttendance[empId] = tipo;
    renderAsistencia();
}

function saveAsistencia() {
    const fecha = document.getElementById('attDate').value;
    if (!fecha) return toast('Seleccione una fecha', 'warning');
    attendance = attendance.filter(a => a.fecha !== fecha);
    Object.entries(tempAttendance).forEach(([empId, tipo]) => {
        attendance.push({ id: uid(), empleadoId: empId, fecha, tipo, horasNormales: tipo === 'ASISTENCIA' ? 8 : 0, horasExtras25: 0, horasExtras35: 0 });
    });
    persist();
    toast('Asistencia guardada correctamente para ' + fecha, 'success');
}
