-- ════════════════════════════════════════════════════════
-- Migration 001: Extender tabla Plant para multi-sede
-- Aplicada: 2026-04-30 en proyecto rslzosmeteyzxmgfkppe (Producción)
-- ════════════════════════════════════════════════════════

ALTER TABLE "Plant"
  ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'propia',
  ADD COLUMN IF NOT EXISTS color TEXT NOT NULL DEFAULT '#0e7c3a',
  ADD COLUMN IF NOT EXISTS icono TEXT NOT NULL DEFAULT '🏭',
  ADD COLUMN IF NOT EXISTS activa BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS principal BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS scale_factor NUMERIC(4,2) NOT NULL DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS ubicacion TEXT,
  ADD COLUMN IF NOT EXISTS empresa TEXT;

ALTER TABLE "Plant" DROP CONSTRAINT IF EXISTS plant_code_unique;
ALTER TABLE "Plant" ADD CONSTRAINT plant_code_unique UNIQUE (code);

-- Renombrar plantas de simulación → reales
UPDATE "Plant"
SET name='FTP Huaura', code='FTP-HUA', address='Huaura, Lima',
    tipo='propia', color='#0e7c3a', icono='🏭',
    activa=true, principal=true, scale_factor=1.0,
    ubicacion='Huaura, Lima', empresa='Frutos Tropicales Peru Export S.A.C.'
WHERE id='6d8707af-3394-4018-8136-51bb8f6a52cb';

UPDATE "Plant"
SET name='FTP Piura', code='FTP-PIU', address='Piura',
    tipo='propia', color='#1e40af', icono='🏭',
    activa=true, principal=false, scale_factor=0.72,
    ubicacion='Piura', empresa='Frutos Tropicales Peru Export S.A.C.'
WHERE id='ad13a88f-8f1f-45b3-8afe-c36ae3cfdc81';

INSERT INTO "Plant" (id, name, code, address, tipo, color, icono, activa, principal, scale_factor, ubicacion, empresa)
SELECT gen_random_uuid(), 'PRC (Maquila)', 'PRC-MAQ', 'Lima',
       'maquila', '#ea580c', '🤝', true, false, 0.41, 'Lima',
       'Procesadora PRC S.A.C. (servicio de maquila)'
WHERE NOT EXISTS (SELECT 1 FROM "Plant" WHERE code='PRC-MAQ');

COMMENT ON TABLE "Plant" IS 'Plantas operativas (sedes). Extendida para multi-sede 2026-04-30. Usa code como lookup estable (FTP-HUA, FTP-PIU, PRC-MAQ).';
