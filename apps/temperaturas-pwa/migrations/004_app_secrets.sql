-- =============================================================
-- Migration 004: Tabla app_secrets para guardar API keys
-- de servicios externos (Gemini, etc.) que usa la Edge Function.
--
-- RLS sin policies = anon/authenticated NO ven nada.
-- Solo service_role (Edge Functions) puede leer/escribir.
-- =============================================================

CREATE TABLE IF NOT EXISTS public.app_secrets (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.app_secrets ENABLE ROW LEVEL SECURITY;

-- IMPORTANTE: NO crear policies. Sin policies, anon/authenticated NO pueden ver nada.
-- service_role bypassea RLS automáticamente (lo usa la Edge Function 'detect-temperatura').

COMMENT ON TABLE public.app_secrets IS
  'API keys y secrets para servicios externos. RLS sin policies bloquea anon/authenticated. Solo Edge Functions con service_role pueden leer.';

-- =============================================================
-- INSTRUCCIONES POST-MIGRATION
-- =============================================================
-- Para poblar la API key de Gemini (NO commitear la key al repo):
--
-- INSERT INTO public.app_secrets (key, value, description)
-- VALUES (
--   'GEMINI_API_KEY',
--   '<TU_API_KEY_DE_GOOGLE_AI_STUDIO>',
--   'Gemini Vision API key para temperaturas-pwa OCR fallback. Free tier: 1500/day.'
-- )
-- ON CONFLICT (key) DO UPDATE
--   SET value = EXCLUDED.value,
--       updated_at = NOW();
--
-- Obtener API key gratis en: https://aistudio.google.com/app/apikey
-- =============================================================
