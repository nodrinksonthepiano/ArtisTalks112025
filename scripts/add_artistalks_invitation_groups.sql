-- ArtisTalks reusable invitation groups only.
-- Run manually in Supabase SQL Editor before using saved invitation groups.
-- This additive schema does not create invitations, send email, or change
-- profiles, entitlements, payments, providers, events, or authentication.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) Jai-owned reusable invitation groups
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.artistalks_invitation_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT artistalks_invitation_groups_name_check
    CHECK (
      name = btrim(name)
      AND char_length(name) BETWEEN 1 AND 100
    ),
  CONSTRAINT artistalks_invitation_groups_reserved_name_check
    CHECK (lower(btrim(name)) <> 'all eligible artists')
);

CREATE UNIQUE INDEX IF NOT EXISTS artistalks_invitation_groups_creator_name_idx
  ON public.artistalks_invitation_groups (created_by, lower(btrim(name)));

COMMENT ON TABLE public.artistalks_invitation_groups IS
  'Jai-owned reusable artist group names for invitation preparation. All eligible artists is a live virtual group and must not be stored here.';

COMMENT ON COLUMN public.artistalks_invitation_groups.created_by IS
  'Private server-controlled owner identity. Never expose this ID to the browser.';

-- ---------------------------------------------------------------------------
-- 2) Reusable group membership
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.artistalks_invitation_group_members (
  group_id uuid NOT NULL
    REFERENCES public.artistalks_invitation_groups (id) ON DELETE CASCADE,
  member_user_id uuid NOT NULL
    REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, member_user_id)
);

CREATE INDEX IF NOT EXISTS artistalks_invitation_group_members_user_id_idx
  ON public.artistalks_invitation_group_members (member_user_id);

COMMENT ON TABLE public.artistalks_invitation_group_members IS
  'Organizational membership only. Membership never grants ArtisTalks access or invitation eligibility; eligibility must always be rechecked separately.';

COMMENT ON COLUMN public.artistalks_invitation_group_members.member_user_id IS
  'Private server-only artist identity. Store no email, entitlement, payment, or provider data in this table.';

-- ---------------------------------------------------------------------------
-- 3) Trim group names and maintain updated_at
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prepare_artistalks_invitation_group_row()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
    AND (
      NEW.id IS DISTINCT FROM OLD.id
      OR NEW.created_by IS DISTINCT FROM OLD.created_by
      OR NEW.created_at IS DISTINCT FROM OLD.created_at
    )
  THEN
    RAISE EXCEPTION 'artistalks invitation group identity fields are immutable';
  END IF;

  NEW.name := btrim(NEW.name);
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prepare_artistalks_invitation_group_row
  ON public.artistalks_invitation_groups;

CREATE TRIGGER prepare_artistalks_invitation_group_row
BEFORE INSERT OR UPDATE ON public.artistalks_invitation_groups
FOR EACH ROW
EXECUTE FUNCTION public.prepare_artistalks_invitation_group_row();

-- ---------------------------------------------------------------------------
-- 4) Server-only access
-- ---------------------------------------------------------------------------
ALTER TABLE public.artistalks_invitation_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.artistalks_invitation_group_members ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.artistalks_invitation_groups
  FROM anon, authenticated;
REVOKE ALL ON TABLE public.artistalks_invitation_group_members
  FROM anon, authenticated;

-- Intentionally no authenticated browser SELECT, INSERT, UPDATE, or DELETE
-- policies. Future access must use separately approved Jai-authorized server
-- actions. Service-role use alone is not authorization.

COMMIT;
