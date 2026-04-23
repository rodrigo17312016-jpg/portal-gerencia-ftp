# Incident Response Runbook

**Version:** 1.0 · **Ultima revision:** 2026-04-23
**Alineacion:** NIST SP 800-61r2, ISO/IEC 27035

---

## 1. Matriz de severidad

| Nivel | Descripcion | Ejemplo | Tiempo respuesta | Notificacion |
|---|---|---|---|---|
| **P1 — Critico** | Brecha de datos, sistema caido, acceso no autorizado confirmado | Supabase DB comprometida, leak credenciales admin | 15 min | Inmediata a gerencia + legal |
| **P2 — Alto** | Funcionalidad critica afectada, riesgo alto | Login caido, tabla audit_log con escrituras sospechosas | 1 hora | Gerencia el mismo dia |
| **P3 — Medio** | Funcionalidad parcial afectada, riesgo medio | Panel con errores intermitentes, alerta temp falsa | 4 horas | Email interno |
| **P4 — Bajo** | Molestia operativa, sin riesgo | Typo en UI, boton export falla 1 vez | 1 dia habil | Ticket/backlog |

## 2. Flujo general de respuesta

```
DETECCION
    ↓
CONTENCION (bloquear el ataque activo)
    ↓
ERRADICACION (eliminar causa raiz)
    ↓
RECUPERACION (restaurar operaciones)
    ↓
LECCIONES APRENDIDAS (post-mortem + mejoras)
```

## 3. Playbooks especificos

### 3.1 Brecha de datos (data breach)

**Indicadores:**
- Notificacion externa de datos filtrados
- Logs Supabase muestran queries masivas sospechosas
- audit_log con lecturas en tabla `Employee` fuera de horario

**Accion inmediata (15 min):**
1. **CONTENER**:
   - Supabase Dashboard > Authentication > Users > Sign Out All (revoca todos los JWT)
   - Rotar anon keys de Supabase (generar nuevas en Settings > API)
   - Update `assets/js/config/supabase.js` con nuevas keys + commit + push
   - Bump SW cache (`sw.js`) para forzar re-fetch
2. **INVESTIGAR**:
   - Exportar audit_log ultimas 72h: boton "📋 Exportar BRCGS" en panel Audit
   - Revisar Supabase logs: Dashboard > Logs > Filter por `auth` / `errors`
   - Identificar: que datos, cuantos registros, que usuarios
3. **NOTIFICAR**:
   - Gerencia (Rodrigo) — inmediato
   - Si incluye datos personales: ANPDP Peru en 72h (Ley 29733 art 40)
   - Clientes afectados si hay PII (segun severidad)

**Evidencia a conservar:**
- Export completo audit_log (integrity hash incluido)
- Screenshots Supabase logs
- Timeline cronologico de acciones tomadas

### 3.2 Compromiso de credenciales

**Indicadores:**
- Usuario reporta que no hizo un cambio que aparece en audit_log
- Login desde IP sospechosa (ver `auth.sessions` en Supabase)
- Rate limit dispara 10+ veces en 1 hora

**Accion (30 min):**
1. **CONTENER**:
   - Forzar logout del usuario: Supabase Dashboard > Authentication > Users > <user> > Sign Out
   - Resetear password: enviar email reset desde dashboard
2. **INVESTIGAR**:
   - Audit log filtrado por ese user_email
   - Revisar cambios realizados durante ventana sospechosa
   - Si tiene 2FA activo: verificar que no se desactivo recientemente
3. **REMEDIAR**:
   - Exigir cambio de password
   - Activar 2FA si no lo tenia
   - Documentar en ticket

### 3.3 Supabase down / degraded

**Indicadores:**
- Login falla con timeout
- Dashboard muestra banner "Supabase issue"
- https://status.supabase.com/ marca incidente

**Accion:**
1. Verificar https://status.supabase.com/
2. Si es incidente de Supabase: notificar usuarios, esperar resolucion
3. Verificar que backups diarios estan funcionando (`scripts/backup/backup_supabase.py`)
4. Si es de largo plazo: considerar switch a backup de DB restaurada en proyecto nuevo
5. Post-mortem: documentar duracion + impacto operativo

### 3.4 Perdida de datos / restore

**Indicadores:**
- DELETE masivo accidental
- Usuario reporta data faltante
- audit_log muestra operacion DELETE no autorizada

**Accion:**
1. **DETENER escrituras** (bloquear temporalmente):
   - Temporalmente: DROP policy de escritura en la tabla afectada
   - `DROP POLICY "role_write_X" ON public.X;`
2. **IDENTIFICAR alcance**:
   - audit_log filtrado por `operation = 'DELETE'` y fecha
   - Contar rows afectadas
3. **RESTAURAR**:
   - Opcion A (< 7 dias): Supabase PITR (Point-in-Time Recovery) desde Dashboard
   - Opcion B: backup externo `scripts/backup/backup_supabase.py --restore FECHA`
4. **VERIFICAR integridad** audit_log post-restore (hashes SHA-256 validos)
5. **REACTIVAR escrituras** (reaplicar policies)

### 3.5 DDoS / trafico sospechoso

**Indicadores:**
- Supabase REST API rate limit triggereado masivamente
- Portal lento o caido

**Accion:**
1. Supabase tiene rate limit nativo, usualmente se autoprotege
2. Si persiste: activar Cloudflare frente a GitHub Pages (ver [CLOUDFLARE_SETUP.md](CLOUDFLARE_SETUP.md))
3. Bloquear IPs sospechosas via Supabase Dashboard > Settings > API > IP Allowlist

### 3.6 Account takeover (ATO)

**Indicadores:**
- Usuario reporta notificacion email sobre login no realizado
- Cambios en perfil del usuario que no hizo

**Accion:**
1. Forzar logout + reset password del usuario
2. Revisar audit_log para cambios durante ventana ATO
3. Si se escalaron privilegios (cambio role): revertir en `auth.users.raw_app_meta_data`
4. Activar 2FA obligatorio para ese usuario

## 4. Template post-mortem

```markdown
# Post-Mortem: [Titulo incidente]

**Fecha incidente:** YYYY-MM-DD HH:MM - HH:MM (UTC)
**Severidad:** P1/P2/P3/P4
**Autor del PM:** [Nombre]
**Status:** Abierto / Resuelto / Pendiente accion

## Resumen ejecutivo
[2-3 oraciones para gerencia]

## Timeline
- HH:MM - Evento 1
- HH:MM - Evento 2
- HH:MM - Resolucion

## Causa raiz
[5 Whys analisis]

## Impacto
- Usuarios afectados: N
- Datos afectados: [tablas/cantidad]
- Downtime: N minutos
- Dinero perdido (si aplica): $X

## Que funciono bien
- ...

## Que NO funciono
- ...

## Acciones correctivas
| # | Accion | Responsable | Deadline | Status |
|---|---|---|---|---|
| 1 | ... | ... | ... | Pending |

## Lecciones aprendidas
- ...
```

## 5. Comunicacion a stakeholders

### Durante incidente (interno)

Template Slack/Email:
```
[P1/P2/P3] Incidente en Portal FTP
Inicio: HH:MM
Sintoma: [descripcion breve]
Impacto: [quienes/que modulos afectados]
Accion actual: [que se esta haciendo]
ETA resolucion: HH:MM o "investigando"
Siguiente update: HH:MM
```

### Post-incidente (externo, si aplica)

**Que SI decir:**
- Que paso en terminos tecnicos claros
- Que datos pudieron ser accedidos (si hay certeza)
- Que acciones se tomaron
- Que estamos haciendo para prevenir

**Que NO decir:**
- Especulaciones sin evidencia
- Detalles de infraestructura que faciliten ataques futuros
- Nombres de empleados sospechosos (hasta confirmar)
- Admision de culpa sin consulta legal

### A ANPDP Peru (brecha de datos personales)

Si la brecha involucra datos de `Employee`, `AttendanceRecord`, `trabajadores`:
- Notificar en 72 horas segun Ley 29733 art 40
- Usar formulario oficial: https://www.gob.pe/institucion/minjus/
- Incluir: fecha, alcance, medidas tomadas, responsables

## 6. Contactos de emergencia

| Rol | Nombre | Contacto | Disponibilidad |
|---|---|---|---|
| Owner Tecnico | Rodrigo Garcia | rodrigo17312016@gmail.com | 24/7 |
| Gerencia | [Nombre gerencia] | [email] | Horario oficina |
| Supabase Support | — | support@supabase.com | Plan Pro: 24h SLA |
| Legal (ANPDP) | [Asesor legal] | [email] | — |

## 7. Checklist de drill (simulacro trimestral)

- [ ] Simular DDoS: activar Cloudflare en staging
- [ ] Simular brecha: exportar audit_log + verificar flujo de notificacion
- [ ] Simular perdida: DELETE en staging + restore desde backup
- [ ] Simular compromiso credenciales: forzar logout + reset
- [ ] Verificar que backup diario corre correctamente
- [ ] Revisar contactos emergencia actualizados

**Registro de drills**: ver [COMPLIANCE.md](COMPLIANCE.md) seccion "Drills ejecutados"
