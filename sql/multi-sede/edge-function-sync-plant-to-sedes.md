# Edge Function: sync-plant-to-sedes

**Estado:** ✅ Desplegada en `rslzosmeteyzxmgfkppe`, version 1, ACTIVE
**URL:** `https://rslzosmeteyzxmgfkppe.supabase.co/functions/v1/sync-plant-to-sedes`
**verify_jwt:** true (requiere JWT con rol admin)

## Propósito

Cuando un admin cambia metadata de una sede en el proyecto Producción (tabla `Plant`),
esta función sincroniza la copia espejo en el proyecto Calidad (tabla `sedes`).

Es la pieza que mantiene consistencia cross-database al editar:
nombre, color, ícono, ubicación, scale_factor, etc.

## Uso desde el Admin Sedes UI

Botón "⟲ Sync metadata → Calidad" en `modules/gerencia/admin-sedes.html`.
Hace POST a la URL con el JWT del admin como Authorization Bearer.

## Body

```json
{}                          // Sincroniza todas las plantas activas
{ "code": "FTP-PIU" }       // Sincroniza solo una planta
```

## Secrets requeridos en Supabase

```bash
supabase secrets set CALIDAD_SERVICE_ROLE_KEY=<service_role_key_del_proyecto_calidad> \
  --project-ref rslzosmeteyzxmgfkppe
```

> ⚠️ Sin este secret la función devuelve 500 con un mensaje claro.

## Source code

Versionado en este repo: `proyecto/sql/multi-sede/edge-function-sync-plant-to-sedes/index.ts`
(deployed via `mcp__supabase__deploy_edge_function`).
