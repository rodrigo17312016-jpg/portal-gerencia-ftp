-- ════════════════════════════════════════════════════════
-- Migration 008: BONUS 2 - sedes_health_status RPC
-- Aplicada: 2026-05-01 en proyecto rslzosmeteyzxmgfkppe (Producción)
-- ════════════════════════════════════════════════════════
-- Devuelve estado en tiempo real de cada planta para el dashboard health-check.
-- Respeta RLS (SECURITY INVOKER) - admin ve todas, usuarios solo las suyas.

CREATE OR REPLACE FUNCTION sedes_health_status()
RETURNS TABLE (
  plant_id TEXT, code TEXT, name TEXT, color TEXT, icono TEXT, tipo TEXT,
  ultimo_produccion TIMESTAMPTZ, horas_ult_produccion NUMERIC,
  ultimo_empaque TIMESTAMPTZ, horas_ult_empaque NUMERIC,
  ultimo_personal TIMESTAMPTZ, horas_ult_personal NUMERIC,
  filas_hoy_produccion BIGINT, filas_hoy_empaque BIGINT,
  estado TEXT
)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH visibles AS (
    SELECT p.* FROM "Plant" p WHERE p.activa AND user_has_plant_access(p.id)
  ),
  prod AS (
    SELECT "plantId" AS pid, max(created_at) AS ult,
           count(*) FILTER (WHERE fecha = CURRENT_DATE) AS hoy
    FROM registro_produccion GROUP BY "plantId"
  ),
  emp AS (
    SELECT "plantId" AS pid, max(created_at) AS ult,
           count(*) FILTER (WHERE fecha = CURRENT_DATE) AS hoy
    FROM registro_empaque_congelado GROUP BY "plantId"
  ),
  per AS (
    SELECT "plantId" AS pid, max(created_at) AS ult
    FROM registro_personal GROUP BY "plantId"
  )
  SELECT v.id, v.code, v.name, v.color, v.icono, v.tipo,
    prod.ult, CASE WHEN prod.ult IS NULL THEN NULL ELSE round(extract(epoch FROM (now() - prod.ult)) / 3600.0, 1) END,
    emp.ult, CASE WHEN emp.ult IS NULL THEN NULL ELSE round(extract(epoch FROM (now() - emp.ult)) / 3600.0, 1) END,
    per.ult, CASE WHEN per.ult IS NULL THEN NULL ELSE round(extract(epoch FROM (now() - per.ult)) / 3600.0, 1) END,
    coalesce(prod.hoy, 0), coalesce(emp.hoy, 0),
    CASE
      WHEN coalesce(prod.hoy, 0) > 0 OR coalesce(emp.hoy, 0) > 0 THEN 'activa'
      WHEN prod.ult IS NULL AND emp.ult IS NULL AND per.ult IS NULL THEN 'sin-datos'
      WHEN extract(epoch FROM (now() - greatest(coalesce(prod.ult, '1970-01-01'::timestamptz),
                                                 coalesce(emp.ult, '1970-01-01'::timestamptz),
                                                 coalesce(per.ult, '1970-01-01'::timestamptz)))) < 43200 THEN 'lenta'
      ELSE 'inactiva'
    END
  FROM visibles v
  LEFT JOIN prod ON prod.pid = v.id
  LEFT JOIN emp ON emp.pid = v.id
  LEFT JOIN per ON per.pid = v.id
  ORDER BY v.principal DESC, v.code;
END;
$$;
GRANT EXECUTE ON FUNCTION sedes_health_status() TO anon, authenticated;
