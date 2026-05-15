-- ═══════════════════════════════════════════════════════════════════════════
-- Panda AdLab — Migración: Storage de medios (sistema de guardado v2)
--
-- Crea el bucket "panda-media" donde se suben TODAS las imágenes generadas
-- (artes optimizados, anuncios de campaña, menús mejorados, historias 9:16).
-- La base de datos deja de guardar base64 — solo guarda URLs públicas.
--
-- Pega este archivo COMPLETO en Supabase → SQL Editor → Run.
-- Es idempotente: se puede correr varias veces sin romper nada.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1) Bucket público para todos los medios generados por la app.
--    file_size_limit 15 MB (las imágenes van comprimidas a WebP, pesan <1 MB,
--    pero dejamos margen amplio).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'panda-media', 'panda-media', true, 15728640,
  array['image/webp','image/jpeg','image/png','image/jpg']
)
on conflict (id) do update
  set public = true,
      file_size_limit = 15728640,
      allowed_mime_types = array['image/webp','image/jpeg','image/png','image/jpg'];

-- 2) Políticas RLS — cada usuario solo escribe en su propia carpeta (uid/...).

-- Subir (insert) — solo a la carpeta propia
drop policy if exists "panda-media upload own" on storage.objects;
create policy "panda-media upload own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'panda-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Reemplazar (update) — solo la carpeta propia
drop policy if exists "panda-media update own" on storage.objects;
create policy "panda-media update own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'panda-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'panda-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Borrar (delete) — solo la carpeta propia
drop policy if exists "panda-media delete own" on storage.objects;
create policy "panda-media delete own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'panda-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Lectura pública — cualquiera puede ver las imágenes por su URL
drop policy if exists "panda-media public read" on storage.objects;
create policy "panda-media public read"
  on storage.objects for select
  to public
  using (bucket_id = 'panda-media');

-- ═══════════════════════════════════════════════════════════════════════════
-- LISTO. A partir de ahora la app sube imágenes a este bucket y la DB solo
-- guarda URLs livianas. El bucket "avatars" sigue funcionando como fallback.
-- ═══════════════════════════════════════════════════════════════════════════
