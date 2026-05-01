-- ════════════════════════════════════════════════════════
-- Migration 002: Agregar plantId (FK a Plant) a 5 tablas operativas
-- Aplicada: 2026-04-30 en proyecto rslzosmeteyzxmgfkppe (Producción)
-- Backfill: todas las filas existentes → FTP-HUA (UUID 6d8707af-...)
-- ════════════════════════════════════════════════════════

-- Patron repetido para cada tabla:
-- 1. ADD COLUMN nullable
-- 2. UPDATE existing rows con default UUID de FTP-HUA
-- 3. SET NOT NULL + DEFAULT
-- 4. FK a Plant(id)
-- 5. INDEX (plantId, fecha)

-- registro_produccion (398 filas)
ALTER TABLE registro_produccion ADD COLUMN IF NOT EXISTS "plantId" TEXT;
UPDATE registro_produccion SET "plantId" = '6d8707af-3394-4018-8136-51bb8f6a52cb' WHERE "plantId" IS NULL;
ALTER TABLE registro_produccion
  ALTER COLUMN "plantId" SET NOT NULL,
  ALTER COLUMN "plantId" SET DEFAULT '6d8707af-3394-4018-8136-51bb8f6a52cb';
ALTER TABLE registro_produccion DROP CONSTRAINT IF EXISTS registro_produccion_plant_fkey;
ALTER TABLE registro_produccion ADD CONSTRAINT registro_produccion_plant_fkey
  FOREIGN KEY ("plantId") REFERENCES "Plant"(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_registro_produccion_plant_fecha ON registro_produccion("plantId", fecha);

-- registro_personal (10 filas)
ALTER TABLE registro_personal ADD COLUMN IF NOT EXISTS "plantId" TEXT;
UPDATE registro_personal SET "plantId" = '6d8707af-3394-4018-8136-51bb8f6a52cb' WHERE "plantId" IS NULL;
ALTER TABLE registro_personal
  ALTER COLUMN "plantId" SET NOT NULL,
  ALTER COLUMN "plantId" SET DEFAULT '6d8707af-3394-4018-8136-51bb8f6a52cb';
ALTER TABLE registro_personal DROP CONSTRAINT IF EXISTS registro_personal_plant_fkey;
ALTER TABLE registro_personal ADD CONSTRAINT registro_personal_plant_fkey
  FOREIGN KEY ("plantId") REFERENCES "Plant"(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_registro_personal_plant_fecha ON registro_personal("plantId", fecha);

-- registro_tuneles (19 filas)
ALTER TABLE registro_tuneles ADD COLUMN IF NOT EXISTS "plantId" TEXT;
UPDATE registro_tuneles SET "plantId" = '6d8707af-3394-4018-8136-51bb8f6a52cb' WHERE "plantId" IS NULL;
ALTER TABLE registro_tuneles
  ALTER COLUMN "plantId" SET NOT NULL,
  ALTER COLUMN "plantId" SET DEFAULT '6d8707af-3394-4018-8136-51bb8f6a52cb';
ALTER TABLE registro_tuneles DROP CONSTRAINT IF EXISTS registro_tuneles_plant_fkey;
ALTER TABLE registro_tuneles ADD CONSTRAINT registro_tuneles_plant_fkey
  FOREIGN KEY ("plantId") REFERENCES "Plant"(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_registro_tuneles_plant_fecha ON registro_tuneles("plantId", fecha);

-- registro_empaque_congelado (43 filas)
ALTER TABLE registro_empaque_congelado ADD COLUMN IF NOT EXISTS "plantId" TEXT;
UPDATE registro_empaque_congelado SET "plantId" = '6d8707af-3394-4018-8136-51bb8f6a52cb' WHERE "plantId" IS NULL;
ALTER TABLE registro_empaque_congelado
  ALTER COLUMN "plantId" SET NOT NULL,
  ALTER COLUMN "plantId" SET DEFAULT '6d8707af-3394-4018-8136-51bb8f6a52cb';
ALTER TABLE registro_empaque_congelado DROP CONSTRAINT IF EXISTS registro_empaque_plant_fkey;
ALTER TABLE registro_empaque_congelado ADD CONSTRAINT registro_empaque_plant_fkey
  FOREIGN KEY ("plantId") REFERENCES "Plant"(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_registro_empaque_plant_fecha ON registro_empaque_congelado("plantId", fecha);

-- config_costos (4 filas, sin fecha)
ALTER TABLE config_costos ADD COLUMN IF NOT EXISTS "plantId" TEXT;
UPDATE config_costos SET "plantId" = '6d8707af-3394-4018-8136-51bb8f6a52cb' WHERE "plantId" IS NULL;
ALTER TABLE config_costos
  ALTER COLUMN "plantId" SET NOT NULL,
  ALTER COLUMN "plantId" SET DEFAULT '6d8707af-3394-4018-8136-51bb8f6a52cb';
ALTER TABLE config_costos DROP CONSTRAINT IF EXISTS config_costos_plant_fkey;
ALTER TABLE config_costos ADD CONSTRAINT config_costos_plant_fkey
  FOREIGN KEY ("plantId") REFERENCES "Plant"(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_config_costos_plant ON config_costos("plantId");

COMMENT ON COLUMN registro_produccion."plantId" IS 'FK a Plant. Default: FTP-HUA. Backfill automatico 2026-04-30 (multi-sede).';
