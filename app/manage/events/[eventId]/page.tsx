import { randomUUID } from 'crypto'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { normalizeArtistNameSlug } from '@/lib/artistName'
import { deriveArtistTalksRsvpTokenHash } from '@/lib/artistalksRsvpToken'
import { checkAuthRateLimit } from '@/lib/rateLimit'
import { requireJaiAdmin } from '@/utils/supabase/requireJaiAdmin'
import PrepareInvitation, {
  type ArtistLookupState,
  type InvitationPreparationState,
} from './PrepareInvitation'

type EventDetailPageProps = {
  params: Promise<{ eventId: string }>
}

type EventStatus = 'draft' | 'scheduled' | 'canceled'

type EventRow = {
  title: string
  description: string
  starts_at: string
  ends_at: string
  timezone: string
  location: string | null
  meeting_url: string | null
  status: string
}

type ArtistLookupRow = {
  id?: string
  artist_name: string | null
  saas_subscription_status: string | null
}

type InvitationEventRow = {
  id: string
  title: string
  ends_at: string
  status: string
}

type ExistingInvitationRow = {
  rsvp_status: string
  delivery_status: string
}

const EVENT_SELECT =
  'title, description, starts_at, ends_at, timezone, location, meeting_url, status'

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const EMAIL_SHAPED_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i
const ARTIST_NAME_MAX_LENGTH = 200
const INVITATION_LOOKUP_BUCKET = 'jai-invitation-artist-lookup'
const INVITATION_LOOKUP_LIMIT = 20
const INVITATION_LOOKUP_WINDOW_SECONDS = 10 * 60
const RSVP_EXPIRY_BUFFER_MS = 7 * 24 * 60 * 60 * 1000

const STATUS_LABELS: Record<EventStatus, string> = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  canceled: 'Canceled',
}

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Event | ArtisTalks',
  robots: {
    index: false,
    follow: false,
  },
}

function isEventStatus(status: string): status is EventStatus {
  return status === 'draft' || status === 'scheduled' || status === 'canceled'
}

function formatEventDateTime(event: EventRow) {
  const startsAt = new Date(event.starts_at)
  const endsAt = new Date(event.ends_at)

  if (
    Number.isNaN(startsAt.getTime()) ||
    Number.isNaN(endsAt.getTime())
  ) {
    throw new Error('Unable to display event time.')
  }

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
    date: startDate === endDate ? startDate : `${startDate}–${endDate}`,
    time: `${timeFormatter.format(startsAt)}–${timeFormatter.format(endsAt)}`,
  }
}

async function checkArtistForInvitation(
  eventId: string,
  _previousState: ArtistLookupState,
  formData: FormData
): Promise<ArtistLookupState> {
  'use server'

  const authorization = await requireJaiAdmin()
  if (!authorization.ok || !UUID_V4_PATTERN.test(eventId)) {
    return { status: 'error', message: 'Unable to prepare invitation.' }
  }

  const { data: ownedEvent, error: eventError } = await authorization.admin
    .from('artistalks_events')
    .select('id')
    .eq('id', eventId)
    .eq('created_by', authorization.userId)
    .maybeSingle()

  if (eventError) {
    console.error('artistalks_invitation_prepare_failed')
    return { status: 'error', message: 'Unable to prepare invitation.' }
  }

  if (!ownedEvent) {
    return { status: 'error', message: 'Unable to prepare invitation.' }
  }

  const rawArtistName = formData.get('artistName')
  const artistName =
    typeof rawArtistName === 'string' ? rawArtistName.trim() : ''
  const artistNameSlug = normalizeArtistNameSlug(artistName)

  if (
    !artistName ||
    artistName.length > ARTIST_NAME_MAX_LENGTH ||
    !artistNameSlug
  ) {
    return { status: 'error', message: 'Enter an artist name.' }
  }

  try {
    const lookupAllowed = await checkAuthRateLimit(
      authorization.admin,
      INVITATION_LOOKUP_BUCKET,
      INVITATION_LOOKUP_LIMIT,
      INVITATION_LOOKUP_WINDOW_SECONDS
    )

    if (!lookupAllowed) {
      return {
        status: 'error',
        message: 'Too many checks. Try again later.',
      }
    }
  } catch {
    console.error('artistalks_invitation_lookup_rate_limit_failed')
    return { status: 'error', message: 'Unable to check artist.' }
  }

  const { data, error } = await authorization.admin
    .from('profiles')
    .select('artist_name, saas_subscription_status')
    .eq('artist_name_slug', artistNameSlug)
    .maybeSingle()

  if (error) {
    console.error('artistalks_invitation_artist_lookup_failed')
    return { status: 'error', message: 'Unable to check artist.' }
  }

  if (!data) {
    return { status: 'error', message: 'Artist not found.' }
  }

  const profile = data as ArtistLookupRow
  const canonicalArtistName = profile.artist_name?.trim()

  if (!canonicalArtistName || EMAIL_SHAPED_PATTERN.test(canonicalArtistName)) {
    return { status: 'error', message: 'Artist not found.' }
  }

  return {
    status: 'selected',
    artistName: canonicalArtistName,
    eligible:
      profile.saas_subscription_status === 'active' ||
      profile.saas_subscription_status === 'comped',
  }
}

function preparedInvitationState(
  artistName: string,
  eventTitle: string
): InvitationPreparationState {
  return {
    status: 'prepared',
    artistName,
    eventTitle,
    rsvpStatus: 'Pending',
    deliveryStatus: 'Not sent',
  }
}

function invitationExpiry(endsAt: string): Date | null {
  const eventEndsAt = new Date(endsAt).getTime()
  if (Number.isNaN(eventEndsAt)) return null

  const expiry = new Date(
    Math.max(
      eventEndsAt + RSVP_EXPIRY_BUFFER_MS,
      Date.now() + RSVP_EXPIRY_BUFFER_MS
    )
  )
  expiry.setMilliseconds(0)
  return expiry
}

async function createInvitation(
  eventId: string,
  _previousState: InvitationPreparationState,
  formData: FormData
): Promise<InvitationPreparationState> {
  'use server'

  const authorization = await requireJaiAdmin()
  if (!authorization.ok || !UUID_V4_PATTERN.test(eventId)) {
    return { status: 'error', message: 'Unable to create invitation.' }
  }

  const { data: eventData, error: eventError } = await authorization.admin
    .from('artistalks_events')
    .select('id, title, ends_at, status')
    .eq('id', eventId)
    .eq('created_by', authorization.userId)
    .maybeSingle()

  if (eventError) {
    console.error('artistalks_invitation_create_failed')
    return { status: 'error', message: 'Unable to create invitation.' }
  }

  if (!eventData) {
    return { status: 'error', message: 'Unable to create invitation.' }
  }

  const event = eventData as InvitationEventRow
  if (event.status !== 'draft' && event.status !== 'scheduled') {
    return {
      status: 'error',
      message: 'Invitations cannot be prepared for this event.',
    }
  }

  const rawArtistName = formData.get('artistName')
  const artistName =
    typeof rawArtistName === 'string' ? rawArtistName.trim() : ''
  const artistNameSlug = normalizeArtistNameSlug(artistName)

  if (
    !artistName ||
    artistName.length > ARTIST_NAME_MAX_LENGTH ||
    !artistNameSlug
  ) {
    return { status: 'error', message: 'Unable to create invitation.' }
  }

  try {
    const lookupAllowed = await checkAuthRateLimit(
      authorization.admin,
      INVITATION_LOOKUP_BUCKET,
      INVITATION_LOOKUP_LIMIT,
      INVITATION_LOOKUP_WINDOW_SECONDS
    )

    if (!lookupAllowed) {
      return {
        status: 'error',
        message: 'Too many checks. Try again later.',
      }
    }
  } catch {
    console.error('artistalks_invitation_create_rate_limit_failed')
    return { status: 'error', message: 'Unable to create invitation.' }
  }

  const { data: profileData, error: profileError } = await authorization.admin
    .from('profiles')
    .select('id, artist_name, saas_subscription_status')
    .eq('artist_name_slug', artistNameSlug)
    .maybeSingle()

  if (profileError) {
    console.error('artistalks_invitation_create_failed')
    return { status: 'error', message: 'Unable to create invitation.' }
  }

  const profile = profileData as ArtistLookupRow | null
  const canonicalArtistName = profile?.artist_name?.trim()
  const eligible =
    profile?.saas_subscription_status === 'active' ||
    profile?.saas_subscription_status === 'comped'

  if (
    !profile?.id ||
    !canonicalArtistName ||
    EMAIL_SHAPED_PATTERN.test(canonicalArtistName) ||
    !eligible
  ) {
    return { status: 'error', message: 'Artist is not eligible.' }
  }

  const { data: existingData, error: existingError } =
    await authorization.admin
      .from('artistalks_event_invitations')
      .select('rsvp_status, delivery_status')
      .eq('event_id', event.id)
      .eq('invitee_user_id', profile.id)
      .maybeSingle()

  if (existingError) {
    console.error('artistalks_invitation_create_failed')
    return { status: 'error', message: 'Unable to create invitation.' }
  }

  if (existingData) {
    const existing = existingData as ExistingInvitationRow
    return existing.rsvp_status === 'pending' &&
      existing.delivery_status === 'unsent'
      ? preparedInvitationState(canonicalArtistName, event.title)
      : { status: 'error', message: 'An invitation already exists.' }
  }

  const expiresAt = invitationExpiry(event.ends_at)
  if (!expiresAt) {
    console.error('artistalks_invitation_create_failed')
    return { status: 'error', message: 'Unable to create invitation.' }
  }

  const invitationId = randomUUID()
  let rsvpTokenHash: string

  try {
    rsvpTokenHash = deriveArtistTalksRsvpTokenHash(invitationId, expiresAt)
  } catch {
    console.error('artistalks_invitation_token_create_failed')
    return { status: 'error', message: 'Unable to create invitation.' }
  }

  const { error: insertError } = await authorization.admin
    .from('artistalks_event_invitations')
    .insert({
      id: invitationId,
      event_id: event.id,
      invitee_user_id: profile.id,
      rsvp_status: 'pending',
      rsvp_token_hash: rsvpTokenHash,
      rsvp_token_expires_at: expiresAt.toISOString(),
      delivery_status: 'unsent',
    })

  if (!insertError) {
    return preparedInvitationState(canonicalArtistName, event.title)
  }

  if ((insertError as { code?: string } | null)?.code !== '23505') {
    console.error('artistalks_invitation_create_failed')
    return { status: 'error', message: 'Unable to create invitation.' }
  }

  const { data: duplicateData, error: duplicateError } =
    await authorization.admin
      .from('artistalks_event_invitations')
      .select('rsvp_status, delivery_status')
      .eq('event_id', event.id)
      .eq('invitee_user_id', profile.id)
      .maybeSingle()

  if (duplicateError || !duplicateData) {
    console.error('artistalks_invitation_create_failed')
    return { status: 'error', message: 'Unable to create invitation.' }
  }

  const duplicate = duplicateData as ExistingInvitationRow
  return duplicate.rsvp_status === 'pending' &&
    duplicate.delivery_status === 'unsent'
    ? preparedInvitationState(canonicalArtistName, event.title)
    : { status: 'error', message: 'An invitation already exists.' }
}

export default async function EventDetailPage({
  params,
}: EventDetailPageProps) {
  const authorization = await requireJaiAdmin()

  if (!authorization.ok) {
    notFound()
  }

  const { eventId } = await params
  if (!UUID_V4_PATTERN.test(eventId)) {
    notFound()
  }

  const { data, error } = await authorization.admin
    .from('artistalks_events')
    .select(EVENT_SELECT)
    .eq('id', eventId)
    .eq('created_by', authorization.userId)
    .maybeSingle()

  if (error) {
    console.error('artistalks_event_read_failed')
    throw new Error('Unable to load event.')
  }

  if (!data) {
    notFound()
  }

  const event = data as EventRow
  if (!isEventStatus(event.status)) {
    console.error('artistalks_event_read_failed')
    throw new Error('Unable to load event.')
  }

  let displayTime: ReturnType<typeof formatEventDateTime>
  try {
    displayTime = formatEventDateTime(event)
  } catch {
    console.error('artistalks_event_read_failed')
    throw new Error('Unable to load event.')
  }

  const eventDateTime = `${displayTime.date}, ${displayTime.time} (${event.timezone})`
  const checkArtistForEvent = checkArtistForInvitation.bind(null, eventId)
  const createInvitationForEvent = createInvitation.bind(null, eventId)

  return (
    <main
      className="min-h-screen bg-[#051340] px-4 text-[#f5f1cf] [min-height:100dvh] sm:px-6"
      style={{
        paddingTop: 'max(1.5rem, env(safe-area-inset-top))',
        paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))',
      }}
    >
      <article className="mx-auto w-full max-w-xl">
        <header className="mb-6">
          <p className="font-mono text-sm font-semibold uppercase tracking-[0.18em] text-[#d8ad2a]">
            ArtisTalks event
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#f5f1cf] sm:text-4xl">
            {event.title}
          </h1>
          <p className="mt-3 inline-flex rounded-full border border-[#d8ad2a] bg-[#091b54] px-3 py-1 text-sm font-semibold text-[#f5f1cf]">
            Status: {STATUS_LABELS[event.status]}
          </p>
        </header>

        <section className="rounded-2xl border border-[#d8ad2a] bg-[#091b54] p-5 shadow-[0_16px_50px_rgba(0,0,0,0.3)] sm:p-7">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[#d8ad2a]">
              Description
            </h2>
            <p className="mt-2 whitespace-pre-wrap text-base leading-7 text-[#f5f1cf]">
              {event.description || 'No description added.'}
            </p>
          </div>

          <dl className="mt-6 space-y-5 text-base leading-6">
            <div>
              <dt className="font-semibold text-[#d8ad2a]">Date</dt>
              <dd className="mt-1 text-[#f5f1cf]">{displayTime.date}</dd>
            </div>
            <div>
              <dt className="font-semibold text-[#d8ad2a]">Time</dt>
              <dd className="mt-1 text-[#f5f1cf]">{displayTime.time}</dd>
            </div>
            <div>
              <dt className="font-semibold text-[#d8ad2a]">Timezone</dt>
              <dd className="mt-1 break-words text-[#f5f1cf]">
                {event.timezone}
              </dd>
            </div>
            {event.location ? (
              <div>
                <dt className="font-semibold text-[#d8ad2a]">Location</dt>
                <dd className="mt-1 whitespace-pre-wrap text-[#f5f1cf]">
                  {event.location}
                </dd>
              </div>
            ) : null}
            {event.meeting_url ? (
              <div>
                <dt className="font-semibold text-[#d8ad2a]">Meeting URL</dt>
                <dd className="mt-1 break-all">
                  <a
                    className="text-[#7ee2a8] underline decoration-2 underline-offset-4 hover:text-white focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#d8ad2a]"
                    href={event.meeting_url}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {event.meeting_url}
                  </a>
                </dd>
              </div>
            ) : null}
          </dl>

          <div className="mt-7 border-t border-[#d8ad2a]/45 pt-6">
            <PrepareInvitation
              checkAction={checkArtistForEvent}
              createAction={createInvitationForEvent}
              eventDateTime={eventDateTime}
              eventTitle={event.title}
            />
          </div>
        </section>
      </article>
    </main>
  )
}
