/* ════════════════════════════════════════════════════════
   FORMATTERS - Utilidades de formato
   ════════════════════════════════════════════════════════ */

// Formato numerico con separador de miles
export function fmt(n, decimals = 0) {
  if (n == null || isNaN(n)) return '0';
  return Number(n).toLocaleString('es-PE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

// Formato numerico compacto (1.2K, 3.5M)
export function fmtCompact(n) {
  if (n == null || isNaN(n)) return '0';
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return fmt(n);
}

// Formato porcentaje
export function fmtPct(n, decimals = 1) {
  if (n == null || isNaN(n)) return '0%';
  return Number(n).toFixed(decimals) + '%';
}

// Formato moneda Soles
export function fmtSoles(n, decimals = 2) {
  if (n == null || isNaN(n)) return 'S/ 0.00';
  return 'S/ ' + fmt(n, decimals);
}

// Formato moneda USD
export function fmtUSD(n, decimals = 2) {
  if (n == null || isNaN(n)) return '$ 0.00';
  return '$ ' + fmt(n, decimals);
}

// Formato fecha corta (11 abr 2026)
export function fmtDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Formato fecha larga (Viernes, 11 de Abril 2026)
export function fmtDateLong(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('es-PE', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
}

// Formato hora (14:30)
export function fmtTime(timeStr) {
  if (!timeStr) return '-';
  return timeStr.substring(0, 5);
}

// Fecha de hoy en formato YYYY-MM-DD
export function today() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
}

// Obtener el nombre del turno actual
export function currentTurno() {
  const h = new Date().toLocaleString('en-US', {
    timeZone: 'America/Lima', hour: 'numeric', hour12: false
  });
  return parseInt(h) >= 6 && parseInt(h) < 18 ? 'DIA' : 'NOCHE';
}
