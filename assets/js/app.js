/* ════════════════════════════════════════════════════════
   APP.JS - Entry Point del Portal Unificado
   Frutos Tropicales Peru Export S.A.C.
   ════════════════════════════════════════════════════════ */

import { requireAuth, getCurrentUser, setPermissions, initActivityListeners, initSessionAutoRefresh } from './core/auth.js';
import { initRouter, showPanel, getDefaultPanel } from './core/router.js';
import { initTheme, toggleTheme, onThemeChange } from './core/theme.js';
import { startClock } from './core/clock.js';
import { checkConnection } from './config/supabase.js';
import { updateChartsTheme } from './utils/chart-helpers.js';

// ── Inicializacion ──
async function initPortal() {
  // 1. Verificar autenticacion (ahora async: consulta Supabase Auth + fallback)
  if (!(await requireAuth())) return;

  const user = getCurrentUser();

  // 2. Cargar roles
  try {
    const rolesRes = await fetch('config/roles.json');
    const roles = await rolesRes.json();
    setPermissions(roles);
  } catch (err) {
    console.error('Error cargando roles:', err);
  }

  // 3. Cargar navegacion y construir sidebar
  try {
    const navRes = await fetch('config/navigation.json');
    const navigation = await navRes.json();
    buildSidebar(navigation, user.role);
  } catch (err) {
    console.error('Error cargando navegacion:', err);
  }

  // 4. Actualizar UI con datos del usuario
  updateUserUI(user);

  // 5. Inicializar subsistemas
  initTheme();
  initRouter();
  startClock();
  initActivityListeners();
  initSessionAutoRefresh(); // JWT auto-renewal + logout cascade

  // 6. Verificar conexion Supabase
  const connected = await checkConnection();
  updateConnectionStatus(connected);

  // 7. Suscribirse a cambios de tema para actualizar charts (usa registry global)
  onThemeChange(() => {
    updateChartsTheme();
  });

  // 8. Remover loader inicial
  const loader = document.getElementById('initial-loader');
  if (loader) loader.remove();

  // 9. Cargar panel por defecto
  const defaultPanel = getDefaultPanel();
  showPanel(defaultPanel.id, defaultPanel.module);

  // 10. Eventos de UI
  setupUIEvents();
}

// ── Construir Sidebar ──
function buildSidebar(navigation, userRole) {
  const navContainer = document.getElementById('sidebar-nav');
  if (!navContainer) return;

  let html = '';

  navigation.sections.forEach(section => {
    // Filtrar por rol
    if (!section.roles.includes(userRole) && userRole !== 'admin') return;

    html += `<div class="nav-section">
      <div class="nav-section-title">${section.label}</div>`;

    section.items.forEach(item => {
      html += `
        <div class="nav-item" data-panel="${item.id}" data-module="${item.module}">
          <span class="nav-icon">${item.icon}</span>
          <span class="nav-label">${item.label}</span>
        </div>`;
    });

    html += '</div>';
  });

  // Quick Apps (registro)
  if (navigation.quickApps) {
    const qa = navigation.quickApps;
    if (qa.roles.includes(userRole) || userRole === 'admin') {
      html += `<div class="nav-section">
        <div class="nav-section-title">${qa.label}</div>`;

      qa.items.forEach(item => {
        html += `
          <div class="nav-item nav-app" data-app="${item.path}">
            <span class="nav-icon">${item.icon}</span>
            <span class="nav-label">${item.label}</span>
            <span class="nav-external">\u2197</span>
          </div>`;
      });

      html += '</div>';
    }
  }

  navContainer.innerHTML = html;

  // Event delegation para navegacion
  navContainer.addEventListener('click', (e) => {
    const navItem = e.target.closest('.nav-item');
    if (!navItem) return;

    // App externa
    if (navItem.dataset.app) {
      window.open(navItem.dataset.app, '_blank');
      return;
    }

    // Panel interno
    const panelId = navItem.dataset.panel;
    const modulePath = navItem.dataset.module;
    if (panelId && modulePath) {
      showPanel(panelId, modulePath);

      // Cerrar sidebar en mobile
      if (window.innerWidth <= 768) {
        document.body.classList.remove('sidebar-open');
      }
    }
  });
}

// ── Actualizar UI del usuario ──
function updateUserUI(user) {
  const els = {
    userName: document.getElementById('user-name'),
    userRole: document.getElementById('user-role'),
    userAvatar: document.getElementById('user-avatar'),
    topbarName: document.getElementById('topbar-name'),
    topbarRole: document.getElementById('topbar-role'),
    topbarAvatar: document.getElementById('topbar-avatar')
  };

  if (els.userName) els.userName.textContent = user.name;
  if (els.userRole) els.userRole.textContent = user.roleLabel;
  if (els.userAvatar) els.userAvatar.textContent = user.initials;
  if (els.topbarName) els.topbarName.textContent = user.name;
  if (els.topbarRole) els.topbarRole.textContent = user.roleLabel;
  if (els.topbarAvatar) els.topbarAvatar.textContent = user.initials;

  // Titulo del portal segun rol
  const portalTitles = {
    'admin': 'Portal de Gerencia',
    'produccion': 'Portal de Produccion',
    'calidad': 'Portal de Calidad',
    'mantenimiento': 'Portal de Mantenimiento'
  };
  const portalTitle = portalTitles[user.role] || 'Portal de Gerencia';

  const sidebarTitle = document.querySelector('.sidebar-title strong');
  if (sidebarTitle) sidebarTitle.textContent = portalTitle;

  const topbarTitle = document.querySelector('.topbar-title');
  if (topbarTitle) topbarTitle.textContent = portalTitle;

  // Actualizar titulo de la pagina
  document.title = portalTitle + ' — Frutos Tropicales Peru Export S.A.C.';
}

// ── Estado de Conexion Supabase ──
function updateConnectionStatus(connected) {
  const dot = document.getElementById('connection-status');
  if (dot) {
    dot.className = `status-dot ${connected ? 'online' : 'offline'}`;
    dot.title = connected ? 'Conectado a Supabase' : 'Sin conexion a Supabase';
  }
}

// ── Eventos de UI ──
function setupUIEvents() {
  // Theme toggle
  const themeBtn = document.getElementById('theme-toggle');
  if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

  // Logout
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      import('./core/auth.js').then(m => m.doLogout());
    });
  }

  // Mobile menu toggle
  const menuBtn = document.getElementById('menu-toggle');
  if (menuBtn) {
    menuBtn.addEventListener('click', () => {
      document.body.classList.toggle('sidebar-open');
    });
  }

  // Overlay para cerrar sidebar en mobile
  const overlay = document.getElementById('sidebar-overlay');
  if (overlay) {
    overlay.addEventListener('click', () => {
      document.body.classList.remove('sidebar-open');
    });
  }
}

// ── Iniciar ──
document.addEventListener('DOMContentLoaded', initPortal);
