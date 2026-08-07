-- Sprint 4: native Orbit application (separate from SaaS and curriculum).
-- Run once in Supabase SQL Editor before relying on Apply to Orbit.

CREATE TABLE IF NOT EXISTS public.orbit_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  phone text NOT NULL DEFAULT '',
  why_orbit text NOT NULL DEFAULT '',
  six_month_ready text,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  CONSTRAINT orbit_applications_user_id_key UNIQUE (user_id),
  CONSTRAINT orbit_applications_status_check
    CHECK (status IN ('draft', 'submitted', 'approved', 'declined')),
  CONSTRAINT orbit_applications_six_month_ready_check
    CHECK (
      six_month_ready IS NULL
      OR six_month_ready IN ('yes', 'not_yet')
    )
);

COMMENT ON TABLE public.orbit_applications IS
  'ArtisTalks Orbit Launch applications. No row = not_applied. Does not store sanctuary snapshots.';

COMMENT ON COLUMN public.orbit_applications.status IS
  'draft editable by artist; submitted read-only to artist; approved/declined admin only.';

CREATE OR REPLACE FUNCTION public.is_trusted_orbit_application_writer()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT
    auth.role() = 'service_role'
    OR current_user IN ('postgres', 'supabase_admin')
    OR session_user IN ('postgres', 'supabase_admin');
$$;

CREATE OR REPLACE FUNCTION public.protect_orbit_application()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF public.is_trusted_orbit_application_writer() THEN
      NEW.updated_at := coalesce(NEW.updated_at, now());
      RETURN NEW;
    END IF;

    IF NEW.user_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'orbit_applications user_id must match auth.uid()';
    END IF;

    IF NEW.status IS NULL OR NEW.status = 'draft' THEN
      NEW.status := 'draft';
      NEW.submitted_at := NULL;
      NEW.updated_at := now();
      RETURN NEW;
    END IF;

    RAISE EXCEPTION 'artists may only create orbit_applications as draft';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    NEW.updated_at := now();

    IF public.is_trusted_orbit_application_writer() THEN
      IF NEW.status = 'submitted'
        AND OLD.status IS DISTINCT FROM 'submitted'
        AND NEW.submitted_at IS NULL
      THEN
        NEW.submitted_at := now();
      END IF;
      RETURN NEW;
    END IF;

    IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'orbit_applications user_id is immutable';
    END IF;

    IF OLD.status <> 'draft' THEN
      RAISE EXCEPTION 'orbit application is read-only after submit';
    END IF;

    IF NEW.status IS NULL THEN
      NEW.status := 'draft';
    END IF;

    IF NEW.status NOT IN ('draft', 'submitted') THEN
      RAISE EXCEPTION 'artists may not set orbit application approved or declined';
    END IF;

    IF NEW.status = 'submitted' THEN
      NEW.submitted_at := coalesce(OLD.submitted_at, now());
    ELSE
      NEW.submitted_at := NULL;
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_orbit_application_row ON public.orbit_applications;

CREATE TRIGGER protect_orbit_application_row
BEFORE INSERT OR UPDATE ON public.orbit_applications
FOR EACH ROW
EXECUTE FUNCTION public.protect_orbit_application();

ALTER TABLE public.orbit_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS orbit_applications_select_own ON public.orbit_applications;
CREATE POLICY orbit_applications_select_own
ON public.orbit_applications
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS orbit_applications_insert_own_draft ON public.orbit_applications;
CREATE POLICY orbit_applications_insert_own_draft
ON public.orbit_applications
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id AND status = 'draft');

DROP POLICY IF EXISTS orbit_applications_update_own_draft ON public.orbit_applications;
CREATE POLICY orbit_applications_update_own_draft
ON public.orbit_applications
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id AND status = 'draft')
WITH CHECK (
  auth.uid() = user_id
  AND status IN ('draft', 'submitted')
);
