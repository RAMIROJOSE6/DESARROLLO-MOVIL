-- ============================================================================
-- MIGRACIÓN SUPABASE V4: PLATAFORMA TODÁ APP & CONTROL DE ARRIENDO MULTITIENDA
-- ============================================================================
-- Este script habilita en la base de datos centralizada de Supabase el soporte para:
-- 1. Control de arriendo / suscripciones mensuales por tienda en 'empresas'.
-- 2. Estado de activación (is_activa) y suspensión por mora de arriendo.
-- 3. Creación del usuario Propietario / Superadmin de TODÁ APP (100% independiente de Einuushi).

-- 1. Agregar columnas de control de arriendo a la tabla 'empresas'
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS valor_arriendo NUMERIC DEFAULT 0;
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS estado_pago TEXT DEFAULT 'al_dia';
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS fecha_corte_arriendo TEXT DEFAULT 'Día 5 de cada mes';
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS notas_arriendo TEXT;

-- 2. Asegurar que Einuushi esté registrada como una tienda afiliada regular
UPDATE empresas 
SET nombre = 'Einuushi Artesanías',
    is_activa = true,
    estado_pago = 'al_dia',
    valor_arriendo = COALESCE(valor_arriendo, 150000),
    fecha_corte_arriendo = COALESCE(fecha_corte_arriendo, 'Día 5 de cada mes'),
    notas_arriendo = COALESCE(notas_arriendo, 'Tienda fundadora afiliada a TODÁ APP')
WHERE id = 'einuushi';

-- 3. Crear o actualizar el usuario Propietario de la plataforma TODÁ APP
INSERT INTO users (
  id,
  full_name,
  cedula,
  email,
  phone,
  city,
  password,
  role,
  empresa_id,
  created_at
) VALUES (
  'USR-OWNER-TODA',
  'Propietario TODÁ APP',
  '1000000000',
  'propietario@todaapp.com',
  '3000000000',
  'Colombia',
  'toda2026',
  'superadmin',
  NULL,
  timezone('utc'::text, now())
) ON CONFLICT (email) DO UPDATE SET
  role = 'superadmin',
  full_name = 'Propietario TODÁ APP',
  empresa_id = NULL;

-- 4. Notificar confirmación en consola de Supabase
SELECT 'Migración V4 TODÁ APP completada con éxito. Tabla empresas y Superadministrador actualizados.' AS resultado;

