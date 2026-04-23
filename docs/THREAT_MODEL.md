# Threat Model — Portal Frutos Tropicales

**Metodologia:** STRIDE (Microsoft)
**Version:** 1.0 · **Fecha:** 2026-04-23

---

## 1. Actores (threat actors)

| Actor | Capacidad | Motivacion | Probabilidad |
|---|---|---|---|
| **Externo oportunista** | Baja (scripts automatizados, scan de puertos) | Cryptojacking, spam, ransomware | Alta |
| **Externo dirigido** | Media-Alta (reconnaissance, social engineering) | Robo datos, espionaje industrial, sabotaje | Baja |
| **Insider malicioso** | Alta (ya tiene acceso legitimo) | Venganza, venta datos, fraude | Media |
| **Insider negligente** | Media (clicks en phishing, contrasenas debiles) | Sin malicia, solo errores | Alta |
| **Socio/proveedor comprometido** | Variable | Colateral de otro ataque (jsdelivr, Supabase, Twilio) | Baja |

## 2. Assets criticos

Ordenados por impacto de compromiso:

| # | Asset | Ubicacion | Impacto si se compromete |
|---|---|---|---|
| 1 | **audit_log** + triggers | Supabase principal | Perdida de trazabilidad BRCGS/FDA -> perdida certificacion |
| 2 | **Datos personales Employee** | Supabase principal | Multa ANPDP + dano reputacional + demandas |
| 3 | **Registros produccion** | Supabase principal | Perdida data operacional + manipulacion records |
| 4 | **Credenciales admin** | Supabase auth.users | Compromiso total del sistema |
| 5 | **Service role keys** | Variables de entorno (scripts/) | Bypass total de RLS |
| 6 | **Anon keys** | Frontend (publicas por diseño) | Impacto MINIMO porque RLS filtra |
| 7 | **Backups** | `scripts/backup/backups/` local | Si offsite esta mal configurado, perdida total posible |

## 3. STRIDE por componente

### 3.1 Frontend (portal.html + apps)

| Amenaza STRIDE | Riesgo | Mitigacion actual | Residual |
|---|---|---|---|
| **S** Spoofing (suplantar usuario) | Alto | Supabase Auth JWT firmado + 2FA opcional | Medio (2FA no obligatorio) |
| **T** Tampering (modificar codigo cliente) | Medio | SRI hashes en scripts CDN + HTTPS | Bajo |
| **R** Repudiation (negar acciones) | Medio | audit_log tamper-evident con hash SHA-256 | Muy bajo |
| **I** Info disclosure (XSS leak data) | Alto | escapeHtml en 200+ locations + CSP | Bajo |
| **D** DoS (portal caido) | Medio | GitHub Pages tolerante + Supabase rate limit | Medio (sin WAF) |
| **E** Elevation (escalar privilegios) | Alto | role en app_metadata (inmutable) + RLS | Muy bajo |

### 3.2 Supabase backend

| Amenaza | Riesgo | Mitigacion | Residual |
|---|---|---|---|
| **S** Token JWT robado | Alto | JWT tiene expiracion + auto-refresh + HTTPS only | Bajo (browser extension malicious podria leerlo) |
| **T** Modificar audit_log | Critico | REVOKE INSERT/UPDATE/DELETE + policies DENY | Muy bajo |
| **R** Usuario niega un INSERT | Bajo | Trigger audit_log captura user_email | Muy bajo |
| **I** SQL Injection | Alto | Supabase SDK parametriza automaticamente | Muy bajo |
| **D** DDoS a Supabase | Medio | Rate limit nativo + free tier limits | Medio |
| **E** Escalacion via user_metadata | Alto | **RESUELTO FASE 9**: role en app_metadata | Muy bajo |

### 3.3 Dependencias CDN (jsdelivr, qrserver)

| Amenaza | Riesgo | Mitigacion | Residual |
|---|---|---|---|
| **T** jsdelivr sirve codigo malicioso | Alto | SRI hashes verifican integridad | Muy bajo |
| **I** qrserver loggea secrets TOTP | Medio | Se puede hacer QR client-side para eliminar dep | Medio (pendiente) |
| **D** jsdelivr caido | Medio | Charts no renderizan pero portal sigue funcional | Bajo |
| **E** Compromiso supply chain | Alto | Pin versiones exactas + SRI | Bajo |

### 3.4 GitHub Pages

| Amenaza | Riesgo | Mitigacion | Residual |
|---|---|---|---|
| **T** Commit malicioso en main | Critico | 2FA en GitHub + branch protection recomendado | Medio |
| **T** Dependabot alerta no atendida | Medio | No usamos npm pero monitorear CDN deps | Medio |
| **D** GitHub Pages caido | Medio | Muy raro, alto SLA | Bajo |
| **S** Repo fork malicioso | Bajo | Usuarios siempre van a la URL oficial | Muy bajo |

### 3.5 Apps standalone

| Amenaza | Riesgo | Mitigacion | Residual |
|---|---|---|---|
| **S** Acceso sin autenticacion | Alto | auth-guard.js valida JWT antes de cargar | Muy bajo |
| **T** Modificar registros en localStorage | Bajo | Datos reales van a Supabase, local es backup | Muy bajo |
| **I** Lectura no autorizada | Alto | RLS por rol + JWT compartido con portal | Muy bajo |

## 4. Ataques tipicos y contra-medidas

### 4.1 Phishing para obtener credenciales

**Escenario**: atacante manda email "tu contrasena expira en 24h, click aqui" con link a portal falso.

**Contra-medidas:**
- 2FA obligatorio para admins (no activado aun — riesgo residual)
- Rate limit 5 intentos / 5 min
- Password policy (min 8, mixto)
- **Adicional**: capacitacion anti-phishing a usuarios

### 4.2 Brute-force login

**Escenario**: script automatizado prueba passwords contra `gerencia@frutos-tropicales.pe`.

**Contra-medidas:**
- Rate limit client-side en `assets/js/utils/rate-limit.js`
- Rate limit server-side de Supabase Auth (nativo)
- Password policy complica diccionario
- **Gap**: sin HIBP (requiere plan Pro Supabase)

### 4.3 XSS via datos de DB

**Escenario**: atacante inserta `<script>alert(1)</script>` en campo `fruta` de `registro_produccion`.

**Contra-medidas:**
- `escapeHtml()` aplicado en ~200 locations donde se inyecta DB data
- CSP bloquea scripts inline no autorizados
- `frame-ancestors 'none'` previene clickjacking

### 4.4 Compromiso de sesion

**Escenario**: atacante obtiene JWT via XSS o extension browser maliciosa.

**Contra-medidas:**
- JWT tiene expiracion (~1 hora) + refresh token
- HTTPS only (cookie HttpOnly no aplica porque usamos localStorage)
- **Gap conocido**: localStorage accesible a cualquier JS en el mismo origen

### 4.5 Insider manipula audit_log

**Escenario**: admin con acceso SQL via dashboard intenta borrar logs de actividad sospechosa.

**Contra-medidas:**
- audit_log con policies DENY para UPDATE/DELETE (incluso para admin)
- REVOKE de INSERT directo (solo via trigger)
- Hash SHA-256 en vista BRCGS permite detectar manipulacion externa
- **Gap**: service_role bypasea RLS — whoever tiene service key puede modificar

### 4.6 SQL Injection

**Escenario**: atacante intenta `' OR 1=1--` en search input.

**Contra-medidas:**
- Supabase JS SDK parametriza queries automaticamente
- RPC functions con `SECURITY DEFINER` + `search_path` fijo (H6 fase 9)
- Triggers sin SQL dinamico con input de usuario

## 5. Residual risks aceptados

| Riesgo | Por que aceptado |
|---|---|
| HIBP disabled | Requiere plan Pro Supabase — aceptable mientras passwords tengan complejidad policy |
| localStorage legible por JS | Limitacion del browser — mitigamos con CSP agresivo |
| Anon keys publicas en frontend | Por diseño Supabase — seguridad via RLS |
| Service role key en env de scripts | Necesario para backups — rotar periodicamente |
| Sin pen-test formal | Presupuesto — considerar contratar anualmente |
| Bus factor 1 (solo Rodrigo) | Organizacional — planes de cross-training |

## 6. Matriz riesgo vs mitigacion

```
Impacto
  Alto   │ [H8 Bus factor]       │ [H3 SQL Injection]    │
         │ [H2 Audit tampering]  │ [H7 Token robado]     │
  ───────┼───────────────────────┼───────────────────────┤
  Medio  │ [H5 HIBP]             │ [H4 Phishing]         │
         │                       │ [H6 DDoS]             │
  ───────┼───────────────────────┼───────────────────────┤
  Bajo   │ [H1 Anon key]         │                       │
         │                       │                       │
         │    Baja               │    Alta               │
                              Probabilidad
```

Leyenda:
- H1: anon key expuesta — mitigado RLS
- H2: admin modifica audit_log — mitigado DENY policies
- H3: SQL injection — mitigado parametrizacion SDK
- H4: phishing — mitigado 2FA + rate limit + capacitacion pendiente
- H5: HIBP — aceptado hasta plan Pro
- H6: DDoS — mitigado Supabase rate limit, WAF Cloudflare pendiente
- H7: token robado — mitigado JWT expiry + CSP
- H8: bus factor — mitigacion organizacional pendiente

## 7. Revision de este threat model

- Revision semestral obligatoria
- Actualizar si: nuevas dependencias, nuevos usuarios/roles, cambios en arquitectura
- Proxima revision: 2026-10-23

Ver [COMPLIANCE.md](COMPLIANCE.md) para calendario completo.
