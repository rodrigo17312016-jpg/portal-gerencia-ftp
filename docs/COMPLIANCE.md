# Compliance — Calendario y Templates

**Proposito:** gestion continua de cumplimiento ISO 27001 / BRCGS / FDA / Ley 29733.
**Version:** 1.0 · **Proxima revision:** 2026-10-23

---

## 1. Calendario de actividades

### Mensual

| # | Actividad | Responsable | Evidencia |
|---|---|---|---|
| M1 | Revisar advisors Supabase (ambos proyectos) | Tecnico | Screenshot con 0 ERROR |
| M2 | Verificar backups diarios ultima semana | Tecnico | Log ejecuciones |
| M3 | Revisar audit_log para actividad anomala | Admin | Vista BRCGS ultimo mes |
| M4 | Rotar password si alguien lo solicito | Tecnico | Log en COMPLIANCE.md |

### Trimestral

| # | Actividad | Responsable | Evidencia |
|---|---|---|---|
| Q1 | Drill de incident response | Equipo | Registro drill ejecutado |
| Q2 | Revisar usuarios activos vs empleados actuales | Admin + RRHH | Lista reconciliada |
| Q3 | Revisar policies RLS (si hubo cambios) | Tecnico | Diff vs trimestre anterior |
| Q4 | Verificar retencion audit_log (> 3 anos BRCGS) | Tecnico | Query age min/max |
| Q5 | Test de restore desde backup | Tecnico | Checklist drill completado |
| Q6 | Revisar dependencias CDN (nuevas versiones, CVEs) | Tecnico | Update SRI hashes si bump |
| Q7 | Revisar threat model | Tecnico | Actualizar THREAT_MODEL.md si aplica |

### Semestral

| # | Actividad | Responsable | Evidencia |
|---|---|---|---|
| S1 | Actualizar SECURITY.md (politicas) | Tecnico + Legal | Diff commited |
| S2 | Capacitacion anti-phishing usuarios | RRHH + Tecnico | Lista asistentes |
| S3 | Revisar bus factor / documentacion | Gerencia | Checklist ONBOARDING |
| S4 | Auditoria interna (checklist seccion 4) | Auditor externo/interno | Reporte firmado |

### Anual

| # | Actividad | Responsable | Evidencia |
|---|---|---|---|
| A1 | Recertificacion BRCGS/FDA | Calidad + Tecnico | Certificado renovado |
| A2 | Renovacion dominio, SSL, Supabase plan | Admin | Facturas |
| A3 | Rotacion TODOS los secretos (service_role keys) | Tecnico | Log fecha rotacion |
| A4 | Pen-test externo (cuando presupuesto permita) | Empresa externa | Reporte pen-test |
| A5 | Revision de proveedores (Supabase, Twilio, CDN) | Gerencia | Evaluacion proveedor |
| A6 | Registro ANPDP (Ley 29733) | Legal | Constancia vigente |
| A7 | Update de esta misma checklist | Tecnico | Diff de calendario |

## 2. Checklist auditoria interna (trimestral)

**Fecha:** YYYY-MM-DD · **Auditor:** [Nombre]

### Seguridad tecnica

- [ ] Supabase advisors security: 0 ERROR, 0 WARN criticos
- [ ] Todos los usuarios activos tienen role en `app_metadata`
- [ ] audit_log con policies DENY UPDATE/DELETE activas
- [ ] Triggers `protect_immutable_*` existen en las 6 tablas operacionales
- [ ] RLS habilitada en el 100% de tablas public
- [ ] No hay policies `USING (true)` para authenticated (excepto las documentadas en SECURITY.md §2.3)
- [ ] CSP headers presentes en portal.html, login.html, apps
- [ ] SRI hashes correctos en todos los scripts CDN
- [ ] SW cache version actualizada post-cambios

### Gestion de accesos

- [ ] Usuarios en `auth.users` coinciden con empleados actuales
- [ ] Usuarios desvinculados fueron removidos dentro de 24h post-salida
- [ ] 2FA activo para todos los admins
- [ ] Ningun usuario tiene 2+ roles
- [ ] Service role keys NO estan en el repo git

### Audit trail

- [ ] audit_log tiene eventos del ultimo mes
- [ ] Hash SHA-256 verificado en muestra aleatoria de 10 registros
- [ ] Retencion mayor a 3 anos (BRCGS) / 5 anos (FDA) — NO se puede eliminar legalmente
- [ ] Export BRCGS funciona y descarga correctamente

### Backups

- [ ] Backup diario ejecutado sin errores ultimas 30 corridas
- [ ] Backup offsite (S3/GDrive) accesible
- [ ] Integridad verificada con hash del manifest.json
- [ ] Drill de restore ejecutado ultimo trimestre

### Documentacion

- [ ] SECURITY.md actualizado (ultima revision < 6 meses)
- [ ] THREAT_MODEL.md actualizado (ultima revision < 6 meses)
- [ ] ONBOARDING.md completo y claro
- [ ] INCIDENT_RESPONSE.md tiene contactos actualizados
- [ ] Este COMPLIANCE.md con calendario al dia

### Compliance externa

- [ ] Registro ANPDP vigente (Ley 29733)
- [ ] Certificacion BRCGS vigente
- [ ] Certificacion FDA vigente
- [ ] Politica privacidad publicada (si aplica)

**Observaciones:** ____________________

**Aprobado por:** ____________________  **Fecha:** ____________________

## 3. KPIs de seguridad

| KPI | Target | Medicion actual | Fecha |
|---|---|---|---|
| % admins con 2FA | 100% | TBD | — |
| Tiempo promedio resolucion incidente P1 | < 1h | TBD | — |
| Tiempo promedio resolucion incidente P2 | < 4h | TBD | — |
| Backups exitosos / mes | 100% | TBD | — |
| Advisors ERROR count | 0 | 0 | 2026-04-23 |
| Advisors WARN count | < 5 | 2 (HIBP) | 2026-04-23 |
| Drills IR ejecutados / trimestre | 1+ | 0 | 2026-04-23 |
| Audit log queries sospechosas / mes | 0 | 0 | 2026-04-23 |

## 4. Drills ejecutados (log)

| Fecha | Tipo drill | Resultado | Observaciones |
|---|---|---|---|
| — | — | — | Primer drill pendiente Q2 2026 |

## 5. Log de cambios de policies RLS

Cada cambio significativo en policies RLS debe registrarse aqui:

| Fecha | Migration | Resumen | Aprobado por |
|---|---|---|---|
| 2026-04-23 | tighten_rls_operational_tables | anon SELECT only | Rodrigo |
| 2026-04-23 | audit_log_tamper_evident | DENY UPDATE/DELETE audit | Rodrigo |
| 2026-04-23 | move_role_to_app_metadata | Role ahora en app_metadata | Rodrigo |
| 2026-04-23 | restrictive_policies_by_role | Policies por rol JWT | Rodrigo |
| 2026-04-23 | policies_personal_data_tables | Employee con policies | Rodrigo |
| 2026-04-23 | deny_policies_out_of_scope_tables | finance_* + aresbet_debug DENY | Rodrigo |

## 6. Registro de incidentes (log)

| Fecha | Severidad | Descripcion breve | Post-mortem link | Estado |
|---|---|---|---|---|
| — | — | Primer incidente aun no ocurre | — | — |

## 7. Post-mortems

Guardar post-mortems de incidentes como archivos separados en `docs/post-mortems/YYYY-MM-DD-<nombre>.md`.

Template disponible en [INCIDENT_RESPONSE.md §4](INCIDENT_RESPONSE.md).

## 8. Templates rapidos

### 8.1 Registro onboarding usuario nuevo

```
Nombre: ________________
Email: _________________
Rol: admin | produccion | calidad | mantenimiento | rrhh
Fecha creacion: ________
Creado en Supabase Auth: [ ]
Role asignado en app_metadata: [ ]
2FA configurado: [ ]
Capacitacion anti-phishing: [ ]
Acceso docs ONBOARDING.md: [ ]
Aprobado por: ______
```

### 8.2 Registro offboarding usuario

```
Nombre: ________________
Email: _________________
Fecha salida: __________
Acciones:
- [ ] Revocar sesiones activas (Supabase > Auth > Users > Sign Out)
- [ ] Cambiar password temporalmente (invalida JWT viejos)
- [ ] Remover de auth.users si aplica (generalmente se conserva por audit_log)
- [ ] Revocar acceso repo GitHub si era dev
- [ ] Archivo de respaldo: export audit_log filtrado por ese user_email
- [ ] Documentar en este log
Aprobado por: ______
```

## 9. Normas referenciadas

- **ISO/IEC 27001:2022** — SGSI
- **ISO/IEC 27035:2023** — Gestion de incidentes
- **ISO/IEC 27017** — Controles para cloud
- **BRCGS Global Standard for Food Safety Issue 9 (2022)**
- **FDA 21 CFR Part 11** — Electronic Records / Electronic Signatures
- **FDA 21 CFR Part 117** — HACCP Subpart C recordkeeping
- **Ley 29733** — Proteccion de Datos Personales Peru
- **D.S. 003-2013-JUS** — Reglamento Ley 29733
- **NIST SP 800-61r2** — Incident Response
- **NIST SP 800-63B** — Digital Identity Guidelines (password policy)
- **OWASP Top 10 (2021)** — Web Application Security Risks
- **CIS Controls v8** — Defensive actions
