-- ═══════════════════════════════════════════════════════════════════════════
-- Panda AdLab — Migración: Avatar + Nombre de perfil
--
-- Pega este archivo COMPLETO en Supabase SQL Editor y ejecútalo.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1) Agregar columna avatar_url a profiles (si no existe)
alter table public.profiles
  add column if not exists avatar_url text;

-- 2) Crear bucket de avatares (público)
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

-- 3) Políticas de storage para avatares

-- Cualquier usuario autenticado puede subir su propio avatar
drop policy if exists "Avatar upload own" on storage.objects;
create policy "Avatar upload own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Cualquier usuario autenticado puede reemplazar su propio avatar
drop policy if exists "Avatar update own" on storage.objects;
create policy "Avatar update own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Lectura pública de avatares (bucket es público, pero por si acaso)
drop policy if exists "Avatar public read" on storage.objects;
create policy "Avatar public read"
  on storage.objects for select
  to public
  using (bucket_id = 'avatars');

-- 4) Permitir que el usuario actualice su propio perfil (solo full_name y avatar_url)
-- Nota: si quieres que el frontend pueda actualizar directamente sin pasar por server:
drop policy if exists "User update own profile limited" on public.profiles;
create policy "User update own profile limited"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);
