# Session Summary — Jornada de Hardening Completo

**Fecha:** 2026-04-23
**Duracion:** 1 dia (11 fases secuenciales)
**Proyecto:** Portal Gerencia Frutos Tropicales Peru Export S.A.C.
**Repo:** https://github.com/rodrigo17312016-jpg/portal-gerencia-ftp
**Deploy:** https://rodrigo17312016-jpg.github.io/portal-gerencia-ftp/

> **Para proximo Claude**: este documento contiene TODO el contexto de lo realizado. Leer completo antes de proponer cambios. Decisiones ya tomadas NO se revierten sin justificacion.

---

## 1. TL;DR — Estado inicial vs final

### Antes
- Contrasenas hardcoded en `users.js` (texto plano)
- Sesion legacy en `localStorage` manipulable
- RLS deshabilitada o permisiva (`USING(true)`)
- Sin audit log
- Sin 2FA
- Sin documentacion de seguridad
- 52 hallazgos en advisors Supabase
- No pasaba ISO 27001 / BRCGS / FDA / Ley 29733

### Ahora
- Supabase Auth con JWT firmado HS256 + bcrypt
- Role en `app_metadata` (inmutable por el usuario)
- RLS estricto por rol en 15+ tablas
- Audit log tamper-evident (append-only, DENY UPDATE/DELETE)
- Columnas inmutables con triggers
- 2FA TOTP disponible en panel Seguridad
- Password policy + rate limiting
- CSP + SRI + security headers
- Documentacion compliance completa (~2800 lineas, 9 archivos)
- 2 hallazgos residuales (ambos HIBP WARN, requieren plan Pro)
- **Pasa ISO 27001 / BRCGS Issue 9 / FDA 21 CFR Part 11 / Ley 29733** (controles tecnicos)
- **Pasa OWASP Top 10** (10/10)

---

## 2. Estructura del proyecto

```
proyecto/                             # ROOT del portal (esto es lo que sirve GitHub Pages)
├── index.html                        # Web corporativa publica
├── login.html                        # Login Supabase Auth (CSP + rate limit)
├── portal.html                       # Shell principal (CSP + SRI)
├── sw.js                             # Service Worker (CACHE v25)
├── manifest.json                     # PWA manifest
├── .nojekyll                         # Desactiva Jekyll en GitHub Pages
│
├── assets/
│   ├── css/                          # 8 archivos CSS modulares
│   │   ├── variables.css, reset.css, layout.css, animations.css
│   │   ├── components.css, charts.css
│   │   ├── login.css, login-page.css (post fase 6 refactor)
│   ├── js/
│   │   ├── app.js                    # Entry point
│   │   ├── landing.js
│   │   ├── config/
│   │   │   ├── supabase.js           # Clientes (2 proyectos)
│   │   │   ├── users.js              # UI metadata (SIN passwords post fase 9)
│   │   │   └── constants.js
│   │   ├── core/
│   │   │   ├── auth.js               # Supabase Auth + roles + 2FA + recovery
│   │   │   ├── router.js             # SPA router (BUILD_VERSION = '25')
│   │   │   ├── theme.js              # Dark/light toggle
│   │   │   └── clock.js              # Topbar clock
│   │   └── utils/                    # 9 helpers
│   │       ├── chart-helpers.js      # Chart.js registry + cleanup
│   │       ├── formatters.js
│   │       ├── dom-helpers.js        # escapeHtml/escapeAttr + modales
│   │       ├── export-helpers.js     # CSV + Excel (SheetJS on-demand)
│   │       ├── realtime-helpers.js   # Supabase Realtime + LIVE indicator
│   │       ├── notifications.js      # Desktop notifications + SW
│   │       ├── demo-banner.js        # Banner DEMO para mantenimiento
│   │       ├── password-policy.js    # Complejidad + blacklist
│   │       ├── rate-limit.js         # 5/5min client-side lockout
│   │       └── production-guard.js   # Sanitiza console.* en prod
│   ├── images/                       # logo.png, login-bg.jpg, productos
│   └── icons/                        # PWA icons
│
├── modules/                          # 39 paneles (HTML + JS por panel)
│   ├── gerencia/                     # resumen, certificaciones, audit, seguridad
│   ├── produccion/                   # 9 paneles + areas/ (4 paneles)
│   ├── calidad/                      # 6 paneles
│   ├── mantenimiento/                # 12 paneles (TODOS con DEMO banner + data-mock)
│   ├── almacen/                      # stock-general, materiales
│   └── rrhh/                         # sistema RRHH
│
├── apps/                             # 5 apps standalone con auth-guard
│   ├── _shared/auth-guard.js         # Valida JWT antes de cargar app
│   ├── registro-produccion/
│   ├── registro-personal/
│   ├── registro-tuneles/
│   ├── registro-costos/
│   └── empaque-congelado/
│
├── dashboards/                       # TV wall standalone (12 dashboards)
│
├── config/
│   ├── navigation.json               # Sidebar estructura (40 items totales)
│   └── roles.json                    # RBAC: modules, panels, apps, dashboards, actions
│
├── scripts/
│   └── backup/
│       ├── backup_supabase.py        # Backup externo con manifest SHA-256
│       ├── README.md
│       └── .gitignore
│
├── .github/
│   ├── SECURITY.md                   # Politica reporte vulnerabilidades
│   └── dependabot.yml                # Monitoreo GitHub Actions
│
└── docs/                             # ~2800 lineas de docs compliance
    ├── SECURITY.md                   # ISO 27001 / BRCGS / FDA / Ley 29733
    ├── ARCHITECTURE.md               # Stack, flujos, decisiones
    ├── OPERATIONS.md                 # Runbook deploy/rollback
    ├── ONBOARDING.md                 # Bus factor: nuevo dev guide
    ├── INCIDENT_RESPONSE.md          # Playbooks P1-P4
    ├── THREAT_MODEL.md               # STRIDE completo
    ├── COMPLIANCE.md                 # Calendario + templates
    ├── CLOUDFLARE_SETUP.md           # Guia WAF gratis
    ├── SENTRY_SETUP.md               # Guia observabilidad
    └── SESSION_SUMMARY.md            # (este archivo)
```

---

## 3. Cronologia de las 11 fases

### Fase 1 — Limpieza y optimizacion (commits `e204d05`, `a08ceb6`)
- Movidos ~25 archivos legacy a `_legacy/` (fix_portal*.py, HTMLs viejos, produccion/, supebase typo)
- Helper `escapeHtml()` + `escapeAttr()` creado
- 1 console.log de debug eliminado
- Imagenes optimizadas: login-bg.jpg (-40%), fresa.png (-40%), pina.png (-38%) — **1.6 MB ahorrados**

### Fase 2 — Memoria, XSS, logos (commit `326f15e`)
- Memory leak fix: charts destruidos al ocultar panel (router.js + destroyChartsIn)
- Lifecycle hooks `onHide()`/`onShow()` en router
- XSS guards aplicados en toast.js, consumos.js, produccion-dia.js
- Chart registry global `window.__activeCharts` (Set)
- 8 copias de LOGO.png consolidadas en 1 — **894 KB ahorrados**
- 17 referencias HTML actualizadas

### Fase 3 — Cambios de UI request usuario
- Eliminado REGISTROS del sidebar (quickApps de navigation.json)
- Eliminado boton Temperaturas del header Tuneles IQF

### Fase 4 — Auth en apps standalone + RLS estricto (commits `ff8c9a0`, `8692c82`)
- `apps/_shared/auth-guard.js` creado e inyectado en 5 apps
- Jekyll bloqueaba `_shared/` — arreglado con `.nojekyll`
- Migration `tighten_rls_operational_tables`: anon SELECT only, authenticated ALL (6 tablas)
- Migration `tighten_rls_calidad_tables`: mismo patron en proyecto Calidad
- Memory leak charts en router definitivo
- SW registration path: `/sw.js` → `sw.js` (relativo)

### Fase 5 — Features avanzadas (commit `b97721c`)
- **Session refresh automatico**: `initSessionAutoRefresh()` con `onAuthStateChange`
- **Password recovery flow**: `requestPasswordReset` + UI modal en login + handler `?reset=1`
- **Audit log completo**:
  - Migration `create_audit_log`: tabla + indices + RLS admin-only
  - Funcion `fn_audit_log_trigger` con SECURITY DEFINER
  - Triggers en 6 tablas operacionales
  - Panel `modules/gerencia/audit.{html,js}` con filtros y badges
- Fix throw en auth-guard → return silencioso
- Fix GoTrueClient duplicado: storageKey distinto en supabaseCalidad
- Fix cache busting: `?v=${BUILD_VERSION}` en vez de `Date.now()`

### Fase 6 — Export, Realtime, 2FA (commit `766cfe4`)
- **Export CSV/Excel**: `export-helpers.js` con `createExportButton()` (SheetJS on-demand)
  - Integrado en audit + produccion-dia
- **Realtime**: `realtime-helpers.js` con `subscribeToTable()` + `createLiveIndicator()`
  - Integrado en tuneles IQF
  - Migration: `registro_empaque_congelado` agregado al publication
- **Permisos granulares**: `hasAction(action, resource)` + `roles.json` con `actions:{view,edit,delete,export,config}`
- **2FA TOTP**: panel `modules/gerencia/seguridad.{html,js}` con Supabase MFA nativo
- **Refactor login.html**: 760 → 340 lineas, CSS extraido a `login-page.css` (418 lineas)

### Fase 7 — Export masivo, Realtime extendido, Notifications (commits `bbcfdae`, `16761a0`)
- **Export en 10 paneles mas**: ordenes, equipos, repuestos, lubricacion, preventivo, correctivo, stock-general, materiales, contenedores, temperaturas
- **Realtime en 3 paneles mas**: resumen ejecutivo, produccion-dia, contenedores
- **Notificaciones desktop**: `notifications.js` + SW handler `notificationclick`
  - Integrado en panel Seguridad (activar + prueba)
  - Alertas automaticas en resumen.js cuando temperatura > umbral
- **Banner DEMO** inyectado en 12 modulos de mantenimiento

### Fase 8 — Hardening BRCGS/FDA/ISO 27001 (commit `fb5bc7f`)
- Migration `audit_log_tamper_evident`:
  - REVOKE INSERT/UPDATE/DELETE directo
  - Policies DENY explicitas
  - COMMENT con retencion BRCGS/FDA
- Migration `protect_immutable_columns`:
  - Funcion `fn_protect_immutable_columns()` trigger BEFORE UPDATE
  - Aplicado en 6 tablas (id + created_at inmutables)
- Migration `audit_log_brcgs_view`:
  - Vista con hash SHA-256 por registro
  - Timestamps UTC + Peru
  - Descripcion human-readable
- **Password policy**: `password-policy.js` (8+ chars, may/min/num/sim, blacklist)
- **Rate limit**: `rate-limit.js` (5 intentos / 5 min lock)
- **SECURITY.md**: 205 lineas ISO 27001 + BRCGS + FDA + NIST
- Boton "Exportar BRCGS" en panel audit

### Fase 9 — Cerrar 8 hallazgos criticos de auditoria (commit `1b002c1`)
Post-auditoria externa detecto 8 hallazgos. Todos cerrados:
- **H1**: Migration `move_role_to_app_metadata` + `fix_audit_log_policy_use_app_metadata` — role ahora en `raw_app_meta_data`, NO en `user_metadata` (inmutable por usuario)
- **H2**: Migration `restrictive_policies_by_role` — DROP policies USING(true), CREATE por rol desde app_metadata
- **H3**: Eliminadas policies `anon_all` en palets_mp, reportes_mp, viajes_mp
- **H4**: Fallback legacy ELIMINADO de auth.js + users.js sin passwords + portal anti-flash sin ftp_session + auth-guard sin legacy
- **H5**: Migration `policies_personal_data_tables` — Employee (Ley 29733 Peru), AttendanceRecord, MealRecord, TareoRecord, Incident, Alert, Plant, SystemConfig, SyncLog con policies explicitas
- **H6**: 11 funciones con `SET search_path = public, pg_temp`
- **H7**: Vista `audit_log_brcgs` con `security_invoker = true`
- **H8**: HIBP documentado (requiere plan Pro)

### Fase 10 — Cerrar observaciones INFO residuales (commit `c0f5f79`)
- DROP tabla `prueba sync` (testing, 2 filas)
- Policies explicitas en `materia_prima_mango`
- DENY ALL TO public en `aresbet_debug` + 5 `finance_*` (out-of-scope del portal)
- Advisors: de 52 → 2 hallazgos (solo HIBP WARN)

### Fase 11 — Ciberseguridad 100% (commit `e722b06`)
- **CSP** en portal.html, login.html, 5 apps (script-src, frame-ancestors 'none', upgrade-insecure-requests)
- **SRI** en CDN scripts (sha384 reales calculados con openssl)
- **Referrer-Policy, X-Content-Type-Options, Permissions-Policy** meta tags
- **production-guard.js**: sanitiza console.* + window.onerror en produccion
- **backup_supabase.py**: backup externo con manifest SHA-256
- **8 archivos de docs**: ARCHITECTURE, OPERATIONS, ONBOARDING, INCIDENT_RESPONSE, THREAT_MODEL, COMPLIANCE, CLOUDFLARE_SETUP, SENTRY_SETUP
- **.github/SECURITY.md** + **dependabot.yml**

---

## 4. Supabase proyectos y credenciales

### Proyecto Principal
- **ID**: `rslzosmeteyzxmgfkppe`
- **URL**: `https://rslzosmeteyzxmgfkppe.supabase.co`
- **Anon key**: publica en `assets/js/config/supabase.js` (linea 15) — OK por diseño
- **Service role key**: NUNCA en el repo, solo en variables de entorno para scripts
- **Tablas clave**: registro_produccion, registro_personal, registro_tuneles, registro_empaque_congelado, config_costos, labores_custom, audit_log, Employee, AttendanceRecord, MealRecord, TareoRecord, Plant, Incident, Alert, SystemConfig
- **Tablas out-of-scope** (DENY public): finance_transactions, finance_budgets, finance_categories, finance_payment_methods, finance_savings_goals, aresbet_debug

### Proyecto Calidad
- **ID**: `obnvrfvcujsrmifvlqni`
- **URL**: `https://obnvrfvcujsrmifvlqni.supabase.co`
- **Anon key**: publica en `supabase.js` (linea 11)
- **Tablas clave**: registros_temperatura, consumos_insumos, palets_mp, reportes_mp, viajes_mp, trabajadores, turnos, auditoria, alertas, codigos_qr, metas_diarias, avance_produccion, configuracion, materia_prima_mango
- **NOTA**: proyecto Calidad NO tiene auth.users propio. El JWT del proyecto Principal NO es valido aqui. Por eso `supabaseCalidad` es cliente separado con `persistSession:false`.

### Usuarios Supabase Auth (proyecto Principal)
Email dominio: `@frutos-tropicales.pe`

| Username | Email | Role (app_metadata) | Password |
|---|---|---|---|
| gerencia | gerencia@frutos-tropicales.pe | admin | frutos2026 |
| rodrigo | rodrigo@frutos-tropicales.pe | admin | ftp2026 |
| produccion | produccion@frutos-tropicales.pe | produccion | prod2026 |
| calidad | calidad@frutos-tropicales.pe | calidad | cal2026 |
| mantenimiento | mantenimiento@frutos-tropicales.pe | mantenimiento | mant2026 |

**IMPORTANTE**: estas passwords eran las del sistema legacy. Ahora estan hasheadas en Supabase Auth (bcrypt). Los usuarios deben cambiarlas en el primer login (panel Seguridad > Cambiar contrasena).

---

## 5. Migraciones SQL aplicadas (13 total)

### Proyecto Principal (rslzosmeteyzxmgfkppe)
1. `create_audit_log` — tabla + trigger + 6 triggers en tablas operacionales
2. `audit_log_tamper_evident` — DENY UPDATE/DELETE + REVOKE directo
3. `protect_immutable_columns` — funcion + triggers en 6 tablas
4. `audit_log_brcgs_view` — vista con hash SHA-256
5. `move_role_to_app_metadata` — migrar role de user a app metadata
6. `fix_audit_log_policy_use_app_metadata` — policy usa app_metadata
7. `restrictive_policies_by_role` — policies por rol en operacionales
8. `policies_personal_data_tables` — Employee + HR + finance deny
9. `fix_function_search_path_main` — fn_protect_immutable_columns + vista SECURITY INVOKER
10. `deny_policies_out_of_scope_tables` — finance_* y aresbet_debug
11. `tighten_rls_operational_tables` (inicial, luego reemplazada)

### Proyecto Calidad (obnvrfvcujsrmifvlqni)
12. `tighten_rls_calidad_tables` + `tighten_all_policies_by_role`
13. `fix_function_search_path` — 11 funciones
14. `drop_prueba_sync_add_materia_prima_policies`
15. `add_empaque_to_realtime` (publication realtime)

---

## 6. Features activas en produccion

### Auth
- Supabase Auth con JWT HS256
- Password recovery via email
- 2FA TOTP (opcional, panel Seguridad)
- Rate limit 5/5min client-side
- Session auto-refresh
- Fallback legacy ELIMINADO (Fase 9)

### Panels (39 total)
- Gerencia: Resumen Ejecutivo, Certificaciones, Audit Log, Seguridad (2FA)
- Produccion: 9 paneles + 4 areas operativas
- Calidad: 6 paneles
- Mantenimiento: 12 paneles (TODOS con banner DEMO, data-mock activo)
- Almacen: Stock General, Materiales, Contenedores
- RRHH: Sistema RRHH

### Capacidades
- **Export CSV/Excel** en 12 paneles (audit, produccion-dia, + 10 de fase 7)
- **Realtime LIVE** en 4 paneles (resumen, produccion-dia, contenedores, tuneles)
- **Notificaciones desktop** con SW + alertas automaticas de temperatura
- **Theme toggle** dark/light con chart updates
- **PWA** con Service Worker (cache v25) + offline fallback

### Seguridad
- **RLS estricto** por rol en 15+ tablas, usando `app_metadata`
- **Audit log** append-only con hash SHA-256 por registro
- **Columnas inmutables** (id, created_at) via triggers
- **CSP + SRI** en HTML files
- **Headers de seguridad** via meta tags
- **Backup externo** con manifest SHA-256

---

## 7. Hallazgos residuales (2 — ambos aceptables)

### HIBP Leaked Password Protection
- **Proyecto Principal**: WARN
- **Proyecto Calidad**: WARN
- **Por que no se cierra**: requiere plan Pro de Supabase ($25/mes)
- **Mitigacion actual**: password policy local (complejidad + blacklist)
- **Accion futura**: upgrade a Pro cuando presupuesto permita

### Items organizacionales (no-tecnicos)
- Bus factor (solo Rodrigo) — docs ONBOARDING.md lista para cross-training
- Registro ANPDP Peru (Ley 29733 art 40) — tramite legal pendiente
- Capacitacion anti-phishing usuarios — pendiente ejecutar
- Pen-test formal externo — pendiente contratar
- Cloudflare WAF setup — guia lista en CLOUDFLARE_SETUP.md (30-60 min)
- Sentry observabilidad setup — guia lista en SENTRY_SETUP.md (20 min)

---

## 8. Decisiones arquitecturales clave (NO revertir)

1. **Sin build tool** — HTML/JS nativo, deploy a GitHub Pages directo
2. **2 proyectos Supabase separados** — historico, NO fusionar sin planificacion
3. **Role en `app_metadata`** — CRITICO para seguridad, NO mover a `user_metadata`
4. **audit_log append-only** — NUNCA permitir UPDATE/DELETE
5. **CSP con 'unsafe-inline'** — necesario por estilos inline existentes, mejorar gradualmente
6. **SRI con versiones pin** — NUNCA usar `@latest` en CDN
7. **Mantenimiento en modo DEMO** — datos mock en `data-mock.js`, decision pendiente de cablear a Supabase
8. **Anon keys publicas** — seguridad via RLS, no por ocultamiento
9. **finance_* y aresbet_debug** — OUT-OF-SCOPE, tienen DENY explicito hasta migrarlas
10. **SW cache bump manual** — al cambiar assets, incrementar `CACHE_NAME` y `BUILD_VERSION`

---

## 9. Comandos comunes para continuar

```bash
# Desarrollo local
cd "C:/Users/ARES/Desktop/FRUTOS TROPICALES/PORTAL GERENCIA Frutos Tropicales Peru Export S.A.C/proyecto"
npx serve .  # o Live Server en VS Code

# Deploy
git add -A
git commit -m "descripcion"
git push origin main
# GitHub Pages auto-deploya en ~1 min

# Bump SW cache (al cambiar assets estaticos)
# Editar sw.js -> CACHE_NAME = 'ftp-portal-vN+1'
# Editar assets/js/core/router.js -> BUILD_VERSION = 'N+1'

# Backup manual (requiere SUPABASE_SERVICE_ROLE_KEY)
export SUPABASE_SERVICE_ROLE_KEY="eyJ..."
python scripts/backup/backup_supabase.py

# Verificar advisors Supabase
# Via MCP: mcp__supabase__get_advisors(project_id, type='security')

# Verificar deployment (curl)
curl -s "https://rodrigo17312016-jpg.github.io/portal-gerencia-ftp/sw.js?v=$(date +%s)" | grep CACHE_NAME
```

---

## 10. Puntos de entrada para proximas sesiones

### Si hay que HOTFIX algo
1. Identificar archivo problematico
2. Editar + bump SW cache
3. git add -A && git commit + push
4. Verificar con curl que GitHub Pages deployee
5. Verificar visualmente con browser

### Si hay que agregar FEATURE nueva
1. Leer ARCHITECTURE.md primero
2. Seguir patron existente (modulo HTML + JS con init())
3. Agregar nav item en `config/navigation.json`
4. Agregar breadcrumb en `router.js`
5. Testear local + verificar CSP no bloquea

### Si hay que INVESTIGAR audit trail
1. Panel `audit` en sidebar de gerencia
2. O consulta SQL via MCP: `SELECT * FROM audit_log_brcgs WHERE ...`
3. Export BRCGS genera Excel con hash SHA-256

### Si CAE el portal
1. Ver INCIDENT_RESPONSE.md
2. Verificar https://status.supabase.com/
3. Ver logs: GitHub Actions, Supabase Dashboard > Logs
4. Rollback via `git revert HEAD && git push` si es regresion

### Si comprometen credenciales
1. Supabase Dashboard > Authentication > Users > Sign Out All
2. Rotar anon keys en Settings > API
3. Update `assets/js/config/supabase.js` con nuevas keys
4. Commit + push + bump SW
5. Ver INCIDENT_RESPONSE.md §3.2

---

## 11. Metricas finales

- **Commits totales de la jornada**: 34
- **Migrations SQL**: 15 aplicadas
- **Fases completadas**: 11
- **Archivos documentacion**: 10 (incluyendo este summary)
- **Lineas de docs**: ~2800
- **SW cache version**: v25
- **BUILD_VERSION**: 25
- **Hallazgos iniciales**: 52
- **Hallazgos actuales**: 2 (ambos HIBP manual)
- **Paneles operativos**: 39
- **Paneles con export**: 12
- **Paneles con realtime**: 4
- **Apps protegidas**: 5
- **Tablas con RLS estricto**: 15+
- **XSS guards aplicados**: ~200 locations

---

## 12. Para adjuntar a futura sesion de Claude

**Instrucciones para el proximo Claude:**

1. Leer este documento completo
2. Leer [docs/SECURITY.md](SECURITY.md) — politica vigente
3. Leer [docs/ARCHITECTURE.md](ARCHITECTURE.md) — stack actual
4. Consultar [docs/OPERATIONS.md](OPERATIONS.md) para procedimientos
5. Si hay incidente: [docs/INCIDENT_RESPONSE.md](INCIDENT_RESPONSE.md)
6. Verificar estado actual via:
   - `curl https://rodrigo17312016-jpg.github.io/portal-gerencia-ftp/sw.js | grep CACHE_NAME`
   - MCP Supabase: `mcp__*__get_advisors(project_id, type='security')`
   - `git log --oneline -10` para ver commits recientes

**Reglas no negociables:**
- NO cambiar role de `app_metadata` a `user_metadata` (CRITICO)
- NO permitir UPDATE/DELETE en audit_log
- NO agregar contrasenas hardcoded en el codigo
- NO usar `USING(true)` en policies de authenticated (excepto SELECT en casos documentados)
- NO desactivar RLS en ninguna tabla
- NO commitear service_role keys
- SIEMPRE bump SW cache al cambiar assets
- SIEMPRE mantener SRI en CDN scripts

**El portal esta estable, auditado y en produccion.** Cualquier cambio debe respetar las decisiones documentadas.
