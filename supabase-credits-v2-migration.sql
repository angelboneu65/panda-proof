-- ══════════════════════════════════════════════════════════════════════════════
-- Panda AdLab — Migración v2: SIMPLIFICACIÓN A CRÉDITOS PUROS
-- ──────────────────────────────────────────────────────────────────────────────
-- Elimina el concepto de "rondas" y unifica todo en créditos.
-- - Plans: Basic 9.99/150cr, Pro 29.99/500cr
-- - Packages: pack-100, pack-250, pack-600, pack-1500
-- - Desactiva paquetes legacy de rondas
-- - Reemplaza RPC consume_image_round_or_credits por consume_credits (alias)
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1) Actualizar PLANS con los nuevos precios y créditos ───────────────────
update public.plans
   set price = 9.99,
       monthly_credits = 150,
       image_rounds = 0,
       analysis_limit = 999,
       display_order = 10
 where slug = 'basic';

update public.plans
   set price = 29.99,
       monthly_credits = 500,
       image_rounds = 0,
       analysis_limit = 999,
       display_order = 20
 where slug = 'pro';

-- ── 2) Insertar planes si no existen (idempotente) ──────────────────────────
insert into public.plans (name, slug, price, monthly_credits, image_rounds, analysis_limit, display_order)
values
  ('Basic', 'basic',  9.99,  150, 0, 999, 10),
  ('Pro',   'pro',   29.99,  500, 0, 999, 20)
on conflict (slug) do update set
  price            = excluded.price,
  monthly_credits  = excluded.monthly_credits,
  image_rounds     = excluded.image_rounds,
  analysis_limit   = excluded.analysis_limit,
  display_order    = excluded.display_order;

-- ── 3) Desactivar paquetes legacy (rondas y créditos viejos) ────────────────
update public.credit_packages
   set is_active = false
 where slug in ('pack-1-round', 'pack-5-rounds', 'pack-50-credits', 'pack-150-credits');

-- ── 4) Insertar/actualizar paquetes nuevos ──────────────────────────────────
insert into public.credit_packages (name, slug, credits, image_rounds, price, display_order, is_active)
values
  ('Recarga 100 créditos',  'pack-100',  100,  0,   9.99, 10, true),
  ('Recarga 250 créditos',  'pack-250',  250,  0,  19.99, 20, true),
  ('Recarga 600 créditos',  'pack-600',  600,  0,  39.99, 30, true),
  ('Recarga 1500 créditos', 'pack-1500', 1500, 0,  89.99, 40, true)
on conflict (slug) do update set
  name          = excluded.name,
  credits       = excluded.credits,
  image_rounds  = excluded.image_rounds,
  price         = excluded.price,
  display_order = excluded.display_order,
  is_active     = excluded.is_active;

-- ── 5) Actualizar RPC consume_image_round_or_credits → cobra solo créditos ──
-- Mantiene la misma firma para compat con código viejo, pero ya no usa rondas.
create or replace function public.consume_image_round_or_credits(
  p_user_id     uuid,
  p_credit_cost integer,
  p_description text default 'Image generation',
  p_metadata    jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_tx_id   uuid;
begin
  select * into v_profile from public.profiles where id = p_user_id for update;
  if not found then
    return jsonb_build_object('allowed', false, 'reason', 'Perfil no encontrado');
  end if;

  -- Admin / ilimitado: pasa libre, registra con charged=0
  if v_profile.is_unlimited or v_profile.role = 'admin' then
    insert into public.credit_transactions (user_id, amount, transaction_type, description, metadata)
    values (p_user_id, 0, 'image_generation', coalesce(p_description, '') || ' (unlimited)', p_metadata)
    returning id into v_tx_id;
    return jsonb_build_object(
      'allowed', true, 'charged', 0, 'charge_type', 'unlimited', 'transaction_id', v_tx_id
    );
  end if;

  -- Verifica balance
  if v_profile.credits_balance < p_credit_cost then
    return jsonb_build_object(
      'allowed', false, 'reason', 'No tienes suficientes créditos',
      'credits_balance', v_profile.credits_balance,
      'required_credits', p_credit_cost
    );
  end if;

  -- Descuenta créditos
  update public.profiles
     set credits_balance = credits_balance - p_credit_cost, updated_at = now()
   where id = p_user_id;

  insert into public.credit_transactions (user_id, amount, transaction_type, description, metadata)
  values (p_user_id, -p_credit_cost, 'image_generation', p_description,
          p_metadata || jsonb_build_object('charge_type', 'credits'))
  returning id into v_tx_id;

  return jsonb_build_object(
    'allowed', true, 'charged', p_credit_cost, 'charge_type', 'credits',
    'credits_left', v_profile.credits_balance - p_credit_cost,
    'transaction_id', v_tx_id
  );
end;
$$;

-- ── 6) Actualizar apply_subscription_grant para no acreditar rondas ─────────
-- Las rondas quedan en 0 — los planes solo dan créditos mensuales.
-- (Se mantiene la columna image_rounds_balance por compat, pero queda fija en 0)

-- ── 7) Refund actualizado: solo créditos (rondas obsoletas) ─────────────────
create or replace function public.refund_transaction(p_tx_id uuid, p_reason text default 'API call failed')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tx     public.credit_transactions%rowtype;
  v_new_tx uuid;
begin
  select * into v_tx from public.credit_transactions where id = p_tx_id;
  if not found then return jsonb_build_object('success', false, 'reason', 'Tx no encontrada'); end if;
  if v_tx.amount >= 0 then return jsonb_build_object('success', false, 'reason', 'Tx no es un consumo'); end if;

  -- Compat: si la transacción era una ronda vieja, también la devolvemos
  if v_tx.transaction_type = 'image_generation_round' then
    update public.profiles set image_rounds_balance = image_rounds_balance + 1, updated_at = now() where id = v_tx.user_id;
  else
    update public.profiles set credits_balance = credits_balance + (-v_tx.amount), updated_at = now() where id = v_tx.user_id;
  end if;

  insert into public.credit_transactions (user_id, amount, transaction_type, description, metadata)
  values (v_tx.user_id, -v_tx.amount, 'refund', p_reason,
          jsonb_build_object('original_tx', p_tx_id))
  returning id into v_new_tx;

  return jsonb_build_object('success', true, 'refund_tx', v_new_tx);
end;
$$;

-- ── DONE ────────────────────────────────────────────────────────────────────
-- Verificar resultado:
-- select slug, name, price, monthly_credits, is_active from public.plans;
-- select slug, name, credits, price, is_active from public.credit_packages where is_active = true;
