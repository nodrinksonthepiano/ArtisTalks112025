-- SaaS $8 PayPal sandbox: webhook idempotency only.
-- Run once in Supabase SQL Editor before relying on PayPal Subscriptions.
-- Does NOT change saas_payment_subscriptions (provider='paypal' already allowed).
-- Does NOT mix Orbit tuition into these tables.

-- ---------------------------------------------------------------------------
-- saas_paypal_webhook_events (required; mark only after successful writes)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.saas_paypal_webhook_events (
  event_id text PRIMARY KEY,
  processed_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.saas_paypal_webhook_events IS
  'Successfully processed PayPal webhook event IDs. Insert ONLY after required DB writes succeed so failed handling remains retryable. Do not mix with Stripe event IDs.';

ALTER TABLE public.saas_paypal_webhook_events ENABLE ROW LEVEL SECURITY;
-- No policies for authenticated: service role only.
