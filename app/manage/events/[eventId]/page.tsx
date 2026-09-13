import type { SupabaseClient } from '@supabase/supabase-js'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import {
  artistSelectionHandleMatches,
  deriveArtistSelectionHandle,
  deriveGroupSelectionHandle,
  deriveRecipientSetDigest,
  groupSelectionHandleMatches,
} from '@/lib/artistalksInvitationSelection'
import { requireJaiAdmin } from '@/utils/supabase/requireJaiAdmin'
import PrepareInvitation, {
  type ArtistSelectionOption,
  type CreateGroupState,
  type GroupSelectionOption,
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
type DeliveryLabel = 'Not sent' | 'Sent' | 'Needs verification' | 'Mixed'

const EVENT_SELECT =
  'title, description, starts_at, ends_at, timezone, location, meeting_url, status'
const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const EMAIL_SHAPED_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i
const PAGE_SIZE = 200
const INVITATION_QUERY_CHUNK_SIZE = 100
const GROUP_NAME_MAX_LENGTH = 100
const MAX_GROUP_MEMBERS = 500
const DELIVERY_REJECTED_CODE = 'provider_rejected'
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
      if (UUID_V4_PATTERN.test(row.id) && name && !EMAIL_SHAPED_PATTERN.test(name)) {
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
  let recipients: EligibleArtist[] = []

  if (kind === 'artist') {
    const artist = resolveArtistHandle(handle, artists)
    if (!artist) {
      return { status: 'error', message: 'Artist eligibility changed. Refresh and try again.' }
    }
    recipients = [artist]
  } else if (kind === 'group') {
    let groups: InvitationGroup[]
    let memberIds: string[]
    try {
      groups = await loadOwnedGroups(authorization.admin, authorization.userId)
      const group = resolveGroupHandle(handle, groups)
      if (!group) return { status: 'error', message: 'Group not found. Refresh and try again.' }
      memberIds = await loadGroupMemberIds(authorization.admin, group.groupId)
    } catch {
      console.error('artistalks_invitation_recipient_preview_failed')
      return { status: 'error', message: 'Unable to preview invitations.' }
    }
    const eligibleById = new Map(artists.map((artist) => [artist.userId, artist]))
    recipients = memberIds
      .map((memberId) => eligibleById.get(memberId))
      .filter((artist): artist is EligibleArtist => Boolean(artist))
  } else if (kind === 'all_eligible') {
    recipients = artists
  } else {
    return { status: 'error', message: 'Choose an artist or group.' }
  }

  recipients = [...new Map(recipients.map((artist) => [artist.userId, artist])).values()].sort(
    (a, b) =>
      a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }) ||
      a.userId.localeCompare(b.userId)
  )
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
              previewAction={previewInvitationRecipients.bind(null, eventId)}
            />
          </div>
        </section>
      </article>
    </main>
  )
}
