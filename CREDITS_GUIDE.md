# 💰 Panda AdLab — Sistema de Créditos, Planes y Admin

Esta guía explica cómo activar y operar el sistema completo de créditos, planes de suscripción, paquetes de recarga y panel de administrador.

---

## TL;DR — Activación rápida (5 pasos)

1. **Correr SQL** en Supabase: pega `supabase-credits-schema.sql` en SQL Editor → Run.
2. **Crear cuenta admin**: regístrate en la app con `angelboneu65@gmail.com` (o si ya existe, ese email será admin automático en cuanto corras el SQL).
3. **Agregar env vars en Render** (server):
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY` ← desde Supabase Settings → API
   - `SUPABASE_ANON_KEY`
4. **(Opcional, para cobros)** Configurar Stripe — ver sección 4 abajo.
5. **Push** a main (Netlify auto-deploya el frontend).

Cuando el server arranque, vas a ver:
```
✓  Sistema de créditos ACTIVO
✓  Stripe ACTIVO   (o ⚠️  Stripe DESACTIVADO si no lo configuraste)
```

---

## 1. Arquitectura

```
┌─────────────────────────────────────────────────────────────────────┐
│  Frontend (React, Netlify)                                          │
│    - useProfile()    → trae /api/me                                 │
│    - authedFetch()   → manda Authorization: Bearer <JWT>            │
│    - CreditsModal    → se abre con 402 o manual                     │
│    - AdminPanel      → solo si role === 'admin'                     │
└───────────────────────────┬─────────────────────────────────────────┘
                            │ HTTPS + JWT
┌───────────────────────────▼─────────────────────────────────────────┐
│  Backend (Express, Render)                                          │
│    - attachUser middleware  → valida JWT con Supabase Auth          │
│    - /api/analyze, /api/generate, ... → llaman RPCs ATÓMICAS        │
│    - /api/admin/*           → requiere role admin                   │
│    - /api/stripe/*          → crea sesiones y procesa webhook       │
└───────────────────────────┬─────────────────────────────────────────┘
                            │ service_role (NO expuesto al cliente)
┌───────────────────────────▼─────────────────────────────────────────┐
│  Supabase (Postgres + Auth)                                         │
│    Tablas:                                                          │
│      profiles, credit_transactions, plans, credit_packages         │
│    RPCs SECURITY DEFINER:                                           │
│      consume_credits, consume_image_round_or_credits,              │
│      refund_transaction, admin_grant_credits, ...                  │
│    Trigger: on_auth_user_created → crea profile automático         │
│             (admin auto si email = angelboneu65@gmail.com)         │
│    RLS: usuarios solo leen lo suyo. Mutaciones críticas SOLO        │
│    via RPC con service role (frontend NO puede editar créditos).   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Schema y RPCs (qué crea el SQL)

| Tabla | Para qué |
|---|---|
| `profiles` | Extensión de `auth.users` con role, plan, créditos, rondas, Stripe IDs, etc. |
| `credit_transactions` | Historial inmutable de cada movimiento (descontar, sumar, refund, admin grant) |
| `plans` | Catálogo de planes (free / basic / pro) con `monthly_credits`, `image_rounds`, `stripe_price_id` |
| `credit_packages` | Paquetes de recarga única (1 ronda, 5 rondas, 50 créditos, 150 créditos) |

**RPCs principales** (todas `SECURITY DEFINER`, llamadas desde el server con service role):

| RPC | Qué hace |
|---|---|
| `consume_credits(user, amount, type, desc, meta)` | Atómico: chequea balance, descuenta, registra transacción. Si admin/unlimited → log con 0 charge |
| `consume_image_round_or_credits(user, cost, desc, meta)` | Prefiere rondas; si no hay, cae a créditos |
| `refund_transaction(tx, reason)` | Revierte una transacción (rondas o créditos) |
| `admin_grant_credits(target, amount, desc)` | Valida `auth.uid()` admin, suma créditos |
| `admin_grant_rounds(target, amount, desc)` | Mismo pero rondas |
| `admin_set_unlimited / admin_set_role / admin_set_plan` | Toggles administrativos |
| `apply_subscription_grant(user, plan_slug, event)` | Suma créditos+rondas del plan (usado por webhook Stripe en `invoice.paid`) |
| `apply_package_purchase(user, package_slug)` | Suma créditos+rondas del paquete (usado por webhook en `checkout.session.completed`) |

---

## 3. Costos por acción

| Endpoint | Acción | Costo |
|---|---|---|
| `/api/extract` | Auto-llenar form desde imagen | **Gratis** (helper) |
| `/api/extract-brand` | Extraer colores del logo | **Gratis** (helper) |
| `/api/analyze-photo` | Detectar contexto de campaña | **Gratis** (helper) |
| `/api/reverse-geocode` | Geo + competencia local | **Gratis** (helper) |
| `/api/chat` | Asistente Panda | **Gratis** |
| `/api/analyze` | Panda Score (Opus) | **5 créditos** |
| `/api/generate` | Regenerar arte optimizado | **5 créditos** |
| `/api/regenerate-ad` | Regenerar 1 anuncio de campaña | **5 créditos** |
| `/api/generate-campaign` | 5 anuncios Foto a Campaña | **1 ronda O 25 créditos** |

**Admin (`role='admin'` o `is_unlimited=true`)**: no se le descuenta nada. Las acciones quedan loggeadas con `(unlimited)` en la descripción.

---

## 4. Stripe — setup paso a paso

### Crear productos en Stripe Dashboard

Andá a [dashboard.stripe.com](https://dashboard.stripe.com) → **Products** → New product.

**Suscripciones (recurring monthly):**

| Producto | Precio | slug en `plans` |
|---|---|---|
| Panda AdLab Basic | $9.99 USD / month | `basic` |
| Panda AdLab Pro | $19.99 USD / month | `pro` |

**Paquetes (one-time):**

| Producto | Precio | slug en `credit_packages` |
|---|---|---|
| Extra 1 ronda | $2.99 | `pack-1-round` |
| Extra 5 rondas | $9.99 | `pack-5-rounds` |
| 50 créditos | $4.99 | `pack-50-credits` |
| 150 créditos | $9.99 | `pack-150-credits` |

Después de crear cada producto, copiá el **Price ID** (empieza con `price_…`) y agrégalo a Render env vars:

```
STRIPE_BASIC_PRICE_ID=<PRICE_ID_BASIC>
STRIPE_PRO_PRICE_ID=<PRICE_ID_PRO>
STRIPE_EXTRA_ROUND_PRICE_ID=<PRICE_ID_PACK_1_ROUND>
STRIPE_EXTRA_5_ROUNDS_PRICE_ID=<PRICE_ID_PACK_5_ROUNDS>
STRIPE_50_CREDITS_PRICE_ID=<PRICE_ID_PACK_50_CREDITS>
STRIPE_150_CREDITS_PRICE_ID=<PRICE_ID_PACK_150_CREDITS>
```

### Configurar el webhook

En Stripe → **Developers** → **Webhooks** → Add endpoint:

- **URL**: `https://panda-proof.onrender.com/api/stripe-webhook`
- **Events** a escuchar:
  - `checkout.session.completed`
  - `invoice.paid`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`

Stripe te dará un **Signing secret** (`whsec_…`). Agregalo a Render como `STRIPE_WEBHOOK_SECRET`.

### Stripe modo test

Usá las keys que empiezan con `sk_test_…` y `pk_test_…`. Tarjeta de prueba: `4242 4242 4242 4242`, fecha futura, CVC cualquiera.

Cuando estés listo para producción, cambia a las keys `sk_live_…` y `pk_live_…`.

---

## 5. Variables de entorno completas en Render

Andá a Render → tu servicio panda-proof → **Environment** y agrega:

```
# IA (ya las tenés)
ANTHROPIC_API_KEY=sk-ant-…
OPENAI_API_KEY=sk-proj-…

# Supabase server-side (NUEVAS)
SUPABASE_URL=https://xxxxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJxxxx…
SUPABASE_SERVICE_ROLE_KEY=eyJxxxx…   ← SECRETO ABSOLUTO

# Stripe (NUEVAS, opcionales — sin ellas, no hay checkout)
STRIPE_SECRET_KEY=<YOUR_STRIPE_SECRET_KEY>
STRIPE_WEBHOOK_SECRET=<YOUR_STRIPE_WEBHOOK_SECRET>
STRIPE_BASIC_PRICE_ID=<PRICE_ID_BASIC>
STRIPE_PRO_PRICE_ID=<PRICE_ID_PRO>
STRIPE_EXTRA_ROUND_PRICE_ID=<PRICE_ID_PACK_1_ROUND>
STRIPE_EXTRA_5_ROUNDS_PRICE_ID=<PRICE_ID_PACK_5_ROUNDS>
STRIPE_50_CREDITS_PRICE_ID=<PRICE_ID_PACK_50_CREDITS>
STRIPE_150_CREDITS_PRICE_ID=<PRICE_ID_PACK_150_CREDITS>
```

> ⚠️ El `SUPABASE_SERVICE_ROLE_KEY` da acceso total a tu base de datos. **Nunca** lo pongas en variables que empiecen con `VITE_` (esas se bundlean en el cliente). Solo en variables del server.

---

## 6. Cómo PROBAR todo el flujo

### A. Crear usuario normal
1. Abre `https://stirring-speculoos-ca869c.netlify.app/` en incógnito
2. Crear cuenta con cualquier email tuyo (no el admin)
3. Vas a ver en el sidebar: **10 créditos · 0 rondas · Plan: free** (bono de bienvenida)

### B. Verificar cuenta admin
1. Inicia sesión con `angelboneu65@gmail.com`
2. Sidebar debe mostrar: **∞ Ilimitado · Plan: admin**
3. En el nav aparece **⚙️ Admin Panel** (botón rosa)

### C. Admin asigna créditos a otro usuario
1. Con el admin → Admin Panel → busca el email del usuario de prueba
2. Tocá `+/− Créditos` → ingresá `100`
3. El usuario de prueba refresca y debe ver `110 créditos`

### D. Consumir créditos
1. Con el usuario de prueba (110 créditos) hacer un análisis → debe bajar a `105` (5 créditos del análisis)
2. Regenerar arte → debe bajar a `100` (5 créditos)
3. Hacer una campaña Foto a Campaña → debe bajar a `75 créditos + 0 rondas` (25 créditos)

### E. Sin créditos
1. Intenta otra acción cara → aparece el modal "Necesitas más créditos"
2. Click en un plan o paquete → te lleva a Stripe Checkout

### F. Pago de prueba con Stripe
1. En Checkout usa: `4242 4242 4242 4242`, mes cualquiera futuro, CVC cualquiera
2. Después del pago vuelves a la app con `?checkout=success`
3. El webhook se dispara → asigna créditos
4. ~3-5 segundos después el sidebar refresca con los créditos nuevos

### G. Historial
- Usuario: en próximas iteraciones podemos exponer `GET /api/me/transactions` en la UI
- Admin: en el panel admin tocá **Ver historial** sobre cualquier usuario

---

## 7. Seguridad

✅ **Lo que está bien:**
- Frontend solo lee perfil/transacciones propias (RLS por `auth.uid()`)
- Mutaciones de créditos NUNCA desde el frontend — solo via RPCs con service role
- Stripe webhook verifica firma con `STRIPE_WEBHOOK_SECRET`
- Service role key vive solo en server (Render env)
- Trigger DB asegura que `angelboneu65@gmail.com` siempre quede admin

🛡️ **Reglas de oro:**
- NUNCA expongas `SUPABASE_SERVICE_ROLE_KEY` al frontend
- NUNCA confíes en datos enviados por el cliente para créditos — siempre re-verifica en server
- Los `apply_subscription_grant` y `apply_package_purchase` solo se llaman desde el webhook (no expuestos)

---

## 8. Cómo cambiar precios o agregar planes

### Cambiar un precio existente:
1. En Stripe: crea un nuevo Price para el mismo producto (los Price IDs son immutables)
2. Actualiza el env var correspondiente en Render
3. Re-deploy

### Agregar un plan nuevo (ej: "Enterprise"):
```sql
insert into public.plans (name, slug, price, monthly_credits, image_rounds, analysis_limit, display_order)
values ('Enterprise', 'enterprise', 49.99, 1000, 30, 200, 40);
```
Luego en Stripe creá el producto/price y agrega `STRIPE_ENTERPRISE_PRICE_ID` al server.
Actualizá `STRIPE_PRICE_MAP` en `server.js` para incluir el nuevo slug.

### Agregar un paquete nuevo:
```sql
insert into public.credit_packages (name, slug, credits, image_rounds, price, display_order)
values ('Mega Pack 500', 'pack-500', 500, 10, 24.99, 50);
```

---

## 9. Resetear créditos mensuales

Si querés un reset duro al inicio de cada mes (en vez de acumular), corré:
```sql
update public.profiles
   set credits_balance = monthly_credits
 where role <> 'admin' and is_unlimited = false;
```
Recomendación: hacelo con un cron job de Supabase Edge Functions o trigger en `invoice.paid`. El comportamiento actual ACUMULA créditos (más generoso con el usuario).

---

## 10. Troubleshooting

**"⚠️ Sistema de créditos DESACTIVADO" en logs de Render**
→ Falta `SUPABASE_URL` o `SUPABASE_SERVICE_ROLE_KEY`. Sin esto, todas las llamadas pasan libres sin cobrar.

**"insufficient_credits" pero el usuario sí tiene créditos**
→ Revisa el `Authorization: Bearer <jwt>` en el request. El frontend usa `authedFetch` que lo agrega automáticamente solo si `supabase.auth.getSession()` devuelve sesión activa.

**El admin se consume créditos igual**
→ Verifica que el profile tenga `role='admin'` o `is_unlimited=true`. Corré:
```sql
select email, role, is_unlimited from public.profiles where email = 'angelboneu65@gmail.com';
```
Si no muestra admin, corré:
```sql
update public.profiles set role='admin', is_unlimited=true, plan='admin' where email='angelboneu65@gmail.com';
```

**Stripe webhook no procesa el pago**
→ Stripe Dashboard → Webhooks → tu endpoint → ver los últimos eventos. Si dice "Failed signature verification", el `STRIPE_WEBHOOK_SECRET` no coincide.

**El frontend no recibe los créditos después del pago**
→ El webhook tarda 1-3 segundos. El frontend espera 2.5s después del `?checkout=success` y refresca. Si tampoco aparecen, ver logs de Render para el evento `checkout.session.completed`.
