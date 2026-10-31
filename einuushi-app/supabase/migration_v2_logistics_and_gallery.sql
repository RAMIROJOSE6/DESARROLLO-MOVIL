-- ============================================================================
-- MIGRACIÓN SUPABASE: LOGÍSTICA, LIQUIDACIÓN, GALERÍA MULTIFOTO Y MEDIOS DE PAGO DINÁMICOS
-- ============================================================================
-- Ejecuta este script en el SQL Editor de Supabase (https://supabase.com/dashboard/project/ismvmlcemxkawdwextzk/sql)
-- para asegurar que todas las tablas tengan las columnas necesarias de forma nativa.

DO $$ 
BEGIN 
  -- 1. TABLA ORDERS: Liquidación, Paz y Salvo, Repartidores y Guías
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='settlement_status') THEN
    ALTER TABLE orders ADD COLUMN settlement_status TEXT NOT NULL DEFAULT 'NOT_APPLICABLE';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='settled_at') THEN
    ALTER TABLE orders ADD COLUMN settled_at TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='settled_by') THEN
    ALTER TABLE orders ADD COLUMN settled_by TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='settlement_method') THEN
    ALTER TABLE orders ADD COLUMN settlement_method TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='transfer_reference') THEN
    ALTER TABLE orders ADD COLUMN transfer_reference TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='settlement_notes') THEN
    ALTER TABLE orders ADD COLUMN settlement_notes TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='driver_name') THEN
    ALTER TABLE orders ADD COLUMN driver_name TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='driver_id') THEN
    ALTER TABLE orders ADD COLUMN driver_id TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='driver_email') THEN
    ALTER TABLE orders ADD COLUMN driver_email TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='driver_phone') THEN
    ALTER TABLE orders ADD COLUMN driver_phone TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='driver_type') THEN
    ALTER TABLE orders ADD COLUMN driver_type TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='vehicle_type') THEN
    ALTER TABLE orders ADD COLUMN vehicle_type TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='plate_or_nit') THEN
    ALTER TABLE orders ADD COLUMN plate_or_nit TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='tracking_guide_number') THEN
    ALTER TABLE orders ADD COLUMN tracking_guide_number TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='carrier_tracking_url') THEN
    ALTER TABLE orders ADD COLUMN carrier_tracking_url TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='delivery_evidence_photo') THEN
    ALTER TABLE orders ADD COLUMN delivery_evidence_photo TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='driver_collection_evidence') THEN
    ALTER TABLE orders ADD COLUMN driver_collection_evidence TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='driver_lat') THEN
    ALTER TABLE orders ADD COLUMN driver_lat DOUBLE PRECISION;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='driver_lng') THEN
    ALTER TABLE orders ADD COLUMN driver_lng DOUBLE PRECISION;
  END IF;

  -- 2. TABLA USERS: Repartidores y Aliados Logísticos Corporativos
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='driver_type') THEN
    ALTER TABLE users ADD COLUMN driver_type TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='company_name') THEN
    ALTER TABLE users ADD COLUMN company_name TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='vehicle_type') THEN
    ALTER TABLE users ADD COLUMN vehicle_type TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='plate_or_nit') THEN
    ALTER TABLE users ADD COLUMN plate_or_nit TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='carrier_tracking_url') THEN
    ALTER TABLE users ADD COLUMN carrier_tracking_url TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='driver_status') THEN
    ALTER TABLE users ADD COLUMN driver_status TEXT DEFAULT 'active';
  END IF;

  -- 3. TABLA PRODUCTS: Galería de Múltiples Fotos
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='gallery_images') THEN
    ALTER TABLE products ADD COLUMN gallery_images JSONB DEFAULT '[]'::jsonb;
  END IF;

  -- 4. TABLA CATEGORIES: Descripción e Icono
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='categories' AND column_name='description') THEN
    ALTER TABLE categories ADD COLUMN description TEXT;
  END IF;
END $$;

-- 5. TABLA PAYMENT_METHODS: Medios de pago configurables por la tienda
CREATE TABLE IF NOT EXISTS payment_methods (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'other', -- 'cash' | 'transfer' | 'card' | 'qr' | 'other'
  description TEXT,
  instructions TEXT,
  account_number TEXT,
  account_holder TEXT,
  qr_image_url TEXT,
  icon TEXT DEFAULT 'wallet-outline',
  is_active BOOLEAN NOT NULL DEFAULT true,
  requires_proof BOOLEAN NOT NULL DEFAULT false,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Políticas RLS para payment_methods
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso total a payment_methods" ON payment_methods;
CREATE POLICY "Acceso total a payment_methods" ON payment_methods FOR ALL USING (true) WITH CHECK (true);

-- Semilla de Medios de Pago por Defecto
INSERT INTO payment_methods (id, name, type, icon, description, instructions, is_active, requires_proof, order_index)
VALUES 
  ('efectivo', 'Efectivo contra entrega', 'cash', 'cash-outline', 'Pagas al repartidor en efectivo al recibir tu pedido en destino.', 'Ten a mano el valor exacto en efectivo para agilizar la entrega.', true, false, 1),
  ('nequi_daviplata', 'Transferencia Nequi / Daviplata', 'transfer', 'phone-portrait-outline', 'Transfiere directamente desde tu billetera digital favorita.', 'Número Nequi / Daviplata: 300 123 4567. Envía el comprobante.', true, true, 2),
  ('codigo_qr', 'Código QR', 'qr', 'qr-code-outline', 'Escanea el código QR de Bancolombia / Nequi.', 'Escanea desde tu app bancaria al momento de finalizar tu pedido.', true, true, 3),
  ('pse', 'PSE', 'transfer', 'swap-horizontal-outline', 'Débito bancario en línea y seguro a través de PSE.', 'Disponible para cuentas de ahorros y corrientes de todos los bancos.', true, false, 4),
  ('tarjeta_debito', 'Tarjeta débito', 'card', 'card-outline', 'Pago electrónico con tarjeta débito bancaria.', 'Pago seguro en línea.', true, false, 5),
  ('tarjeta_credito', 'Tarjeta de crédito', 'card', 'card-outline', 'Pago en línea con tarjeta de crédito (Visa, Mastercard, Amex).', 'Cuotas y pago seguro.', true, false, 6)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  instructions = EXCLUDED.instructions;

-- Índices de alto rendimiento para búsquedas y filtros
CREATE INDEX IF NOT EXISTS idx_orders_settlement ON orders(settlement_status);
CREATE INDEX IF NOT EXISTS idx_orders_driver_id ON orders(driver_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_driver_type ON users(driver_type);
CREATE INDEX IF NOT EXISTS idx_payment_methods_active ON payment_methods(is_active);
