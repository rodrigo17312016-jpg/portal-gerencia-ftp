-- =============================================================
-- Migration 001: Tabla maestra areas_temperatura
-- Reemplaza el objeto rangos hardcodeado en _legacy/dashboards-old/temperaturas.html
-- Permite admin sin tocar código (activar/desactivar áreas, editar rangos)
-- =============================================================

CREATE TABLE IF NOT EXISTS public.areas_temperatura (
  codigo          TEXT PRIMARY KEY,
  nombre          TEXT NOT NULL,
  formato         TEXT NOT NULL CHECK (formato IN ('mp','proceso','empaque')),
  limite_max      NUMERIC NOT NULL,
  critico_max     NUMERIC NOT NULL,
  tipo_equipo     TEXT NOT NULL DEFAULT 'visor'
                  CHECK (tipo_equipo IN ('visor','termometro_portatil','termoregistro')),
  activa          BOOLEAN NOT NULL DEFAULT TRUE,
  orden           INTEGER NOT NULL DEFAULT 0,
  sede_codigo     TEXT REFERENCES public.sedes(codigo) ON UPDATE CASCADE,
  -- NULL = aplica a todas las sedes (compatibilidad). Texto = sede específica.
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_areas_temp_activa ON public.areas_temperatura (activa, orden);
CREATE INDEX IF NOT EXISTS idx_areas_temp_formato ON public.areas_temperatura (formato);
CREATE INDEX IF NOT EXISTS idx_areas_temp_sede ON public.areas_temperatura (sede_codigo);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.fn_areas_temp_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_areas_temp_updated_at ON public.areas_temperatura;
CREATE TRIGGER trg_areas_temp_updated_at
  BEFORE UPDATE ON public.areas_temperatura
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_areas_temp_touch_updated_at();

-- RLS: lectura pública (anon + authenticated), escritura solo admin
ALTER TABLE public.areas_temperatura ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "areas_temp_read_all" ON public.areas_temperatura;
CREATE POLICY "areas_temp_read_all" ON public.areas_temperatura
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "areas_temp_write_authenticated" ON public.areas_temperatura;
CREATE POLICY "areas_temp_write_authenticated" ON public.areas_temperatura
  FOR ALL USING (auth.role() = 'authenticated' OR auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- =============================================================
-- SEED: rangos vigentes confirmados por Rodrigo 2026-05-02
-- (extraídos de _legacy/dashboards-old/temperaturas.html línea 1551)
-- REEFERs van con activa=FALSE (no se están usando por ahora)
-- =============================================================
INSERT INTO public.areas_temperatura
  (codigo, nombre, formato, limite_max, critico_max, tipo_equipo, activa, orden) VALUES
  ('CAMARA DE MATERIA PRIMA',      'Cámara Materia Prima',      'mp',       8,  13, 'visor',                TRUE,   1),
  ('TEMPERATURA DE PRODUCTO(MP)',  'Temp. Producto (MP)',       'mp',     -20, -15, 'termometro_portatil',  TRUE,   2),
  ('ACONDICIONADO',                'Acondicionado',             'proceso',  17,  22, 'termometro_portatil',  TRUE,  10),
  ('EMBANDEJADO',                  'Embandejado',               'proceso',  15,  20, 'termometro_portatil',  TRUE,  11),
  ('LAVADO DE BANDEJAS',           'Lavado de Bandejas',        'proceso',  18,  23, 'termometro_portatil',  TRUE,  12),
  ('PRE ENFRIADO',                 'Pre-Enfriado',              'proceso',  10,  15, 'termometro_portatil',  TRUE,  13),
  ('EMPAQUE',                      'Empaque',                   'empaque',   5,  10, 'termometro_portatil',  TRUE,  20),
  ('TEMPERATURA PRODUCTO',         'Temp. Producto',            'empaque', -18, -13, 'termometro_portatil',  TRUE,  21),
  ('CAMARA DE PRODUCTO TERMINADO', 'Cámara Producto Terminado', 'empaque', -20, -15, 'termoregistro',        TRUE,  22),
  ('DESPACHO',                     'Despacho',                  'empaque',   5,  10, 'termometro_portatil',  TRUE,  23),
  ('REEFER 1',                     'Reefer 1',                  'mp',        8,  13, 'visor',                FALSE, 100),
  ('REEFER 2',                     'Reefer 2',                  'mp',        8,  13, 'visor',                FALSE, 101),
  ('REEFER 3',                     'Reefer 3',                  'mp',        8,  13, 'visor',                FALSE, 102),
  ('REEFER 4',                     'Reefer 4',                  'mp',        8,  13, 'visor',                FALSE, 103),
  ('REEFER 5',                     'Reefer 5',                  'mp',        8,  13, 'visor',                FALSE, 104),
  ('REEFER 6',                     'Reefer 6',                  'mp',        8,  13, 'visor',                FALSE, 105),
  ('REEFER 7',                     'Reefer 7',                  'mp',        8,  13, 'visor',                FALSE, 106),
  ('REEFER 8',                     'Reefer 8',                  'mp',        8,  13, 'visor',                FALSE, 107),
  ('REEFER 9',                     'Reefer 9',                  'mp',        8,  13, 'visor',                FALSE, 108),
  ('REEFER 10',                    'Reefer 10',                 'mp',        8,  13, 'visor',                FALSE, 109)
ON CONFLICT (codigo) DO NOTHING;

COMMENT ON TABLE public.areas_temperatura IS 'Catalogo de areas con rangos de temperatura. Reemplaza objeto rangos hardcodeado. Editable via panel admin sin tocar codigo.';
