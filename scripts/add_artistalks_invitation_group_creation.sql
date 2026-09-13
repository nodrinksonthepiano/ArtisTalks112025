-- ArtisTalks atomic invitation-group creation function only.
-- Run manually in Supabase SQL Editor after add_artistalks_invitation_groups.sql.
-- This function creates organizational groups only. It does not create
-- invitations, send email, or grant access or invitation eligibility.

BEGIN;

CREATE OR REPLACE FUNCTION public.create_artistalks_invitation_group(
  p_created_by uuid,
  p_name text,
  p_member_user_ids uuid[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_group_id uuid;
  v_name text;
  v_requested_count integer;
  v_eligible_count integer;
BEGIN
  IF p_created_by IS NULL THEN
    RAISE EXCEPTION 'group creator is required';
  END IF;

  v_name := btrim(p_name);
  IF v_name IS NULL OR char_length(v_name) NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'group name must contain 1 to 100 characters';
  END IF;

  IF lower(v_name) = 'all eligible artists' THEN
    RAISE EXCEPTION 'reserved group name';
  END IF;

  IF p_member_user_ids IS NULL OR cardinality(p_member_user_ids) = 0 THEN
    RAISE EXCEPTION 'at least one group member is required';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(p_member_user_ids) AS members(member_user_id)
    WHERE members.member_user_id IS NULL
  ) THEN
    RAISE EXCEPTION 'group member IDs cannot be null';
  END IF;

  SELECT count(DISTINCT members.member_user_id)
    INTO v_requested_count
  FROM unnest(p_member_user_ids) AS members(member_user_id);

  IF v_requested_count <> cardinality(p_member_user_ids) THEN
    RAISE EXCEPTION 'group member IDs must be unique';
  END IF;

  SELECT count(*)
    INTO v_eligible_count
  FROM public.profiles
  WHERE id = ANY (p_member_user_ids)
    AND saas_subscription_status IN ('active', 'comped');

  IF v_eligible_count <> v_requested_count THEN
    RAISE EXCEPTION 'every group member must be currently eligible';
  END IF;

  INSERT INTO public.artistalks_invitation_groups (name, created_by)
  VALUES (v_name, p_created_by)
  RETURNING id INTO v_group_id;

  INSERT INTO public.artistalks_invitation_group_members (
    group_id,
    member_user_id
  )
  SELECT v_group_id, members.member_user_id
  FROM unnest(p_member_user_ids) AS members(member_user_id);

  RETURN v_group_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_artistalks_invitation_group(
  uuid,
  text,
  uuid[]
) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.create_artistalks_invitation_group(
  uuid,
  text,
  uuid[]
) FROM anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_artistalks_invitation_group(
  uuid,
  text,
  uuid[]
) TO service_role;

COMMENT ON FUNCTION public.create_artistalks_invitation_group(
  uuid,
  text,
  uuid[]
) IS
  'Creates one named organizational group and its members atomically. Caller must separately authorize Jai. Membership never grants access or invitation eligibility; current active/comped eligibility is rechecked inside this function.';

COMMIT;
