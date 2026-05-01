-- ════════════════════════════════════════════════════════
-- Migration 007: BONUS 1 - log_sede_change RPC
-- Aplicada: 2026-05-01 en proyecto rslzosmeteyzxmgfkppe (Producción)
-- ════════════════════════════════════════════════════════
-- Funcion que el frontend llama cuando un usuario cambia de sede en el selector.
-- INSERT en audit_log compartido (BRCGS/FDA tamper-evident).

CREATE OR REPLACE FUNCTION log_sede_change(
  p_codigo_anterior TEXT,
  p_codigo_nuevo    TEXT,
  p_user_agent      TEXT DEFAULT NULL
) RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth
AS $$
DECLARE v_uid UUID; v_email TEXT; v_role TEXT; v_id BIGINT;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RETURN NULL; END IF;
  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
  v_role := (auth.jwt() -> 'app_metadata' ->> 'role');
  INSERT INTO audit_log (table_name, operation, row_id, user_id, user_email, user_role, old_data, new_data)
  VALUES ('_session_sede', 'SEDE_CHANGE', NULL, v_uid, v_email, v_role,
          jsonb_build_object('codigo', p_codigo_anterior),
          jsonb_build_object('codigo', p_codigo_nuevo, 'user_agent', p_user_agent))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION log_sede_change(TEXT, TEXT, TEXT) TO authenticated;
