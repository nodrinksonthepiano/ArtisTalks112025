import { randomUUID, timingSafeEqual } from 'crypto'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { normalizeArtistNameSlug } from '@/lib/artistName'
import {
  assertArtistTalksInvitationEmailConfigured,
  buildArtistTalksGoogleCalendarUrl,
  buildArtistTalksRsvpUrl,
  sendArtistTalksInvitation,
} from '@/lib/artistalksInvitationEmail'
import {
  deriveArtistTalksRsvpToken,
  deriveArtistTalksRsvpTokenHash,
  hashArtistTalksRsvpToken,
} from '@/lib/artistalksRsvpToken'
import { checkAuthRateLimit } from '@/lib/rateLimit'
import { requireJaiAdmin } from '@/utils/supabase/requireJaiAdmin'
import PrepareInvitation, {
  type ArtistLookupState,
  type InvitationPreparationState,
  type InvitationSendState,
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
  send_idempotency_key: string | null
  last_delivery_error_code: string | null
}

type SendInvitationEventRow = EventRow & {
  id: string
}

type SendInvitationRow = ExistingInvitationRow & {
  id: string
  rsvp_token_hash: string
  rsvp_token_expires_at: string
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
const SEND_IDEMPOTENCY_PREFIX = 'artistalks-send-v1'
const SEND_IDEMPOTENCY_SAFE_WINDOW_MS = 23 * 60 * 60 * 1000
const SEND_IDEMPOTENCY_PATTERN =
  /^artistalks-send-v1:(\d{13}):[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const RSVP_TOKEN_HASH_PATTERN = /^[0-9a-f]{64}$/
const DELIVERY_REJECTED_CODE = 'provider_rejected'
const DELIVERY_UNCERTAIN_CODE = 'delivery_uncertain'

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
  eventTitle: string,
  deliveryStatus: 'Not sent' | 'Send failed' | 'Needs verification' =
    'Not sent'
): InvitationPreparationState {
  return {
    status: 'prepared',
    artistName,
    eventTitle,
    rsvpStatus: 'Pending',
    deliveryStatus,
  }
}

function sentInvitationPreparationState(
  artistName: string,
  eventTitle: string
): InvitationPreparationState {
  return {
    status: 'sent',
    artistName,
    eventTitle,
    deliveryStatus: 'Sent',
  }
}

function existingInvitationPreparationState(
  invitation: ExistingInvitationRow,
  artistName: string,
  eventTitle: string
): InvitationPreparationState {
  if (invitation.delivery_status === 'sent') {
    return sentInvitationPreparationState(artistName, eventTitle)
  }

  if (invitation.rsvp_status !== 'pending') {
    return { status: 'error', message: 'An invitation already exists.' }
  }

  if (invitation.delivery_status === 'unsent') {
    return preparedInvitationState(
      artistName,
      eventTitle,
      invitation.send_idempotency_key ? 'Needs verification' : 'Not sent'
    )
  }

  if (invitation.delivery_status === 'failed') {
    return preparedInvitationState(
      artistName,
      eventTitle,
      invitation.last_delivery_error_code === DELIVERY_REJECTED_CODE
        ? 'Send failed'
        : 'Needs verification'
    )
  }

  return { status: 'error', message: 'An invitation already exists.' }
}

function sendFailureState(): InvitationSendState {
  return {
    status: 'error',
    message: 'Invitation could not be sent. Try again.',
  }
}

function deliveryVerificationState(): InvitationSendState {
  return {
    status: 'verification',
    message: 'Delivery status needs verification.',
  }
}

function sentInvitationState(
  artistName: string,
  eventTitle: string
): InvitationSendState {
  return {
    status: 'sent',
    artistName,
    eventTitle,
    recipientCount: 1,
    deliveryStatus: 'Sent',
  }
}

function isValidHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
}

function createSendIdempotencyKey(): string {
  return `${SEND_IDEMPOTENCY_PREFIX}:${Date.now()}:${randomUUID()}`
}

function sendIdempotencyIsUsable(value: string): boolean {
  const match = value.match(SEND_IDEMPOTENCY_PATTERN)
  if (!match) return false

  const claimedAt = Number(match[1])
  const age = Date.now() - claimedAt
  return age >= 0 && age < SEND_IDEMPOTENCY_SAFE_WINDOW_MS
}

function tokenHashMatches(derivedHash: string, storedHash: string): boolean {
  if (
    !RSVP_TOKEN_HASH_PATTERN.test(derivedHash) ||
    !RSVP_TOKEN_HASH_PATTERN.test(storedHash)
  ) {
    return false
  }

  return timingSafeEqual(
    Buffer.from(derivedHash, 'hex'),
    Buffer.from(storedHash, 'hex')
  )
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
      .select(
        'rsvp_status, delivery_status, send_idempotency_key, last_delivery_error_code'
      )
      .eq('event_id', event.id)
      .eq('invitee_user_id', profile.id)
      .maybeSingle()

  if (existingError) {
    console.error('artistalks_invitation_create_failed')
    return { status: 'error', message: 'Unable to create invitation.' }
  }

  if (existingData) {
    const existing = existingData as ExistingInvitationRow
    return existingInvitationPreparationState(
      existing,
      canonicalArtistName,
      event.title
    )
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
      .select(
        'rsvp_status, delivery_status, send_idempotency_key, last_delivery_error_code'
      )
      .eq('event_id', event.id)
      .eq('invitee_user_id', profile.id)
      .maybeSingle()

  if (duplicateError || !duplicateData) {
    console.error('artistalks_invitation_create_failed')
    return { status: 'error', message: 'Unable to create invitation.' }
  }

  const duplicate = duplicateData as ExistingInvitationRow
  return existingInvitationPreparationState(
    duplicate,
    canonicalArtistName,
    event.title
  )
}

async function sendInvitation(
  eventId: string,
  _previousState: InvitationSendState,
  formData: FormData
): Promise<InvitationSendState> {
  'use server'

  const authorization = await requireJaiAdmin()
  if (!authorization.ok || !UUID_V4_PATTERN.test(eventId)) {
    return sendFailureState()
  }

  const { data: eventData, error: eventError } = await authorization.admin
    .from('artistalks_events')
    .select(
      'id, title, description, starts_at, ends_at, timezone, location, meeting_url, status'
    )
    .eq('id', eventId)
    .eq('created_by', authorization.userId)
    .maybeSingle()

  if (eventError || !eventData) {
    if (eventError) console.error('artistalks_invitation_send_failed')
    return sendFailureState()
  }

  const event = eventData as SendInvitationEventRow
  if (event.status !== 'draft' && event.status !== 'scheduled') {
    return sendFailureState()
  }

  const meetingUrl = event.meeting_url?.trim() ?? ''
  if (!meetingUrl || !isValidHttpsUrl(meetingUrl)) {
    return {
      status: 'error',
      message: 'Add a meeting link before sending.',
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
    return sendFailureState()
  }

  try {
    const lookupAllowed = await checkAuthRateLimit(
      authorization.admin,
      INVITATION_LOOKUP_BUCKET,
      INVITATION_LOOKUP_LIMIT,
      INVITATION_LOOKUP_WINDOW_SECONDS
    )
    if (!lookupAllowed) return sendFailureState()
  } catch {
    console.error('artistalks_invitation_send_rate_limit_failed')
    return sendFailureState()
  }

  const { data: profileData, error: profileError } = await authorization.admin
    .from('profiles')
    .select('id, artist_name, saas_subscription_status')
    .eq('artist_name_slug', artistNameSlug)
    .maybeSingle()

  if (profileError || !profileData) {
    if (profileError) console.error('artistalks_invitation_send_failed')
    return sendFailureState()
  }

  const profile = profileData as ArtistLookupRow
  const canonicalArtistName = profile.artist_name?.trim()
  const eligible =
    profile.saas_subscription_status === 'active' ||
    profile.saas_subscription_status === 'comped'
  if (
    !profile.id ||
    !canonicalArtistName ||
    EMAIL_SHAPED_PATTERN.test(canonicalArtistName) ||
    !eligible
  ) {
    return sendFailureState()
  }

  const { data: authData, error: authLookupError } =
    await authorization.admin.auth.admin.getUserById(profile.id)
  const recipientEmail = authData?.user?.email
  if (authLookupError || !recipientEmail) {
    if (authLookupError) console.error('artistalks_invitation_send_failed')
    return sendFailureState()
  }

  const { data: invitationData, error: invitationError } =
    await authorization.admin
      .from('artistalks_event_invitations')
      .select(
        'id, event_id, invitee_user_id, rsvp_status, rsvp_token_hash, rsvp_token_expires_at, delivery_status, send_idempotency_key, last_delivery_error_code'
      )
      .eq('event_id', event.id)
      .eq('invitee_user_id', profile.id)
      .maybeSingle()

  if (invitationError || !invitationData) {
    if (invitationError) console.error('artistalks_invitation_send_failed')
    return sendFailureState()
  }

  let invitation = invitationData as SendInvitationRow
  if (invitation.delivery_status === 'sent') {
    return sentInvitationState(canonicalArtistName, event.title)
  }

  const tokenExpiresAt = new Date(invitation.rsvp_token_expires_at)
  if (
    invitation.rsvp_status !== 'pending' ||
    (invitation.delivery_status !== 'unsent' &&
      invitation.delivery_status !== 'failed') ||
    Number.isNaN(tokenExpiresAt.getTime()) ||
    tokenExpiresAt <= new Date()
  ) {
    return sendFailureState()
  }

  let rawRsvpToken: string
  try {
    rawRsvpToken = deriveArtistTalksRsvpToken(
      invitation.id,
      invitation.rsvp_token_expires_at
    )
  } catch {
    console.error('artistalks_invitation_send_failed')
    return sendFailureState()
  }

  const derivedTokenHash = hashArtistTalksRsvpToken(rawRsvpToken)
  if (!tokenHashMatches(derivedTokenHash, invitation.rsvp_token_hash)) {
    console.error('artistalks_invitation_send_failed')
    return sendFailureState()
  }

  let displayTime: ReturnType<typeof formatEventDateTime>
  try {
    displayTime = formatEventDateTime(event)
  } catch {
    return sendFailureState()
  }

  const rsvpUrl = buildArtistTalksRsvpUrl(rawRsvpToken)
  const googleCalendarUrl = buildArtistTalksGoogleCalendarUrl({
    title: event.title,
    description: event.description,
    startsAt: event.starts_at,
    endsAt: event.ends_at,
    timezone: event.timezone,
    location: event.location,
    meetingUrl,
  })
  if (!rsvpUrl || !googleCalendarUrl) return sendFailureState()

  try {
    assertArtistTalksInvitationEmailConfigured()
  } catch {
    console.error('artistalks_invitation_send_configuration_failed')
    return sendFailureState()
  }

  let sendIdempotencyKey = invitation.send_idempotency_key
  let claimedNow = false

  if (!sendIdempotencyKey) {
    const candidateKey = createSendIdempotencyKey()
    const { data: claimedData, error: claimError } = await authorization.admin
      .from('artistalks_event_invitations')
      .update({ send_idempotency_key: candidateKey })
      .eq('id', invitation.id)
      .eq('event_id', event.id)
      .eq('invitee_user_id', profile.id)
      .eq('rsvp_status', 'pending')
      .eq('delivery_status', 'unsent')
      .is('send_idempotency_key', null)
      .select(
        'id, event_id, invitee_user_id, rsvp_status, rsvp_token_hash, rsvp_token_expires_at, delivery_status, send_idempotency_key, last_delivery_error_code'
      )
      .maybeSingle()

    if (claimError) {
      console.error('artistalks_invitation_send_claim_failed')
      return sendFailureState()
    }

    if (claimedData) {
      invitation = claimedData as SendInvitationRow
      sendIdempotencyKey = candidateKey
      claimedNow = true
    } else {
      const { data: currentData, error: currentError } =
        await authorization.admin
          .from('artistalks_event_invitations')
          .select(
            'id, event_id, invitee_user_id, rsvp_status, rsvp_token_hash, rsvp_token_expires_at, delivery_status, send_idempotency_key, last_delivery_error_code'
          )
          .eq('id', invitation.id)
          .maybeSingle()

      if (currentError || !currentData) {
        if (currentError) console.error('artistalks_invitation_send_claim_failed')
        return sendFailureState()
      }

      invitation = currentData as SendInvitationRow
      if (invitation.delivery_status === 'sent') {
        return sentInvitationState(canonicalArtistName, event.title)
      }
      sendIdempotencyKey = invitation.send_idempotency_key
    }
  }

  if (!sendIdempotencyKey || !sendIdempotencyIsUsable(sendIdempotencyKey)) {
    return deliveryVerificationState()
  }

  if (
    !claimedNow &&
    (invitation.delivery_status !== 'failed' ||
      invitation.last_delivery_error_code !== DELIVERY_REJECTED_CODE)
  ) {
    return deliveryVerificationState()
  }

  const sendResult = await sendArtistTalksInvitation({
    recipientEmail,
    idempotencyKey: sendIdempotencyKey,
    artistName: canonicalArtistName,
    eventTitle: event.title,
    eventDescription: event.description,
    eventDate: displayTime.date,
    eventTime: displayTime.time,
    eventTimezone: event.timezone,
    eventLocation: event.location?.trim() ?? '',
    meetingUrl,
    rsvpUrl,
    googleCalendarUrl,
  })

  if (sendResult.status === 'accepted') {
    const { data: sentData, error: sentError } = await authorization.admin
      .from('artistalks_event_invitations')
      .update({
        delivery_status: 'sent',
        provider_message_id: sendResult.providerMessageId,
        last_delivery_error_code: null,
      })
      .eq('id', invitation.id)
      .eq('send_idempotency_key', sendIdempotencyKey)
      .in('delivery_status', ['unsent', 'failed'])
      .select('delivery_status')
      .maybeSingle()

    if (!sentError && sentData?.delivery_status === 'sent') {
      return sentInvitationState(canonicalArtistName, event.title)
    }

    const { data: currentData } = await authorization.admin
      .from('artistalks_event_invitations')
      .select('delivery_status')
      .eq('id', invitation.id)
      .maybeSingle()
    if (currentData?.delivery_status === 'sent') {
      return sentInvitationState(canonicalArtistName, event.title)
    }

    await authorization.admin
      .from('artistalks_event_invitations')
      .update({
        delivery_status: 'failed',
        last_delivery_error_code: DELIVERY_UNCERTAIN_CODE,
      })
      .eq('id', invitation.id)
      .eq('send_idempotency_key', sendIdempotencyKey)
      .neq('delivery_status', 'sent')
    console.error('artistalks_invitation_send_finalize_failed')
    return deliveryVerificationState()
  }

  const failureCode =
    sendResult.status === 'rejected'
      ? DELIVERY_REJECTED_CODE
      : DELIVERY_UNCERTAIN_CODE
  const { error: failureUpdateError } = await authorization.admin
    .from('artistalks_event_invitations')
    .update({
      delivery_status: 'failed',
      last_delivery_error_code: failureCode,
    })
    .eq('id', invitation.id)
    .eq('send_idempotency_key', sendIdempotencyKey)
    .neq('delivery_status', 'sent')

  if (failureUpdateError) {
    console.error('artistalks_invitation_send_failure_state_failed')
  }

  return sendResult.status === 'rejected'
    ? sendFailureState()
    : deliveryVerificationState()
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
  const sendInvitationForEvent = sendInvitation.bind(null, eventId)

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
              eventMeetingUrl={event.meeting_url}
              eventTitle={event.title}
              sendAction={sendInvitationForEvent}
            />
          </div>
        </section>
      </article>
    </main>
  )
}
