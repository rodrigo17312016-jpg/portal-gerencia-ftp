/* ============================================================
   LIQUIDACIONES — Cálculo de liquidación de beneficios
   ============================================================ */

function calcularLiquidacion() {
    const empId = document.getElementById('liqEmp').value;
    const fechaCese = document.getElementById('liqFechaCese').value;
    const motivo = document.getElementById('liqMotivo').value;
    if (!empId || !fechaCese) return toast('Seleccione empleado y fecha de cese', 'warning');
    const emp = employees.find(e => e.id === empId);
    if (!emp) return;

    const cese = new Date(fechaCese);
    const ingreso = new Date(emp.fechaIngreso);
    const mesesTotal = diffMonths(ingreso, cese);
    const anios = mesesTotal / 12;

    let ctsTrunca = 0, gratTrunca = 0;
    let rdaInfo = '';

    if (emp.regimen === 'GENERAL') {
        // CTS Trunca (solo Régimen General)
        const mesesCTS = mesesTotal % 6 || 6;
        const gratif16 = emp.sueldoBasico / 6;
        ctsTrunca = ((emp.sueldoBasico + gratif16) / 12) * mesesCTS;

        // Gratificación Trunca
        const mesSemestre = cese.getMonth() < 6 ? cese.getMonth() : cese.getMonth() - 6;
        gratTrunca = (emp.sueldoBasico / 6) * (mesSemestre + 1);
        gratTrunca += gratTrunca * 0.09;
    } else {
        // Régimen Agrario: CTS y Gratificaciones ya están incluidas en la RDA
        const rda = calcRDA(emp.sueldoBasico);
        rdaInfo = `
        <div class="sec-title" style="margin-top:16px"><div class="icon">&#128203;</div><h2>Desglose RDA — Ley 31110</h2><div class="line"></div></div>
        <div class="detail-grid" style="margin-bottom:16px">
            <div class="detail-item"><div class="detail-label">Jornal Diario Básico</div><div class="detail-value">${fmt(rda.jornal)}</div></div>
            <div class="detail-item"><div class="detail-label">CTS Incluida (9.72%)</div><div class="detail-value" style="color:var(--teal-l)">${fmt(rda.ctsDiaria)}/día</div></div>
            <div class="detail-item"><div class="detail-label">Gratif. Incluida (16.66%)</div><div class="detail-value" style="color:var(--orange-l)">${fmt(rda.gratifDiaria)}/día</div></div>
            <div class="detail-item"><div class="detail-label">RDA Total</div><div class="detail-value" style="font-weight:800;color:var(--green-l)">${fmt(rda.rda)}/día</div></div>
        </div>
        <div style="padding:12px;background:var(--bg3);border-radius:8px;color:var(--teal-l);margin-bottom:16px;font-size:13px">
            &#9432; En Régimen Agrario, la CTS y Gratificación ya fueron pagadas como parte de la Remuneración Diaria Agraria (RDA) en cada pago semanal.
            No corresponde depósito separado de CTS ni pago adicional de gratificación.
        </div>`;
    }

    // Vacaciones Truncas (ambos regímenes: 30 días)
    const vacTomados = vacations.filter(v => v.empleadoId === empId).reduce((s,v) => s + v.dias, 0);
    const vacPendientes = Math.max(0, Math.floor(anios) * 30 - vacTomados);
    const vacTruncas = (emp.sueldoBasico / 30) * vacPendientes;

    // Indemnización (solo despido arbitrario)
    let indemnizacion = 0;
    if (motivo === 'DESPIDO') {
        if (emp.tipoContrato === 'INDETERMINADO') {
            indemnizacion = emp.sueldoBasico * 1.5 * Math.min(anios, 12);
        } else {
            const mesesRestantes = 12 - (mesesTotal % 12);
            indemnizacion = emp.sueldoBasico * 1.5 * (mesesRestantes / 12);
        }
    }

    // Préstamos pendientes
    const prestPend = loans.filter(l => l.empleadoId === empId && l.estado === 'ACTIVO').reduce((s,l) => s + l.saldoPendiente, 0);
    const totalLiq = ctsTrunca + gratTrunca + vacTruncas + indemnizacion - prestPend;

    const motivoLabels = {RENUNCIA:'Renuncia Voluntaria',DESPIDO:'Despido',MUTUO:'Mutuo Acuerdo',TERMINO:'Término de Contrato'};

    document.getElementById('liqResult').innerHTML = `
        <div class="sec-title"><div class="icon">&#128196;</div><h2>Liquidación de ${empName(emp)}</h2><div class="line"></div></div>
        <div class="detail-grid">
            <div class="detail-item"><div class="detail-label">Empleado</div><div class="detail-value">${empName(emp)}</div></div>
            <div class="detail-item"><div class="detail-label">DNI</div><div class="detail-value">${emp.dni}</div></div>
            <div class="detail-item"><div class="detail-label">Fecha Ingreso</div><div class="detail-value">${emp.fechaIngreso}</div></div>
            <div class="detail-item"><div class="detail-label">Fecha Cese</div><div class="detail-value">${fechaCese}</div></div>
            <div class="detail-item"><div class="detail-label">Tiempo de Servicios</div><div class="detail-value">${anios.toFixed(1)} años (${mesesTotal} meses)</div></div>
            <div class="detail-item"><div class="detail-label">Motivo</div><div class="detail-value">${motivoLabels[motivo]}</div></div>
            <div class="detail-item"><div class="detail-label">Régimen</div><div class="detail-value"><span class="badge ${emp.regimen==='AGRARIO'?'badge-teal':'badge-purple'}">${emp.regimen}</span></div></div>
            <div class="detail-item"><div class="detail-label">Sueldo Básico</div><div class="detail-value">${fmt(emp.sueldoBasico)}</div></div>
            <div class="detail-item"><div class="detail-label">Frecuencia de Pago</div><div class="detail-value" style="font-weight:700">${emp.regimen==='AGRARIO'?'Semanal (Sábado)':'Mensual (Fin de mes)'}</div></div>
        </div>
        ${rdaInfo}
        <div class="tbl-card" style="margin-bottom:20px"><div class="tbl-wrap"><table class="tbl">
            <thead><tr><th>Concepto</th><th style="text-align:right">Monto</th></tr></thead>
            <tbody>
                ${emp.regimen==='GENERAL'?`
                <tr><td>CTS Trunca</td><td style="text-align:right;font-weight:700">${fmt(ctsTrunca)}</td></tr>
                <tr><td>Gratificación Trunca (inc. bonif. ext. 9%)</td><td style="text-align:right;font-weight:700">${fmt(gratTrunca)}</td></tr>
                `:`
                <tr><td>CTS Trunca <span style="color:var(--teal-l);font-size:11px">(ya incluida en RDA — S/ 0.00)</span></td><td style="text-align:right;font-weight:700">${fmt(0)}</td></tr>
                <tr><td>Gratificación Trunca <span style="color:var(--teal-l);font-size:11px">(ya incluida en RDA — S/ 0.00)</span></td><td style="text-align:right;font-weight:700">${fmt(0)}</td></tr>
                `}
                <tr><td>Vacaciones Truncas (${vacPendientes} días pendientes)</td><td style="text-align:right;font-weight:700">${fmt(vacTruncas)}</td></tr>
                ${indemnizacion>0?`<tr><td>Indemnización por Despido Arbitrario</td><td style="text-align:right;font-weight:700;color:var(--orange-l)">${fmt(indemnizacion)}</td></tr>`:''}
                ${prestPend>0?`<tr><td style="color:#f87171">(-) Préstamos Pendientes</td><td style="text-align:right;font-weight:700;color:#f87171">-${fmt(prestPend)}</td></tr>`:''}
                <tr class="tbl-total"><td>TOTAL LIQUIDACIÓN</td><td style="text-align:right;font-size:18px">${fmt(totalLiq)}</td></tr>
            </tbody>
        </table></div></div>
        <div class="btn-group"><button class="btn btn-primary" onclick="window.print()">&#128424; Imprimir Liquidación</button></div>
    `;
}
