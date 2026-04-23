# Arquitectura - Portal Frutos Tropicales Peru Export S.A.C.

**Version:** 1.0
**Fecha:** 2026-04-23
**Autor:** Rodrigo Garcia
**Audiencia:** Developers, arquitectos, auditores tecnicos

---

## 1. Vision general

El Portal de Gerencia es una Single Page Application (SPA) desplegada como sitio estatico en GitHub Pages, con persistencia y autenticacion delegadas a Supabase (Backend as a Service). No existe servidor propio, no existe build tool. Todo el codigo ejecutable se entrega tal cual al browser del usuario.

Ventajas clave:
- Cero costo de hosting (GitHub Pages gratis, Supabase free tier suficiente)
- Rollback trivial (git revert)
- Actualizacion en segundos (push a main)
- Sin vendor lock-in pesado (Supabase es Postgres + PostgREST estandar)

---

## 2. Stack tecnico completo

### 2.1 Frontend

| Capa | Tecnologia | Version | Notas |
|---|---|---|---|
| Markup | HTML5 | - | Semantico, validado W3C |
| Estilos | CSS3 | - | Variables nativas, sin preprocesador |
| Logica | Vanilla JavaScript | ES2020+ | Imports nativos del browser |
| PWA | Service Worker | - | Cache-first para assets estaticos |
| Modules | ES Modules | - | `<script type="module">` + imports nativos |

No se usa: React, Vue, Angular, webpack, rollup, babel, npm build. La eleccion es intencional: simplicidad, portabilidad y curva de aprendizaje baja.

### 2.2 Backend

| Capa | Tecnologia | Proyecto |
|---|---|---|
| Base de datos | PostgreSQL 15 (via Supabase) | 2 proyectos |
| Autenticacion | Supabase Auth (gotrue) | `rslzosmeteyzxmgfkppe` |
| Autorizacion | Row Level Security (RLS) nativo | Ambos |
| Realtime | Supabase Realtime (opcional) | `rslzosmeteyzxmgfkppe` |
| Audit | Triggers + tabla `audit_log` | `rslzosmeteyzxmgfkppe` |

### 2.3 Dependencias externas (CDN)

| Libreria | CDN | Uso |
|---|---|---|
| `@supabase/supabase-js@2` | jsDelivr ESM | Cliente DB + Auth |
| `chart.js@4.4.0` | jsDelivr | Graficos de todos los paneles |
| `chartjs-plugin-datalabels` | jsDelivr | Etiquetas sobre graficos |
| `xlsx` (SheetJS) | CDN | Export Excel de reportes |
| `qrserver.com` API | goqr.me | Generacion QR apps registro |

Ninguna dependencia es privada o requiere auth. Si cualquier CDN cayera, el portal degradaria: los graficos no se renderizarian pero los datos de las tablas si.

### 2.4 Deploy

| Item | Detalle |
|---|---|
| Hosting | GitHub Pages (rama `main`, carpeta root) |
| DNS | Default `*.github.io` (puede ponerse custom) |
| TLS | Automatico via GitHub (Let's Encrypt) |
| CDN | El de GitHub (global) |

---

## 3. Diagrama de componentes

```
                    ┌─────────────────────────────────────┐
                    │       Usuario (browser)             │
                    │  Chrome / Firefox / Edge / Safari   │
                    └──────────────┬──────────────────────┘
                                   │ HTTPS
                                   ▼
          ┌────────────────────────────────────────────────┐
          │  GitHub Pages (CDN global, TLS automatico)     │
          │  ───────────────────────────────────────────── │
          │   index.html    login.html    portal.html      │
          │   assets/css/*  assets/js/*   config/*.json    │
          │   modules/**    apps/**       dashboards/**    │
          │   sw.js (service worker cache-first)           │
          └────────┬───────────────────────────────────────┘
                   │
                   │ ESM imports (cache agresivo del browser)
                   ▼
        ┌──────────────────────┐      ┌──────────────────────┐
        │  jsDelivr / CDN      │      │  qrserver.com        │
        │  ─────────────────   │      │  ─────────────────   │
        │  supabase-js@2       │      │  QR generation       │
        │  chart.js@4.4.0      │      │  (apps registro)     │
        │  xlsx (SheetJS)      │      └──────────────────────┘
        │  chartjs-datalabels  │
        └──────────────────────┘
                   │
                   │ HTTPS + JWT (Bearer) + RLS
                   ▼
      ┌──────────────────────────────────────────────────────┐
      │   Supabase Proyecto 1 (rslzosmeteyzxmgfkppe)         │
      │   "Principal / Produccion"                           │
      │   ─────────────────────────────────────────────────  │
      │   - auth.users  (gotrue)                             │
      │   - registro_produccion                              │
      │   - registro_personal                                │
      │   - registro_tuneles                                 │
      │   - registro_empaque_congelado                       │
      │   - config_costos, labores_custom                    │
      │   - audit_log + audit_log_brcgs (vista)              │
      │   - RLS habilitada en todas las tablas               │
      └──────────────────────────────────────────────────────┘
                   │
                   │ (fetch paralelo para datos de calidad)
                   ▼
      ┌──────────────────────────────────────────────────────┐
      │   Supabase Proyecto 2 (obnvrfvcujsrmifvlqni)         │
      │   "Calidad"                                          │
      │   ─────────────────────────────────────────────────  │
      │   - registros_temperatura                            │
      │   - consumos_insumos                                 │
      │   - RLS: lectura publica con anon key                │
      └──────────────────────────────────────────────────────┘
```

### 3.1 Por que dos proyectos Supabase

Historico. El proyecto de Calidad existio primero (data de temperaturas/consumos subida desde hojas Excel). Cuando se creo el portal de Produccion, se decidio mantener separado para no mezclar schemas.

Trade-offs aceptados:
- Dos anon keys que viajan en el bundle (aceptable, publicas por diseño)
- Sin JOIN nativo entre proyectos (se hace client-side cuando hace falta, raro en la practica)
- Beneficio: aislamiento de blast radius si uno se compromete

---

## 4. Flujo de autenticacion

```
┌────────────┐    username +    ┌────────────┐
│  login.html│ ───password────► │  auth.js   │
└────────────┘                  └─────┬──────┘
                                      │ username@frutos-tropicales.pe
                                      ▼
                              ┌────────────────┐
                              │ supabase.auth  │
                              │ .signInWith    │
                              │   Password()   │
                              └───────┬────────┘
                                      │ valida con bcrypt
                                      ▼
                              ┌────────────────┐
                              │  JWT firmado   │
                              │  (HS256)       │
                              │  + refresh tok │
                              └───────┬────────┘
                                      │
                                      │ localStorage
                                      │ 'sb-rslzos...-auth-token'
                                      ▼
                              ┌────────────────┐
                              │  app.js pide   │
                              │  getSession()  │
                              └───────┬────────┘
                                      │
                                      │ role desde
                                      │ app_metadata
                                      ▼
                              ┌────────────────┐
                              │  router.js     │
                              │  hasAccess()?  │
                              └───────┬────────┘
                                      │
                                      ▼
                          ┌────────────────────────┐
                          │  Render panel + data   │
                          │  JWT auto-incluido en  │
                          │  cada query Supabase   │
                          │  RLS evalua y filtra   │
                          └────────────────────────┘
```

Detalles criticos:
- **Email sintetico:** el usuario escribe `rodrigo`, se convierte a `rodrigo@frutos-tropicales.pe` antes de llamar a Supabase. Esto permite UX de "login con username" sin apartar de la API estandar de gotrue.
- **Role autoritativo:** SIEMPRE `raw_app_meta_data.role`. El `user_metadata` es solo para display y es editable por el usuario desde la UI (no confiable).
- **RLS fuente unica de verdad:** el frontend nunca decide si algo se puede leer/escribir. Se intenta, y RLS bloquea. El frontend solo oculta UI para no confundir al usuario.

---

## 5. Flujos de datos principales

### 5.1 Produccion (registro horario de kg procesados)

```
App "registro-produccion"         Supabase
─────────────────────────────     ──────────────────────
 Operario escanea QR en tablet
 Entra a apps/registro-produccion
 auth-guard.js valida sesion
 Escribe: hora, kg, producto
        │
        │ supabase.from('registro_produccion')
        │   .insert({...})
        ▼
                            RLS check (authenticated, WITH CHECK)
                            Trigger fn_audit_log dispara
                                │
                                ▼
                            audit_log INSERT automatico
                                │
                            Respuesta 201
        │
        ▼
 Toast "Guardado" + refresh tabla
        │
 Realtime channel (opcional) notifica
 a dashboards de gerencia abiertos
        │
        ▼
 modules/produccion/indicadores.js
 modules/produccion/produccion-dia.js
 refrescan charts automaticamente
```

### 5.2 Calidad (temperaturas tuneles IQF)

```
Tableta operario
(carga ya subida via Excel
 o app dedicada en el futuro)
        │
        ▼
 Supabase proyecto calidad
  registros_temperatura
        │
 modules/calidad/temperaturas.js
        │ anon key + SELECT (RLS allow)
        ▼
 Chart.js linea en tiempo real
 Alertas desktop si fuera de -18 a -22 C
 (via notifications.js)
```

### 5.3 Mantenimiento (ordenes de trabajo + dashboard TV wall)

```
modules/mantenimiento/ordenes.js
        │
        ▼ (actualmente data mock en data-mock.js)
 Renderiza tabla + KPIs
        │
 dashboards/mantenimiento.html
 muestra en TV wall del taller
 (auto-refresh cada 60s)
```

Nota: mantenimiento opera sobre data mock por diseño actual. Tablas Supabase pendientes en fase futura.

---

## 6. Decisiones arquitecturales (ADRs resumidos)

### ADR-001: Sin build tool

**Decision:** No usar webpack/vite/rollup.
**Justificacion:** El proyecto tiene ~50 archivos JS, la complejidad no lo amerita. Debugging directo en DevTools sin source maps. Cualquier developer puede abrir y entender sin cadena de tooling.
**Trade-off:** No arbol-shaking, no minificacion. Bundle mas grande (~500 KB descomprimido). Aceptable para portal interno.

### ADR-002: GitHub Pages como hosting

**Decision:** Desplegar en `github.io` en vez de Vercel/Netlify/VPS.
**Justificacion:** Cero costo, CDN global, TLS automatico, rollback trivial (git revert). El equipo ya usa GitHub.
**Trade-off:** Sin headers custom (no CSP, no HSTS propio). Mitigacion: Cloudflare proxy opcional (ver `CLOUDFLARE_SETUP.md`).

### ADR-003: Supabase en vez de backend propio

**Decision:** BaaS en vez de Node/Django/Rails propio.
**Justificacion:** Sin operaciones de devops, RLS built-in, Postgres completo, backups automaticos, free tier generoso. Equipo es de 1 persona (Rodrigo).
**Trade-off:** Vendor lock-in parcial. Mitigacion: la data es Postgres estandar, se puede exportar. Migraciones de auth requeririan reset de passwords.

### ADR-004: RLS como unico enforcement

**Decision:** Autorizacion ocurre 100% en la base de datos via RLS policies, no en el cliente.
**Justificacion:** El cliente es no-confiable por naturaleza. Un atacante con DevTools puede modificar cualquier check frontend.
**Trade-off:** Debugging de permisos es mas dificil (policies deben probarse con cuentas de cada rol). Beneficio enorme en seguridad.

### ADR-005: Roles en app_metadata, no user_metadata

**Decision:** El campo `role` se guarda en `raw_app_meta_data`, no en `raw_user_meta_data`.
**Justificacion:** Supabase permite que cualquier usuario autenticado edite su propio `user_metadata`. Si role viviera alli, un usuario podria auto-promoverse. `app_metadata` solo lo puede modificar `service_role`.
**Referencia:** Ver `SECURITY.md` seccion 2.0 y `auth.js` comentarios.

### ADR-006: Sistema legacy USERS[] como fallback solo UI

**Decision:** Post-Fase 9, `users.js` solo contiene metadata de display (name, initials, roleLabel). Las contrasenas fueron eliminadas.
**Justificacion:** Migracion gradual sin romper logins mientras todos migran a Supabase Auth. Ahora eliminado.

---

## 7. Modelo de datos (tablas principales)

### 7.1 Proyecto Principal (`rslzosmeteyzxmgfkppe`)

```
auth.users (gestionado por gotrue)
├── id UUID PK
├── email TEXT
├── encrypted_password TEXT (bcrypt)
├── raw_app_meta_data JSONB
│   └── role: 'admin' | 'produccion' | 'calidad' | 'mantenimiento' | 'rrhh'
└── raw_user_meta_data JSONB (solo UI, no confiable para auth)

public.registro_produccion
├── id BIGSERIAL PK
├── fecha DATE
├── hora TIME
├── producto TEXT
├── kg_procesados NUMERIC
├── linea TEXT
├── turno TEXT
├── created_by UUID FK auth.users
├── created_at TIMESTAMPTZ (inmutable por trigger)
└── updated_at TIMESTAMPTZ

public.registro_personal
├── id BIGSERIAL PK
├── fecha DATE
├── area TEXT
├── personas INT
├── horas NUMERIC
└── created_by UUID, created_at, updated_at

public.registro_tuneles
├── id BIGSERIAL PK
├── fecha DATE
├── tunel_id TEXT (tunel-1, tunel-2, ...)
├── hora_inicio TIMESTAMPTZ
├── hora_fin TIMESTAMPTZ
├── temperatura_objetivo NUMERIC
└── ciclos INT

public.registro_empaque_congelado
├── id BIGSERIAL PK
├── fecha DATE
├── producto TEXT
├── presentacion TEXT
├── cantidad INT
└── kg_totales NUMERIC

public.config_costos
├── id BIGSERIAL PK
├── categoria TEXT
├── concepto TEXT
└── valor NUMERIC

public.labores_custom
├── id BIGSERIAL PK
├── nombre TEXT
└── area TEXT

public.audit_log
├── id BIGSERIAL PK
├── table_name TEXT
├── operation TEXT  ('INSERT','UPDATE','DELETE')
├── user_email TEXT
├── user_role TEXT
├── old_data JSONB
├── new_data JSONB
├── changed_fields TEXT[]
├── created_at TIMESTAMPTZ DEFAULT now()
└── (APPEND ONLY - policies DENY UPDATE/DELETE)

public.audit_log_brcgs (VIEW)
  = SELECT *, encode(sha256(row_to_json(audit_log)::text::bytea), 'hex') AS integrity_hash
    FROM audit_log
```

### 7.2 Proyecto Calidad (`obnvrfvcujsrmifvlqni`)

```
public.registros_temperatura
├── id BIGSERIAL PK
├── tunel TEXT
├── fecha TIMESTAMPTZ
├── temperatura NUMERIC
└── sensor_id TEXT

public.consumos_insumos
├── id BIGSERIAL PK
├── fecha DATE
├── insumo TEXT
├── cantidad NUMERIC
└── unidad TEXT
```

### 7.3 Relaciones

- `registro_produccion.created_by` → `auth.users.id` (soft FK)
- Todas las tablas operacionales tienen trigger `fn_audit_log()` que escribe a `public.audit_log`
- `audit_log_brcgs` es vista derivada solo-lectura
- No existen FKs duras entre proyectos Supabase (son bases separadas)

---

## 8. Service Worker y caching

Ver `sw.js`. Estrategia:

- **Cache name:** `ftp-portal-v{N}` (bump manual al deployar cambios breaking)
- **Install:** pre-cachea assets estaticos criticos (CSS, JS core, JSONs de config, logo)
- **Fetch:** cache-first para estaticos, network-first para datos Supabase (no se cachean las respuestas de /rest/v1/)
- **Activate:** elimina caches viejos

Cuando bumpear el cache:
- Cambios en `assets/js/core/*` (auth, router)
- Cambios en `assets/css/*`
- Cambios en `config/roles.json` o `config/navigation.json`

Si solo cambia contenido de modulos (por ejemplo un fix en `modules/produccion/indicadores.js`), no es necesario bumpear (el fetch network-first lo traera fresco).

---

## 9. Consideraciones de performance

- **First load:** ~500 KB descomprimido (~150 KB gzip). Aceptable para LAN interna y 4G.
- **Subsecuentes:** service worker sirve casi todo desde cache, latencia <50 ms.
- **Queries Supabase:** indices aplicados en columnas `fecha`, `created_at` de todas las tablas operacionales.
- **Realtime:** usado con moderacion (solo dashboards abiertos de gerencia).

---

## 10. Referencias

- `SECURITY.md` - politicas de seguridad y compliance
- `OPERATIONS.md` - runbook operacional (deploy, rollback, migraciones)
- `ONBOARDING.md` - onboarding nuevo dev
- `INCIDENT_RESPONSE.md` - runbook detallado de incidentes
- `THREAT_MODEL.md` - modelo de amenazas STRIDE
- `COMPLIANCE.md` - calendario compliance + templates

**Proxima revision:** 2026-10-23 (semestral)
