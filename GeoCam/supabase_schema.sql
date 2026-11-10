-- ========================================================
-- Script para crear la tabla y almacenamiento de GeoCam en Supabase
-- Proyecto: ywmgiccnjvblmneuiupn
-- ========================================================

-- 1. Opcional: Eliminar tabla antigua de MI-TIENDA si deseas limpiar el esquema
-- DROP TABLE IF EXISTS public.products CASCADE;

-- 2. Crear tabla de fotos geolocalizadas (GeoCam)
CREATE TABLE IF NOT EXISTS public.geo_photos (
  id TEXT PRIMARY KEY,
  uri TEXT NOT NULL,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  accuracy DOUBLE PRECISION,
  coords_timestamp BIGINT,
  source TEXT NOT NULL CHECK (source IN ('camera', 'gallery')),
  created_at BIGINT NOT NULL,
  inserted_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Habilitar Row Level Security (RLS)
ALTER TABLE public.geo_photos ENABLE ROW LEVEL SECURITY;

-- 4. Políticas para permitir lectura y escritura públicas (anon)
CREATE POLICY "Permitir lectura publica de geo_photos"
  ON public.geo_photos FOR SELECT
  USING (true);

CREATE POLICY "Permitir insercion publica de geo_photos"
  ON public.geo_photos FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Permitir eliminacion publica de geo_photos"
  ON public.geo_photos FOR DELETE
  USING (true);

-- 5. Bucket de almacenamiento opcional para subir las imágenes a Supabase Storage
INSERT INTO storage.buckets (id, name, public)
VALUES ('geocam-photos', 'geocam-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de almacenamiento para el bucket geocam-photos
CREATE POLICY "Acceso publico lectura fotos geocam"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'geocam-photos');

CREATE POLICY "Subida publica fotos geocam"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'geocam-photos');

CREATE POLICY "Eliminacion publica fotos geocam"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'geocam-photos');
