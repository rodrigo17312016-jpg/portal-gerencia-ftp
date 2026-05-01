-- ════════════════════════════════════════════════════════
-- Migration 009: BONUS 4 - RPCs admin para gestion de sedes
-- Aplicada: 2026-05-01 en proyecto rslzosmeteyzxmgfkppe (Producción)
-- HARDENING: usa IS DISTINCT FROM en checks para que NULL bloquee anon.
-- ════════════════════════════════════════════════════════

-- 1. Listar usuarios con sus sedes asignadas
CREATE OR REPLACE FUNCTION admin_list_usuarios_sedes()
RETURNS TABLE (user_id UUID, email TEXT, username TEXT, role TEXT,
               last_sign_in TIMESTAMPTZ, sedes_count INTEGER, sedes_codes TEXT[])
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE v_role TEXT;
BEGIN
  v_role := (auth.jwt() -> 'app_metadata' ->> 'role');
  IF v_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Solo admin puede listar permisos (rol actual: %)', coalesce(v_role, 'anon');
  END IF;
  RETURN QUERY
  SELECT u.id, u.email::TEXT,
         (u.raw_app_meta_data ->> 'username')::TEXT,
         (u.raw_app_meta_data ->> 'role')::TEXT,
         u.last_sign_in_at,
         coalesce(grants.cnt, 0)::INTEGER,
         coalesce(grants.codes, ARRAY[]::TEXT[])
  FROM auth.users u
  LEFT JOIN (
    SELECT us.user_id, count(*)::INTEGER AS cnt, array_agg(p.code ORDER BY p.code) AS codes
    FROM usuarios_sedes us JOIN "Plant" p ON p.id = us.plant_id
    GROUP BY us.user_id
  ) grants ON grants.user_id = u.id
  WHERE u.email::TEXT LIKE '%@frutos-tropicales.pe'
  ORDER BY u.email;
END;
$$;

-- 2. Asignar sede
CREATE OR REPLACE FUNCTION admin_grant_sede(p_user_id UUID, p_plant_code TEXT, p_is_default BOOLEAN DEFAULT false)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE v_role TEXT; v_plant_id TEXT; v_id UUID;
BEGIN
  v_role := (auth.jwt() -> 'app_metadata' ->> 'role');
  IF v_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Solo admin puede asignar sedes (rol actual: %)', coalesce(v_role, 'anon');
  END IF;
  SELECT id INTO v_plant_id FROM "Plant" WHERE code = p_plant_code;
  IF v_plant_id IS NULL THEN RAISE EXCEPTION 'Planta % no existe', p_plant_code; END IF;
  INSERT INTO usuarios_sedes (user_id, plant_id, is_default, granted_by)
  VALUES (p_user_id, v_plant_id, p_is_default, auth.uid())
  ON CONFLICT (user_id, plant_id) DO UPDATE SET is_default = EXCLUDED.is_default
  RETURNING id INTO v_id;
  INSERT INTO audit_log (table_name, operation, row_id, user_id, user_email, user_role, new_data)
  SELECT 'usuarios_sedes', 'GRANT', v_id::TEXT, auth.uid(), u.email, v_role,
         jsonb_build_object('user_id', p_user_id, 'plant_code', p_plant_code, 'is_default', p_is_default)
  FROM auth.users u WHERE u.id = auth.uid();
  RETURN v_id;
END;
$$;

-- 3. Revocar sede
CREATE OR REPLACE FUNCTION admin_revoke_sede(p_user_id UUID, p_plant_code TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE v_role TEXT; v_plant_id TEXT; v_deleted INTEGER;
BEGIN
  v_role := (auth.jwt() -> 'app_metadata' ->> 'role');
  IF v_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Solo admin puede revocar sedes (rol actual: %)', coalesce(v_role, 'anon');
  END IF;
  SELECT id INTO v_plant_id FROM "Plant" WHERE code = p_plant_code;
  IF v_plant_id IS NULL THEN RETURN false; END IF;
  DELETE FROM usuarios_sedes WHERE user_id = p_user_id AND plant_id = v_plant_id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  IF v_deleted > 0 THEN
    INSERT INTO audit_log (table_name, operation, row_id, user_id, user_email, user_role, new_data)
    SELECT 'usuarios_sedes', 'REVOKE', NULL, auth.uid(), u.email, v_role,
           jsonb_build_object('user_id', p_user_id, 'plant_code', p_plant_code)
    FROM auth.users u WHERE u.id = auth.uid();
  END IF;
  RETURN v_deleted > 0;
END;
$$;

-- 4. Actualizar metadata de sede
CREATE OR REPLACE FUNCTION admin_update_sede(
  p_code TEXT, p_name TEXT DEFAULT NULL, p_color TEXT DEFAULT NULL,
  p_icono TEXT DEFAULT NULL, p_activa BOOLEAN DEFAULT NULL,
  p_ubicacion TEXT DEFAULT NULL, p_scale_factor NUMERIC DEFAULT NULL
) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE v_role TEXT; v_updated INTEGER;
BEGIN
  v_role := (auth.jwt() -> 'app_metadata' ->> 'role');
  IF v_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Solo admin puede actualizar sedes (rol actual: %)', coalesce(v_role, 'anon');
  END IF;
  UPDATE "Plant"
  SET name = coalesce(p_name, name), color = coalesce(p_color, color),
      icono = coalesce(p_icono, icono), activa = coalesce(p_activa, activa),
      ubicacion = coalesce(p_ubicacion, ubicacion), scale_factor = coalesce(p_scale_factor, scale_factor)
  WHERE code = p_code;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated > 0 THEN
    INSERT INTO audit_log (table_name, operation, row_id, user_id, user_email, user_role, new_data)
    SELECT 'Plant', 'UPDATE_META', p_code, auth.uid(), u.email, v_role,
           jsonb_build_object('code', p_code, 'name', p_name, 'color', p_color, 'icono', p_icono,
                              'activa', p_activa, 'ubicacion', p_ubicacion, 'scale_factor', p_scale_factor)
    FROM auth.users u WHERE u.id = auth.uid();
  END IF;
  RETURN v_updated > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_list_usuarios_sedes() TO authenticated;
GRANT EXECUTE ON FUNCTION admin_grant_sede(UUID, TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_revoke_sede(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_update_sede(TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT, NUMERIC) TO authenticated;
