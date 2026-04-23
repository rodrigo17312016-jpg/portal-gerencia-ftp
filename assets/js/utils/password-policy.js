/* ════════════════════════════════════════════════════════
   PASSWORD POLICY - Validador de complejidad
   Frutos Tropicales Peru Export S.A.C.

   Politica ISO 27001 Annex A.9.4.3 / NIST 800-63B:
   - Minimo 8 caracteres
   - Al menos 1 mayuscula
   - Al menos 1 minuscula
   - Al menos 1 numero
   - Al menos 1 simbolo
   - NO similar a palabras de diccionario obvias (nombre empresa, etc.)
   ════════════════════════════════════════════════════════ */

const MIN_LENGTH = 8;
const COMMON_WEAK = [
  'password', 'contrasena', 'contraseña', '12345678', 'qwerty',
  'frutos', 'tropicales', 'ftp', 'admin', 'gerencia', '2026', '2025', '2024'
];

/**
 * Valida fortaleza de una contrasena.
 *
 * @param {string} password
 * @returns {{valid: boolean, score: 0-4, errors: string[], strength: 'weak'|'medium'|'strong'}}
 */
export function validatePassword(password) {
  const errors = [];
  const pwd = password || '';

  if (pwd.length < MIN_LENGTH) errors.push(`Minimo ${MIN_LENGTH} caracteres`);
  if (!/[A-Z]/.test(pwd)) errors.push('Al menos una mayuscula (A-Z)');
  if (!/[a-z]/.test(pwd)) errors.push('Al menos una minuscula (a-z)');
  if (!/[0-9]/.test(pwd)) errors.push('Al menos un numero (0-9)');
  if (!/[^A-Za-z0-9]/.test(pwd)) errors.push('Al menos un simbolo (!@#$...)');

  // Check palabras debiles (case-insensitive)
  const lower = pwd.toLowerCase();
  const matched = COMMON_WEAK.find(w => lower.includes(w));
  if (matched) errors.push(`No uses palabras obvias como "${matched}"`);

  // Score: 0-4 para medidor visual
  let score = 0;
  if (pwd.length >= 8) score++;
  if (pwd.length >= 12) score++;
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd) && /[0-9]/.test(pwd) && /[^A-Za-z0-9]/.test(pwd)) score++;
  if (pwd.length >= 14 && !matched) score++;

  const strength = score >= 3 ? 'strong' : score === 2 ? 'medium' : 'weak';

  return {
    valid: errors.length === 0,
    score,
    errors,
    strength
  };
}

/**
 * Crea un medidor visual de fortaleza.
 * @param {string} password
 * @returns {HTMLElement}
 */
export function createStrengthMeter(password) {
  const r = validatePassword(password);
  const wrap = document.createElement('div');
  wrap.className = 'ftp-pwd-meter';
  wrap.style.cssText = 'margin-top:6px';

  const bar = document.createElement('div');
  bar.style.cssText = 'height:4px;background:var(--surface-alt,#e2e8f0);border-radius:2px;overflow:hidden';
  const fill = document.createElement('div');
  const colors = { weak: '#ef4444', medium: '#f59e0b', strong: '#16a34a' };
  fill.style.cssText = `height:100%;width:${r.score * 25}%;background:${colors[r.strength] || '#ef4444'};transition:all 0.3s ease`;
  bar.appendChild(fill);
  wrap.appendChild(bar);

  if (r.errors.length > 0) {
    const errList = document.createElement('ul');
    errList.style.cssText = 'font-size:11px;color:#ef4444;margin:6px 0 0;padding-left:18px;line-height:1.5';
    r.errors.forEach(e => {
      const li = document.createElement('li');
      li.textContent = e;
      errList.appendChild(li);
    });
    wrap.appendChild(errList);
  } else {
    const ok = document.createElement('div');
    ok.style.cssText = 'font-size:11px;color:#16a34a;margin-top:6px';
    ok.textContent = '✓ Contrasena valida (' + r.strength + ')';
    wrap.appendChild(ok);
  }

  return wrap;
}

/**
 * Wire-up automatico: enlaza un input con un container de medidor.
 */
export function attachPasswordMeter(input, container) {
  if (!input || !container) return;
  const update = () => {
    container.innerHTML = '';
    container.appendChild(createStrengthMeter(input.value));
  };
  input.addEventListener('input', update);
  update();
}
