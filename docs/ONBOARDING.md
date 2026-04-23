# Onboarding — Nuevo Developer / Bus Factor

**Proposito**: reducir el bus factor. Un nuevo dev (o alguien que reemplace al actual mantenedor) debe poder operar el portal con solo leer este documento.

**Version:** 1.0 · **Fecha:** 2026-04-23

---

## 1. Accesos criticos a solicitar (dia 1)

| Servicio | Recurso | Como pedirlo |
|---|---|---|
| **GitHub** | Collaborator en `rodrigo17312016-jpg/portal-gerencia-ftp` | Rodrigo Garcia via invite |
| **Supabase (principal)** | Organization member + project `rslzosmeteyzxmgfkppe` | Invite desde Supabase Dashboard |
| **Supabase (calidad)** | Project `obnvrfvcujsrmifvlqni` | Invite desde Supabase Dashboard |
| **GitHub Pages settings** | Admin del repo | Para ver configuracion deploy |
| **Twilio (chatbot)** | Opcional, solo si toca chatbot WhatsApp | Credenciales en `scripts/` (fuera del portal) |

## 2. Setup local (30 min)

```bash
# 1. Clonar repo
git clone https://github.com/rodrigo17312016-jpg/portal-gerencia-ftp.git
cd portal-gerencia-ftp

# 2. Servidor local (recomendado: npx serve)
# Opcion A - npx (no instala nada)
npx serve .

# Opcion B - Python (si ya lo tienes)
python -m http.server 8000

# Opcion C - Live Server extension en VS Code (recomendado para dev)
# Click derecho en portal.html -> "Open with Live Server"

# 3. Abrir http://localhost:3000 (o el puerto que se asigne)
# 4. Login con credenciales de Supabase (gerencia/frutos2026 NO funciona sin DB)
```

**IMPORTANTE**: El portal no tiene `package.json` ni build step. No hace falta `npm install`. Solo servir los archivos estaticos.

## 3. Estructura de carpetas

```
proyecto/
├── index.html              Web corporativa publica
├── login.html              Login (Supabase Auth)
├── portal.html             Shell del portal (shell pattern)
├── sw.js                   Service Worker (PWA)
├── manifest.json           PWA manifest
├── .nojekyll               Desactiva Jekyll en GitHub Pages (para _shared/)
│
├── assets/
│   ├── css/                Estilos modulares (variables, reset, layout, etc.)
│   ├── js/
│   │   ├── app.js          Entry point del portal
│   │   ├── config/
│   │   │   ├── supabase.js     Clientes Supabase (2 proyectos)
│   │   │   └── users.js        Metadata UI (sin contrasenas post Fase 9)
│   │   ├── core/
│   │   │   ├── auth.js         Supabase Auth + requireAuth + roles
│   │   │   ├── router.js       SPA router lazy-load
│   │   │   ├── theme.js        Dark/light mode
│   │   │   └── clock.js        Reloj en topbar
│   │   └── utils/              Helpers reusables (~15 archivos)
│   ├── images/             Logos, productos, certificaciones
│   └── icons/              PWA icons
│
├── modules/                Paneles (templates HTML + logica JS)
│   ├── gerencia/               resumen, certificaciones, audit, seguridad
│   ├── produccion/             9 paneles + areas/
│   ├── calidad/                6 paneles
│   ├── mantenimiento/          12 paneles (DEMO data-mock)
│   ├── almacen/                stock, materiales
│   └── rrhh/                   sistema RRHH
│
├── apps/                   Apps standalone (con auth-guard)
│   ├── _shared/                auth-guard.js
│   ├── registro-produccion/
│   ├── registro-personal/
│   ├── registro-tuneles/
│   ├── registro-costos/
│   └── empaque-congelado/
│
├── dashboards/             Dashboards TV wall standalone
│
├── config/
│   ├── navigation.json         Sidebar del portal (estructura)
│   └── roles.json              RBAC: modulos, panels, apps, actions por rol
│
├── scripts/                Scripts operacionales
│   └── backup/                 Backup Supabase a JSON
│
└── docs/                   Documentacion
    ├── SECURITY.md             Politicas seguridad (ISO 27001, BRCGS, FDA)
    ├── ARCHITECTURE.md         Arquitectura tecnica
    ├── OPERATIONS.md           Runbook operacional
    ├── ONBOARDING.md           Este archivo
    ├── INCIDENT_RESPONSE.md    Runbook IR detallado
    ├── THREAT_MODEL.md         STRIDE + mitigaciones
    ├── COMPLIANCE.md           Calendario compliance + templates
    ├── CLOUDFLARE_SETUP.md     Guia proxy gratis
    └── SENTRY_SETUP.md         Guia observabilidad
```

## 4. Convenciones de codigo

Ver [CLAUDE.md](../CLAUDE.md) del proyecto. Resumen:

- **CSS**: kebab-case, BEM simplificado (`.card`, `.card-header`, `.card-title`)
- **JS**: camelCase variables, UPPER_SNAKE_CASE constantes
- **IDs paneles**: kebab-case (`panel-produccion-dia`)
- **Modulos**: cada panel tiene `{id}.html` (template) y `{id}.js` (logica con `init(container)`)

## 5. Como funciona el routing

1. `portal.html` carga `app.js`
2. `app.js` lee `config/navigation.json` y construye sidebar
3. Click en nav-item -> `router.js showPanel(panelId, modulePath)`
4. Router fetch `modules/<path>.html` + `modules/<path>.js`
5. Llama `module.init(panelWrapper)`
6. Panel anterior se oculta + `onHide()` se llama + charts se destruyen

## 6. Debugging con DevTools

### Console

- `window.__FTP_PROD_MODE` — true en produccion (logs sanitizados)
- `window.__activeCharts` — Set de Chart.js activos
- `window.__auditOk`, `window.__ftpAuthMode` — auth state

### Network

- Requests a `*.supabase.co/rest/v1/*` — REST API
- Requests a `*.supabase.co/auth/v1/*` — Auth
- WebSocket a `wss://*.supabase.co/realtime/v1/*` — Realtime

### Application

- LocalStorage: `sb-<ref>-auth-token` — JWT Supabase
- LocalStorage: `ftp_theme` — preferencia tema
- SessionStorage: `ftp_logged_in`, `ftp_login_attempts`

## 7. Workflow tipico de cambio

```bash
# 1. Crear branch
git checkout -b fix/nombre-descriptivo

# 2. Editar archivos relevantes
# 3. Probar LOCAL con Live Server

# 4. Si cambio assets importantes: bump SW cache
# Editar sw.js -> CACHE_NAME = 'ftp-portal-vN+1'
# Editar assets/js/core/router.js -> BUILD_VERSION = 'N+1'

# 5. Commit + push
git add -A
git commit -m "Descripcion clara"
git push origin fix/nombre-descriptivo

# 6. Merge a main via PR (o directo si es urgente y trivial)
git checkout main
git merge fix/nombre-descriptivo
git push origin main

# 7. Esperar ~1 min para GitHub Pages deploy
# 8. Verificar en produccion: https://rodrigo17312016-jpg.github.io/portal-gerencia-ftp/
```

## 8. Primeras 5 tareas recomendadas al entrar

1. **Leer** [SECURITY.md](SECURITY.md), [ARCHITECTURE.md](ARCHITECTURE.md), [OPERATIONS.md](OPERATIONS.md)
2. **Probar login local** con tus credenciales Supabase
3. **Navegar cada modulo** para entender el UI
4. **Revisar el audit log** (`panel-audit`) para ver actividad reciente
5. **Hacer un cambio trivial** (texto, comentario) y deployar para validar workflow

## 9. Contactos

- **Mantenedor actual**: Rodrigo Garcia — rodrigo17312016@gmail.com
- **Admin Supabase**: Rodrigo Garcia
- **Owner GitHub repo**: rodrigo17312016-jpg

## 10. Que NO hacer (gotchas)

- NO commitear `service_role_key` de Supabase — solo usar anon keys en frontend
- NO tocar `audit_log` directamente (trigger se encarga)
- NO modificar `config_costos` sin entender impacto (afecta calculos de rendimiento)
- NO desactivar RLS en ninguna tabla — siempre agregar policy apropiada
- NO saltar bump de SW cache cuando cambias assets (usuarios ven version vieja)

## 11. Recursos

- Supabase Docs: https://supabase.com/docs
- Chart.js Docs: https://www.chartjs.org/docs/latest/
- RFC 6238 (TOTP 2FA): https://datatracker.ietf.org/doc/html/rfc6238
- OWASP Top 10: https://owasp.org/www-project-top-ten/
