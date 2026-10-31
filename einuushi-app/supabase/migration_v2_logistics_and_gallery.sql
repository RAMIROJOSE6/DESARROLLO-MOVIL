-- ============================================================================
-- MIGRACIÓN SUPABASE: LOGÍSTICA, LIQUIDACIÓN Y GALERÍA MULTIFOTO
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

-- Índices de alto rendimiento para búsquedas y filtros
CREATE INDEX IF NOT EXISTS idx_orders_settlement ON orders(settlement_status);
CREATE INDEX IF NOT EXISTS idx_orders_driver_id ON orders(driver_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_driver_type ON users(driver_type);
