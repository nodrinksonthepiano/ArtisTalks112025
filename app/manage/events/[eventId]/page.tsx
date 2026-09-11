import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { requireJaiAdmin } from '@/utils/supabase/requireJaiAdmin'

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

const EVENT_SELECT =
  'title, description, starts_at, ends_at, timezone, location, meeting_url, status'

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

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
            <button
              aria-describedby="prepare-invitation-help"
              className="min-h-12 w-full cursor-not-allowed rounded-xl border border-[#8796aa] bg-[#26365f] px-5 py-3 text-base font-bold tracking-[0.08em] text-[#c5cbd7] opacity-75"
              disabled
              type="button"
            >
              PREPARE INVITATION
            </button>
            <p
              className="mt-3 text-center text-sm leading-5 text-[#b9c9b8]"
              id="prepare-invitation-help"
            >
              Invitation setup is not active yet.
            </p>
          </div>
        </section>
      </article>
    </main>
  )
}
