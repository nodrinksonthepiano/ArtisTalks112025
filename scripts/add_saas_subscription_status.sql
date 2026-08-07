-- Slice E: smallest SaaS authorization field for paid continuation.
-- Run once in Supabase SQL Editor before relying on the $8 access gate.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS saas_subscription_status text NOT NULL DEFAULT 'inactive';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_saas_subscription_status_check'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_saas_subscription_status_check
      CHECK (saas_subscription_status IN ('inactive', 'active', 'comped'));
  END IF;
END $$;

COMMENT ON COLUMN public.profiles.saas_subscription_status IS
  'ArtisTalks SaaS access status. Server/manual controlled. active or comped may continue beyond CURRENT_FOCUS_PILLAR.';

CREATE OR REPLACE FUNCTION public.is_trusted_saas_status_writer()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT
    auth.role() = 'service_role'
    OR current_user IN ('postgres', 'supabase_admin')
    OR session_user IN ('postgres', 'supabase_admin');
$$;

CREATE OR REPLACE FUNCTION public.protect_saas_subscription_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF public.is_trusted_saas_status_writer() THEN
      RETURN NEW;
    END IF;

    IF NEW.saas_subscription_status IS NULL THEN
      NEW.saas_subscription_status := 'inactive';
      RETURN NEW;
    END IF;

    IF NEW.saas_subscription_status <> 'inactive' THEN
      RAISE EXCEPTION 'saas_subscription_status is server controlled';
    END IF;

    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.saas_subscription_status IS DISTINCT FROM OLD.saas_subscription_status
      AND NOT public.is_trusted_saas_status_writer()
    THEN
      RAISE EXCEPTION 'saas_subscription_status is server controlled';
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_saas_subscription_status_on_profiles ON public.profiles;

CREATE TRIGGER protect_saas_subscription_status_on_profiles
BEFORE INSERT OR UPDATE OF saas_subscription_status ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_saas_subscription_status();
