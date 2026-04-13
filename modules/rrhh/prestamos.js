/* ============================================================
   PRÉSTAMOS — Gestión de préstamos y adelantos
   ============================================================ */

function renderPrestamos() {
    const activos = loans.filter(l => l.estado === 'ACTIVO');
    const totalSaldo = activos.reduce((s,l) => s + l.saldoPendiente, 0);
    const totalMensual = activos.reduce((s,l) => s + l.cuotaMensual, 0);

    document.getElementById('loanKpis').innerHTML = `
        <div class="kpi"><div class="kpi-icon">&#128178;</div><div class="kpi-label">Préstamos Activos</div><div class="kpi-val">${activos.length}</div></div>
        <div class="kpi"><div class="kpi-icon">&#128176;</div><div class="kpi-label">Saldo Total Pendiente</div><div class="kpi-val">${fmt(totalSaldo)}</div></div>
        <div class="kpi"><div class="kpi-icon">&#128197;</div><div class="kpi-label">Descuento Mensual Total</div><div class="kpi-val">${fmt(totalMensual)}</div></div>
    `;

    document.getElementById('loanBody').innerHTML = loans.map(l => {
        const emp = employees.find(e => e.id === l.empleadoId);
        const pagado = l.monto - l.saldoPendiente;
        return `<tr>
            <td style="font-weight:700">${emp?empName(emp):'N/A'}</td>
            <td><span class="badge ${l.tipo==='PRESTAMO'?'badge-orange':'badge-blue'}">${l.tipo}</span></td>
            <td style="text-align:right">${fmt(l.monto)}</td>
            <td style="text-align:center">${l.cuotas}</td>
            <td style="text-align:right">${fmt(l.cuotaMensual)}</td>
            <td style="text-align:right">${fmt(pagado)}</td>
            <td style="text-align:right;font-weight:700">${fmt(l.saldoPendiente)}</td>
            <td><span class="badge ${l.estado==='ACTIVO'?'badge-green':'badge-gray'}">${l.estado}</span></td>
            <td>${l.estado==='ACTIVO'?`<button class="btn btn-sm btn-primary" onclick="pagarCuota('${l.id}')">Pagar Cuota</button>`:''}</td>
        </tr>`;
    }).join('');
}

function openLoanModal() { populateEmpSelects(); document.getElementById('loanModal').classList.add('show'); }

function saveLoan(e) {
    e.preventDefault();
    const monto = parseFloat(document.getElementById('fLoanMonto').value);
    const cuotas = parseInt(document.getElementById('fLoanCuotas').value);
    loans.push({
        id: uid(), empleadoId: document.getElementById('fLoanEmp').value,
        tipo: document.getElementById('fLoanTipo').value, monto, cuotas,
        cuotaMensual: Math.ceil(monto/cuotas*100)/100,
        saldoPendiente: monto, fechaInicio: document.getElementById('fLoanFecha').value,
        estado: 'ACTIVO', pagos: []
    });
    persist(); closeModal('loanModal'); renderPrestamos();
    toast('Préstamo registrado correctamente', 'success');
}

function pagarCuota(loanId) {
    const l = loans.find(x => x.id === loanId);
    if (!l) return;
    l.saldoPendiente = Math.max(0, l.saldoPendiente - l.cuotaMensual);
    l.pagos.push({ fecha: new Date().toISOString().split('T')[0], monto: l.cuotaMensual });
    if (l.saldoPendiente <= 0) { l.saldoPendiente = 0; l.estado = 'PAGADO'; }
    persist(); renderPrestamos();
    toast(l.estado === 'PAGADO' ? 'Préstamo pagado completamente' : 'Cuota registrada correctamente', 'success');
}
