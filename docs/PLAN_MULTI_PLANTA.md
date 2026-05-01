# PLAN MULTI-PLANTA / MULTI-SEDE

**Estado:** ✅ TODAS LAS FASES (1-7) + 4 BONUS COMPLETADAS - sistema enterprise listo para multi-tenant real.
**Fecha:** 2026-05-01
**Autor:** Rodrigo García

---

## Contexto

Frutos Tropicales Perú Export S.A.C. opera hoy desde:

| Código    | Nombre              | Tipo    | Ubicación    | Estado     |
|-----------|---------------------|---------|--------------|------------|
| FTP-HUA   | FTP Huaura          | propia  | Huaura       | activa     |
| FTP-PIU   | FTP Piura           | propia  | Piura        | activa     |
| PRC-MAQ   | PRC (Maquila)       | maquila | Lima         | activa     |

El portal actual fue concebido para una sola planta (FTP Huaura). Este plan agrega la **dimensión sede** a TODO el sistema sin romper lo existente.

---

## Modelo de datos (Supabase)

Cada tabla operativa gana una columna `sede_id` (FK → `sedes.id`):

```sql
-- Tabla maestra (nueva)
create table sedes (
  id          uuid primary key default gen_random_uuid(),
  codigo      text unique not null,        -- FTP-HUA, FTP-PIU, PRC-MAQ
  nombre      text not null,
  tipo        text not null,               -- 'propia' | 'maquila'
  ubicacion   text,
  empresa     text,                        -- para maquilas: nombre del cliente que contrata
  activa      boolean default true,
  color       text,                        -- color del badge en UI
  created_at  timestamptz default now()
);

-- Patch a tablas operativas (ejemplo registro_produccion)
alter table registro_produccion
  add column sede_id uuid references sedes(id) default '<uuid de FTP-HUA>';

create index idx_registro_produccion_sede on registro_produccion(sede_id, fecha);
```

**Tablas que requieren `sede_id`:** `registro_produccion`, `registro_empaque_congelado`, `registros_temperatura`, `consumos_insumos`, `inspecciones_*`, `mant_ordenes`, `mant_equipos`, `rrhh_personal`, `stock_*`, `materiales`, `contenedores`.

**Migración de datos existentes:** todos los registros actuales se asignan automáticamente a `FTP-HUA` (default).

---

## Arquitectura de la app

### Capa 1 — Registry de sedes
`config/sedes.json` define las plantas. `assets/js/config/sedes.js` lo expone como módulo ES.

### Capa 2 — Contexto global (`assets/js/core/sede-context.js`)
- Estado: sede activa (`'FTP-HUA'`, `'FTP-PIU'`, `'PRC-MAQ'`, o `'CONSOLIDADO'`).
- Persistencia: `localStorage` (`ftp_sede_activa`).
- Eventos: emite `sede-changed` cuando cambia. Cualquier módulo se suscribe con `onSedeChange(callback)`.
- API: `getSedeActiva()`, `setSedeActiva(codigo)`, `onSedeChange(cb)`.

### Capa 3 — Selector UI (header del portal)
- Botón pill en `.topbar-right` que muestra la sede activa.
- Al hacer click despliega menú con todas las sedes + "Consolidado".
- Cierra al click fuera. Persiste selección.

### Capa 4 — Cableado en cada panel
Cada panel `module/X.js` se suscribe a `sede-changed` y recarga datos. La query a Supabase agrega `.eq('sede_id', sedeId)` (o `.in('sede_id', [...])` para consolidado).

### Capa 5 — Dashboard comparativo
Nuevo panel `modules/gerencia/comparativo-plantas` que SIEMPRE muestra todas las sedes (ignora la sede activa). Comparativas por planta: producción TN, costo/kg, productividad, alertas.

### Capa 6 — Roles por sede (RLS Supabase)
Política RLS en cada tabla:
```sql
create policy "usuarios solo ven su sede"
  on registro_produccion for select
  using (
    sede_id = any (
      select sede_id from usuarios_sedes where user_id = auth.uid()
    )
    or auth.jwt() ->> 'role' = 'admin'  -- gerencia ve todo
  );
```

---

## Fases de implementación

### Fase 1 — Cimientos (este PR / commit)
- [x] Plan documentado
- [x] `config/sedes.json` con 3 sedes
- [x] `assets/js/config/sedes.js` (loader)
- [x] `assets/js/core/sede-context.js` (estado + eventos)

### Fase 2 — UI selector (este PR / commit)
- [x] Botón pill en topbar
- [x] Menú dropdown con sedes + consolidado
- [x] Estilos light/dark + mobile
- [x] Persistencia en localStorage

### Fase 3 — PoC visible (este PR / commit)
- [x] Helper `sede-mock-helper.js` para escalar mock por sede
- [x] Módulo `resumen` reacciona a cambio de sede
- [x] KPIs y charts cambian visualmente

### Fase 4 — Comparativo (este PR / commit)
- [x] Nuevo panel "Comparativo Plantas" en navegación
- [x] Dashboard con 3-4 charts cross-sede
- [x] Aparece solo para rol admin

### Fase 5 — Schema Supabase (✅ COMPLETADA 2026-04-30)
- [x] Reusar tabla `Plant` existente (extender, no crear nueva)
- [x] Migration 001: extender `Plant` con `tipo`, `color`, `icono`, `activa`, `principal`, `scale_factor`, `ubicacion`, `empresa`
- [x] Renombrar P1→FTP-HUA, P2→FTP-PIU, insertar PRC-MAQ
- [x] Migration 002: `plantId` en `registro_produccion`, `registro_personal`, `registro_tuneles`, `registro_empaque_congelado`, `config_costos`
- [x] Backfill: 474 filas existentes → FTP-HUA (UUID `6d8707af-...`)
- [x] Índices `(plantId, fecha)` en las 4 tablas con fecha
- [x] Migration 003: tabla `sedes` espejo en proyecto Calidad + `sede_codigo` en `registros_temperatura` (5837 filas) y `consumos_insumos` (428 filas)
- [x] Migration 004: política `anon_read_Plant` para que el frontend pueda llenar el selector

SQL files: `proyecto/sql/multi-sede/{001..004}_*.sql`

### Fase 6 — Cableo real (✅ COMPLETADA 2026-04-30)
- [x] `assets/js/config/sedes.js` lee Plant desde Supabase (con fallback JSON si offline)
- [x] `assets/js/core/sede-context.js` expone `applyPlantFilter()` (UUID para Prod) y `applySedeFilter()` (TEXT para Calidad)
- [x] `modules/gerencia/resumen.js` usa filtros reales — KPIs y charts cambian con la sede activa
- [x] `modules/gerencia/comparativo-plantas.js` agrega por `plantId` con datos reales (verificado: HUA=175.2 TN, PIU=0, PRC=0)
- [x] `apps/_shared/plant-context.js` helper opcional para sub-apps
- [x] DEFAULT en columna `plantId` cubre el caso actual: INSERTs sin plantId van automáticamente a FTP-HUA
- [x] Helper `sede-mock-helper.js` ELIMINADO (ya no se necesita)

### Fase 7 — Roles por sede (✅ COMPLETADA 2026-05-01)
- [x] Tabla `usuarios_sedes(user_id, plant_id)` en proyecto Producción + espejo en Calidad (`sede_codigo`)
- [x] Helper `user_has_plant_access(plant_id)` y `user_has_sede_access(sede_codigo)` — admin pasa siempre, usuario sin grants tiene acceso a todo (compat), con grants solo ve sus plantas
- [x] RLS actualizado en 5 tablas Prod (`auth_select_filtered_*`) + 2 tablas Calidad
- [x] RPC `mis_sedes()` — el frontend obtiene solo las sedes permitidas
- [x] Selector UI filtra por permisos del usuario (oculta CONSOLIDADO si solo 1 sede)
- [x] **HARDENING**: todos los `admin_*` RPCs usan `IS DISTINCT FROM 'admin'` para que NULL bloquee anon (el `<>` no protegía)

**Decisión:** se eligió aislamiento estricto + compatibilidad. Mientras un usuario no tenga filas en `usuarios_sedes`, ve todo (cero impacto retroactivo). Cuando admin asigna sus primeras sedes, automáticamente queda restringido a esas.

### BONUS implementados (no estaban en el plan original)

#### BONUS 1 — Auditoría de cambios de sede
- RPC `log_sede_change(prev, new, user_agent)` graba en `audit_log` cada vez que un usuario cambia de planta en el selector del topbar
- `setSedeActiva()` lo llama automáticamente en background
- Queda en el mismo `audit_log` BRCGS/FDA tamper-evident usando `table_name='_session_sede'`
- SQL: `sql/multi-sede/007_audit_log_sede_change.sql`

#### BONUS 2 — Health Check Multi-Sede dashboard
- Nuevo panel `modules/gerencia/sedes-health.{html,js}` con auto-refresh 60s
- 4 KPIs: sedes activas hoy / lentas (>12h) / inactivas (>48h) / total registros hoy
- Cards por sede con últimos timestamps de producción/empaque/personal + horas desde
- Tabla con últimos 20 cambios de sede (audit_log)
- RPC `sedes_health_status()` con SECURITY INVOKER (respeta RLS por usuario)
- SQL: `sql/multi-sede/008_sedes_health_status_rpc.sql`

#### BONUS 3 — Alertas cross-sede toast
- `assets/js/core/sedes-watcher.js` — daemon background, polling cada 5min
- Toast notifications animados cuando una sede está lenta (>12h) o inactiva (>48h)
- Cooldown 4h por sede para no hacer spam
- Click en el toast abre el dashboard sedes-health

#### BONUS 4 — Admin Sedes (CRUD + permisos)
- Nuevo panel `modules/gerencia/admin-sedes.{html,js}` solo para admin
- Tabla editable inline de sedes (nombre, color, ícono, ubicación, scale_factor, activa)
- Tabla de usuarios con chips clickeables para grant/revoke sedes
- Botón "Sync metadata → Calidad" que dispara la Edge Function
- 4 RPCs admin con hardening NULL-safe: `admin_list_usuarios_sedes`, `admin_grant_sede`, `admin_revoke_sede`, `admin_update_sede`
- Cada acción graba en `audit_log` (operation: GRANT, REVOKE, UPDATE_META)
- SQL: `sql/multi-sede/009_admin_sedes_management_rpcs.sql`

#### BONUS Extra — Edge Function sync-plant-to-sedes
- Función Deno desplegada en Supabase (verify_jwt=true, admin only)
- Mantiene sincronizada la tabla `Plant` (Prod) con la tabla `sedes` (Calidad) cuando admin edita metadata
- Doc: `sql/multi-sede/edge-function-sync-plant-to-sedes.md`
- [ ] UI muestra solo sedes permitidas en el selector

---

## Riesgos & mitigación

| Riesgo                                                  | Mitigación                                                      |
|---------------------------------------------------------|-----------------------------------------------------------------|
| Romper paneles existentes durante migración             | Sede default `FTP-HUA`; fallback si `sede_id` es null           |
| Confusión usuarios (¿qué sede estoy viendo?)            | Badge gigante en header + breadcrumb que dice "Viendo: FTP-PIU" |
| Maquila (PRC) tiene contabilidad distinta               | Campo `tipo='maquila'` permite filtros financieros separados    |
| Datos cross-sede contaminados (un registro mal tagueado)| RLS + validación en backend; auditoría en `audit_log`           |
| Performance con multi-tenant                            | Índices `(sede_id, fecha)`; consolidado usa materialized view   |

---

## Métricas de éxito

- ✅ Selector funciona sin recargar la página
- ✅ Cambio de sede actualiza KPIs/charts en <500ms
- ✅ Dashboard comparativo muestra las 3 plantas
- ✅ 0 errores en consola
- ✅ Funciona en mobile + dark mode
- ⏳ Fase 6: 14 paneles cableados a Supabase real
- ⏳ Fase 7: RLS funcional, jefe de Huaura no ve datos de Piura
