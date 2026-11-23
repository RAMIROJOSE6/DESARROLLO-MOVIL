-- ====================================================================
-- GEOCAM: SCRIPT SEMANA 10 (IA GENERATIVA MULTIMODAL Y EDGE AI)
-- Ejecutar en el SQL Editor de tu proyecto Supabase (ywmgiccnjvblmneuiupn)
-- ====================================================================

-- 1. Columnas en photos para descripción y etiquetas generadas por IA (T3)
alter table public.photos
  add column if not exists ai_description text;

alter table public.photos
  add column if not exists ai_tags text;

-- 2. Tabla de control de límite de uso diario de IA por usuario (C5)
create table if not exists public.uso_ia (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Habilitar RLS en uso_ia
alter table public.uso_ia enable row level security;

-- Políticas de seguridad: Cada usuario solo puede ver y registrar su propio consumo
drop policy if exists "ver mi propio uso de ia" on public.uso_ia;
create policy "ver mi propio uso de ia" on public.uso_ia
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "registrar mi propio uso de ia" on public.uso_ia;
create policy "registrar mi propio uso de ia" on public.uso_ia
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

-- Índice para optimizar el conteo de peticiones de las últimas 24 horas
create index if not exists uso_ia_user_created_idx
  on public.uso_ia (user_id, created_at);
