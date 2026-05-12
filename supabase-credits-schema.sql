-- ═══════════════════════════════════════════════════════════════════════════
-- Panda AdLab — Sistema de Créditos, Planes y Roles
--
-- Pega este archivo COMPLETO en Supabase SQL Editor y ejecútalo.
-- Es idempotente (se puede correr varias veces sin romper nada).
--
-- Requiere haber corrido antes el `supabase-schema.sql` original.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1) PROFILES — extiende auth.users con datos de cuenta ─────────────────
create table if not exists public.profiles (
  id                       uuid primary key references auth.users(id) on delete cascade,
  email                    text,
  full_name                text,
  role                     text default 'user' check (role in ('user', 'admin')),
  plan                     text default 'free' check (plan in ('free', 'basic', 'pro', 'admin')),
  credits_balance          integer default 0 not null,
  monthly_credits          integer default 0 not null,
  image_rounds_balance     integer default 0 not null,
  is_unlimited             boolean default false not null,
  stripe_customer_id       text,
  stripe_subscription_id   text,
  subscription_status      text,
  created_at               timestamp with time zone default now() not null,
  updated_at               timestamp with time zone default now() not null
);

create index if not exists profiles_email_idx on public.profiles(email);
create index if not exists profiles_stripe_customer_idx on public.profiles(stripe_customer_id);

alter table public.profiles enable row level security;

-- Solo lectura para el propio usuario y para admins
drop policy if exists "Users read own profile" on public.profiles;
create policy "Users read own profile" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "Admins read all profiles" on public.profiles;
create policy "Admins read all profiles" on public.profiles
  for select using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- INSERT/UPDATE/DELETE no permitidos directamente desde cliente.
-- Toda mutación pasa por RPCs (security definer) o por service role desde server.

-- ── 2) CREDIT TRANSACTIONS — historial inmutable de todo movimiento ───────
create table if not exists public.credit_transactions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references public.profiles(id) on delete cascade not null,
  amount           integer not null,
  transaction_type text not null,
  -- Tipos: admin_grant | admin_remove | purchase | subscription_monthly |
  --        image_generation | image_generation_round | ad_analysis |
  --        refund | adjustment | signup_bonus
  description      text default '',
  created_by       uuid references public.profiles(id) on delete set null,
  metadata         jsonb default '{}'::jsonb,
  created_at       timestamp with time zone default now() not null
);

create index if not exists tx_user_created_idx
  on public.credit_transactions(user_id, created_at desc);
create index if not exists tx_type_idx
  on public.credit_transactions(transaction_type);

alter table public.credit_transactions enable row level security;

drop policy if exists "Users read own tx" on public.credit_transactions;
create policy "Users read own tx" on public.credit_transactions
  for select using (auth.uid() = user_id);

drop policy if exists "Admins read all tx" on public.credit_transactions;
create policy "Admins read all tx" on public.credit_transactions
  for select using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- ── 3) PLANS — catálogo de planes de suscripción ──────────────────────────
create table if not exists public.plans (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  slug              text unique not null,
  price             numeric(10,2) default 0 not null,
  monthly_credits   integer default 0 not null,
  image_rounds      integer default 0 not null,
  analysis_limit    integer default 0 not null,
  stripe_price_id   text,
  is_active         boolean default true not null,
  display_order     integer default 100 not null,
  created_at        timestamp with time zone default now() not null
);

alter table public.plans enable row level security;

drop policy if exists "Anyone reads active plans" on public.plans;
create policy "Anyone reads active plans" on public.plans
  for select using (is_active = true);

-- Seed de planes (idempotente)
insert into public.plans (name, slug, price, monthly_credits, image_rounds, analysis_limit, display_order)
values
  ('Free',  'free',   0.00,   10,  0,  3,  10),
  ('Basic', 'basic',  9.99,  100,  2, 20,  20),
  ('Pro',   'pro',   19.99,  250,  5, 50,  30)
on conflict (slug) do update set
  price            = excluded.price,
  monthly_credits  = excluded.monthly_credits,
  image_rounds     = excluded.image_rounds,
  analysis_limit   = excluded.analysis_limit;

-- ── 4) CREDIT PACKAGES — recargas/compras únicas ──────────────────────────
create table if not exists public.credit_packages (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  slug            text unique not null,
  credits         integer default 0 not null,
  image_rounds    integer default 0 not null,
  price           numeric(10,2) not null,
  stripe_price_id text,
  is_active       boolean default true not null,
  display_order   integer default 100 not null,
  created_at      timestamp with time zone default now() not null
);

alter table public.credit_packages enable row level security;

drop policy if exists "Anyone reads active packages" on public.credit_packages;
create policy "Anyone reads active packages" on public.credit_packages
  for select using (is_active = true);

insert into public.credit_packages (name, slug, credits, image_rounds, price, display_order)
values
  ('Extra 1 ronda',     'pack-1-round',     0,  1,  2.99,  10),
  ('Extra 5 rondas',    'pack-5-rounds',    0,  5,  9.99,  20),
  ('50 créditos extra', 'pack-50-credits', 50,  0,  4.99,  30),
  ('150 créditos extra','pack-150-credits',150, 0,  9.99,  40)
on conflict (slug) do update set
  credits      = excluded.credits,
  image_rounds = excluded.image_rounds,
  price        = excluded.price;

-- ═══════════════════════════════════════════════════════════════════════════
-- 5) TRIGGER — crear profile automático al registrarse
-- ═══════════════════════════════════════════════════════════════════════════
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
    case when v_is_admin then 999999 else 10 end,
    case when v_is_admin then 999999 else 0 end,
    case when v_is_admin then 999999 else 10 end
  )
  on conflict (id) do nothing;

  -- Registrar bono de bienvenida para usuarios normales
  if not v_is_admin then
    insert into public.credit_transactions (user_id, amount, transaction_type, description)
    values (new.id, 10, 'signup_bonus', 'Bono de bienvenida — 10 créditos');
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- Backfill: crear profile para usuarios ya existentes
insert into public.profiles
  (id, email, full_name, role, plan, is_unlimited, credits_balance, image_rounds_balance, monthly_credits)
select
  u.id,
  u.email,
  coalesce(u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)),
  case when lower(u.email) = 'angelboneu65@gmail.com' then 'admin' else 'user' end,
  case when lower(u.email) = 'angelboneu65@gmail.com' then 'admin' else 'free' end,
  lower(u.email) = 'angelboneu65@gmail.com',
  case when lower(u.email) = 'angelboneu65@gmail.com' then 999999 else 10 end,
  case when lower(u.email) = 'angelboneu65@gmail.com' then 999999 else 0 end,
  case when lower(u.email) = 'angelboneu65@gmail.com' then 999999 else 10 end
from auth.users u
on conflict (id) do nothing;

-- Por si la cuenta admin ya existía como user normal, promoverla
update public.profiles
   set role = 'admin', is_unlimited = true, plan = 'admin',
       credits_balance = 999999, image_rounds_balance = 999999, monthly_credits = 999999,
       updated_at = now()
 where lower(email) = 'angelboneu65@gmail.com';

-- ═══════════════════════════════════════════════════════════════════════════
-- 6) RPC FUNCTIONS — atómicas y seguras (SECURITY DEFINER)
-- ═══════════════════════════════════════════════════════════════════════════

-- ── consume_credits: descuenta créditos atómicamente ──────────────────────
create or replace function public.consume_credits(
  p_user_id     uuid,
  p_amount      integer,
  p_action_type text,
  p_description text default '',
  p_metadata    jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile  public.profiles%rowtype;
  v_tx_id    uuid;
begin
  select * into v_profile from public.profiles where id = p_user_id for update;
  if not found then
    return jsonb_build_object('allowed', false, 'reason', 'Perfil no encontrado');
  end if;

  -- Admin/unlimited: log pero no cobra
  if v_profile.is_unlimited or v_profile.role = 'admin' then
    insert into public.credit_transactions (user_id, amount, transaction_type, description, metadata)
    values (p_user_id, 0, p_action_type, coalesce(p_description, '') || ' (unlimited)', p_metadata)
    returning id into v_tx_id;
    return jsonb_build_object(
      'allowed', true, 'charged', 0, 'charge_type', 'unlimited',
      'credits_left', v_profile.credits_balance, 'transaction_id', v_tx_id
    );
  end if;

  if v_profile.credits_balance < p_amount then
    return jsonb_build_object(
      'allowed', false, 'reason', 'Créditos insuficientes',
      'credits_balance', v_profile.credits_balance, 'required', p_amount
    );
  end if;

  update public.profiles
     set credits_balance = credits_balance - p_amount, updated_at = now()
   where id = p_user_id;

  insert into public.credit_transactions (user_id, amount, transaction_type, description, metadata)
  values (p_user_id, -p_amount, p_action_type, p_description, p_metadata)
  returning id into v_tx_id;

  return jsonb_build_object(
    'allowed', true, 'charged', p_amount, 'charge_type', 'credits',
    'credits_left', v_profile.credits_balance - p_amount, 'transaction_id', v_tx_id
  );
end;
$$;

-- ── consume_image_round_or_credits: prefiere rondas, cae a créditos ───────
create or replace function public.consume_image_round_or_credits(
  p_user_id     uuid,
  p_credit_cost integer default 100,
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

  if v_profile.is_unlimited or v_profile.role = 'admin' then
    insert into public.credit_transactions (user_id, amount, transaction_type, description, metadata)
    values (p_user_id, 0, 'image_generation', coalesce(p_description, '') || ' (unlimited)', p_metadata)
    returning id into v_tx_id;
    return jsonb_build_object(
      'allowed', true, 'charged', 0, 'charge_type', 'unlimited', 'transaction_id', v_tx_id
    );
  end if;

  -- Rondas primero
  if v_profile.image_rounds_balance > 0 then
    update public.profiles
       set image_rounds_balance = image_rounds_balance - 1, updated_at = now()
     where id = p_user_id;
    insert into public.credit_transactions (user_id, amount, transaction_type, description, metadata)
    values (p_user_id, -1, 'image_generation_round', p_description,
            p_metadata || jsonb_build_object('charge_type', 'round'))
    returning id into v_tx_id;
    return jsonb_build_object(
      'allowed', true, 'charged', 1, 'charge_type', 'round',
      'rounds_left', v_profile.image_rounds_balance - 1,
      'credits_left', v_profile.credits_balance,
      'transaction_id', v_tx_id
    );
  end if;

  -- Fallback créditos
  if v_profile.credits_balance < p_credit_cost then
    return jsonb_build_object(
      'allowed', false, 'reason', 'Sin créditos ni rondas suficientes',
      'credits_balance', v_profile.credits_balance,
      'rounds_balance', 0,
      'required_credits', p_credit_cost
    );
  end if;

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
    'rounds_left', 0,
    'transaction_id', v_tx_id
  );
end;
$$;

-- ── refund_transaction: revertir una transacción (si falló la API) ────────
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

  -- Revertir: si era ronda, devuelve ronda; si era crédito, devuelve crédito.
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

-- ── admin_grant_credits ───────────────────────────────────────────────────
create or replace function public.admin_grant_credits(
  p_target_user uuid,
  p_amount      integer,
  p_description text default 'Admin grant'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role text;
  v_balance     integer;
begin
  select role into v_caller_role from public.profiles where id = auth.uid();
  if v_caller_role is null or v_caller_role <> 'admin' then
    return jsonb_build_object('success', false, 'reason', 'Solo admins');
  end if;

  update public.profiles
     set credits_balance = credits_balance + p_amount, updated_at = now()
   where id = p_target_user
  returning credits_balance into v_balance;

  if v_balance is null then
    return jsonb_build_object('success', false, 'reason', 'Usuario no encontrado');
  end if;

  insert into public.credit_transactions (user_id, amount, transaction_type, description, created_by)
  values (p_target_user, p_amount, case when p_amount >= 0 then 'admin_grant' else 'admin_remove' end,
          p_description, auth.uid());

  return jsonb_build_object('success', true, 'new_balance', v_balance);
end;
$$;

-- ── admin_grant_rounds ────────────────────────────────────────────────────
create or replace function public.admin_grant_rounds(
  p_target_user uuid,
  p_amount      integer,
  p_description text default 'Admin grant rounds'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role text;
  v_balance     integer;
begin
  select role into v_caller_role from public.profiles where id = auth.uid();
  if v_caller_role is null or v_caller_role <> 'admin' then
    return jsonb_build_object('success', false, 'reason', 'Solo admins');
  end if;

  update public.profiles
     set image_rounds_balance = image_rounds_balance + p_amount, updated_at = now()
   where id = p_target_user
  returning image_rounds_balance into v_balance;

  if v_balance is null then
    return jsonb_build_object('success', false, 'reason', 'Usuario no encontrado');
  end if;

  insert into public.credit_transactions (user_id, amount, transaction_type, description, created_by, metadata)
  values (p_target_user, p_amount, case when p_amount >= 0 then 'admin_grant' else 'admin_remove' end,
          p_description, auth.uid(), jsonb_build_object('unit', 'image_rounds'));

  return jsonb_build_object('success', true, 'new_rounds_balance', v_balance);
end;
$$;

-- ── admin_set_unlimited ───────────────────────────────────────────────────
create or replace function public.admin_set_unlimited(
  p_target_user uuid,
  p_unlimited   boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_caller_role text;
begin
  select role into v_caller_role from public.profiles where id = auth.uid();
  if v_caller_role is null or v_caller_role <> 'admin' then
    return jsonb_build_object('success', false, 'reason', 'Solo admins');
  end if;

  update public.profiles set is_unlimited = p_unlimited, updated_at = now() where id = p_target_user;
  insert into public.credit_transactions (user_id, amount, transaction_type, description, created_by, metadata)
  values (p_target_user, 0, 'adjustment',
          case when p_unlimited then 'Activado modo ilimitado' else 'Desactivado modo ilimitado' end,
          auth.uid(), jsonb_build_object('field', 'is_unlimited', 'value', p_unlimited));
  return jsonb_build_object('success', true);
end;
$$;

-- ── admin_set_role ────────────────────────────────────────────────────────
create or replace function public.admin_set_role(p_target_user uuid, p_role text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_caller_role text;
begin
  select role into v_caller_role from public.profiles where id = auth.uid();
  if v_caller_role is null or v_caller_role <> 'admin' then
    return jsonb_build_object('success', false, 'reason', 'Solo admins');
  end if;
  if p_role not in ('user', 'admin') then
    return jsonb_build_object('success', false, 'reason', 'Rol inválido');
  end if;

  update public.profiles set role = p_role, updated_at = now() where id = p_target_user;
  insert into public.credit_transactions (user_id, amount, transaction_type, description, created_by, metadata)
  values (p_target_user, 0, 'adjustment', 'Rol cambiado a ' || p_role,
          auth.uid(), jsonb_build_object('field', 'role', 'value', p_role));
  return jsonb_build_object('success', true);
end;
$$;

-- ── admin_set_plan ────────────────────────────────────────────────────────
create or replace function public.admin_set_plan(p_target_user uuid, p_plan text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_caller_role text;
begin
  select role into v_caller_role from public.profiles where id = auth.uid();
  if v_caller_role is null or v_caller_role <> 'admin' then
    return jsonb_build_object('success', false, 'reason', 'Solo admins');
  end if;

  update public.profiles set plan = p_plan, updated_at = now() where id = p_target_user;
  insert into public.credit_transactions (user_id, amount, transaction_type, description, created_by, metadata)
  values (p_target_user, 0, 'adjustment', 'Plan cambiado a ' || p_plan,
          auth.uid(), jsonb_build_object('field', 'plan', 'value', p_plan));
  return jsonb_build_object('success', true);
end;
$$;

-- ── apply_subscription_grant: para usar desde webhook de Stripe ───────────
-- (Aplica créditos + rondas del plan al renovar o al activar suscripción)
create or replace function public.apply_subscription_grant(
  p_user_id   uuid,
  p_plan_slug text,
  p_event     text default 'subscription_monthly'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan public.plans%rowtype;
begin
  select * into v_plan from public.plans where slug = p_plan_slug;
  if not found then return jsonb_build_object('success', false, 'reason', 'Plan no existe'); end if;

  update public.profiles
     set plan = p_plan_slug,
         monthly_credits = v_plan.monthly_credits,
         credits_balance = credits_balance + v_plan.monthly_credits,
         image_rounds_balance = image_rounds_balance + v_plan.image_rounds,
         subscription_status = 'active',
         updated_at = now()
   where id = p_user_id;

  insert into public.credit_transactions (user_id, amount, transaction_type, description, metadata)
  values (p_user_id, v_plan.monthly_credits, p_event,
          'Plan ' || v_plan.name || ' — ' || v_plan.monthly_credits || ' créditos + ' || v_plan.image_rounds || ' rondas',
          jsonb_build_object('plan', p_plan_slug, 'rounds_added', v_plan.image_rounds));

  return jsonb_build_object('success', true, 'credits_added', v_plan.monthly_credits, 'rounds_added', v_plan.image_rounds);
end;
$$;

-- ── apply_package_purchase: para usar desde webhook de Stripe ─────────────
create or replace function public.apply_package_purchase(
  p_user_id      uuid,
  p_package_slug text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_pkg public.credit_packages%rowtype;
begin
  select * into v_pkg from public.credit_packages where slug = p_package_slug;
  if not found then return jsonb_build_object('success', false, 'reason', 'Paquete no existe'); end if;

  update public.profiles
     set credits_balance = credits_balance + v_pkg.credits,
         image_rounds_balance = image_rounds_balance + v_pkg.image_rounds,
         updated_at = now()
   where id = p_user_id;

  insert into public.credit_transactions (user_id, amount, transaction_type, description, metadata)
  values (p_user_id, v_pkg.credits, 'purchase',
          'Compra: ' || v_pkg.name,
          jsonb_build_object('package', p_package_slug, 'rounds_added', v_pkg.image_rounds, 'price', v_pkg.price));

  return jsonb_build_object('success', true, 'credits_added', v_pkg.credits, 'rounds_added', v_pkg.image_rounds);
end;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- ✅ Listo. Crear cuenta angelboneu65@gmail.com (si no existe) → será admin
--    automáticamente. Si ya existe, el script de arriba la promueve.
-- ═══════════════════════════════════════════════════════════════════════════
