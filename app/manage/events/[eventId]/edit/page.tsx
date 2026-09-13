import type { SupabaseClient } from '@supabase/supabase-js'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireJaiAdmin } from '@/utils/supabase/requireJaiAdmin'
import EditEventForm, { type EditableEvent } from './EditEventForm'

type EditEventPageProps = { params: Promise<{ eventId: string }> }
type EventRow = {
  title: string
  description: string
  starts_at: string
  ends_at: string
  timezone: string
  location: string | null
  meeting_url: string | null
  status: string
  updated_at: string
}
type InvitationLifecycleRow = {
  rsvp_status: string
  delivery_status: string
  send_idempotency_key: string | null
  last_delivery_error_code: string | null
}

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const EVENT_SELECT =
  'title, description, starts_at, ends_at, timezone, location, meeting_url, status, updated_at'
const INVITATION_SELECT =
  'rsvp_status, delivery_status, send_idempotency_key, last_delivery_error_code'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Edit Event | ArtisTalks',
  robots: { index: false, follow: false },
}

async function loadOwnedEvent(
  admin: SupabaseClient,
  eventId: string,
  ownerId: string
) {
  const { data, error } = await admin
    .from('artistalks_events')
    .select(EVENT_SELECT)
    .eq('id', eventId)
    .eq('created_by', ownerId)
    .maybeSingle()

  if (error) throw new Error('Unable to load event.')
  return (data as EventRow | null) ?? null
}

async function loadInvitationLifecycle(
  admin: SupabaseClient,
  eventId: string
) {
  const { data, error } = await admin
    .from('artistalks_event_invitations')
    .select(INVITATION_SELECT)
    .eq('event_id', eventId)

  if (error) throw new Error('Unable to load event.')
  return (data ?? []) as InvitationLifecycleRow[]
}

function invitationBlocksEditing(row: InvitationLifecycleRow): boolean {
  return (
    row.rsvp_status !== 'pending' ||
    row.delivery_status !== 'unsent' ||
    row.send_idempotency_key !== null ||
    row.last_delivery_error_code !== null
  )
}

function wallTimeParts(instant: string, timezone: string) {
  const date = new Date(instant)
  if (Number.isNaN(date.getTime())) throw new Error('Unable to load event.')

  const parts = new Intl.DateTimeFormat('en-US', {
    calendar: 'iso8601',
    numberingSystem: 'latn',
    timeZone: timezone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(date)
  const values = Object.fromEntries(
    parts
      .filter((part) =>
        ['year', 'month', 'day', 'hour', 'minute'].includes(part.type)
      )
      .map((part) => [part.type, part.value])
  )

  if (
    !values.year ||
    !values.month ||
    !values.day ||
    !values.hour ||
    !values.minute
  ) {
    throw new Error('Unable to load event.')
  }

  return {
    date: `${values.year}-${values.month}-${values.day}`,
    time: `${values.hour}:${values.minute}`,
  }
}

function blockedPanel(eventId: string, message: string) {
  return (
    <section className="rounded-2xl border border-[#d8ad2a] bg-[#091b54] p-5 shadow-[0_16px_50px_rgba(0,0,0,0.3)] sm:p-7">
      <p className="text-base leading-7 text-[#f5f1cf]">{message}</p>
      <Link
        className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-[#62d391] px-4 py-3 text-center text-base font-semibold text-[#62d391] outline-none transition hover focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#d8ad2a]"
        href={`/manage/events/${eventId}`}
        prefetch={false}
      >
        BACK TO EVENT
      </Link>
    </section>
  )
}

export default async function EditEventPage({ params }: EditEventPageProps) {
  const authorization = await requireJaiAdmin()
  if (!authorization.ok) notFound()

  const { eventId } = await params
  if (!UUID_V4_PATTERN.test(eventId)) notFound()

  let event: EventRow | null
  let invitations: InvitationLifecycleRow[] = []
  try {
    event = await loadOwnedEvent(
      authorization.admin,
      eventId,
      authorization.userId
    )
    if (event) {
      invitations = await loadInvitationLifecycle(authorization.admin, eventId)
    }
  } catch {
    console.error('artistalks_event_edit_load_failed')
    throw new Error('Unable to load event.')
  }
  if (!event) notFound()

  let body
  if (event.status === 'canceled') {
    body = blockedPanel(eventId, 'Canceled events cannot be edited.')
  } else if (event.status !== 'draft' && event.status !== 'scheduled') {
    body = blockedPanel(eventId, 'This event cannot be edited.')
  } else if (invitations.some(invitationBlocksEditing)) {
    body = blockedPanel(
      eventId,
      'This event may already have reached an artist. Review its delivery before changing event details.'
    )
  } else {
    const start = wallTimeParts(event.starts_at, event.timezone)
    const end = wallTimeParts(event.ends_at, event.timezone)
    const editableEvent: EditableEvent = {
      eventId,
      expectedUpdatedAt: event.updated_at,
      title: event.title,
      description: event.description,
      date: start.date,
      startTime: start.time,
      endTime: end.time,
      timezone: event.timezone,
      location: event.location ?? '',
      meetingUrl: event.meeting_url ?? '',
    }
    body = (
      <EditEventForm
        event={editableEvent}
        timingLocked={invitations.length > 0}
      />
    )
  }

  return (
    <main
      className="min-h-screen bg-[#051340] px-4 text-[#f5f1cf] [min-height:100dvh] sm:px-6"
      style={{
        paddingTop: 'max(1.5rem, env(safe-area-inset-top))',
        paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))',
      }}
    >
      <section className="mx-auto w-full max-w-xl">
        <header className="mb-6">
          <p className="font-mono text-sm font-semibold uppercase tracking-[0.18em] text-[#d8ad2a]">
            ArtisTalks event
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#f5f1cf] sm:text-4xl">
            Edit event
          </h1>
          <p className="mt-3 max-w-prose text-base leading-7 text-[#dce7d0]">
            Update the private event details. Saving sends nothing.
          </p>
        </header>
        {body}
      </section>
    </main>
  )
}
