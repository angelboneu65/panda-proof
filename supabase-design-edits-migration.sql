-- ══════════════════════════════════════════════════════════════════════════════
-- Panda AdLab — design_edits
-- Versiones editadas por capas (Polotno) de un saved_result.
-- ══════════════════════════════════════════════════════════════════════════════

create table if not exists public.design_edits (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  result_id          uuid references public.saved_results(id) on delete set null,
  base_image_url     text,
  polotno_json       jsonb,
  exported_image_url text,
  title              text,
  created_at         timestamptz default now() not null,
  updated_at         timestamptz default now() not null
);

create index if not exists design_edits_user_idx   on public.design_edits(user_id);
create index if not exists design_edits_result_idx on public.design_edits(result_id);

alter table public.design_edits enable row level security;

drop policy if exists "Users read own design edits" on public.design_edits;
create policy "Users read own design edits"
  on public.design_edits for select
  using (auth.uid() = user_id);

drop policy if exists "Users insert own design edits" on public.design_edits;
create policy "Users insert own design edits"
  on public.design_edits for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users update own design edits" on public.design_edits;
create policy "Users update own design edits"
  on public.design_edits for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users delete own design edits" on public.design_edits;
create policy "Users delete own design edits"
  on public.design_edits for delete
  using (auth.uid() = user_id);

-- Trigger para mantener updated_at
create or replace function public.set_design_edits_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists design_edits_updated_at on public.design_edits;
create trigger design_edits_updated_at
  before update on public.design_edits
  for each row execute function public.set_design_edits_updated_at();
