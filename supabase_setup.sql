-- ====================================================================
-- TALLER SEMANA 8: PROYECTO GEOCAM EN SUPABASE
-- Ejecuta este script completo en el SQL Editor de tu proyecto Supabase
-- ====================================================================

-- 1. Tabla remota photos
create table if not exists public.photos (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  client_id uuid not null unique, -- UUID creado en el teléfono: identifica la misma foto en ambos lados
  storage_path text not null unique,
  latitude double precision,
  longitude double precision,
  note text,
  favorite boolean not null default false,
  source text not null check (source in ('camera', 'gallery')),
  taken_at timestamptz not null,
  updated_at timestamptz not null, -- última modificación hecha por el usuario
  created_at timestamptz not null default now()
);

-- 2. Habilitar Row Level Security (RLS)
alter table public.photos enable row level security;

-- 3. Políticas de seguridad para la tabla photos (Cada usuario solo ve, crea, modifica y borra sus propias fotos)
create policy "ver las mías" on public.photos
for select to authenticated using ((select auth.uid()) = user_id);

create policy "crear las mías" on public.photos
for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "actualizar las mías" on public.photos
for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "borrar las mías" on public.photos
for delete to authenticated using ((select auth.uid()) = user_id);

-- 4. Habilitar Realtime para la tabla photos (Tarea C4)
alter publication supabase_realtime add table public.photos;

-- 5. Bucket privado geocam
insert into storage.buckets (id, name, public) 
values ('geocam', 'geocam', false)
on conflict (id) do nothing;

-- 6. Políticas de seguridad para storage.objects (Bucket geocam privado con aislamiento por carpeta de usuario)
create policy "subir a mi carpeta" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'geocam' 
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "actualizar en mi carpeta" on storage.objects
for update to authenticated
using (
  bucket_id = 'geocam' 
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "leer mi carpeta" on storage.objects
for select to authenticated
using (
  bucket_id = 'geocam' 
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "borrar de mi carpeta" on storage.objects
for delete to authenticated
using (
  bucket_id = 'geocam' 
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

