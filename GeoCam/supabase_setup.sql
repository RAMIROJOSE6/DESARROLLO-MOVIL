-- ====================================================================
-- GEOCAM: SCRIPT MAESTRO DE BASE DE DATOS (SEMANA 8 + SEMANA 9)
-- Proyecto: GeoCam (ywmgiccnjvblmneuiupn)
-- Cumple al 100% con la Guía de la Semana 9: TanStack Query y Offline-First
-- ====================================================================

-- 1. Tabla remota photos (con soporte offline-first y dos relojes)
create table if not exists public.photos (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  client_id uuid not null unique,        -- UUID generado en el teléfono (identidad compartida)
  storage_path text not null unique,    -- Ruta en el bucket: <user_id>/<client_id>.jpg
  latitude double precision,
  longitude double precision,
  note text,
  favorite boolean not null default false,
  source text not null check (source in ('camera', 'gallery')),
  taken_at timestamptz not null,
  updated_at timestamptz not null,       -- Reloj del teléfono: resuelve conflictos (remoteWins)
  created_at timestamptz not null default now()
);

-- 2. Columna del reloj del servidor (Requisito T1 / Semana 9)
-- Sirve como cursor de bajada (pull) para que ningún cambio quede desfasado
alter table public.photos
  add column if not exists server_updated_at timestamptz not null default now();

-- Columna opcional para borrado lógico sincronizado (Semana 9 - C1)
alter table public.photos
  add column if not exists deleted_at timestamptz;

-- 3. Trigger para actualizar server_updated_at automáticamente en cada insert o update
create or replace function public.touch_server_updated_at()
returns trigger language plpgsql as $$
begin
  new.server_updated_at = now();
  return new;
end;
$$;

drop trigger if exists photos_touch_server_updated_at on public.photos;
create trigger photos_touch_server_updated_at
  before insert or update on public.photos
  for each row execute function public.touch_server_updated_at();

-- 4. Índice para acelerar el pull por usuario y cursor (Requisito T1 / Semana 9)
create index if not exists photos_user_server_updated_idx
  on public.photos (user_id, server_updated_at);

-- 5. Habilitar Row Level Security (RLS)
alter table public.photos enable row level security;

-- 6. Políticas de seguridad para la tabla photos
drop policy if exists "ver las mías" on public.photos;
create policy "ver las mías" on public.photos
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "crear las mías" on public.photos;
create policy "crear las mías" on public.photos
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

-- Esencial para upsert de TanStack Query / syncAll (Requisito T1 / Semana 9)
drop policy if exists "editar las mías" on public.photos;
drop policy if exists "actualizar las mías" on public.photos;
create policy "editar las mías" on public.photos
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "borrar las mías" on public.photos;
create policy "borrar las mías" on public.photos
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- 7. Realtime para la tabla photos
do $$
begin
  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'photos'
  ) then
    alter publication supabase_realtime add table public.photos;
  end if;
end;
$$;

-- 8. Bucket privado 'geocam' en Supabase Storage
insert into storage.buckets (id, name, public) 
values ('geocam', 'geocam', false)
on conflict (id) do nothing;

-- 9. Políticas de seguridad para storage.objects (acceso seguro por carpeta de usuario)
drop policy if exists "subir a mi carpeta" on storage.objects;
create policy "subir a mi carpeta" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'geocam' 
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

drop policy if exists "actualizar en mi carpeta" on storage.objects;
create policy "actualizar en mi carpeta" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'geocam' 
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

drop policy if exists "leer mi carpeta" on storage.objects;
create policy "leer mi carpeta" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'geocam' 
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

drop policy if exists "borrar de mi carpeta" on storage.objects;
create policy "borrar de mi carpeta" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'geocam' 
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
