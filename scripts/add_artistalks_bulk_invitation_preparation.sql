-- ArtisTalks atomic bulk invitation preparation function only.
-- Run manually in Supabase SQL Editor after the event, invitation-group, and
-- invitation-group-creation scripts. This function creates missing invitation
-- rows only. It does not send email or change any existing invitation.

BEGIN;

CREATE OR REPLACE FUNCTION public.prepare_artistalks_event_invitations(
  p_created_by uuid,
  p_event_id uuid,
  p_selector_kind text,
  p_selector_id uuid,
  p_expected_recipient_user_ids uuid[],
  p_rsvp_token_expires_at timestamptz,
  p_invitation_candidates jsonb
)
RETURNS TABLE (result_status text, inserted_count integer)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_current_recipient_user_ids uuid[] := ARRAY[]::uuid[];
  v_expected_recipient_user_ids uuid[] := ARRAY[]::uuid[];
  v_candidate_recipient_user_ids uuid[] := ARRAY[]::uuid[];
  v_expected_count integer;
  v_inserted_count integer := 0;
BEGIN
  IF p_created_by IS NULL OR p_event_id IS NULL THEN
    RAISE EXCEPTION 'event owner and event are required';
  END IF;

  PERFORM 1
  FROM public.artistalks_events AS event
  WHERE event.id = p_event_id
    AND event.created_by = p_created_by
    AND event.status IN ('draft', 'scheduled')
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'event_unavailable'::text, 0;
    RETURN;
  END IF;

  IF p_selector_kind = 'artist' THEN
    IF p_selector_id IS NULL THEN
      RAISE EXCEPTION 'artist selector identity is required';
    END IF;

    SELECT coalesce(
      array_agg(profile.id ORDER BY profile.id),
      ARRAY[]::uuid[]
    )
    INTO v_current_recipient_user_ids
    FROM public.profiles AS profile
    WHERE profile.id = p_selector_id
      AND profile.saas_subscription_status IN ('active', 'comped')
      AND nullif(btrim(profile.artist_name), '') IS NOT NULL
      AND strpos(profile.artist_name, '@') = 0;
  ELSIF p_selector_kind = 'group' THEN
    IF p_selector_id IS NULL THEN
      RAISE EXCEPTION 'group selector identity is required';
    END IF;

    SELECT coalesce(
      array_agg(profile.id ORDER BY profile.id),
      ARRAY[]::uuid[]
    )
    INTO v_current_recipient_user_ids
    FROM public.artistalks_invitation_groups AS invitation_group
    JOIN public.artistalks_invitation_group_members AS membership
      ON membership.group_id = invitation_group.id
    JOIN public.profiles AS profile
      ON profile.id = membership.member_user_id
    WHERE invitation_group.id = p_selector_id
      AND invitation_group.created_by = p_created_by
      AND profile.saas_subscription_status IN ('active', 'comped')
      AND nullif(btrim(profile.artist_name), '') IS NOT NULL
      AND strpos(profile.artist_name, '@') = 0;
  ELSIF p_selector_kind = 'all_eligible' THEN
    IF p_selector_id IS NOT NULL THEN
      RAISE EXCEPTION 'all eligible selector must not include an identity';
    END IF;

    SELECT coalesce(
      array_agg(profile.id ORDER BY profile.id),
      ARRAY[]::uuid[]
    )
    INTO v_current_recipient_user_ids
    FROM public.profiles AS profile
    WHERE profile.saas_subscription_status IN ('active', 'comped')
      AND nullif(btrim(profile.artist_name), '') IS NOT NULL
      AND strpos(profile.artist_name, '@') = 0;
  ELSE
    RAISE EXCEPTION 'unsupported invitation selector';
  END IF;

  IF p_expected_recipient_user_ids IS NULL
    OR cardinality(p_expected_recipient_user_ids) = 0
  THEN
    RAISE EXCEPTION 'expected recipients are required';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(p_expected_recipient_user_ids) AS expected(recipient_user_id)
    WHERE expected.recipient_user_id IS NULL
  ) THEN
    RAISE EXCEPTION 'expected recipients cannot contain null';
  END IF;

  SELECT
    count(*)::integer,
    coalesce(
      array_agg(expected.recipient_user_id ORDER BY expected.recipient_user_id),
      ARRAY[]::uuid[]
    )
  INTO v_expected_count, v_expected_recipient_user_ids
  FROM unnest(p_expected_recipient_user_ids) AS expected(recipient_user_id);

  IF (
    SELECT count(DISTINCT expected.recipient_user_id)
    FROM unnest(p_expected_recipient_user_ids) AS expected(recipient_user_id)
  ) <> v_expected_count THEN
    RAISE EXCEPTION 'expected recipients must be unique';
  END IF;

  IF v_current_recipient_user_ids IS DISTINCT FROM v_expected_recipient_user_ids THEN
    RETURN QUERY SELECT 'recipient_set_changed'::text, 0;
    RETURN;
  END IF;

  IF p_rsvp_token_expires_at IS NULL
    OR p_rsvp_token_expires_at <= statement_timestamp()
  THEN
    RAISE EXCEPTION 'RSVP token expiry must be in the future';
  END IF;

  IF p_invitation_candidates IS NULL
    OR jsonb_typeof(p_invitation_candidates) <> 'array'
  THEN
    RAISE EXCEPTION 'invitation candidates must be an array';
  END IF;

  IF jsonb_array_length(p_invitation_candidates) <> v_expected_count THEN
    RAISE EXCEPTION 'one invitation candidate per recipient is required';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_invitation_candidates) AS candidate(value)
    WHERE jsonb_typeof(candidate.value) <> 'object'
      OR NOT (candidate.value ? 'invitation_id')
      OR NOT (candidate.value ? 'invitee_user_id')
      OR NOT (candidate.value ? 'rsvp_token_hash')
      OR coalesce(candidate.value ->> 'invitation_id', '')
        !~* '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      OR coalesce(candidate.value ->> 'invitee_user_id', '')
        !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      OR coalesce(candidate.value ->> 'rsvp_token_hash', '')
        !~ '^[0-9a-f]{64}$'
  ) THEN
    RAISE EXCEPTION 'invitation candidate is invalid';
  END IF;

  WITH candidates AS (
    SELECT
      (candidate.value ->> 'invitation_id')::uuid AS invitation_id,
      (candidate.value ->> 'invitee_user_id')::uuid AS invitee_user_id,
      candidate.value ->> 'rsvp_token_hash' AS rsvp_token_hash
    FROM jsonb_array_elements(p_invitation_candidates) AS candidate(value)
  )
  SELECT coalesce(
    array_agg(candidates.invitee_user_id ORDER BY candidates.invitee_user_id),
    ARRAY[]::uuid[]
  )
  INTO v_candidate_recipient_user_ids
  FROM candidates;

  IF v_candidate_recipient_user_ids IS DISTINCT FROM v_expected_recipient_user_ids THEN
    RAISE EXCEPTION 'invitation candidates must match expected recipients';
  END IF;

  IF EXISTS (
    WITH candidates AS (
      SELECT
        (candidate.value ->> 'invitation_id')::uuid AS invitation_id,
        (candidate.value ->> 'invitee_user_id')::uuid AS invitee_user_id,
        candidate.value ->> 'rsvp_token_hash' AS rsvp_token_hash
      FROM jsonb_array_elements(p_invitation_candidates) AS candidate(value)
    )
    SELECT 1
    FROM candidates
    GROUP BY candidates.invitation_id
    HAVING count(*) <> 1
  ) OR EXISTS (
    WITH candidates AS (
      SELECT candidate.value ->> 'rsvp_token_hash' AS rsvp_token_hash
      FROM jsonb_array_elements(p_invitation_candidates) AS candidate(value)
    )
    SELECT 1
    FROM candidates
    GROUP BY candidates.rsvp_token_hash
    HAVING count(*) <> 1
  ) THEN
    RAISE EXCEPTION 'invitation candidate identities and token hashes must be unique';
  END IF;

  IF EXISTS (
    WITH candidates AS (
      SELECT
        (candidate.value ->> 'invitation_id')::uuid AS invitation_id,
        (candidate.value ->> 'invitee_user_id')::uuid AS invitee_user_id,
        candidate.value ->> 'rsvp_token_hash' AS rsvp_token_hash
      FROM jsonb_array_elements(p_invitation_candidates) AS candidate(value)
    ),
    missing_candidates AS (
      SELECT candidates.*
      FROM candidates
      LEFT JOIN public.artistalks_event_invitations AS existing_recipient
        ON existing_recipient.event_id = p_event_id
        AND existing_recipient.invitee_user_id = candidates.invitee_user_id
      WHERE existing_recipient.id IS NULL
    )
    SELECT 1
    FROM missing_candidates
    JOIN public.artistalks_event_invitations AS existing_identity
      ON existing_identity.id = missing_candidates.invitation_id
      OR existing_identity.rsvp_token_hash = missing_candidates.rsvp_token_hash
  ) THEN
    RAISE EXCEPTION 'invitation candidate identity collision';
  END IF;

  WITH candidates AS (
    SELECT
      (candidate.value ->> 'invitation_id')::uuid AS invitation_id,
      (candidate.value ->> 'invitee_user_id')::uuid AS invitee_user_id,
      candidate.value ->> 'rsvp_token_hash' AS rsvp_token_hash
    FROM jsonb_array_elements(p_invitation_candidates) AS candidate(value)
  )
  INSERT INTO public.artistalks_event_invitations (
    id,
    event_id,
    invitee_user_id,
    rsvp_status,
    rsvp_token_hash,
    rsvp_token_expires_at,
    delivery_status
  )
  SELECT
    candidates.invitation_id,
    p_event_id,
    candidates.invitee_user_id,
    'pending',
    candidates.rsvp_token_hash,
    p_rsvp_token_expires_at,
    'unsent'
  FROM candidates
  LEFT JOIN public.artistalks_event_invitations AS existing_recipient
    ON existing_recipient.event_id = p_event_id
    AND existing_recipient.invitee_user_id = candidates.invitee_user_id
  WHERE existing_recipient.id IS NULL
  ON CONFLICT (event_id, invitee_user_id) DO NOTHING;

  GET DIAGNOSTICS v_inserted_count = ROW_COUNT;

  RETURN QUERY SELECT 'prepared'::text, v_inserted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.prepare_artistalks_event_invitations(
  uuid,
  uuid,
  text,
  uuid,
  uuid[],
  timestamptz,
  jsonb
) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.prepare_artistalks_event_invitations(
  uuid,
  uuid,
  text,
  uuid,
  uuid[],
  timestamptz,
  jsonb
) FROM anon, authenticated;

GRANT EXECUTE ON FUNCTION public.prepare_artistalks_event_invitations(
  uuid,
  uuid,
  text,
  uuid,
  uuid[],
  timestamptz,
  jsonb
) TO service_role;

COMMENT ON FUNCTION public.prepare_artistalks_event_invitations(
  uuid,
  uuid,
  text,
  uuid,
  uuid[],
  timestamptz,
  jsonb
) IS
  'Atomically locks one Jai-owned event, reconstructs and verifies the current eligible recipient set, and inserts only missing pending/unsent invitations. Existing invitations and RSVP credentials are never changed. Service-role execution still requires separate Jai authorization in application code.';

COMMIT;
