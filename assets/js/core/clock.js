/* ════════════════════════════════════════════════════════
   CLOCK - Reloj Peru Timezone
   ════════════════════════════════════════════════════════ */

import { TIMEZONE } from '../config/constants.js';

let clockInterval = null;

export function startClock() {
  updateClock();
  clockInterval = setInterval(updateClock, 1000);
}

export function stopClock() {
  if (clockInterval) {
    clearInterval(clockInterval);
    clockInterval = null;
  }
}

function updateClock() {
  const now = new Date();

  // Hora
  const timeEl = document.getElementById('clock-time');
  if (timeEl) {
    timeEl.textContent = now.toLocaleTimeString('es-PE', {
      timeZone: TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  }

  // Fecha
  const dateEl = document.getElementById('clock-date');
  if (dateEl) {
    dateEl.textContent = now.toLocaleDateString('es-PE', {
      timeZone: TIMEZONE,
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }

  // Indicador de turno
  const turnoEl = document.getElementById('current-turno');
  if (turnoEl) {
    const h = parseInt(now.toLocaleString('en-US', { timeZone: TIMEZONE, hour: 'numeric', hour12: false }));
    const isDia = h >= 6 && h < 18;
    turnoEl.textContent = isDia ? '\u2600\uFE0F Turno Dia' : '\uD83C\uDF19 Turno Noche';
  }
}
