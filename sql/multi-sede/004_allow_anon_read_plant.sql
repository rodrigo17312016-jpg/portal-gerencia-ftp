-- ════════════════════════════════════════════════════════
-- Migration 004: Permitir lectura anon de Plant (selector multi-sede)
-- Aplicada: 2026-04-30 en proyecto rslzosmeteyzxmgfkppe (Producción)
-- ════════════════════════════════════════════════════════
-- Plant es metadata operativa no-sensible (nombres + ubicaciones de plantas).
-- El frontend portal lo lee como anon para llenar el selector del topbar.

DROP POLICY IF EXISTS anon_read_Plant ON "Plant";
CREATE POLICY anon_read_Plant ON "Plant" FOR SELECT TO anon USING (true);

COMMENT ON POLICY anon_read_Plant ON "Plant" IS
  'Lectura publica - metadata de plantas no-sensible para selector multi-sede.';
