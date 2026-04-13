/* ============================================================
   CONFIG — Constantes legales Peru, Storage, Helpers, Cálculos
   ============================================================ */

const CFG = {
    uit: 5350, rmv: 1130,
    essaludGeneral: 0.09, essaludAgrario: 0.06,
    onp: 0.13,
    afp: {
        AFP_INTEGRA:   { fondo:0.10, comision:0.0155, seguro:0.0184 },
        AFP_PRIMA:     { fondo:0.10, comision:0.0155, seguro:0.0184 },
        AFP_PROFUTURO: { fondo:0.10, comision:0.0169, seguro:0.0184 },
        AFP_HABITAT:   { fondo:0.10, comision:0.0138, seguro:0.0184 }
    },
    irEscala: [
        { hasta:5, tasa:0.08 },{ hasta:20, tasa:0.14 },{ hasta:35, tasa:0.17 },
        { hasta:45, tasa:0.20 },{ hasta:Infinity, tasa:0.30 }
    ],
    hhee25: 1.25, hhee35: 1.35, asigFamiliar: 0.10
};

// ==================== STORAGE ====================
function loadData(key) { try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; } }
function saveData(key, data) { localStorage.setItem(key, JSON.stringify(data)); }
function loadConfig() { return JSON.parse(localStorage.getItem('rrhh_config') || 'null') || CFG; }

let employees = loadData('rrhh_employees');
let attendance = loadData('rrhh_attendance');
let payroll = loadData('rrhh_payroll');
let loans = loadData('rrhh_loans');
let vacations = loadData('rrhh_vacations');

// Migrate old CHANCAY data to PIURA
employees.forEach(e => { if (e.planta === 'PLANTA CHANCAY') e.planta = 'PLANTA PIURA'; });
if (employees.length) persist();

function persist() {
    saveData('rrhh_employees', employees);
    saveData('rrhh_attendance', attendance);
    saveData('rrhh_payroll', payroll);
    saveData('rrhh_loans', loans);
    saveData('rrhh_vacations', vacations);
}

// ==================== HELPERS ====================
function fmt(n) { return 'S/ ' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
function fmtN(n) { return n.toLocaleString('es-PE'); }
function uid() { return Date.now().toString(36) + Math.random().toString(36).substr(2,5); }
function getActiveEmps() { return employees.filter(e => e.estado === 'ACTIVO'); }
function empName(e) { return e.apellidos + ', ' + e.nombres; }
function diffMonths(d1, d2) { return (d2.getFullYear()-d1.getFullYear())*12+(d2.getMonth()-d1.getMonth()); }

// ==================== CALCULATIONS ====================
function calcAFP(sueldo, tipo) {
    const a = CFG.afp[tipo];
    if (!a) return { fondo:0, comision:0, seguro:0, total:0 };
    return { fondo: sueldo*a.fondo, comision: sueldo*a.comision, seguro: sueldo*a.seguro, total: sueldo*(a.fondo+a.comision+a.seguro) };
}

function calcONP(sueldo) { return sueldo * CFG.onp; }

function calcEsSalud(sueldo, regimen) {
    return sueldo * (regimen === 'AGRARIO' ? CFG.essaludAgrario : CFG.essaludGeneral);
}

function calcIR5ta(remuAnual) {
    const deduccion = 7 * CFG.uit;
    let renta = Math.max(0, remuAnual - deduccion);
    let impuesto = 0;
    let prevLim = 0;
    for (const tramo of CFG.irEscala) {
        const lim = tramo.hasta * CFG.uit;
        const base = Math.min(renta, lim) - prevLim;
        if (base > 0) impuesto += base * tramo.tasa;
        prevLim = lim;
        if (renta <= lim) break;
    }
    return impuesto;
}

function calcIR5taMensual(sueldoMensual, mesActual) {
    const anualProyectado = sueldoMensual * 14;
    const irAnual = calcIR5ta(anualProyectado);
    return irAnual / 12;
}

function calcHHEE(sueldoBasico, hh25, hh35) {
    const valorHora = sueldoBasico / 30 / 8;
    return (hh25 * valorHora * CFG.hhee25) + (hh35 * valorHora * CFG.hhee35);
}

function calcAsigFamiliar() { return CFG.rmv * CFG.asigFamiliar; }

// ==================== RÉGIMEN AGRARIO (Ley 31110) ====================
// La Remuneración Diaria Agraria (RDA) incluye CTS y Gratificaciones
// de forma proporcional en el jornal diario.
// - Gratificaciones: 16.66% del jornal básico (2 sueldos / 12 meses)
// - CTS: 9.72% del jornal básico
// Total RDA = Jornal × 1.2638

CFG.agrario = {
    gratifPct: 16.66 / 100,  // 16.66%
    ctsPct: 9.72 / 100,       // 9.72%
    diasLaborales: 6,          // Lunes a Sábado
    jornadaHoras: 8            // Jornada diaria
};

function calcJornalBasico(sueldoMensual) {
    return sueldoMensual / 30;
}

// Calcula el desglose semanal completo del Régimen Agrario
// Base computable para CTS y Gratif = basico + asigFamiliar + dominical
function calcSemanalAgrario(sueldoMensual, diasTrab, tieneAsigFam, hhExtras25, hhExtras35) {
    const jornal = calcJornalBasico(sueldoMensual);
    const basico = jornal * diasTrab;
    const dominical = jornal; // Descanso dominical = 1 jornal
    const asigFamiliar = tieneAsigFam ? (calcAsigFamiliar() / 30 * 7) : 0; // proporcional 7 días
    const baseComputable = basico + asigFamiliar + dominical;
    const gratificacion = baseComputable * CFG.agrario.gratifPct;
    const bonoLeyGratif = gratificacion * CFG.essaludAgrario; // 6% sobre gratificación
    const cts = baseComputable * CFG.agrario.ctsPct;

    // Horas extras: base = (basico + asigFam + dominical) / 7 días / 8 horas
    const valorHora = baseComputable / 7 / CFG.agrario.jornadaHoras;
    const montoHHEE25 = (hhExtras25 || 0) * valorHora * CFG.hhee25;
    const montoHHEE35 = (hhExtras35 || 0) * valorHora * CFG.hhee35;

    const totalRemuneraciones = basico + asigFamiliar + gratificacion + dominical + bonoLeyGratif + cts + montoHHEE25 + montoHHEE35;

    return {
        jornal,
        basico,
        dominical,
        asigFamiliar,
        baseComputable,
        gratificacion,
        bonoLeyGratif,
        cts,
        montoHHEE25,
        montoHHEE35,
        valorHora,
        totalRemuneraciones
    };
}

// Estimación rápida para dashboard (6 días, sin extras)
function calcPagoSemanal(sueldoMensual, diasTrab) {
    const r = calcSemanalAgrario(sueldoMensual, diasTrab, false, 0, 0);
    return r.totalRemuneraciones;
}

// RDA info para display (por día)
function calcRDA(sueldoMensual) {
    const jornal = calcJornalBasico(sueldoMensual);
    const gratifDiaria = jornal * CFG.agrario.gratifPct;
    const ctsDiaria = jornal * CFG.agrario.ctsPct;
    return {
        jornal,
        gratifDiaria,
        ctsDiaria,
        rda: jornal + gratifDiaria + ctsDiaria,
        factorRDA: 1 + CFG.agrario.gratifPct + CFG.agrario.ctsPct
    };
}

function calcIR5taSemanal(remuSemanal) {
    const anualProyectado = remuSemanal * 52;
    const irAnual = calcIR5ta(anualProyectado);
    return irAnual / 52;
}

// Helper: obtener el sábado y domingo de una semana dada
function getSabado(anio, numSemana) {
    const jan4 = new Date(anio, 0, 4);
    const dayOfWeek = jan4.getDay() || 7;
    const monday = new Date(anio, 0, 4 - dayOfWeek + 1 + (numSemana - 1) * 7);
    const saturday = new Date(monday);
    saturday.setDate(monday.getDate() + 5);
    return saturday;
}

function getDomingo(anio, numSemana) {
    const sat = getSabado(anio, numSemana);
    const dom = new Date(sat);
    dom.setDate(sat.getDate() + 1);
    return dom;
}

// Helper: obtener número de semana ISO
function getWeekNumber(d) {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
}

// Helper: obtener lunes de una semana ISO
function getLunesDeSemana(anio, numSemana) {
    const jan4 = new Date(anio, 0, 4);
    const dayOfWeek = jan4.getDay() || 7;
    return new Date(anio, 0, 4 - dayOfWeek + 1 + (numSemana - 1) * 7);
}

// Helper: generar semanas de un mes
function getSemanasDelMes(anio, mes) {
    const semanas = [];
    const primerDia = new Date(anio, mes - 1, 1);
    const ultimoDia = new Date(anio, mes, 0);
    const semanasVistas = new Set();

    for (let d = new Date(primerDia); d <= ultimoDia; d.setDate(d.getDate() + 1)) {
        const wk = getWeekNumber(d);
        const yr = d.getMonth() === 11 && wk === 1 ? d.getFullYear() + 1 : (d.getMonth() === 0 && wk > 50 ? d.getFullYear() - 1 : d.getFullYear());
        const key = yr + '-W' + String(wk).padStart(2, '0');
        if (!semanasVistas.has(key)) {
            semanasVistas.add(key);
            const lunes = getLunesDeSemana(yr, wk);
            const domingo = getDomingo(yr, wk);
            const sabado = getSabado(yr, wk);
            semanas.push({
                key,
                anio: yr,
                semana: wk,
                lunes: lunes.toISOString().split('T')[0],
                sabado: sabado.toISOString().split('T')[0],
                domingo: domingo.toISOString().split('T')[0],
                label: `Sem ${wk} (${lunes.toLocaleDateString('es-PE',{day:'2-digit',month:'short'})} al ${domingo.toLocaleDateString('es-PE',{day:'2-digit',month:'short'})})`
            });
        }
    }
    return semanas;
}

// ==================== CSV EXPORT ====================
function downloadCSV(csv, filename) {
    const blob = new Blob(['\uFEFF'+csv], {type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
}
