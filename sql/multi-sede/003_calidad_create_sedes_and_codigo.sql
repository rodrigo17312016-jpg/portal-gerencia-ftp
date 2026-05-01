-- ════════════════════════════════════════════════════════
-- Migration 003: Crear sedes + sede_codigo en proyecto Calidad
-- Aplicada: 2026-04-30 en proyecto obnvrfvcujsrmifvlqni (Calidad)
-- ════════════════════════════════════════════════════════
-- Espejo de Plant del proyecto produccion (no se puede FK cross-database).
-- Se sincroniza manualmente; el frontend usa sede_codigo (TEXT) como filtro.

CREATE TABLE IF NOT EXISTS sedes (
  codigo TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'propia',
  color TEXT NOT NULL DEFAULT '#0e7c3a',
  icono TEXT NOT NULL DEFAULT '🏭',
  activa BOOLEAN NOT NULL DEFAULT true,
  principal BOOLEAN NOT NULL DEFAULT false,
  scale_factor NUMERIC(4,2) NOT NULL DEFAULT 1.0,
  ubicacion TEXT,
  empresa TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO sedes (codigo, nombre, tipo, color, icono, principal, scale_factor, ubicacion, empresa) VALUES
  ('FTP-HUA', 'FTP Huaura', 'propia', '#0e7c3a', '🏭', true, 1.00, 'Huaura, Lima', 'Frutos Tropicales Peru Export S.A.C.'),
  ('FTP-PIU', 'FTP Piura', 'propia', '#1e40af', '🏭', false, 0.72, 'Piura', 'Frutos Tropicales Peru Export S.A.C.'),
  ('PRC-MAQ', 'PRC (Maquila)', 'maquila', '#ea580c', '🤝', false, 0.41, 'Lima', 'Procesadora PRC S.A.C.')
ON CONFLICT (codigo) DO UPDATE SET
  nombre=EXCLUDED.nombre, tipo=EXCLUDED.tipo, color=EXCLUDED.color,
  icono=EXCLUDED.icono, principal=EXCLUDED.principal, scale_factor=EXCLUDED.scale_factor,
  ubicacion=EXCLUDED.ubicacion, empresa=EXCLUDED.empresa;

ALTER TABLE sedes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sedes_read ON sedes;
DROP POLICY IF EXISTS sedes_admin_write ON sedes;
CREATE POLICY sedes_read ON sedes FOR SELECT USING (true);
CREATE POLICY sedes_admin_write ON sedes FOR ALL TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- registros_temperatura (5837 filas)
ALTER TABLE registros_temperatura ADD COLUMN IF NOT EXISTS sede_codigo TEXT;
UPDATE registros_temperatura SET sede_codigo='FTP-HUA' WHERE sede_codigo IS NULL;
ALTER TABLE registros_temperatura
  ALTER COLUMN sede_codigo SET NOT NULL,
  ALTER COLUMN sede_codigo SET DEFAULT 'FTP-HUA';
ALTER TABLE registros_temperatura DROP CONSTRAINT IF EXISTS registros_temperatura_sede_fkey;
ALTER TABLE registros_temperatura ADD CONSTRAINT registros_temperatura_sede_fkey
  FOREIGN KEY (sede_codigo) REFERENCES sedes(codigo) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_registros_temperatura_sede ON registros_temperatura(sede_codigo, created_at DESC);

-- consumos_insumos (428 filas)
ALTER TABLE consumos_insumos ADD COLUMN IF NOT EXISTS sede_codigo TEXT;
UPDATE consumos_insumos SET sede_codigo='FTP-HUA' WHERE sede_codigo IS NULL;
ALTER TABLE consumos_insumos
  ALTER COLUMN sede_codigo SET NOT NULL,
  ALTER COLUMN sede_codigo SET DEFAULT 'FTP-HUA';
ALTER TABLE consumos_insumos DROP CONSTRAINT IF EXISTS consumos_insumos_sede_fkey;
ALTER TABLE consumos_insumos ADD CONSTRAINT consumos_insumos_sede_fkey
  FOREIGN KEY (sede_codigo) REFERENCES sedes(codigo) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_consumos_insumos_sede ON consumos_insumos(sede_codigo);

COMMENT ON TABLE sedes IS 'Sedes operativas (espejo del proyecto produccion). Multi-sede 2026-04-30.';
