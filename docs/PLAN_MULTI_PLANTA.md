# PLAN MULTI-PLANTA / MULTI-SEDE

**Estado:** Fases 1-4 implementadas como PoC con mock data. Fases 5-7 pendientes (cableado real a Supabase).
**Fecha:** 2026-04-30
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

### Fase 5 — Schema Supabase (siguiente PR)
- [ ] Migration: tabla `sedes` + seed 3 filas
- [ ] Migration: `alter table ... add column sede_id` en 14 tablas
- [ ] Migration: backfill de datos existentes a `FTP-HUA`
- [ ] Migration: índices `(sede_id, fecha)`

### Fase 6 — Cableo real (siguiente PR)
- [ ] Patch a 14 paneles para filtrar por `sede_id`
- [ ] Patch a 5 sub-apps (registro-*) para etiquetar la sede al guardar
- [ ] Apps de registro: pedir sede al abrir si rol no la tiene fijada

### Fase 7 — Roles por sede (siguiente PR)
- [ ] Tabla `usuarios_sedes`
- [ ] RLS policies en 14 tablas
- [ ] Roles nuevos: `jefe_planta_huaura`, `jefe_planta_piura`, `supervisor_maquila`
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
