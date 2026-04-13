/* ════════════════════════════════════════════════════════
   THEME - Dark/Light Mode Toggle
   ════════════════════════════════════════════════════════ */

const THEME_KEY = 'ftp_theme';
let themeChangeCallbacks = [];

// Inicializar tema
export function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === 'dark') {
    document.body.classList.add('dark-mode');
  }
  updateThemeIcon();
}

// Toggle dark/light
export function toggleTheme() {
  document.body.classList.toggle('dark-mode');
  const isDark = document.body.classList.contains('dark-mode');
  localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
  updateThemeIcon();

  // Notificar a listeners
  themeChangeCallbacks.forEach(cb => cb(isDark));
}

// Actualizar icono del boton
function updateThemeIcon() {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;
  const isDark = document.body.classList.contains('dark-mode');
  btn.textContent = isDark ? '\u2600\uFE0F' : '\uD83C\uDF19';
  btn.title = isDark ? 'Modo Claro' : 'Modo Oscuro';
}

// Suscribirse a cambios de tema
export function onThemeChange(callback) {
  themeChangeCallbacks.push(callback);
}

// Verificar si es dark mode
export function isDarkMode() {
  return document.body.classList.contains('dark-mode');
}

// Pre-aplicar tema antes de render (anti-flash)
export function preApplyTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === 'dark') {
    document.documentElement.classList.add('dark-mode');
  }
}
