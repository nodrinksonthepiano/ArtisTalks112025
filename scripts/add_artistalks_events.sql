-- ArtisTalks native calendar foundation: events + artist invitations only.
-- Run once in Supabase SQL Editor before relying on ArtisTalks invitations.
-- This schema does not send email, create external calendar events, or modify
-- profiles, curriculum, payments, Orbit, or authentication behavior.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) ArtisTalks-owned events
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.artistalks_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  timezone text NOT NULL,
  location text,
  meeting_url text,
  status text NOT NULL DEFAULT 'draft',
  created_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  calendar_sequence integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  canceled_at timestamptz,
  CONSTRAINT artistalks_events_status_check
    CHECK (status IN ('draft', 'scheduled', 'canceled')),
  CONSTRAINT artistalks_events_time_order_check
    CHECK (ends_at > starts_at),
  CONSTRAINT artistalks_events_title_check
    CHECK (char_length(btrim(title)) BETWEEN 1 AND 200),
  CONSTRAINT artistalks_events_description_check
    CHECK (char_length(description) <= 10000),
  CONSTRAINT artistalks_events_timezone_check
    CHECK (char_length(btrim(timezone)) BETWEEN 1 AND 100),
  CONSTRAINT artistalks_events_location_check
    CHECK (location IS NULL OR char_length(location) <= 500),
  CONSTRAINT artistalks_events_meeting_url_check
    CHECK (
      meeting_url IS NULL
      OR (
        char_length(meeting_url) <= 2048
        AND meeting_url ~* '^https://'
      )
    ),
  CONSTRAINT artistalks_events_calendar_sequence_check
    CHECK (calendar_sequence >= 0),
  CONSTRAINT artistalks_events_canceled_at_check
    CHECK (
      (status = 'canceled' AND canceled_at IS NOT NULL)
      OR (status <> 'canceled' AND canceled_at IS NULL)
    )
);

COMMENT ON TABLE public.artistalks_events IS
  'ArtisTalks-owned calendar events. Saving or scheduling a row does not send email or write to an external calendar.';

COMMENT ON COLUMN public.artistalks_events.created_by IS
  'Server-controlled creator identity. The browser must never choose or override this value.';

COMMENT ON COLUMN public.artistalks_events.timezone IS
  'IANA timezone used for human display. starts_at and ends_at remain absolute timestamptz values.';

COMMENT ON COLUMN public.artistalks_events.meeting_url IS
  'Optional HTTPS meeting link. Visible only to artists invited to this event.';

COMMENT ON COLUMN public.artistalks_events.calendar_sequence IS
  'Server-controlled iCalendar revision. Increments when a scheduled event changes materially.';

CREATE INDEX IF NOT EXISTS artistalks_events_status_starts_at_idx
  ON public.artistalks_events (status, starts_at);

CREATE INDEX IF NOT EXISTS artistalks_events_created_by_created_at_idx
  ON public.artistalks_events (created_by, created_at DESC);

-- ---------------------------------------------------------------------------
-- 2) One invitation per event + artist
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.artistalks_event_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL
    REFERENCES public.artistalks_events (id) ON DELETE RESTRICT,
  invitee_user_id uuid NOT NULL
    REFERENCES auth.users (id) ON DELETE CASCADE,
  rsvp_status text NOT NULL DEFAULT 'pending',
  rsvp_token_hash text NOT NULL,
  rsvp_token_expires_at timestamptz NOT NULL,
  delivery_status text NOT NULL DEFAULT 'unsent',
  send_idempotency_key text,
  provider_message_id text,
  sent_at timestamptz,
  responded_at timestamptz,
  last_delivery_error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT artistalks_event_invitations_event_invitee_key
    UNIQUE (event_id, invitee_user_id),
  CONSTRAINT artistalks_event_invitations_rsvp_token_hash_key
    UNIQUE (rsvp_token_hash),
  CONSTRAINT artistalks_event_invitations_rsvp_status_check
    CHECK (rsvp_status IN ('pending', 'accepted', 'maybe', 'declined')),
  CONSTRAINT artistalks_event_invitations_delivery_status_check
    CHECK (delivery_status IN ('unsent', 'sent', 'failed')),
  CONSTRAINT artistalks_event_invitations_token_hash_check
    CHECK (rsvp_token_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT artistalks_event_invitations_token_expiry_check
    CHECK (rsvp_token_expires_at > created_at),
  CONSTRAINT artistalks_event_invitations_idempotency_key_check
    CHECK (
      send_idempotency_key IS NULL
      OR char_length(btrim(send_idempotency_key)) BETWEEN 1 AND 200
    ),
  CONSTRAINT artistalks_event_invitations_provider_message_id_check
    CHECK (
      provider_message_id IS NULL
      OR char_length(provider_message_id) <= 500
    ),
  CONSTRAINT artistalks_event_invitations_error_code_check
    CHECK (
      last_delivery_error_code IS NULL
      OR char_length(last_delivery_error_code) <= 200
    ),
  CONSTRAINT artistalks_event_invitations_rsvp_response_check
    CHECK (
      (rsvp_status = 'pending' AND responded_at IS NULL)
      OR (rsvp_status <> 'pending' AND responded_at IS NOT NULL)
    ),
  CONSTRAINT artistalks_event_invitations_delivery_time_check
    CHECK (
      (delivery_status = 'sent'
        AND send_idempotency_key IS NOT NULL
        AND sent_at IS NOT NULL
        AND last_delivery_error_code IS NULL)
      OR (delivery_status = 'failed'
        AND send_idempotency_key IS NOT NULL
        AND sent_at IS NULL)
      OR (delivery_status = 'unsent' AND sent_at IS NULL)
    )
);

COMMENT ON TABLE public.artistalks_event_invitations IS
  'One artist invitation per ArtisTalks event. RSVP and delivery state are separate; no row sends email by itself.';

COMMENT ON COLUMN public.artistalks_event_invitations.invitee_user_id IS
  'Private recipient identity. Resolve and validate server-side; never expose this ID or the recipient email to the browser.';

COMMENT ON COLUMN public.artistalks_event_invitations.rsvp_token_hash IS
  'Server-only SHA-256 hex digest of the signed RSVP token. Never store or log the raw token.';

COMMENT ON COLUMN public.artistalks_event_invitations.rsvp_token_expires_at IS
  'Server-controlled expiration for the RSVP email credential.';

COMMENT ON COLUMN public.artistalks_event_invitations.send_idempotency_key IS
  'Server-only logical-send key. A unique non-null value prevents duplicate invitation sends.';

COMMENT ON COLUMN public.artistalks_event_invitations.provider_message_id IS
  'Server-only delivery-provider identifier. Never return it to the browser.';

COMMENT ON COLUMN public.artistalks_event_invitations.last_delivery_error_code IS
  'Server-only sanitized code. Never store raw provider responses, secrets, or email addresses.';

CREATE UNIQUE INDEX IF NOT EXISTS artistalks_event_invitations_send_idempotency_key_idx
  ON public.artistalks_event_invitations (send_idempotency_key)
  WHERE send_idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS artistalks_event_invitations_provider_message_id_idx
  ON public.artistalks_event_invitations (provider_message_id)
  WHERE provider_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS artistalks_event_invitations_invitee_created_at_idx
  ON public.artistalks_event_invitations (invitee_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS artistalks_event_invitations_event_rsvp_idx
  ON public.artistalks_event_invitations (event_id, rsvp_status);

CREATE INDEX IF NOT EXISTS artistalks_event_invitations_delivery_idx
  ON public.artistalks_event_invitations (delivery_status, created_at);

-- ---------------------------------------------------------------------------
-- 3) Server-controlled timestamps and state transitions
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_artistalks_event()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.updated_at := coalesce(NEW.updated_at, now());
    NEW.calendar_sequence := coalesce(NEW.calendar_sequence, 0);
    IF NEW.status = 'canceled' THEN
      NEW.canceled_at := coalesce(NEW.canceled_at, now());
    ELSE
      NEW.canceled_at := NULL;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.id IS DISTINCT FROM OLD.id
      OR NEW.created_by IS DISTINCT FROM OLD.created_by
      OR NEW.created_at IS DISTINCT FROM OLD.created_at
    THEN
      RAISE EXCEPTION 'artistalks event identity fields are immutable';
    END IF;

    IF OLD.status = 'draft' AND NEW.status = 'canceled' THEN
      RAISE EXCEPTION 'schedule an ArtisTalks event before canceling it';
    END IF;

    IF OLD.status = 'scheduled' AND NEW.status = 'draft' THEN
      RAISE EXCEPTION 'a scheduled ArtisTalks event cannot return to draft';
    END IF;

    IF OLD.status = 'canceled' AND NEW.status <> 'canceled' THEN
      RAISE EXCEPTION 'a canceled ArtisTalks event is terminal';
    END IF;

    NEW.updated_at := now();

    IF OLD.status = 'scheduled'
      AND (
        NEW.title IS DISTINCT FROM OLD.title
        OR NEW.description IS DISTINCT FROM OLD.description
        OR NEW.starts_at IS DISTINCT FROM OLD.starts_at
        OR NEW.ends_at IS DISTINCT FROM OLD.ends_at
        OR NEW.timezone IS DISTINCT FROM OLD.timezone
        OR NEW.location IS DISTINCT FROM OLD.location
        OR NEW.meeting_url IS DISTINCT FROM OLD.meeting_url
        OR NEW.status IS DISTINCT FROM OLD.status
      )
    THEN
      NEW.calendar_sequence := OLD.calendar_sequence + 1;
    ELSE
      NEW.calendar_sequence := OLD.calendar_sequence;
    END IF;

    IF NEW.status = 'canceled' THEN
      NEW.canceled_at := coalesce(OLD.canceled_at, now());
    ELSE
      NEW.canceled_at := NULL;
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_artistalks_event_row
  ON public.artistalks_events;

CREATE TRIGGER protect_artistalks_event_row
BEFORE INSERT OR UPDATE ON public.artistalks_events
FOR EACH ROW
EXECUTE FUNCTION public.protect_artistalks_event();

CREATE OR REPLACE FUNCTION public.protect_artistalks_event_invitation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.updated_at := coalesce(NEW.updated_at, now());

    IF NEW.rsvp_status = 'pending' THEN
      NEW.responded_at := NULL;
    ELSE
      NEW.responded_at := coalesce(NEW.responded_at, now());
    END IF;

    IF NEW.delivery_status = 'sent' THEN
      NEW.sent_at := coalesce(NEW.sent_at, now());
      NEW.last_delivery_error_code := NULL;
    ELSE
      NEW.sent_at := NULL;
    END IF;

    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.id IS DISTINCT FROM OLD.id
      OR NEW.event_id IS DISTINCT FROM OLD.event_id
      OR NEW.invitee_user_id IS DISTINCT FROM OLD.invitee_user_id
      OR NEW.created_at IS DISTINCT FROM OLD.created_at
    THEN
      RAISE EXCEPTION 'artistalks invitation identity fields are immutable';
    END IF;

    IF OLD.delivery_status = 'sent' AND NEW.delivery_status <> 'sent' THEN
      RAISE EXCEPTION 'a sent ArtisTalks invitation cannot return to an unsent state';
    END IF;

    IF OLD.send_idempotency_key IS NOT NULL
      AND NEW.send_idempotency_key IS DISTINCT FROM OLD.send_idempotency_key
    THEN
      RAISE EXCEPTION 'an ArtisTalks invitation idempotency key is immutable once claimed';
    END IF;

    IF OLD.provider_message_id IS NOT NULL
      AND NEW.provider_message_id IS DISTINCT FROM OLD.provider_message_id
    THEN
      RAISE EXCEPTION 'an ArtisTalks invitation provider message ID is immutable once stored';
    END IF;

    IF OLD.delivery_status = 'sent'
      AND (
        NEW.rsvp_token_hash IS DISTINCT FROM OLD.rsvp_token_hash
        OR NEW.rsvp_token_expires_at IS DISTINCT FROM OLD.rsvp_token_expires_at
      )
    THEN
      RAISE EXCEPTION 'a sent ArtisTalks invitation RSVP credential is immutable';
    END IF;

    IF OLD.rsvp_status <> 'pending' AND NEW.rsvp_status = 'pending' THEN
      RAISE EXCEPTION 'an ArtisTalks RSVP cannot return to pending';
    END IF;

    NEW.updated_at := now();

    IF NEW.rsvp_status IS DISTINCT FROM OLD.rsvp_status THEN
      NEW.responded_at := CASE
        WHEN NEW.rsvp_status = 'pending' THEN NULL
        ELSE now()
      END;
    ELSE
      NEW.responded_at := OLD.responded_at;
    END IF;

    IF NEW.delivery_status IS DISTINCT FROM OLD.delivery_status THEN
      IF NEW.delivery_status = 'sent' THEN
        NEW.sent_at := now();
        NEW.last_delivery_error_code := NULL;
      ELSE
        NEW.sent_at := NULL;
      END IF;
    ELSE
      NEW.sent_at := OLD.sent_at;
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_artistalks_event_invitation_row
  ON public.artistalks_event_invitations;

CREATE TRIGGER protect_artistalks_event_invitation_row
BEFORE INSERT OR UPDATE ON public.artistalks_event_invitations
FOR EACH ROW
EXECUTE FUNCTION public.protect_artistalks_event_invitation();

-- ---------------------------------------------------------------------------
-- 4) RLS: invited artists may read; browser mutations remain denied
-- ---------------------------------------------------------------------------
ALTER TABLE public.artistalks_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.artistalks_event_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS artistalks_events_select_invited
  ON public.artistalks_events;

CREATE POLICY artistalks_events_select_invited
ON public.artistalks_events
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.artistalks_event_invitations AS invitation
    WHERE invitation.event_id = artistalks_events.id
      AND invitation.invitee_user_id = auth.uid()
      AND invitation.delivery_status = 'sent'
  )
);

DROP POLICY IF EXISTS artistalks_event_invitations_select_own
  ON public.artistalks_event_invitations;

CREATE POLICY artistalks_event_invitations_select_own
ON public.artistalks_event_invitations
FOR SELECT
TO authenticated
USING (
  auth.uid() = invitee_user_id
  AND delivery_status = 'sent'
);

-- Intentionally no authenticated INSERT, UPDATE, or DELETE policies.
-- Jai management and scanner-safe RSVP mutations must use separately approved,
-- authenticated server routes. Service-role use alone is not authorization;
-- those routes must first verify Jai or validate the signed RSVP credential.

COMMIT;
