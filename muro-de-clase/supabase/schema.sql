-- Muro de Clase · Semana 8
-- Ejecutar una sola vez en el SQL Editor del proyecto de Supabase.

-- Tabla de publicaciones
create table public.posts (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  author_email text not null,
  content text not null check (char_length(content) between 1 and 280),
  image_path text,
  created_at timestamptz not null default now()
);

alter table public.posts enable row level security;

create policy "leer publicaciones" on public.posts
  for select to authenticated using (true);

create policy "crear las mías" on public.posts
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "borrar las mías" on public.posts
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Cambios en vivo
alter publication supabase_realtime add table public.posts;

-- Bucket público: cualquiera con la URL ve la imagen, pero solo se sube a la carpeta propia
insert into storage.buckets (id, name, public) values ('muro', 'muro', true);

create policy "subir a mi carpeta" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'muro' and (storage.foldername(name))[1] = (select auth.uid()::text));

create policy "borrar de mi carpeta" on storage.objects
  for delete to authenticated
  using (bucket_id = 'muro' and (storage.foldername(name))[1] = (select auth.uid()::text));
