import 'server-only'

import type { Metadata } from 'next'
import { headers } from 'next/headers'
import {
  checkAuthRateLimit,
  getRequestClientIp,
  hashIp,
} from '@/lib/rateLimit'
import { hashArtistTalksRsvpToken } from '@/lib/artistalksRsvpToken'
import { createAdminClient } from '@/utils/supabase/admin'
import RsvpExperience, {
  type RsvpChoice,
  type RsvpLookupResult,
  type RsvpResponseResult,
} from './RsvpExperience'

type InvitationRow = {
  event_id: string
  rsvp_status: string
}

type EventRow = {
  title: string
  starts_at: string
  ends_at: string
  timezone: string
  status: string
}

const RSVP_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/
const EMAIL_SHAPED_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i
const LOOKUP_RATE_LIMIT = 30
const RESPONSE_RATE_LIMIT = 12
const RATE_LIMIT_WINDOW_SECONDS = 10 * 60

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'RSVP | ArtisTalks',
  referrer: 'no-referrer',
  robots: {
    index: false,
    follow: false,
  },
}

function unavailableLookup(): RsvpLookupResult {
  return { status: 'unavailable' }
}

function unavailableResponse(): RsvpResponseResult {
  return { status: 'unavailable' }
}

function isRsvpChoice(value: string): value is RsvpChoice {
  return value === 'accepted' || value === 'maybe' || value === 'declined'
}

function displayRsvpStatus(
  value: string
): 'Pending' | 'Accepted' | 'Maybe' | 'Declined' | null {
  if (value === 'pending') return 'Pending'
  if (value === 'accepted') return 'Accepted'
  if (value === 'maybe') return 'Maybe'
  if (value === 'declined') return 'Declined'
  return null
}

function formatEvent(event: EventRow) {
  const startsAt = new Date(event.starts_at)
  const endsAt = new Date(event.ends_at)

  if (
    Number.isNaN(startsAt.getTime()) ||
    Number.isNaN(endsAt.getTime()) ||
    endsAt <= startsAt
  ) {
    return null
  }

  try {
    const dateFormatter = new Intl.DateTimeFormat('en-US', {
      dateStyle: 'full',
      timeZone: event.timezone,
    })
    const timeFormatter = new Intl.DateTimeFormat('en-US', {
      timeStyle: 'short',
      timeZone: event.timezone,
    })
    const startDate = dateFormatter.format(startsAt)
    const endDate = dateFormatter.format(endsAt)

    return {
      date: startDate === endDate ? startDate : `${startDate}\u2013${endDate}`,
      time: `${timeFormatter.format(startsAt)}\u2013${timeFormatter.format(endsAt)}`,
    }
  } catch {
    return null
  }
}

async function rateLimitRsvpAttempt(
  bucketPrefix: 'lookup' | 'response',
  limit: number
) {
  const requestHeaders = await headers()
  const hashedIp = hashIp(getRequestClientIp(requestHeaders))
  const admin = createAdminClient()
  const allowed = await checkAuthRateLimit(
    admin,
    `artistalks-rsvp-${bucketPrefix}:ip:${hashedIp}`,
    limit,
    RATE_LIMIT_WINDOW_SECONDS
  )

  return { admin, allowed }
}

async function lookupInvitation(rawToken: string): Promise<RsvpLookupResult> {
  'use server'

  if (!RSVP_TOKEN_PATTERN.test(rawToken)) {
    return unavailableLookup()
  }

  try {
    const { admin, allowed } = await rateLimitRsvpAttempt(
      'lookup',
      LOOKUP_RATE_LIMIT
    )
    if (!allowed) return unavailableLookup()

    const tokenHash = hashArtistTalksRsvpToken(rawToken)
    const { data: invitationData, error: invitationError } = await admin
      .from('artistalks_event_invitations')
      .select('event_id, rsvp_status')
      .eq('rsvp_token_hash', tokenHash)
      .eq('delivery_status', 'sent')
      .gt('rsvp_token_expires_at', new Date().toISOString())
      .maybeSingle()

    if (invitationError || !invitationData) {
      return unavailableLookup()
    }

    const invitation = invitationData as InvitationRow
    const rsvpStatus = displayRsvpStatus(invitation.rsvp_status)
    if (!rsvpStatus) return unavailableLookup()

    const { data: eventData, error: eventError } = await admin
      .from('artistalks_events')
      .select('title, starts_at, ends_at, timezone, status')
      .eq('id', invitation.event_id)
      .maybeSingle()

    if (eventError || !eventData) {
      return unavailableLookup()
    }

    const event = eventData as EventRow
    if (
      (event.status !== 'draft' &&
        event.status !== 'scheduled' &&
        event.status !== 'canceled') ||
      !event.title.trim() ||
      EMAIL_SHAPED_PATTERN.test(event.title)
    ) {
      return unavailableLookup()
    }

    const displayTime = formatEvent(event)
    if (!displayTime) return unavailableLookup()

    return {
      status: event.status === 'canceled' ? 'canceled' : 'ready',
      eventTitle: event.title,
      date: displayTime.date,
      time: displayTime.time,
      timezone: event.timezone,
      rsvpStatus,
    }
  } catch {
    console.error('artistalks_rsvp_lookup_failed')
    return unavailableLookup()
  }
}

async function respondToInvitation(
  rawToken: string,
  choice: string
): Promise<RsvpResponseResult> {
  'use server'

  if (!RSVP_TOKEN_PATTERN.test(rawToken) || !isRsvpChoice(choice)) {
    return unavailableResponse()
  }

  try {
    const { admin, allowed } = await rateLimitRsvpAttempt(
      'response',
      RESPONSE_RATE_LIMIT
    )
    if (!allowed) return unavailableResponse()

    const tokenHash = hashArtistTalksRsvpToken(rawToken)
    const { data, error } = await admin.rpc(
      'respond_to_artistalks_event_invitation',
      {
        p_rsvp_token_hash: tokenHash,
        p_rsvp_status: choice,
      }
    )

    const result = Array.isArray(data) && data.length === 1 ? data[0] : null
    const rsvpStatus = displayRsvpStatus(
      typeof result?.result_status === 'string' ? result.result_status : ''
    )

    if (error || !rsvpStatus || rsvpStatus === 'Pending') {
      return unavailableResponse()
    }

    return { status: 'updated', rsvpStatus }
  } catch {
    console.error('artistalks_rsvp_response_failed')
    return unavailableResponse()
  }
}

export default function RsvpPage() {
  return (
    <main
      className="min-h-screen bg-[#051340] px-4 text-[#f5f1cf] [min-height:100dvh] sm:px-6"
      style={{
        paddingTop: 'max(1.5rem, env(safe-area-inset-top))',
        paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))',
      }}
    >
      <RsvpExperience
        lookupAction={lookupInvitation}
        respondAction={respondToInvitation}
      />
    </main>
  )
}
