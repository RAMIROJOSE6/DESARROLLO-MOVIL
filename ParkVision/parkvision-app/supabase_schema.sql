-- =========================================================================
-- ESQUEMA SQL PARA SUPABASE - PARQUEDERO & LAVADERO CON VISIÓN POR COMPUTADORA
-- =========================================================================

-- 1. Tabla de Espacios / Bahías de Parqueadero
CREATE TABLE IF NOT EXISTS public.espacios_parqueadero (
    codigo VARCHAR(10) PRIMARY KEY, -- Ej: 'P-01', 'P-02'...
    estado VARCHAR(20) DEFAULT 'disponible', -- 'disponible', 'ocupado'
    vehiculo_id TEXT,
    placa VARCHAR(20)
);

-- Poblar 20 espacios de prueba
INSERT INTO public.espacios_parqueadero (codigo, estado)
SELECT 'P-' || LPAD(s::TEXT, 2, '0'), 'disponible'
FROM generate_series(1, 20) AS s
ON CONFLICT (codigo) DO NOTHING;

-- 2. Tabla de Tickets de Entrada y Salida
CREATE TABLE IF NOT EXISTS public.tickets_parqueadero (
    id TEXT PRIMARY KEY,
    placa VARCHAR(20) NOT NULL,
    marca VARCHAR(100) NOT NULL,
    color VARCHAR(50) NOT NULL,
    tipo_servicio VARCHAR(30) DEFAULT 'parqueadero', -- 'parqueadero', 'lavadero', 'ambos'
    hora_ingreso TEXT NOT NULL,
    hora_salida TEXT,
    estado VARCHAR(20) DEFAULT 'activo', -- 'activo', 'finalizado'
    estado_parqueo VARCHAR(30) DEFAULT 'En Parqueo', -- 'En Parqueo', 'En Lavado', 'Salida'
    espacio_asignado VARCHAR(10) NOT NULL, -- Ej: 'P-04'
    
    -- URLs de Evidencia en Supabase Storage
    foto_placa_url TEXT,
    foto_inspeccion_entrada_url TEXT,
    video_entrada_url TEXT,
    foto_inspeccion_salida_url TEXT,
    video_salida_url TEXT,
    
    -- Datos de Daños en formato JSON
    danos_entrada JSONB DEFAULT '[]'::jsonb,
    danos_salida JSONB DEFAULT '[]'::jsonb,
    nuevos_danos_detectados BOOLEAN DEFAULT FALSE,
    diferencia_detectada BOOLEAN DEFAULT FALSE,
    suciedad_ignorada_contador INT DEFAULT 0,
    
    -- Propietario y Observaciones
    propietario_nombre TEXT,
    propietario_telefono TEXT,
    observaciones TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Habilitar Tiempo Real (Realtime) para que la app se actualice sola
ALTER PUBLICATION supabase_realtime ADD TABLE public.tickets_parqueadero;
ALTER PUBLICATION supabase_realtime ADD TABLE public.espacios_parqueadero;

-- 4. Crear el Bucket de Almacenamiento para Videos y Fotos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('evidencias-parqueadero', 'evidencias-parqueadero', true)
ON CONFLICT (id) DO NOTHING;

-- 5. Políticas de Seguridad (Permitir lectura y subida pública de evidencias)
CREATE POLICY "Acceso público de lectura a evidencias" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'evidencias-parqueadero');

CREATE POLICY "Permitir subida de videos y fotos" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'evidencias-parqueadero');
