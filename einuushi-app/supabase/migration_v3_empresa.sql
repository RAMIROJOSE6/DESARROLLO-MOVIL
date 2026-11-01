-- ============================================================================
-- MIGRACIÓN SUPABASE V3: TABLA DE EMPRESAS / ARQUITECTURA MULTITIENDA
-- ============================================================================
-- Ejecuta este script en el SQL Editor de Supabase (https://supabase.com/dashboard/project/ismvmlcemxkawdwextzk/sql)
-- para habilitar la tabla de empresas y migrar la información oficial de Einuushi.

CREATE TABLE IF NOT EXISTS empresas (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  razon_social TEXT,
  nit TEXT,
  slogan TEXT,
  descripcion TEXT,
  logo_url TEXT,
  banner_url TEXT,
  telefono TEXT,
  whatsapp TEXT,
  email TEXT,
  direccion TEXT,
  ciudad TEXT,
  departamento TEXT,
  pais TEXT DEFAULT 'Colombia',
  moneda TEXT DEFAULT 'COP',
  simbolo_moneda TEXT DEFAULT '$',
  costo_envio_base NUMERIC DEFAULT 16000,
  is_activa BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS (Row Level Security)
ALTER TABLE empresas ENABLE ROW LEVEL SECURITY;

-- Políticas de seguridad
DROP POLICY IF EXISTS "Lectura publica de empresas" ON empresas;
CREATE POLICY "Lectura publica de empresas" ON empresas
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Escritura de empresas" ON empresas;
CREATE POLICY "Escritura de empresas" ON empresas
  FOR ALL USING (true) WITH CHECK (true);

-- Semilla oficial inicial: Registro y migración de datos de Einuushi
INSERT INTO empresas (
  id,
  nombre,
  razon_social,
  nit,
  slogan,
  descripcion,
  logo_url,
  telefono,
  whatsapp,
  email,
  direccion,
  ciudad,
  departamento,
  pais,
  moneda,
  simbolo_moneda,
  costo_envio_base,
  is_activa
) VALUES (
  'einuushi',
  'Einuushi',
  'Einuushi Artesanías Wayuu S.A.S.',
  '900.123.456-7',
  'Arte, Cultura y Tradición Wayuu',
  'Tienda oficial de artesanías tradicionales wayuu hechas a mano por maestras artesanas de La Guajira, Colombia.',
  'https://ismvmlcemxkawdwextzk.supabase.co/storage/v1/object/public/einuushi-media/branding/logo_einuushi.jpeg',
  '3009998877',
  '3009998877',
  'admin@einuushi.com',
  'Calle 1 # 2-3, Centro',
  'Riohacha',
  'La Guajira',
  'Colombia',
  'COP',
  '$',
  16000,
  true
)
ON CONFLICT (id) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  razon_social = EXCLUDED.razon_social,
  nit = EXCLUDED.nit,
  slogan = EXCLUDED.slogan,
  descripcion = EXCLUDED.descripcion,
  logo_url = EXCLUDED.logo_url,
  telefono = EXCLUDED.telefono,
  whatsapp = EXCLUDED.whatsapp,
  email = EXCLUDED.email,
  direccion = EXCLUDED.direccion,
  ciudad = EXCLUDED.ciudad,
  departamento = EXCLUDED.departamento,
  updated_at = timezone('utc'::text, now());

