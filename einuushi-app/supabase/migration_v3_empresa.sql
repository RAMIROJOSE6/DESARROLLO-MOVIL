-- ============================================================================
-- MIGRACIÓN SUPABASE V3: TABLA DE EMPRESAS Y ARQUITECTURA MULTITIENDA CENTRALIZADA
-- ============================================================================
-- Ejecuta este script completo en el SQL Editor de Supabase (https://supabase.com/dashboard/project/ismvmlcemxkawdwextzk/sql)
-- para crear la tabla 'empresas', migrar a Einuushi y vincular la columna 'empresa_id' a todas las tablas.

-- 1. CREACIÓN DE LA TABLA 'empresas'
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

-- 2. HABILITAR SEGURIDAD RLS
ALTER TABLE empresas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lectura publica de empresas" ON empresas;
CREATE POLICY "Lectura publica de empresas" ON empresas
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Escritura de empresas" ON empresas;
CREATE POLICY "Escritura de empresas" ON empresas
  FOR ALL USING (true) WITH CHECK (true);

-- 3. SEMILLA OFICIAL: REGISTRO DE EINUUSHI COMO EMPRESA PRINCIPAL
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

-- 4. VINCULACIÓN DE LA COLUMNA 'empresa_id' EN TODAS LAS TABLAS OPERATIVAS
-- Garantiza que cada tienda mantenga sus productos, pedidos y configuraciones aislados
DO $$ 
BEGIN 
  -- Tabla products
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='empresa_id') THEN
    ALTER TABLE products ADD COLUMN empresa_id TEXT DEFAULT 'einuushi';
  END IF;

  -- Tabla categories
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='categories' AND column_name='empresa_id') THEN
    ALTER TABLE categories ADD COLUMN empresa_id TEXT DEFAULT 'einuushi';
  END IF;

  -- Tabla orders
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='empresa_id') THEN
    ALTER TABLE orders ADD COLUMN empresa_id TEXT DEFAULT 'einuushi';
  END IF;

  -- Tabla payment_methods
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payment_methods' AND column_name='empresa_id') THEN
    ALTER TABLE payment_methods ADD COLUMN empresa_id TEXT DEFAULT 'einuushi';
  END IF;

  -- Tabla custom_quotes
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='custom_quotes' AND column_name='empresa_id') THEN
    ALTER TABLE custom_quotes ADD COLUMN empresa_id TEXT DEFAULT 'einuushi';
  END IF;

  -- Tabla chat_messages
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='chat_messages' AND column_name='empresa_id') THEN
    ALTER TABLE chat_messages ADD COLUMN empresa_id TEXT DEFAULT 'einuushi';
  END IF;

  -- Tabla admin_activity_logs
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='admin_activity_logs' AND column_name='empresa_id') THEN
    ALTER TABLE admin_activity_logs ADD COLUMN empresa_id TEXT DEFAULT 'einuushi';
  END IF;

  -- Tabla users (para administradores y repartidores específicos de cada tienda)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='empresa_id') THEN
    ALTER TABLE users ADD COLUMN empresa_id TEXT DEFAULT 'einuushi';
  END IF;
END $$;

-- 5. ACTUALIZAR REGISTROS EXISTENTES PARA QUE QUEDEN BAJO 'einuushi'
UPDATE products SET empresa_id = 'einuushi' WHERE empresa_id IS NULL;
UPDATE categories SET empresa_id = 'einuushi' WHERE empresa_id IS NULL;
UPDATE orders SET empresa_id = 'einuushi' WHERE empresa_id IS NULL;
UPDATE payment_methods SET empresa_id = 'einuushi' WHERE empresa_id IS NULL;
UPDATE custom_quotes SET empresa_id = 'einuushi' WHERE empresa_id IS NULL;
UPDATE chat_messages SET empresa_id = 'einuushi' WHERE empresa_id IS NULL;
UPDATE admin_activity_logs SET empresa_id = 'einuushi' WHERE empresa_id IS NULL;
UPDATE users SET empresa_id = 'einuushi' WHERE empresa_id IS NULL;
