-- =============================================================
-- Migration 002: Extender registros_temperatura para PWA
-- Agrega: foto evidencia, datos OCR, origen, ID offline para deduplicacion
-- =============================================================

ALTER TABLE public.registros_temperatura
  ADD COLUMN IF NOT EXISTS foto_url            TEXT,
  ADD COLUMN IF NOT EXISTS ocr_valor_detectado NUMERIC,
  ADD COLUMN IF NOT EXISTS ocr_confianza       NUMERIC
                                               CHECK (ocr_confianza IS NULL
                                                      OR (ocr_confianza >= 0 AND ocr_confianza <= 100)),
  ADD COLUMN IF NOT EXISTS origen              TEXT NOT NULL DEFAULT 'manual'
                                               CHECK (origen IN ('manual','pwa_ocr','pwa_manual','dashboard','chatbot','sheets')),
  ADD COLUMN IF NOT EXISTS sync_offline_id     UUID;

-- Indice unico parcial: si sync_offline_id no es NULL, debe ser unico por sede.
-- Esto previene duplicados cuando el PWA reintenta sincronizar registros offline.
CREATE UNIQUE INDEX IF NOT EXISTS idx_registros_temp_sync_offline
  ON public.registros_temperatura (sync_offline_id, sede_codigo)
  WHERE sync_offline_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_registros_temp_origen
  ON public.registros_temperatura (origen, fecha DESC);

COMMENT ON COLUMN public.registros_temperatura.foto_url IS 'URL del bucket temperaturas-fotos (NULL si operario salto la foto).';
COMMENT ON COLUMN public.registros_temperatura.ocr_valor_detectado IS 'Valor que detecto Tesseract.js antes de la confirmacion manual. Para auditoria de calidad OCR.';
COMMENT ON COLUMN public.registros_temperatura.ocr_confianza IS 'Confianza 0-100 del OCR. NULL si no se uso OCR.';
COMMENT ON COLUMN public.registros_temperatura.origen IS 'Origen del registro: manual (legacy), pwa_ocr (foto+OCR), pwa_manual (digitado en PWA), dashboard, chatbot, sheets.';
COMMENT ON COLUMN public.registros_temperatura.sync_offline_id IS 'UUID generado en el cliente PWA. Permite dedup cuando se reintenta upload offline.';
