-- ═══════════════════════════════════════════════════════════════════════════
-- Panda AdLab — Migración: Bono de bienvenida 100 créditos
--
-- Cambia el bono de registro de 10 → 100 créditos para usuarios nuevos.
-- Pega este archivo COMPLETO en Supabase → SQL Editor → Run.
-- Es idempotente (se puede correr varias veces sin romper nada).
-- ═══════════════════════════════════════════════════════════════════════════

-- Recrea el trigger handle_new_user con el bono de 100 créditos.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_admin boolean;
begin
  v_is_admin := lower(new.email) = 'angelboneu65@gmail.com';

  insert into public.profiles
    (id, email, full_name, role, plan, is_unlimited, credits_balance, image_rounds_balance, monthly_credits)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    case when v_is_admin then 'admin' else 'user' end,
    case when v_is_admin then 'admin' else 'free' end,
    v_is_admin,
    case when v_is_admin then 999999 else 100 end,   -- bono de bienvenida: 100
    case when v_is_admin then 999999 else 0   end,
    case when v_is_admin then 999999 else 100 end
  )
  on conflict (id) do nothing;

  -- Registrar el bono de bienvenida (100 créditos) para usuarios normales
  if not v_is_admin then
    insert into public.credit_transactions (user_id, amount, transaction_type, description)
    values (new.id, 100, 'signup_bonus', 'Bono de bienvenida — 100 créditos');
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- ═══════════════════════════════════════════════════════════════════════════
-- LISTO. A partir de ahora cada cuenta nueva recibe 100 créditos de bienvenida.
-- Los usuarios que ya existían conservan su balance actual (no se tocan).
-- ═══════════════════════════════════════════════════════════════════════════
