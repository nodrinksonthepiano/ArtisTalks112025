-- SaaS $8 Stripe sandbox: past_due + payment subscription rows + webhook idempotency.
-- Run once in Supabase SQL Editor before relying on Stripe Checkout.
-- Does NOT mix Orbit tuition into these tables.

-- ---------------------------------------------------------------------------
-- 1) profiles.saas_subscription_status: add past_due
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_saas_subscription_status_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_saas_subscription_status_check
  CHECK (
    saas_subscription_status IN ('inactive', 'active', 'past_due', 'comped')
  );

COMMENT ON COLUMN public.profiles.saas_subscription_status IS
  'ArtisTalks DIY SaaS access. inactive = no DIY access; active | past_due | comped = access. past_due retains access until Jai manually sets inactive. Server/manual controlled.';

-- ---------------------------------------------------------------------------
-- 2) saas_payment_subscriptions (Stripe now; PayPal later)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.saas_payment_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  provider text NOT NULL,
  provider_customer_id text,
  provider_subscription_id text,
  provider_status text NOT NULL DEFAULT '',
  plan_key text NOT NULL DEFAULT 'artistalks_8_monthly',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT saas_payment_subscriptions_provider_check
    CHECK (provider IN ('stripe', 'paypal')),
  CONSTRAINT saas_payment_subscriptions_provider_subscription_id_key
    UNIQUE (provider_subscription_id)
);

CREATE INDEX IF NOT EXISTS saas_payment_subscriptions_user_id_idx
  ON public.saas_payment_subscriptions (user_id);

CREATE INDEX IF NOT EXISTS saas_payment_subscriptions_provider_customer_id_idx
  ON public.saas_payment_subscriptions (provider_customer_id);

COMMENT ON TABLE public.saas_payment_subscriptions IS
  'ArtisTalks DIY SaaS provider subscriptions only. Not Orbit tuition. Not curriculum.';

COMMENT ON COLUMN public.saas_payment_subscriptions.plan_key IS
  'Canonical plan key, e.g. artistalks_8_monthly.';

ALTER TABLE public.saas_payment_subscriptions ENABLE ROW LEVEL SECURITY;

-- Service/admin only. Artist-facing status is /api/saas/status — no authenticated
-- SELECT/INSERT/UPDATE/DELETE policies (keeps provider IDs out of the browser).
DROP POLICY IF EXISTS saas_payment_subscriptions_select_own
  ON public.saas_payment_subscriptions;

-- ---------------------------------------------------------------------------
-- 3) saas_stripe_webhook_events (required; mark only after successful writes)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.saas_stripe_webhook_events (
  event_id text PRIMARY KEY,
  processed_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.saas_stripe_webhook_events IS
  'Successfully processed Stripe webhook event IDs. Insert ONLY after required DB writes succeed so failed handling remains retryable.';

ALTER TABLE public.saas_stripe_webhook_events ENABLE ROW LEVEL SECURITY;
-- No policies for authenticated: service role only.
