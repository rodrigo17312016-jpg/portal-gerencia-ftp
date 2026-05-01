-- ════════════════════════════════════════════════════════
-- Migration 005: Fase 7 - usuarios_sedes + RLS por planta
-- Aplicada: 2026-05-01 en proyecto rslzosmeteyzxmgfkppe (Producción)
-- ════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS usuarios_sedes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plant_id    TEXT NOT NULL REFERENCES "Plant"(id) ON DELETE RESTRICT,
  is_default  BOOLEAN NOT NULL DEFAULT false,
  granted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  granted_by  UUID REFERENCES auth.users(id),
  UNIQUE(user_id, plant_id)
);
CREATE INDEX IF NOT EXISTS idx_usuarios_sedes_user ON usuarios_sedes(user_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_sedes_plant ON usuarios_sedes(plant_id);

ALTER TABLE usuarios_sedes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS usuarios_sedes_admin ON usuarios_sedes;
CREATE POLICY usuarios_sedes_admin ON usuarios_sedes FOR ALL TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
DROP POLICY IF EXISTS usuarios_sedes_self_read ON usuarios_sedes;
CREATE POLICY usuarios_sedes_self_read ON usuarios_sedes FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Helper: ¿el usuario actual tiene acceso a esta planta?
-- Admin pasa todo, sin grants explicitos también pasa todo (compat).
CREATE OR REPLACE FUNCTION user_has_plant_access(p_plant_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE v_role TEXT; v_uid UUID;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RETURN true; END IF;
  v_role := (auth.jwt() -> 'app_metadata' ->> 'role');
  IF v_role = 'admin' THEN RETURN true; END IF;
  IF NOT EXISTS (SELECT 1 FROM usuarios_sedes WHERE user_id = v_uid) THEN
    RETURN true;
  END IF;
  RETURN EXISTS (SELECT 1 FROM usuarios_sedes WHERE user_id = v_uid AND plant_id = p_plant_id);
END;
$$;
GRANT EXECUTE ON FUNCTION user_has_plant_access(TEXT) TO anon, authenticated;

-- Funcion para que el frontend pida solo sus sedes permitidas
CREATE OR REPLACE FUNCTION mis_sedes()
RETURNS TABLE (id TEXT, code TEXT, name TEXT, tipo TEXT, color TEXT, icono TEXT,
               principal BOOLEAN, scale_factor NUMERIC, ubicacion TEXT, empresa TEXT, is_default BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE v_role TEXT; v_uid UUID;
BEGIN
  v_uid := auth.uid();
  v_role := (auth.jwt() -> 'app_metadata' ->> 'role');
  IF v_role = 'admin' OR v_uid IS NULL OR NOT EXISTS (SELECT 1 FROM usuarios_sedes us WHERE us.user_id = v_uid) THEN
    RETURN QUERY
    SELECT p.id, p.code, p.name, p.tipo, p.color, p.icono, p.principal, p.scale_factor, p.ubicacion, p.empresa, p.principal AS is_default
    FROM "Plant" p WHERE p.activa ORDER BY p.principal DESC, p.code;
    RETURN;
  END IF;
  RETURN QUERY
  SELECT p.id, p.code, p.name, p.tipo, p.color, p.icono, p.principal, p.scale_factor, p.ubicacion, p.empresa, us.is_default
  FROM "Plant" p JOIN usuarios_sedes us ON us.plant_id = p.id
  WHERE p.activa AND us.user_id = v_uid ORDER BY us.is_default DESC, p.code;
END;
$$;
GRANT EXECUTE ON FUNCTION mis_sedes() TO anon, authenticated;

-- Aplicar filtro plantId a RLS de las 5 tablas operativas
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['registro_produccion', 'registro_personal', 'registro_tuneles', 'registro_empaque_congelado'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS auth_select_filtered_%I ON %I', t, t);
    EXECUTE format('CREATE POLICY auth_select_filtered_%I ON %I FOR SELECT TO authenticated USING (user_has_plant_access("plantId"))', t, t);
    EXECUTE format('DROP POLICY IF EXISTS role_write_%I ON %I', t, t);
    EXECUTE format($p$CREATE POLICY role_write_%I ON %I FOR ALL TO authenticated
      USING (((auth.jwt() -> 'app_metadata' ->> 'role') = ANY (ARRAY['admin','produccion'])) AND user_has_plant_access("plantId"))
      WITH CHECK (((auth.jwt() -> 'app_metadata' ->> 'role') = ANY (ARRAY['admin','produccion'])) AND user_has_plant_access("plantId"))$p$, t, t);
  END LOOP;
END $$;

-- config_costos (solo admin)
DROP POLICY IF EXISTS auth_select_filtered_config_costos ON config_costos;
CREATE POLICY auth_select_filtered_config_costos ON config_costos FOR SELECT TO authenticated USING (user_has_plant_access("plantId"));
DROP POLICY IF EXISTS admin_write_config_costos ON config_costos;
CREATE POLICY admin_write_config_costos ON config_costos FOR ALL TO authenticated
  USING (((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin') AND user_has_plant_access("plantId"))
  WITH CHECK (((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin') AND user_has_plant_access("plantId"));

COMMENT ON TABLE usuarios_sedes IS 'F7: asignación de plantas a usuarios. Sin filas = acceso a todo (compat).';
