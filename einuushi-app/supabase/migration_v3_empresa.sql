-- ============================================================================
-- MIGRACIÓN SUPABASE V3: TABLA DE EMPRESAS Y ARQUITECTURA MULTITIENDA CENTRALIZADA
-- ============================================================================
-- Este script es 100% autónomo y seguro: crea la tabla 'empresas', asegura la tabla
-- 'payment_methods' y vincula la columna 'empresa_id' sin fallar si alguna tabla aún no existe.

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

-- Habilitar RLS para empresas
ALTER TABLE empresas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lectura publica de empresas" ON empresas;
CREATE POLICY "Lectura publica de empresas" ON empresas
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Escritura de empresas" ON empresas;
CREATE POLICY "Escritura de empresas" ON empresas
  FOR ALL USING (true) WITH CHECK (true);

-- 2. SEMILLA OFICIAL: REGISTRO DE EINUUSHI COMO EMPRESA PRINCIPAL
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

-- 3. ASEGURAR TABLA 'payment_methods' (MEDIOS DE PAGO DINÁMICOS)
CREATE TABLE IF NOT EXISTS payment_methods (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'other',
  description TEXT,
  instructions TEXT,
  account_number TEXT,
  account_holder TEXT,
  qr_image_url TEXT,
  icon TEXT DEFAULT 'wallet-outline',
  is_active BOOLEAN NOT NULL DEFAULT true,
  requires_proof BOOLEAN NOT NULL DEFAULT false,
  order_index INTEGER NOT NULL DEFAULT 0,
  empresa_id TEXT DEFAULT 'einuushi',
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso total a payment_methods" ON payment_methods;
CREATE POLICY "Acceso total a payment_methods" ON payment_methods FOR ALL USING (true) WITH CHECK (true);

-- Semilla de Medios de Pago Iniciales de Einuushi
INSERT INTO payment_methods (id, name, type, icon, description, instructions, is_active, requires_proof, order_index, empresa_id)
VALUES 
  ('efectivo', 'Efectivo contra entrega', 'cash', 'cash-outline', 'Pagas al repartidor en efectivo al recibir tu pedido en destino.', 'Ten a mano el valor exacto en efectivo para agilizar la entrega.', true, false, 1, 'einuushi'),
  ('nequi_daviplata', 'Transferencia Nequi / Daviplata', 'transfer', 'phone-portrait-outline', 'Transfiere directamente desde tu billetera digital favorita.', 'Número Nequi / Daviplata: 300 123 4567. Envía el comprobante.', true, true, 2, 'einuushi'),
  ('codigo_qr', 'Código QR', 'qr', 'qr-code-outline', 'Escanea el código QR de Bancolombia / Nequi.', 'Escanea desde tu app bancaria al momento de finalizar tu pedido.', true, true, 3, 'einuushi'),
  ('pse', 'PSE', 'transfer', 'swap-horizontal-outline', 'Débito bancario en línea y seguro a través de PSE.', 'Disponible para cuentas de ahorros y corrientes de todos los bancos.', true, false, 4, 'einuushi'),
  ('tarjeta_debito', 'Tarjeta débito', 'card', 'card-outline', 'Pago electrónico con tarjeta débito bancaria.', 'Pago seguro en línea.', true, false, 5, 'einuushi'),
  ('tarjeta_credito', 'Tarjeta de crédito', 'card', 'card-outline', 'Pago en línea con tarjeta de crédito (Visa, Mastercard, Amex).', 'Cuotas y pago seguro.', true, false, 6, 'einuushi')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  instructions = EXCLUDED.instructions;

-- 4. VINCULACIÓN SEGURA DE LA COLUMNA 'empresa_id' EN TODAS LAS TABLAS EXISTENTES
DO $$ 
DECLARE
  tbl TEXT;
  tbls TEXT[] := ARRAY['products', 'categories', 'orders', 'payment_methods', 'custom_quotes', 'chat_messages', 'admin_activity_logs', 'users'];
BEGIN 
  FOREACH tbl IN ARRAY tbls LOOP
    -- Verificar si la tabla existe en la base de datos
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
      -- Agregar columna empresa_id si no existe
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'empresa_id') THEN
        EXECUTE format('ALTER TABLE %I ADD COLUMN empresa_id TEXT DEFAULT ''einuushi''', tbl);
      END IF;
      -- Asignar los registros huérfanos a einuushi
      EXECUTE format('UPDATE %I SET empresa_id = ''einuushi'' WHERE empresa_id IS NULL', tbl);
    END IF;
  END LOOP;
END $$;
