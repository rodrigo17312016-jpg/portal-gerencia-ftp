# Politica de Seguridad - Portal Frutos Tropicales Peru Export S.A.C.

**Version:** 1.0
**Fecha:** 2026-04-23
**Alineacion:** ISO 27001:2022, BRCGS Issue 9, FDA 21 CFR Part 11, NIST 800-63B

---

## 1. Autenticacion

### 1.1 Sistema
- **Proveedor:** Supabase Auth (JWT firmado con HS256) — **unico mecanismo**
- **Algoritmo hash:** bcrypt (via gotrue server-side)
- **Session token:** JWT con refresh token automatico
- **Fallback legacy:** ELIMINADO (Fase 9). `users.js` solo contiene metadata UI (name, initials, roleLabel). NO hay contrasenas en el codigo.

### 1.2 Politica de contrasenas (ISO 27001 A.9.4.3)
Implementada en `assets/js/utils/password-policy.js`:
- **Longitud minima:** 8 caracteres
- **Complejidad:** 1+ mayuscula, 1+ minuscula, 1+ numero, 1+ simbolo
- **Blacklist:** palabras obvias rechazadas (nombre empresa, years, "password", etc.)
- **Medidor visual:** weak/medium/strong en tiempo real

### 1.3 Rate limiting (anti brute-force)
Implementado en `assets/js/utils/rate-limit.js`:
- **Client-side:** 5 intentos / 5 minutos de lock por usuario
- **Server-side:** rate limit nativo de Supabase Auth
- **Storage:** sessionStorage (se resetea al cerrar browser)

### 1.4 MFA / 2FA
- **Implementacion:** Supabase MFA nativo (TOTP RFC 6238)
- **Apps compatibles:** Google Authenticator, Authy, 1Password, Microsoft Authenticator
- **Disponible para:** cualquier usuario desde panel "Seguridad"
- **Recomendado para:** cuentas con rol admin

### 1.5 Password Recovery
- Flow estandar email-link via Supabase `resetPasswordForEmail()`
- Link expira despues de 1 hora
- Nuevo password valida complejidad antes de guardar

### 1.6 Session Management
- **JWT refresh:** automatico antes de expirar via `onAuthStateChange`
- **Logout cascade:** si el refresh falla, logout limpio
- **Activity timeout:** configurable en auth.js (default 30 min de inactividad)

---

## 2. Control de Acceso (RBAC)

### 2.0 Ubicacion canonica del rol
**CRITICO:** el rol autoritativo se almacena en `auth.users.raw_app_meta_data->>'role'` (inmutable por el usuario final, solo service_role lo modifica). El `user_metadata` **nunca** se usa para decisiones de autorizacion — solo para display UI (name, initials).

Todas las policies RLS leen `auth.jwt()->'app_metadata'->>'role'`.

### 2.1 Roles definidos
- **admin** - acceso total (gerencia, rodrigo)
- **produccion** - modulos produccion + almacen
- **calidad** - modulos calidad + almacen
- **mantenimiento** - modulos mantenimiento + almacen (read-only)
- **rrhh** - acceso a Employee/AttendanceRecord/MealRecord/TareoRecord (datos personales)

### 2.2 Permisos granulares
Definidos en `config/roles.json` con acciones especificas:
```json
{
  "actions": {
    "view": "*",
    "edit": ["registro_produccion", ...],
    "delete": [],
    "export": "*",
    "config": []
  }
}
```
Usar `hasAction(action, resource)` de auth.js para enforcement en UI.

### 2.3 Row Level Security (RLS)
Aplicado en 8 tablas operacionales (2 proyectos Supabase):

| Tabla | anon | authenticated |
|---|---|---|
| registro_produccion | SELECT only | ALL |
| registro_personal | SELECT only | ALL |
| registro_tuneles | SELECT only | ALL |
| registro_empaque_congelado | SELECT only | ALL |
| config_costos | SELECT only | ALL |
| labores_custom | SELECT only | ALL |
| registros_temperatura | SELECT only | ALL |
| consumos_insumos | SELECT only | ALL |

### 2.4 Apps Standalone
Todas las apps bajo `apps/` protegidas por `apps/_shared/auth-guard.js`:
- Verifica JWT/legacy session ANTES de cargar cualquier script
- Si no hay sesion: redirect a `/login.html`
- Cliente Supabase hereda el JWT automaticamente (RLS funciona)

---

## 3. Data Integrity (BRCGS / FDA 21 CFR Part 11)

### 3.1 Audit Trail
- **Tabla:** `public.audit_log`
- **Triggers:** aplicados en 6 tablas operacionales
- **Datos capturados:** user_email, user_role, operation, old_data, new_data, changed_fields, timestamp
- **Vista formatada BRCGS:** `public.audit_log_brcgs` con hash SHA-256 de integridad por registro

### 3.2 Tamper-evidence
- El audit_log es **append-only** - policies DENY explicitas para UPDATE/DELETE
- GRANT SELECT unicamente a authenticated
- REVOKE INSERT/UPDATE/DELETE directo (solo via trigger con SECURITY DEFINER)

### 3.3 Columnas inmutables
- `id` y `created_at` protegidos por trigger `fn_protect_immutable_columns()`
- Cualquier intento de cambio es revertido silenciosamente
- Cambios intencionales requerirían migration SQL con justificacion documentada

### 3.4 Retencion de datos
| Tipo | Duracion minima | Base normativa |
|---|---|---|
| audit_log | 3 anos | BRCGS Issue 9 clause 3.3 |
| audit_log | 5 anos | FDA 21 CFR 117 Subpart C |
| registros operacionales | 3 anos | BRCGS |
| registros de calidad | 5 anos | HACCP / FDA |

**Backup:** Supabase backup diario automatico (plan actual).
**Point-in-time recovery:** 7 dias (upgrade recomendado a plan Pro para 30 dias).

---

## 4. Proteccion XSS / Inyeccion

- **Helper global:** `escapeHtml()` / `escapeAttr()` en `assets/js/utils/dom-helpers.js`
- **Cobertura:** ~200 locations en 15+ modulos
- **SQL Injection:** imposible via Supabase SDK (parametrizacion automatica)
- **CSP:** no implementada aun (gap conocido, ver seccion 7)

---

## 5. Secretos y Credenciales

### 5.1 Keys publicas
- **Supabase anon keys:** publicas por diseño (intencional). Seguridad via RLS, no ocultamiento.

### 5.2 Secretos que NUNCA deben estar en el repositorio
- Service role keys de Supabase
- Twilio tokens (chatbot WhatsApp)
- Cualquier API key personal

### 5.3 Proceso de rotacion
- Rotacion anual o inmediata si se sospecha compromiso
- Revocar el token viejo INMEDIATAMENTE via Supabase Dashboard

---

## 6. Notificaciones de Seguridad

Implementadas en `assets/js/utils/notifications.js`:
- Alertas de temperatura fuera de rango via desktop notifications
- SW maneja click -> abre panel relevante
- Permiso explicito requerido (opt-in)

---

## 7. Gaps Conocidos (Pendientes)

| # | Gap | Prioridad | Accion |
|---|---|---|---|
| 1 | MFA toggle en Supabase Dashboard | Media | Manual: Authentication > Providers > MFA > ON |
| 2 | Leaked Password Protection (HIBP) | Baja | Manual: Authentication > Policies > toggle (requiere plan Pro) |
| 3 | Content Security Policy headers | Baja | Agregar a portal.html `<meta http-equiv="Content-Security-Policy">` |
| 4 | Rate limit server-side custom | Baja | Supabase tiene nativo, custom via Edge Function si se requiere |
| 5 | Bus factor (solo Rodrigo conoce el sistema) | Alta | Organizacional: documentar, cross-training con otro tecnico |

### 7.1 Tablas out-of-scope (aceptadas)

Las siguientes tablas coexisten en el proyecto Supabase por razones historicas pero NO son parte del portal FTP. Tienen RLS habilitada + policy `DENY ALL TO public` explicita. Solo `service_role` puede accederlas desde backends propios.

- `aresbet_debug` — proyecto aresbet (debug)
- `finance_transactions`, `finance_budgets`, `finance_categories`, `finance_payment_methods`, `finance_savings_goals` — proyecto personal de finanzas

**Recomendacion futura:** migrar a proyecto Supabase separado para limpieza total del scope de auditoria FTP.

---

## 8. Incident Response

### 8.1 Deteccion
- Audit log permite forense completo de cambios
- Vista `audit_log_brcgs` con hash de integridad para detectar manipulacion

### 8.2 Contencion
En caso de sospecha de compromiso:
1. Revocar todas las sesiones activas: Supabase Dashboard > Authentication > Users > Sign Out All
2. Rotar anon keys si estan comprometidas (nuevas keys + update en supabase.js + redeploy)
3. Cambiar passwords de todos los usuarios admin
4. Exportar audit_log de las 72h previas para analisis

### 8.3 Recovery
- Restaurar desde backup (Supabase PITR)
- Aplicar patches de seguridad
- Post-mortem documentado

---

## 9. Cumplimiento BRCGS / FDA

### 9.1 Data Integrity (21 CFR Part 11)
- ✅ **Atomicidad:** Supabase es PostgreSQL ACID
- ✅ **Consistencia:** RLS + triggers enforzan invariantes
- ✅ **Trazabilidad:** audit_log completo
- ✅ **Tamper-evidence:** audit_log append-only
- ✅ **Timestamps:** TIMESTAMPTZ, servidor autoritativo

### 9.2 Electronic Signatures
- ⚠️ **Gap:** no implementado como signature binding
- Workaround: JWT firma los tokens, audit_log registra quien hizo que
- Mejora futura: firma explicita con HSM o equivalente

### 9.3 BRCGS Issue 9 Clause 3.3 Record Keeping
- ✅ Registros conservados (Supabase)
- ✅ Accesible solo a personal autorizado (RLS)
- ⚠️ Firma manuscrita electronica: ver 9.2

---

## 10. Estado de Advisors Supabase

Ejecutar `get_advisors(type='security')` via MCP en ambos proyectos Supabase.

**Estado actual (Fase 10):**

| Proyecto | Total lints | ERROR | WARN | INFO |
|---|---|---|---|---|
| Principal (rslzosmeteyzxmgfkppe) | 1 | 0 | 1 (HIBP) | 0 |
| Calidad (obnvrfvcujsrmifvlqni) | 1 | 0 | 1 (HIBP) | 0 |

**De 52 hallazgos iniciales -> 2 hallazgos** (ambos el mismo lint: HIBP, requiere plan Pro).

**0 hallazgos criticos / 0 hallazgos mayores / 0 hallazgos menores.**

## 11. Revisiones

| Fecha | Revisor | Cambios |
|---|---|---|
| 2026-04-23 | Rodrigo Garcia | Version inicial (Fase 8) |
| 2026-04-23 | Rodrigo Garcia | Fase 9: cerrados 8 hallazgos criticos post-auditoria |
| 2026-04-23 | Rodrigo Garcia | Fase 10: cerrados hallazgos INFO (prueba sync, materia_prima, out-of-scope) |

**Proxima revision:** 2026-10-23 (semestral)
