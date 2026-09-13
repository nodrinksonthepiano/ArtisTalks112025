import { randomUUID, timingSafeEqual } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  artistSelectionHandleMatches,
  deriveArtistSelectionHandle,
  deriveGroupSelectionHandle,
  deriveRecipientSetDigest,
  deriveSendReviewDigest,
  groupSelectionHandleMatches,
  recipientSetDigestMatches,
  sendReviewDigestMatches,
  type InvitationSendReviewRecipient,
} from '@/lib/artistalksInvitationSelection'
import {
  assertArtistTalksInvitationEmailConfigured,
  buildArtistTalksGoogleCalendarUrl,
  buildArtistTalksRsvpUrl,
  sendArtistTalksInvitation,
  type SendArtistTalksInvitationResult,
} from '@/lib/artistalksInvitationEmail'
import {
  deriveArtistTalksRsvpToken,
  deriveArtistTalksRsvpTokenHash,
} from '@/lib/artistalksRsvpToken'
import { requireJaiAdmin } from '@/utils/supabase/requireJaiAdmin'
import PrepareInvitation, {
  type ArtistSelectionOption,
  type CreateGroupState,
  type GroupSelectionOption,
  type InvitationPreparationState,
  type InvitationSendState,
  type RecipientPreviewState,
} from './PrepareInvitation'

type EventDetailPageProps = { params: Promise<{ eventId: string }> }
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
type EligibleArtistRow = { id: string; artist_name: string | null }
type EligibleArtist = { userId: string; name: string }
type InvitationGroupRow = { id: string; name: string }
type InvitationGroup = { groupId: string; name: string }
type GroupMemberRow = { member_user_id: string }
type ExistingInvitationRow = {
  invitee_user_id: string
  rsvp_status: string
  delivery_status: string
  send_idempotency_key: string | null
  last_delivery_error_code: string | null
}
type PreparedInvitationRow = ExistingInvitationRow & {
  id: string
  rsvp_token_hash: string
  rsvp_token_expires_at: string
  updated_at: string
}
type RecipientSelection = {
  kind: 'artist' | 'group' | 'all_eligible'
  selectorId: string | null
  recipients: EligibleArtist[]
}
type RecipientSelectionResult =
  | { ok: true; selection: RecipientSelection }
  | { ok: false; message: string }
type PreparationRpcRow = {
  result_status: string
  inserted_count: number
}
type PreparedRecipientState = 'Ready' | 'Sent' | 'Needs verification'
type InvitationSendMode = 'ready' | 'retry_failed'
type InvitationReview = {
  invitations: Map<string, PreparedInvitationRow>
  recipientEmails: Map<string, string | null>
  safeRecipients: Array<{ name: string; state: PreparedRecipientState }>
  reviewRecipients: InvitationSendReviewRecipient[]
  readyToSendCount: number
  alreadySentCount: number
  retryableFailedCount: number
  needsVerificationCount: number
}
type InvitationDeliveryPlan = {
  recipient: EligibleArtist
  invitation: PreparedInvitationRow
  recipientEmail: string
  rsvpUrl: string
}
type ClaimedInvitation = {
  idempotencyKey: string
  deliveryStatus: 'unsent' | 'failed'
}
type InvitationDeliveryOutcome = {
  name: string
  state: 'Sent' | 'Failed' | 'Needs verification'
}
type InvitationSender = typeof sendArtistTalksInvitation
type InvitationDeliveryDependencies = {
  claim: (
    plan: InvitationDeliveryPlan,
    mode: InvitationSendMode
  ) => Promise<ClaimedInvitation | null>
  persist: (
    plan: InvitationDeliveryPlan,
    claim: ClaimedInvitation,
    result: SendArtistTalksInvitationResult
  ) => Promise<InvitationDeliveryOutcome['state']>
  send: InvitationSender
}
type DeliveryLabel = 'Not sent' | 'Sent' | 'Needs verification' | 'Mixed'

const EVENT_SELECT =
  'title, description, starts_at, ends_at, timezone, location, meeting_url, status'
const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const EMAIL_ADDRESS_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PAGE_SIZE = 200
const INVITATION_QUERY_CHUNK_SIZE = 100
const AUTH_LOOKUP_CHUNK_SIZE = 20
const GROUP_NAME_MAX_LENGTH = 100
const MAX_GROUP_MEMBERS = 500
const DELIVERY_REJECTED_CODE = 'provider_rejected'
const DELIVERY_UNCERTAIN_CODE = 'delivery_uncertain'
const RSVP_EXPIRY_BUFFER_MS = 7 * 24 * 60 * 60 * 1000
const PRIVATE_BETA_SEND_LIMIT = 5
const STATUS_LABELS: Record<EventStatus, string> = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  canceled: 'Canceled',
}

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Event | ArtisTalks',
  robots: { index: false, follow: false },
}

function isEventStatus(status: string): status is EventStatus {
  return status === 'draft' || status === 'scheduled' || status === 'canceled'
}

function invitationsMayBePrepared(status: string): boolean {
  return status === 'draft' || status === 'scheduled'
}

function formatEventDateTime(event: EventRow) {
  const startsAt = new Date(event.starts_at)
  const endsAt = new Date(event.ends_at)
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    throw new Error('Unable to display event time.')
  }

  const dates = new Intl.DateTimeFormat('en-US', {
    dateStyle: 'full',
    timeZone: event.timezone,
  })
  const times = new Intl.DateTimeFormat('en-US', {
    timeStyle: 'short',
    timeZone: event.timezone,
  })
  const startDate = dates.format(startsAt)
  const endDate = dates.format(endsAt)
  return {
    date: startDate === endDate ? startDate : startDate + '–' + endDate,
    time: times.format(startsAt) + '–' + times.format(endsAt),
  }
}

async function loadEligibleArtists(admin: SupabaseClient) {
  const artists: EligibleArtist[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await admin
      .from('profiles')
      .select('id, artist_name')
      .in('saas_subscription_status', ['active', 'comped'])
      .order('artist_name', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw new Error('Unable to load eligible artists.')

    const rows = (data ?? []) as EligibleArtistRow[]
    for (const row of rows) {
      const name = row.artist_name?.trim()
      if (UUID_V4_PATTERN.test(row.id) && name && !name.includes('@')) {
        artists.push({ userId: row.id, name })
      }
    }
    if (rows.length < PAGE_SIZE) break
  }
  return artists.sort(
    (a, b) =>
      a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }) ||
      a.userId.localeCompare(b.userId)
  )
}

async function loadOwnedGroups(admin: SupabaseClient, userId: string) {
  const groups: InvitationGroup[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await admin
      .from('artistalks_invitation_groups')
      .select('id, name')
      .eq('created_by', userId)
      .order('name', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw new Error('Unable to load invitation groups.')

    const rows = (data ?? []) as InvitationGroupRow[]
    for (const row of rows) {
      const name = row.name.trim()
      if (UUID_V4_PATTERN.test(row.id) && name) groups.push({ groupId: row.id, name })
    }
    if (rows.length < PAGE_SIZE) break
  }
  return groups
}

async function loadGroupMemberIds(admin: SupabaseClient, groupId: string) {
  const memberIds: string[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await admin
      .from('artistalks_invitation_group_members')
      .select('member_user_id')
      .eq('group_id', groupId)
      .order('member_user_id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw new Error('Unable to load invitation group.')

    const rows = (data ?? []) as GroupMemberRow[]
    for (const row of rows) {
      if (UUID_V4_PATTERN.test(row.member_user_id)) memberIds.push(row.member_user_id)
    }
    if (rows.length < PAGE_SIZE) break
  }
  return memberIds
}

async function loadOwnedEvent(
  admin: SupabaseClient,
  eventId: string,
  userId: string
): Promise<EventRow | null> {
  const { data, error } = await admin
    .from('artistalks_events')
    .select(EVENT_SELECT)
    .eq('id', eventId)
    .eq('created_by', userId)
    .maybeSingle()
  if (error) throw new Error('Unable to load event.')
  return data ? (data as EventRow) : null
}

function resolveArtistHandle(handle: string, artists: readonly EligibleArtist[]) {
  let resolved: EligibleArtist | null = null
  for (const artist of artists) {
    if (artistSelectionHandleMatches(handle, artist.userId)) resolved = artist
  }
  return resolved
}

function resolveGroupHandle(handle: string, groups: readonly InvitationGroup[]) {
  let resolved: InvitationGroup | null = null
  for (const group of groups) {
    if (groupSelectionHandleMatches(handle, group.groupId)) resolved = group
  }
  return resolved
}

function sortedUniqueRecipients(recipients: readonly EligibleArtist[]) {
  return [...new Map(recipients.map((artist) => [artist.userId, artist])).values()].sort(
    (a, b) =>
      a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }) ||
      a.userId.localeCompare(b.userId)
  )
}

async function resolveRecipientSelection(
  admin: SupabaseClient,
  userId: string,
  kind: string,
  handle: string,
  artists: readonly EligibleArtist[]
): Promise<RecipientSelectionResult> {
  if (kind === 'artist') {
    const artist = resolveArtistHandle(handle, artists)
    if (!artist) {
      return {
        ok: false,
        message: 'Artist eligibility changed. Refresh and try again.',
      }
    }
    return {
      ok: true,
      selection: {
        kind: 'artist',
        selectorId: artist.userId,
        recipients: [artist],
      },
    }
  }

  if (kind === 'group') {
    const groups = await loadOwnedGroups(admin, userId)
    const group = resolveGroupHandle(handle, groups)
    if (!group) {
      return {
        ok: false,
        message: 'Group not found. Refresh and try again.',
      }
    }

    const memberIds = await loadGroupMemberIds(admin, group.groupId)
    const eligibleById = new Map(artists.map((artist) => [artist.userId, artist]))
    return {
      ok: true,
      selection: {
        kind: 'group',
        selectorId: group.groupId,
        recipients: sortedUniqueRecipients(
          memberIds
            .map((memberId) => eligibleById.get(memberId))
            .filter((artist): artist is EligibleArtist => Boolean(artist))
        ),
      },
    }
  }

  if (kind === 'all_eligible') {
    return {
      ok: true,
      selection: {
        kind: 'all_eligible',
        selectorId: null,
        recipients: sortedUniqueRecipients(artists),
      },
    }
  }

  return { ok: false, message: 'Choose an artist or group.' }
}

function safeArtistOptions(artists: readonly EligibleArtist[]): ArtistSelectionOption[] {
  return artists.map((artist) => ({
    name: artist.name,
    handle: deriveArtistSelectionHandle(artist.userId),
  }))
}

function safeGroupOptions(groups: readonly InvitationGroup[]): GroupSelectionOption[] {
  return groups.map((group) => ({
    name: group.name,
    handle: deriveGroupSelectionHandle(group.groupId),
  }))
}

function deliveryForInvitation(row: ExistingInvitationRow): DeliveryLabel {
  if (row.delivery_status === 'sent') return 'Sent'
  if (row.rsvp_status !== 'pending') return 'Needs verification'
  if (row.delivery_status === 'unsent') {
    return row.send_idempotency_key ? 'Needs verification' : 'Not sent'
  }
  if (row.delivery_status === 'failed') {
    return row.last_delivery_error_code === DELIVERY_REJECTED_CODE
      ? 'Not sent'
      : 'Needs verification'
  }
  return 'Needs verification'
}

async function aggregateDelivery(
  admin: SupabaseClient,
  eventId: string,
  recipientIds: readonly string[]
): Promise<DeliveryLabel> {
  const byRecipient = new Map<string, DeliveryLabel>()
  for (let from = 0; from < recipientIds.length; from += INVITATION_QUERY_CHUNK_SIZE) {
    const { data, error } = await admin
      .from('artistalks_event_invitations')
      .select(
        'invitee_user_id, rsvp_status, delivery_status, send_idempotency_key, last_delivery_error_code'
      )
      .eq('event_id', eventId)
      .in('invitee_user_id', recipientIds.slice(from, from + INVITATION_QUERY_CHUNK_SIZE))
    if (error) throw new Error('Unable to preview invitations.')
    for (const row of (data ?? []) as ExistingInvitationRow[]) {
      byRecipient.set(row.invitee_user_id, deliveryForInvitation(row))
    }
  }

  const states = new Set(
    recipientIds.map((id) => byRecipient.get(id) ?? ('Not sent' as const))
  )
  return states.size === 1 ? [...states][0] : 'Mixed'
}

function invitationTokenExpiry(event: EventRow): string {
  const eventEndsAt = new Date(event.ends_at).getTime()
  if (Number.isNaN(eventEndsAt)) {
    throw new Error('Unable to prepare invitations.')
  }

  return new Date(
    Math.max(Date.now() + RSVP_EXPIRY_BUFFER_MS, eventEndsAt + RSVP_EXPIRY_BUFFER_MS)
  ).toISOString()
}

function tokenHashMatches(expected: string, supplied: string): boolean {
  if (!/^[0-9a-f]{64}$/.test(expected) || !/^[0-9a-f]{64}$/.test(supplied)) {
    return false
  }

  return timingSafeEqual(
    Buffer.from(expected, 'utf8'),
    Buffer.from(supplied, 'utf8')
  )
}

function hasValidInvitationCredential(row: PreparedInvitationRow): boolean {
  const expiresAt = new Date(row.rsvp_token_expires_at)
  if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
    return false
  }

  try {
    return tokenHashMatches(
      deriveArtistTalksRsvpTokenHash(row.id, expiresAt),
      row.rsvp_token_hash
    )
  } catch {
    return false
  }
}

function isRsvpStatus(
  value: string
): value is 'pending' | 'accepted' | 'maybe' | 'declined' {
  return (
    value === 'pending' ||
    value === 'accepted' ||
    value === 'maybe' ||
    value === 'declined'
  )
}

function isDeliveryStatus(
  value: string
): value is 'unsent' | 'sent' | 'failed' {
  return value === 'unsent' || value === 'sent' || value === 'failed'
}

function failureClassification(
  code: string | null
): InvitationSendReviewRecipient['failureClassification'] {
  if (code === null) return 'none'
  return code === DELIVERY_REJECTED_CODE ? 'provider_rejected' : 'uncertain'
}

function preparedRecipientState(
  row: PreparedInvitationRow,
  recipientEmail: string | null
): PreparedRecipientState {
  if (row.delivery_status === 'sent') return 'Sent'
  if (isReadyForInitialSend(row, recipientEmail)) return 'Ready'
  if (isRetryableFailed(row, recipientEmail)) return 'Ready'
  return 'Needs verification'
}

function isReadyForInitialSend(
  row: PreparedInvitationRow,
  recipientEmail: string | null
): boolean {
  return (
    row.rsvp_status === 'pending' &&
    row.delivery_status === 'unsent' &&
    row.send_idempotency_key === null &&
    row.last_delivery_error_code === null &&
    Boolean(recipientEmail) &&
    hasValidInvitationCredential(row)
  )
}

function isRetryableFailed(
  row: PreparedInvitationRow,
  recipientEmail: string | null
): boolean {
  return (
    row.rsvp_status === 'pending' &&
    row.delivery_status === 'failed' &&
    row.send_idempotency_key !== null &&
    row.last_delivery_error_code === DELIVERY_REJECTED_CODE &&
    Boolean(recipientEmail) &&
    hasValidInvitationCredential(row)
  )
}

async function loadPreparedInvitations(
  admin: SupabaseClient,
  eventId: string,
  recipientIds: readonly string[]
) {
  const invitations = new Map<string, PreparedInvitationRow>()
  for (let from = 0; from < recipientIds.length; from += INVITATION_QUERY_CHUNK_SIZE) {
    const { data, error } = await admin
      .from('artistalks_event_invitations')
      .select(
        'id, invitee_user_id, rsvp_status, rsvp_token_hash, rsvp_token_expires_at, delivery_status, send_idempotency_key, last_delivery_error_code, updated_at'
      )
      .eq('event_id', eventId)
      .in('invitee_user_id', recipientIds.slice(from, from + INVITATION_QUERY_CHUNK_SIZE))
    if (error) throw new Error('Unable to prepare invitations.')

    for (const row of (data ?? []) as PreparedInvitationRow[]) {
      invitations.set(row.invitee_user_id, row)
    }
  }
  return invitations
}

async function loadRecipientEmails(
  admin: SupabaseClient,
  recipientIds: readonly string[]
) {
  const emails = new Map<string, string | null>()
  for (let from = 0; from < recipientIds.length; from += AUTH_LOOKUP_CHUNK_SIZE) {
    const ids = recipientIds.slice(from, from + AUTH_LOOKUP_CHUNK_SIZE)
    const lookups = await Promise.all(
      ids.map(async (recipientId) => {
        const { data, error } = await admin.auth.admin.getUserById(recipientId)
        if (error) throw new Error('Unable to prepare invitations.')
        const email = data.user?.email?.trim().toLocaleLowerCase('en-US') ?? ''
        return {
          recipientId,
          email:
            email.length <= 320 && EMAIL_ADDRESS_PATTERN.test(email) ? email : null,
        }
      })
    )
    for (const lookup of lookups) emails.set(lookup.recipientId, lookup.email)
  }
  return emails
}

async function buildInvitationReview(
  admin: SupabaseClient,
  eventId: string,
  recipients: readonly EligibleArtist[]
): Promise<InvitationReview> {
  const recipientIds = recipients.map((recipient) => recipient.userId)
  const [invitations, recipientEmails] = await Promise.all([
    loadPreparedInvitations(admin, eventId, recipientIds),
    loadRecipientEmails(admin, recipientIds),
  ])
  if (invitations.size !== recipientIds.length) {
    throw new Error('Unable to review invitations.')
  }

  const safeRecipients: InvitationReview['safeRecipients'] = []
  const reviewRecipients: InvitationSendReviewRecipient[] = []
  let readyToSendCount = 0
  let alreadySentCount = 0
  let retryableFailedCount = 0
  let needsVerificationCount = 0

  for (const recipient of recipients) {
    const invitation = invitations.get(recipient.userId)
    if (!invitation || !UUID_V4_PATTERN.test(invitation.id)) {
      throw new Error('Unable to review invitations.')
    }

    const recipientEmail = recipientEmails.get(recipient.userId) ?? null
    const state = preparedRecipientState(invitation, recipientEmail)
    safeRecipients.push({ name: recipient.name, state })
    if (isReadyForInitialSend(invitation, recipientEmail)) readyToSendCount += 1
    else if (isRetryableFailed(invitation, recipientEmail)) {
      retryableFailedCount += 1
    } else if (state === 'Sent') alreadySentCount += 1
    else needsVerificationCount += 1

    reviewRecipients.push({
      recipientUserId: recipient.userId,
      invitationId: invitation.id,
      tokenExpiresAt: invitation.rsvp_token_expires_at,
      rsvpStatus: isRsvpStatus(invitation.rsvp_status)
        ? invitation.rsvp_status
        : 'unexpected',
      deliveryStatus: isDeliveryStatus(invitation.delivery_status)
        ? invitation.delivery_status
        : 'unexpected',
      sendKeyState: invitation.send_idempotency_key ? 'claimed' : 'unclaimed',
      failureClassification: failureClassification(
        invitation.last_delivery_error_code
      ),
      recipientEmail,
      reviewState: state,
    })
  }

  return {
    invitations,
    recipientEmails,
    safeRecipients,
    reviewRecipients,
    readyToSendCount,
    alreadySentCount,
    retryableFailedCount,
    needsVerificationCount,
  }
}

function validHttpsMeetingUrl(value: string | null): string | null {
  if (!value) return null

  try {
    const meetingUrl = new URL(value)
    return meetingUrl.protocol === 'https:' ? meetingUrl.toString() : null
  } catch {
    return null
  }
}

function buildDeliveryPlans(
  mode: InvitationSendMode,
  recipients: readonly EligibleArtist[],
  review: InvitationReview
): InvitationDeliveryPlan[] {
  const plans: InvitationDeliveryPlan[] = []
  for (const recipient of recipients) {
    const invitation = review.invitations.get(recipient.userId)
    const recipientEmail = review.recipientEmails.get(recipient.userId) ?? null
    if (!invitation || !recipientEmail) continue

    const actionable =
      mode === 'ready'
        ? isReadyForInitialSend(invitation, recipientEmail)
        : isRetryableFailed(invitation, recipientEmail)
    if (!actionable) continue

    const rawRsvpToken = deriveArtistTalksRsvpToken(
      invitation.id,
      invitation.rsvp_token_expires_at
    )
    if (
      !tokenHashMatches(
        deriveArtistTalksRsvpTokenHash(
          invitation.id,
          invitation.rsvp_token_expires_at
        ),
        invitation.rsvp_token_hash
      )
    ) {
      throw new Error('Invitation credential changed.')
    }

    const rsvpUrl = buildArtistTalksRsvpUrl(rawRsvpToken)
    if (!rsvpUrl) throw new Error('Invitation credential changed.')
    plans.push({ recipient, invitation, recipientEmail, rsvpUrl })
  }
  return plans
}

async function claimInvitationDelivery(
  admin: SupabaseClient,
  eventId: string,
  plan: InvitationDeliveryPlan,
  mode: InvitationSendMode
): Promise<ClaimedInvitation | null> {
  if (mode === 'ready') {
    const idempotencyKey = randomUUID()
    const { data, error } = await admin
      .from('artistalks_event_invitations')
      .update({ send_idempotency_key: idempotencyKey })
      .eq('id', plan.invitation.id)
      .eq('event_id', eventId)
      .eq('invitee_user_id', plan.recipient.userId)
      .eq('rsvp_status', 'pending')
      .eq('delivery_status', 'unsent')
      .is('send_idempotency_key', null)
      .is('last_delivery_error_code', null)
      .select('send_idempotency_key')
      .maybeSingle()
    if (error || data?.send_idempotency_key !== idempotencyKey) return null
    return { idempotencyKey, deliveryStatus: 'unsent' }
  }

  const idempotencyKey = plan.invitation.send_idempotency_key
  if (!idempotencyKey) return null
  const { data, error } = await admin
    .from('artistalks_event_invitations')
    .update({ last_delivery_error_code: DELIVERY_UNCERTAIN_CODE })
    .eq('id', plan.invitation.id)
    .eq('event_id', eventId)
    .eq('invitee_user_id', plan.recipient.userId)
    .eq('rsvp_status', 'pending')
    .eq('delivery_status', 'failed')
    .eq('send_idempotency_key', idempotencyKey)
    .eq('last_delivery_error_code', DELIVERY_REJECTED_CODE)
    .eq('updated_at', plan.invitation.updated_at)
    .select('send_idempotency_key')
    .maybeSingle()
  if (error || data?.send_idempotency_key !== idempotencyKey) return null
  return { idempotencyKey, deliveryStatus: 'failed' }
}

async function persistInvitationDelivery(
  admin: SupabaseClient,
  eventId: string,
  plan: InvitationDeliveryPlan,
  claim: ClaimedInvitation,
  result: SendArtistTalksInvitationResult
): Promise<InvitationDeliveryOutcome['state']> {
  const update =
    result.status === 'accepted'
      ? {
          delivery_status: 'sent',
          provider_message_id: result.providerMessageId,
          last_delivery_error_code: null,
        }
      : {
          delivery_status: 'failed',
          last_delivery_error_code:
            result.status === 'rejected'
              ? DELIVERY_REJECTED_CODE
              : DELIVERY_UNCERTAIN_CODE,
        }

  let request = admin
    .from('artistalks_event_invitations')
    .update(update)
    .eq('id', plan.invitation.id)
    .eq('event_id', eventId)
    .eq('invitee_user_id', plan.recipient.userId)
    .eq('rsvp_status', 'pending')
    .eq('delivery_status', claim.deliveryStatus)
    .eq('send_idempotency_key', claim.idempotencyKey)

  if (claim.deliveryStatus === 'failed') {
    request = request.eq(
      'last_delivery_error_code',
      DELIVERY_UNCERTAIN_CODE
    )
  }

  const { data, error } = await request.select('id').maybeSingle()
  if (error || !data) return 'Needs verification'
  if (result.status === 'accepted') return 'Sent'
  return result.status === 'rejected' ? 'Failed' : 'Needs verification'
}

async function deliverInvitationPlans(
  mode: InvitationSendMode,
  plans: readonly InvitationDeliveryPlan[],
  emailContext: {
    eventTitle: string
    eventDescription: string
    eventDate: string
    eventTime: string
    eventTimezone: string
    eventLocation: string
    meetingUrl: string
    googleCalendarUrl: string
  },
  dependencies: InvitationDeliveryDependencies
): Promise<InvitationDeliveryOutcome[]> {
  const outcomes: InvitationDeliveryOutcome[] = []
  for (const plan of plans) {
    let claim: ClaimedInvitation | null
    try {
      claim = await dependencies.claim(plan, mode)
    } catch {
      claim = null
    }
    if (!claim) {
      outcomes.push({ name: plan.recipient.name, state: 'Needs verification' })
      continue
    }

    let providerResult: SendArtistTalksInvitationResult
    try {
      providerResult = await dependencies.send({
        recipientEmail: plan.recipientEmail,
        idempotencyKey: claim.idempotencyKey,
        artistName: plan.recipient.name,
        ...emailContext,
        rsvpUrl: plan.rsvpUrl,
      })
    } catch {
      providerResult = { status: 'uncertain' }
    }

    let state: InvitationDeliveryOutcome['state'] = 'Needs verification'
    try {
      state = await dependencies.persist(plan, claim, providerResult)
    } catch {
      // A provider may have accepted the message. Never retry automatically.
    }
    outcomes.push({ name: plan.recipient.name, state })
  }
  return outcomes
}

async function createInvitationGroup(
  eventId: string,
  _previousState: CreateGroupState,
  formData: FormData
): Promise<CreateGroupState> {
  'use server'

  const authorization = await requireJaiAdmin()
  if (!authorization.ok || !UUID_V4_PATTERN.test(eventId)) {
    return { status: 'error', message: 'Unable to save group.' }
  }

  let event: EventRow | null
  try {
    event = await loadOwnedEvent(authorization.admin, eventId, authorization.userId)
  } catch {
    console.error('artistalks_invitation_group_create_failed')
    return { status: 'error', message: 'Unable to save group.' }
  }
  if (!event || !invitationsMayBePrepared(event.status)) {
    return { status: 'error', message: 'Unable to save group.' }
  }

  const rawName = formData.get('groupName')
  const name = typeof rawName === 'string' ? rawName.trim() : ''
  if (
    !name ||
    name.length > GROUP_NAME_MAX_LENGTH ||
    name.toLocaleLowerCase('en-US') === 'all eligible artists'
  ) {
    return { status: 'error', message: 'Enter a group name from 1 to 100 characters.' }
  }

  const handles = [
    ...new Set(
      formData
        .getAll('artistHandle')
        .filter((value): value is string => typeof value === 'string')
    ),
  ]
  if (handles.length === 0 || handles.length > MAX_GROUP_MEMBERS) {
    return { status: 'error', message: 'Select at least one eligible artist.' }
  }

  let artists: EligibleArtist[]
  try {
    artists = await loadEligibleArtists(authorization.admin)
  } catch {
    console.error('artistalks_invitation_group_create_failed')
    return { status: 'error', message: 'Unable to save group.' }
  }

  const resolvedArtists: EligibleArtist[] = []
  const resolvedIds = new Set<string>()
  for (const handle of handles) {
    const artist = resolveArtistHandle(handle, artists)
    if (!artist || resolvedIds.has(artist.userId)) {
      return {
        status: 'error',
        message: 'Artist eligibility changed. Refresh and try again.',
      }
    }
    resolvedIds.add(artist.userId)
    resolvedArtists.push(artist)
  }

  const { data, error } = await authorization.admin.rpc(
    'create_artistalks_invitation_group',
    {
      p_created_by: authorization.userId,
      p_name: name,
      p_member_user_ids: resolvedArtists.map((artist) => artist.userId),
    }
  )
  if (error || typeof data !== 'string' || !UUID_V4_PATTERN.test(data)) {
    if ((error as { code?: string } | null)?.code === '23505') {
      return { status: 'error', message: 'A group with that name already exists.' }
    }
    console.error('artistalks_invitation_group_create_failed')
    return { status: 'error', message: 'Unable to save group. Refresh and try again.' }
  }

  return {
    status: 'saved',
    group: { name, handle: deriveGroupSelectionHandle(data) },
    memberNames: resolvedArtists
      .map((artist) => artist.name)
      .sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' })),
  }
}

async function previewInvitationRecipients(
  eventId: string,
  _previousState: RecipientPreviewState,
  formData: FormData
): Promise<RecipientPreviewState> {
  'use server'

  const authorization = await requireJaiAdmin()
  if (!authorization.ok || !UUID_V4_PATTERN.test(eventId)) {
    return { status: 'error', message: 'Unable to preview invitations.' }
  }

  let event: EventRow | null
  let artists: EligibleArtist[]
  try {
    event = await loadOwnedEvent(authorization.admin, eventId, authorization.userId)
    artists = await loadEligibleArtists(authorization.admin)
  } catch {
    console.error('artistalks_invitation_recipient_preview_failed')
    return { status: 'error', message: 'Unable to preview invitations.' }
  }
  if (!event || !invitationsMayBePrepared(event.status)) {
    return { status: 'error', message: 'Invitations cannot be prepared for this event.' }
  }

  const kindValue = formData.get('selectionKind')
  const handleValue = formData.get('selectionHandle')
  const kind = typeof kindValue === 'string' ? kindValue : ''
  const handle = typeof handleValue === 'string' ? handleValue : ''
  let resolution: RecipientSelectionResult
  try {
    resolution = await resolveRecipientSelection(
      authorization.admin,
      authorization.userId,
      kind,
      handle,
      artists
    )
  } catch {
    console.error('artistalks_invitation_recipient_preview_failed')
    return { status: 'error', message: 'Unable to preview invitations.' }
  }
  if (!resolution.ok) return { status: 'error', message: resolution.message }

  const recipients = resolution.selection.recipients
  if (recipients.length === 0) {
    return { status: 'error', message: 'No currently eligible artists are in this selection.' }
  }

  try {
    const time = formatEventDateTime(event)
    const recipientIds = recipients.map((recipient) => recipient.userId)
    return {
      status: 'preview',
      recipientNames: recipients.map((recipient) => recipient.name),
      recipientCount: recipients.length,
      eventTitle: event.title,
      eventDateTime: time.date + ', ' + time.time + ' (' + event.timezone + ')',
      delivery: await aggregateDelivery(authorization.admin, eventId, recipientIds),
      recipientSetDigest: deriveRecipientSetDigest(eventId, recipientIds),
    }
  } catch {
    console.error('artistalks_invitation_recipient_preview_failed')
    return { status: 'error', message: 'Unable to preview invitations.' }
  }
}

async function prepareInvitationRecipients(
  eventId: string,
  _previousState: InvitationPreparationState,
  formData: FormData
): Promise<InvitationPreparationState> {
  'use server'

  const authorization = await requireJaiAdmin()
  if (!authorization.ok || !UUID_V4_PATTERN.test(eventId)) {
    return { status: 'error', message: 'Unable to prepare invitations.' }
  }

  let event: EventRow | null
  let artists: EligibleArtist[]
  try {
    event = await loadOwnedEvent(authorization.admin, eventId, authorization.userId)
    artists = await loadEligibleArtists(authorization.admin)
  } catch {
    console.error('artistalks_bulk_invitation_preparation_failed')
    return { status: 'error', message: 'Unable to prepare invitations.' }
  }
  if (!event || !invitationsMayBePrepared(event.status)) {
    return { status: 'error', message: 'Invitations cannot be prepared for this event.' }
  }

  const kindValue = formData.get('selectionKind')
  const handleValue = formData.get('selectionHandle')
  const digestValue = formData.get('recipientSetDigest')
  const kind = typeof kindValue === 'string' ? kindValue : ''
  const handle = typeof handleValue === 'string' ? handleValue : ''
  const previewDigest = typeof digestValue === 'string' ? digestValue : ''

  let resolution: RecipientSelectionResult
  try {
    resolution = await resolveRecipientSelection(
      authorization.admin,
      authorization.userId,
      kind,
      handle,
      artists
    )
  } catch {
    console.error('artistalks_bulk_invitation_preparation_failed')
    return { status: 'error', message: 'Unable to prepare invitations.' }
  }
  if (!resolution.ok) {
    return {
      status: 'error',
      message: 'Recipient list changed. Review the updated preview before continuing.',
    }
  }

  const recipients = resolution.selection.recipients
  const recipientIds = recipients.map((recipient) => recipient.userId)
  if (
    recipientIds.length === 0 ||
    !recipientSetDigestMatches(previewDigest, eventId, recipientIds)
  ) {
    return {
      status: 'error',
      message: 'Recipient list changed. Review the updated preview before continuing.',
    }
  }

  try {
    const tokenExpiresAt = invitationTokenExpiry(event)
    const candidates = recipientIds.map((recipientId) => {
      const invitationId = randomUUID()
      return {
        invitation_id: invitationId,
        invitee_user_id: recipientId,
        rsvp_token_hash: deriveArtistTalksRsvpTokenHash(
          invitationId,
          tokenExpiresAt
        ),
      }
    })

    const { data, error } = await authorization.admin.rpc(
      'prepare_artistalks_event_invitations',
      {
        p_created_by: authorization.userId,
        p_event_id: eventId,
        p_selector_kind: resolution.selection.kind,
        p_selector_id: resolution.selection.selectorId,
        p_expected_recipient_user_ids: recipientIds,
        p_rsvp_token_expires_at: tokenExpiresAt,
        p_invitation_candidates: candidates,
      }
    )
    if (error) throw new Error('Unable to prepare invitations.')

    const rpcRows = Array.isArray(data) ? data : [data]
    const rpcResult = rpcRows[0] as PreparationRpcRow | null
    if (rpcResult?.result_status === 'recipient_set_changed') {
      return {
        status: 'error',
        message: 'Recipient list changed. Review the updated preview before continuing.',
      }
    }
    if (
      rpcResult?.result_status !== 'prepared' ||
      !Number.isInteger(rpcResult.inserted_count) ||
      rpcResult.inserted_count < 0
    ) {
      throw new Error('Unable to prepare invitations.')
    }

    const review = await buildInvitationReview(
      authorization.admin,
      eventId,
      recipients
    )
    const time = formatEventDateTime(event)

    return {
      status: 'prepared',
      recipients: review.safeRecipients,
      recipientCount: review.safeRecipients.length,
      readyCount: review.readyToSendCount,
      alreadySentCount: review.alreadySentCount,
      retryableFailedCount: review.retryableFailedCount,
      needsVerificationCount: review.needsVerificationCount,
      eventTitle: event.title,
      eventDateTime: time.date + ', ' + time.time + ' (' + event.timezone + ')',
      meetingUrl: event.meeting_url,
      recipientSetDigest: deriveRecipientSetDigest(eventId, recipientIds),
      sendReviewDigest: deriveSendReviewDigest(
        eventId,
        review.reviewRecipients
      ),
    }
  } catch {
    console.error('artistalks_bulk_invitation_preparation_failed')
    return { status: 'error', message: 'Unable to prepare invitations.' }
  }
}

async function sendInvitationRecipients(
  eventId: string,
  _previousState: InvitationSendState,
  formData: FormData
): Promise<InvitationSendState> {
  'use server'

  const authorization = await requireJaiAdmin()
  if (!authorization.ok || !UUID_V4_PATTERN.test(eventId)) {
    return { status: 'error', message: 'Unable to send invitations.' }
  }

  const modeValue = formData.get('mode')
  const kindValue = formData.get('selectionKind')
  const handleValue = formData.get('selectionHandle')
  const recipientSetDigestValue = formData.get('recipientSetDigest')
  const sendReviewDigestValue = formData.get('sendReviewDigest')
  const mode: InvitationSendMode | null =
    modeValue === 'ready' || modeValue === 'retry_failed' ? modeValue : null
  const kind = typeof kindValue === 'string' ? kindValue : ''
  const handle = typeof handleValue === 'string' ? handleValue : ''
  const recipientSetDigest =
    typeof recipientSetDigestValue === 'string' ? recipientSetDigestValue : ''
  const sendReviewDigest =
    typeof sendReviewDigestValue === 'string' ? sendReviewDigestValue : ''
  if (!mode) {
    return { status: 'error', message: 'Unable to send invitations.' }
  }

  let event: EventRow | null
  let artists: EligibleArtist[]
  try {
    event = await loadOwnedEvent(authorization.admin, eventId, authorization.userId)
    artists = await loadEligibleArtists(authorization.admin)
  } catch {
    console.error('artistalks_bulk_invitation_send_preflight_failed')
    return { status: 'error', message: 'Unable to send invitations.' }
  }
  if (!event || !invitationsMayBePrepared(event.status)) {
    return {
      status: 'error',
      message: 'Invitation status changed. Review the send list before continuing.',
    }
  }

  const meetingUrl = validHttpsMeetingUrl(event.meeting_url)
  if (!meetingUrl) {
    return { status: 'error', message: 'Add a meeting link before sending.' }
  }

  let resolution: RecipientSelectionResult
  try {
    resolution = await resolveRecipientSelection(
      authorization.admin,
      authorization.userId,
      kind,
      handle,
      artists
    )
  } catch {
    console.error('artistalks_bulk_invitation_send_preflight_failed')
    return { status: 'error', message: 'Unable to send invitations.' }
  }
  if (!resolution.ok) {
    return {
      status: 'error',
      message: 'Recipient list changed. Review the updated preview before continuing.',
    }
  }

  const recipients = resolution.selection.recipients
  const recipientIds = recipients.map((recipient) => recipient.userId)
  if (
    recipientIds.length === 0 ||
    !recipientSetDigestMatches(recipientSetDigest, eventId, recipientIds)
  ) {
    return {
      status: 'error',
      message: 'Recipient list changed. Review the updated preview before continuing.',
    }
  }

  let review: InvitationReview
  let plans: InvitationDeliveryPlan[]
  let emailContext: Parameters<typeof deliverInvitationPlans>[2]
  try {
    review = await buildInvitationReview(authorization.admin, eventId, recipients)
    if (!sendReviewDigestMatches(sendReviewDigest, eventId, review.reviewRecipients)) {
      return {
        status: 'error',
        message: 'Invitation status changed. Review the send list before continuing.',
      }
    }

    const time = formatEventDateTime(event)
    const googleCalendarUrl = buildArtistTalksGoogleCalendarUrl({
      title: event.title,
      description: event.description,
      startsAt: event.starts_at,
      endsAt: event.ends_at,
      timezone: event.timezone,
      location: event.location,
      meetingUrl,
    })
    if (!googleCalendarUrl) throw new Error('Invalid calendar configuration.')
    assertArtistTalksInvitationEmailConfigured()

    plans = buildDeliveryPlans(mode, recipients, review)
    emailContext = {
      eventTitle: event.title,
      eventDescription: event.description,
      eventDate: time.date,
      eventTime: time.time,
      eventTimezone: event.timezone,
      eventLocation: event.location?.trim() ?? '',
      meetingUrl,
      googleCalendarUrl,
    }
  } catch {
    console.error('artistalks_bulk_invitation_send_preflight_failed')
    return { status: 'error', message: 'Unable to send invitations.' }
  }

  const expectedProviderCallCount =
    mode === 'ready' ? review.readyToSendCount : review.retryableFailedCount
  if (plans.length !== expectedProviderCallCount || plans.length === 0) {
    return {
      status: 'error',
      message: 'Invitation status changed. Review the send list before continuing.',
    }
  }
  if (plans.length > PRIVATE_BETA_SEND_LIMIT) {
    return {
      status: 'error',
      message: 'This batch is larger than the current send limit. Send a smaller group.',
    }
  }

  const outcomes = await deliverInvitationPlans(mode, plans, emailContext, {
    claim: (plan, sendMode) =>
      claimInvitationDelivery(authorization.admin, eventId, plan, sendMode),
    persist: (plan, claim, result) =>
      persistInvitationDelivery(
        authorization.admin,
        eventId,
        plan,
        claim,
        result
      ),
    send: sendArtistTalksInvitation,
  })
  const sentCount = outcomes.filter((outcome) => outcome.state === 'Sent').length
  const failedCount = outcomes.filter((outcome) => outcome.state === 'Failed').length
  const needsVerificationCount = outcomes.filter(
    (outcome) => outcome.state === 'Needs verification'
  ).length

  let retryableFailedCount = 0
  try {
    const currentReview = await buildInvitationReview(
      authorization.admin,
      eventId,
      recipients
    )
    retryableFailedCount = currentReview.retryableFailedCount
  } catch {
    // The safe result never guesses that an uncertain delivery is retryable.
  }

  return {
    status:
      failedCount === 0 && needsVerificationCount === 0 ? 'complete' : 'partial',
    sentCount,
    failedCount,
    needsVerificationCount,
    retryableFailedCount,
    recipients: outcomes,
  }
}

export default async function EventDetailPage({ params }: EventDetailPageProps) {
  const authorization = await requireJaiAdmin()
  if (!authorization.ok) notFound()

  const { eventId } = await params
  if (!UUID_V4_PATTERN.test(eventId)) notFound()

  let event: EventRow | null
  try {
    event = await loadOwnedEvent(authorization.admin, eventId, authorization.userId)
  } catch {
    console.error('artistalks_event_read_failed')
    throw new Error('Unable to load event.')
  }
  if (!event) notFound()
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

  const canPrepare = invitationsMayBePrepared(event.status)
  let artists: ArtistSelectionOption[] = []
  let groups: GroupSelectionOption[] = []
  if (canPrepare) {
    try {
      const [eligibleArtists, ownedGroups] = await Promise.all([
        loadEligibleArtists(authorization.admin),
        loadOwnedGroups(authorization.admin, authorization.userId),
      ])
      artists = safeArtistOptions(eligibleArtists)
      groups = safeGroupOptions(ownedGroups)
    } catch {
      console.error('artistalks_invitation_selection_load_failed')
      throw new Error('Unable to load invitation choices.')
    }
  }

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
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <p className="inline-flex rounded-full border border-[#d8ad2a] bg-[#091b54] px-3 py-1 text-sm font-semibold text-[#f5f1cf]">
              Status: {STATUS_LABELS[event.status]}
            </p>
            <Link
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#62d391] px-4 py-2 text-sm font-semibold text-[#62d391] outline-none transition hover:bg-[#091b54] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#d8ad2a]"
              href={`/manage/events/${eventId}/edit`}
              prefetch={false}
            >
              EDIT EVENT
            </Link>
          </div>
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
              <dd className="mt-1 break-words text-[#f5f1cf]">{event.timezone}</dd>
            </div>
            {event.location ? (
              <div>
                <dt className="font-semibold text-[#d8ad2a]">Location</dt>
                <dd className="mt-1 whitespace-pre-wrap text-[#f5f1cf]">{event.location}</dd>
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
              artistOptions={artists}
              canPrepare={canPrepare}
              createGroupAction={createInvitationGroup.bind(null, eventId)}
              groupOptions={groups}
              prepareAction={prepareInvitationRecipients.bind(null, eventId)}
              previewAction={previewInvitationRecipients.bind(null, eventId)}
              sendAction={sendInvitationRecipients.bind(null, eventId)}
            />
          </div>
        </section>
      </article>
    </main>
  )
}
