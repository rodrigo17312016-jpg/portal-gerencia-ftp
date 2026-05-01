-- ════════════════════════════════════════════════════════
-- Migration 010: TEMPLATE - Crear usuarios supervisores + asignar sedes
-- ════════════════════════════════════════════════════════
-- ⚠️ PLANTILLA AUDITABLE - NUNCA commitear con passwords reales.
--
-- Origen: post-incidente GitGuardian 2026-05-01. Los passwords reales
-- fueron leakeados en una version anterior de este archivo y rotados.
-- La historia git fue reescrita con git filter-repo para purgarlos.
--
-- Para crear/rotar usuarios reemplaza los placeholders ":XXX_PASSWORD"
-- por valores reales en tu copia local, ejecuta el SQL contra Supabase
-- (SQL Editor o psql), y NO COMMITEES los cambios. Si necesitas auditar
-- una rotacion, registra el evento en docs/SECURITY_INCIDENTS.md
-- (sin pegar el password).
-- ════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────
-- PARTE A: en proyecto Producción (rslzosmeteyzxmgfkppe)
-- ─────────────────────────────────────────────────────────

-- A.1 — Crear usuario produccionprc (idempotente)
DO $$
DECLARE
  v_uid UUID := '67889927-17ce-4469-aa8f-046f49701264';
  v_email TEXT := 'produccionprc@frutos-tropicales.pe';
  v_password TEXT := ':PRODUCCIONPRC_PASSWORD';  -- ← REEMPLAZAR LOCAL
BEGIN
  IF EXISTS (SELECT 1 FROM auth.users WHERE id = v_uid) THEN
    RAISE NOTICE 'Usuario produccionprc ya existe, skip';
    RETURN;
  END IF;

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    phone_change, phone_change_token, email_change_token_current, reauthentication_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_uid, 'authenticated', 'authenticated',
    v_email, crypt(v_password, gen_salt('bf')), now(),
    jsonb_build_object('role', 'produccion', 'provider', 'email',
                       'username', 'produccionprc',
                       'providers', jsonb_build_array('email')),
    '{}'::jsonb, now(), now(),
    '', '', '', '', '', '', '', ''
  );

  INSERT INTO auth.identities (
    provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) VALUES (
    v_uid::text, v_uid,
    jsonb_build_object('sub', v_uid::text, 'email', v_email,
                       'email_verified', true, 'phone_verified', false),
    'email', NULL, now(), now()
  );
END $$;

-- A.2 — Asignar sedes (independiente del password, siempre seguro de ejecutar)
INSERT INTO usuarios_sedes (user_id, plant_id, is_default) VALUES
  ('9304f0cc-92eb-47d9-9d82-8af173fa915b', '6d8707af-3394-4018-8136-51bb8f6a52cb', true),  -- produccion → HUA
  ('9304f0cc-92eb-47d9-9d82-8af173fa915b', '4d13f1ea-ac76-415f-9aea-16ab2f54ce4d', false), -- produccion → PRC
  ('67889927-17ce-4469-aa8f-046f49701264', '4d13f1ea-ac76-415f-9aea-16ab2f54ce4d', true)   -- produccionprc → PRC
ON CONFLICT (user_id, plant_id) DO UPDATE SET is_default = EXCLUDED.is_default;


-- ─────────────────────────────────────────────────────────
-- PARTE B: en proyecto Calidad (obnvrfvcujsrmifvlqni)
-- ─────────────────────────────────────────────────────────
-- Mismos UUIDs que en Prod para que las FKs cross-project funcionen.

DO $$
DECLARE
  users_to_clone JSONB := jsonb_build_array(
    jsonb_build_object('id','9304f0cc-92eb-47d9-9d82-8af173fa915b','email','produccion@frutos-tropicales.pe',   'username','produccion',   'role','produccion','password',':PRODUCCION_PASSWORD'),
    jsonb_build_object('id','67889927-17ce-4469-aa8f-046f49701264','email','produccionprc@frutos-tropicales.pe','username','produccionprc','role','produccion','password',':PRODUCCIONPRC_PASSWORD')
  );
  u JSONB;
BEGIN
  FOR u IN SELECT * FROM jsonb_array_elements(users_to_clone) LOOP
    IF EXISTS (SELECT 1 FROM auth.users WHERE id = (u->>'id')::uuid) THEN CONTINUE; END IF;

    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      phone_change, phone_change_token, email_change_token_current, reauthentication_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', (u->>'id')::uuid,
      'authenticated', 'authenticated', u->>'email',
      crypt(u->>'password', gen_salt('bf')), now(),
      jsonb_build_object('role', u->>'role', 'provider', 'email',
                         'username', u->>'username',
                         'providers', jsonb_build_array('email')),
      '{}'::jsonb, now(), now(),
      '', '', '', '', '', '', '', ''
    );

    INSERT INTO auth.identities (
      provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) VALUES (
      u->>'id', (u->>'id')::uuid,
      jsonb_build_object('sub', u->>'id', 'email', u->>'email',
                         'email_verified', true, 'phone_verified', false),
      'email', NULL, now(), now()
    );
  END LOOP;
END $$;

INSERT INTO usuarios_sedes (user_id, sede_codigo, is_default) VALUES
  ('9304f0cc-92eb-47d9-9d82-8af173fa915b', 'FTP-HUA', true),
  ('9304f0cc-92eb-47d9-9d82-8af173fa915b', 'PRC-MAQ', false),
  ('67889927-17ce-4469-aa8f-046f49701264', 'PRC-MAQ', true)
ON CONFLICT (user_id, sede_codigo) DO UPDATE SET is_default = EXCLUDED.is_default;

-- ─────────────────────────────────────────────────────────
-- ROTAR PASSWORD existente (usar para mantenimiento periódico)
-- ─────────────────────────────────────────────────────────
-- Ejecutar en AMBOS proyectos (Prod + Calidad):
/*
UPDATE auth.users
SET encrypted_password = crypt(':NUEVO_PASSWORD_AQUI', gen_salt('bf')),
    updated_at = now()
WHERE email = ':EMAIL_USUARIO';
*/
