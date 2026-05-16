-- ═══════════════════════════════════════════════════════════════════════════
-- Panda AdLab — Migración: flag de email de bienvenida
--
-- Añade la columna `welcome_email_sent` a profiles. El backend la usa para
-- enviar el email de bienvenida UNA sola vez por usuario, la primera vez que
-- carga la app — funciona con registro por correo Y con Google OAuth.
--
-- Pega este archivo COMPLETO en Supabase → SQL Editor → Run. Es idempotente.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1) Columna nueva (default false = aún no se ha enviado)
alter table public.profiles
  add column if not exists welcome_email_sent boolean not null default false;

-- 2) Backfill: los usuarios que YA existen no deben recibir el correo de
--    bienvenida retroactivamente — se marcan como ya enviado.
update public.profiles
  set welcome_email_sent = true
  where welcome_email_sent = false;

-- A partir de aquí, cada cuenta NUEVA se crea con welcome_email_sent = false
-- (por el default de la columna) y el backend enviará el correo y lo marcará
-- en true en su primer /api/me.

-- ═══════════════════════════════════════════════════════════════════════════
-- LISTO.
-- ═══════════════════════════════════════════════════════════════════════════
