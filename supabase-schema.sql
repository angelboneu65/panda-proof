-- ═══════════════════════════════════════════════════════════════════════════
-- Panda Proof — Supabase Schema
-- Pega esto en el SQL Editor de tu proyecto de Supabase y ejecútalo.
-- ═══════════════════════════════════════════════════════════════════════════

-- Tabla principal de análisis
create table if not exists public.analyses (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid references auth.users(id) on delete cascade not null,
  created_at               timestamp with time zone default now() not null,

  -- Score data
  panda_score              integer not null,
  short_label              text,
  score_label              text,
  score_interpretation     text,
  profile_applied          text,
  platform_detected        text,
  accion_recomendada       text,

  -- JSON columns
  active_weights           jsonb,
  context                  jsonb not null,
  categories               jsonb not null,
  main_problems_detected   jsonb,
  top_recommendations      jsonb,
  regeneration_priorities  jsonb,
  regeneration_prompt      text
);

-- Index para queries por usuario
create index if not exists analyses_user_created_idx
  on public.analyses(user_id, created_at desc);

-- Row Level Security: cada usuario solo ve sus propios análisis
alter table public.analyses enable row level security;

drop policy if exists "Users can view their own analyses" on public.analyses;
create policy "Users can view their own analyses" on public.analyses
  for select using (auth.uid() = user_id);

drop policy if exists "Users can insert their own analyses" on public.analyses;
create policy "Users can insert their own analyses" on public.analyses
  for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update their own analyses" on public.analyses;
create policy "Users can update their own analyses" on public.analyses
  for update using (auth.uid() = user_id);

drop policy if exists "Users can delete their own analyses" on public.analyses;
create policy "Users can delete their own analyses" on public.analyses
  for delete using (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- Tabla de campañas Foto a Campaña
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists public.campaigns (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete cascade not null,
  created_at    timestamp with time zone default now() not null,
  updated_at    timestamp with time zone default now() not null,

  -- Display fields (top-level para queries rápidas)
  product_name  text not null,
  niche         text,
  city          text,
  thumbnail     text, -- base64 o URL de la primera imagen generada (para preview)

  -- Estructura completa: foto subida, contexto, brand, adAngles, etc.
  data          jsonb not null
);

create index if not exists campaigns_user_created_idx
  on public.campaigns(user_id, created_at desc);

alter table public.campaigns enable row level security;

drop policy if exists "Users can view their own campaigns" on public.campaigns;
create policy "Users can view their own campaigns" on public.campaigns
  for select using (auth.uid() = user_id);

drop policy if exists "Users can insert their own campaigns" on public.campaigns;
create policy "Users can insert their own campaigns" on public.campaigns
  for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update their own campaigns" on public.campaigns;
create policy "Users can update their own campaigns" on public.campaigns
  for update using (auth.uid() = user_id);

drop policy if exists "Users can delete their own campaigns" on public.campaigns;
create policy "Users can delete their own campaigns" on public.campaigns
  for delete using (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- INSTRUCCIONES DE SETUP:
-- 1. Ve a https://supabase.com y crea un proyecto nuevo
-- 2. SQL Editor → pega este archivo → Run
-- 3. Settings → API:
--    - Copia el "Project URL"        → VITE_SUPABASE_URL
--    - Copia el "anon public key"   → VITE_SUPABASE_ANON_KEY
-- 4. En Netlify (Site settings → Environment variables) agrega ambas
-- 5. Re-deploy (push a main)
-- 6. Auth → Providers → Email: deshabilita "Confirm email" si quieres
--    permitir registro instantáneo (recomendado para dev)
-- ═══════════════════════════════════════════════════════════════════════════
