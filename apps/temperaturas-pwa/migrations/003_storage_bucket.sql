-- =============================================================
-- Migration 003: Storage bucket para fotos evidencia
-- Privado, JPEG ~200KB. RLS: lectura publica via signed URL,
-- escritura solo authenticated users.
-- =============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'temperaturas-fotos',
  'temperaturas-fotos',
  false,
  524288,                                    -- 512 KB max (PWA comprime a ~200 KB)
  ARRAY['image/jpeg','image/png','image/webp']
)
ON CONFLICT (id) DO UPDATE
  SET file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Policies storage
DROP POLICY IF EXISTS "temp_fotos_read_authenticated" ON storage.objects;
CREATE POLICY "temp_fotos_read_authenticated" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'temperaturas-fotos'
    AND (auth.role() = 'authenticated' OR auth.role() = 'service_role')
  );

DROP POLICY IF EXISTS "temp_fotos_insert_authenticated" ON storage.objects;
CREATE POLICY "temp_fotos_insert_authenticated" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'temperaturas-fotos'
    AND (auth.role() = 'authenticated' OR auth.role() = 'service_role' OR auth.role() = 'anon')
    -- anon permitido temporalmente: la PWA opera sin login todavia.
    -- Cuando se integre auth completo en el portal, restringir a authenticated.
  );

-- No DELETE policy: las fotos son evidencia BRCGS/HACCP, no se borran desde la app.
-- Limpieza programada (>2 anos) via cron job aparte.
