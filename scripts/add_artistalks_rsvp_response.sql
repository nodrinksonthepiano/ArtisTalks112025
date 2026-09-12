-- ArtisTalks RSVP response function only.
-- Run in Supabase SQL Editor after add_artistalks_events.sql and before
-- enabling the artist-facing RSVP page in production.
-- This function does not send email or write to an external calendar.

BEGIN;

CREATE OR REPLACE FUNCTION public.respond_to_artistalks_event_invitation(
  p_rsvp_token_hash text,
  p_rsvp_status text
)
RETURNS TABLE (result_status text)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  invitation_id uuid;
  current_status text;
BEGIN
  IF p_rsvp_token_hash !~ '^[0-9a-f]{64}$'
    OR p_rsvp_status NOT IN ('accepted', 'maybe', 'declined')
  THEN
    RETURN;
  END IF;

  SELECT invitation.id, invitation.rsvp_status
  INTO invitation_id, current_status
  FROM public.artistalks_event_invitations AS invitation
  INNER JOIN public.artistalks_events AS event_row
    ON event_row.id = invitation.event_id
  WHERE invitation.rsvp_token_hash = p_rsvp_token_hash
    AND invitation.rsvp_token_expires_at > now()
    AND invitation.delivery_status = 'sent'
    AND event_row.status IN ('draft', 'scheduled')
  FOR UPDATE OF invitation, event_row;

  IF invitation_id IS NULL THEN
    RETURN;
  END IF;

  IF current_status IS DISTINCT FROM p_rsvp_status THEN
    UPDATE public.artistalks_event_invitations
    SET rsvp_status = p_rsvp_status
    WHERE id = invitation_id;

    current_status := p_rsvp_status;
  END IF;

  RETURN QUERY SELECT current_status;
END;
$$;

COMMENT ON FUNCTION public.respond_to_artistalks_event_invitation(text, text) IS
  'Service-role-only atomic RSVP mutation. Validates a sent, unexpired invitation and locks its active event before changing the response.';

REVOKE ALL
  ON FUNCTION public.respond_to_artistalks_event_invitation(text, text)
  FROM PUBLIC;

REVOKE ALL
  ON FUNCTION public.respond_to_artistalks_event_invitation(text, text)
  FROM anon;

REVOKE ALL
  ON FUNCTION public.respond_to_artistalks_event_invitation(text, text)
  FROM authenticated;

GRANT EXECUTE
  ON FUNCTION public.respond_to_artistalks_event_invitation(text, text)
  TO service_role;

COMMIT;
