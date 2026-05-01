-- ════════════════════════════════════════════════════════
-- Migration 006: Fase 7 - usuarios_sedes en Calidad + RLS
-- Aplicada: 2026-05-01 en proyecto obnvrfvcujsrmifvlqni (Calidad)
-- ════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS usuarios_sedes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sede_codigo TEXT NOT NULL REFERENCES sedes(codigo) ON DELETE RESTRICT,
  is_default  BOOLEAN NOT NULL DEFAULT false,
  granted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  granted_by  UUID REFERENCES auth.users(id),
  UNIQUE(user_id, sede_codigo)
);
CREATE INDEX IF NOT EXISTS idx_usuarios_sedes_user ON usuarios_sedes(user_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_sedes_sede ON usuarios_sedes(sede_codigo);

ALTER TABLE usuarios_sedes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS usuarios_sedes_admin ON usuarios_sedes;
CREATE POLICY usuarios_sedes_admin ON usuarios_sedes FOR ALL TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
DROP POLICY IF EXISTS usuarios_sedes_self_read ON usuarios_sedes;
CREATE POLICY usuarios_sedes_self_read ON usuarios_sedes FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION user_has_sede_access(p_sede_codigo TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth
AS $$
DECLARE v_role TEXT; v_uid UUID;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RETURN true; END IF;
  v_role := (auth.jwt() -> 'app_metadata' ->> 'role');
  IF v_role = 'admin' THEN RETURN true; END IF;
  IF NOT EXISTS (SELECT 1 FROM usuarios_sedes WHERE user_id = v_uid) THEN RETURN true; END IF;
  RETURN EXISTS (SELECT 1 FROM usuarios_sedes WHERE user_id = v_uid AND sede_codigo = p_sede_codigo);
END;
$$;
GRANT EXECUTE ON FUNCTION user_has_sede_access(TEXT) TO anon, authenticated;

DROP POLICY IF EXISTS auth_select_filtered_temperatura ON registros_temperatura;
CREATE POLICY auth_select_filtered_temperatura ON registros_temperatura
  FOR SELECT TO authenticated USING (user_has_sede_access(sede_codigo));

DROP POLICY IF EXISTS auth_select_filtered_consumos ON consumos_insumos;
CREATE POLICY auth_select_filtered_consumos ON consumos_insumos
  FOR SELECT TO authenticated USING (user_has_sede_access(sede_codigo));
