import 'server-only'

import { isValid, parseISO } from 'date-fns'
import { NextResponse } from 'next/server'
import { requireJaiAdmin } from '@/utils/supabase/requireJaiAdmin'

type CreateEventBody = {
  idempotencyKey?: unknown
  title?: unknown
  description?: unknown
  startsAt?: unknown
  endsAt?: unknown
  timezone?: unknown
  location?: unknown
  meetingUrl?: unknown
}

type EventRow = {
  id: string
  title: string
  description: string
  starts_at: string
  ends_at: string
  timezone: string
  location: string | null
  meeting_url: string | null
  status: string
  created_at: string
  updated_at: string
}

type NormalizedEvent = {
  id: string
  title: string
  description: string
  startsAt: string
  endsAt: string
  timezone: string
  location: string | null
  meetingUrl: string | null
}

const EVENT_SELECT =
  'id, title, description, starts_at, ends_at, timezone, location, meeting_url, status, created_at, updated_at'

const ALLOWED_BODY_KEYS = new Set([
  'idempotencyKey',
  'title',
  'description',
  'startsAt',
  'endsAt',
  'timezone',
  'location',
  'meetingUrl',
])

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const RFC3339_WITH_OFFSET_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2})$/

function noStoreJson(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  })
}

function characterCount(value: string): number {
  return Array.from(value).length
}

function isRequestBody(value: unknown): value is CreateEventBody {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).every((key) => ALLOWED_BODY_KEYS.has(key))
  )
}

function optionalTrimmedString(value: unknown): string | null | undefined {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string') return undefined

  const trimmed = value.trim()
  return trimmed || null
}

function parseTimestamp(value: unknown): { date: Date; source: string } | null {
  if (typeof value !== 'string') return null

  const source = value.trim()
  if (!RFC3339_WITH_OFFSET_PATTERN.test(source) || source.endsWith('-00:00')) {
    return null
  }

  const date = parseISO(source)
  return isValid(date) ? { date, source } : null
}

function timestampOffsetMinutes(value: string): number | null {
  const match = value.match(/(Z|([+-])(\d{2}):(\d{2}))$/)
  if (!match) return null
  if (match[1] === 'Z') return 0

  const hours = Number(match[3])
  const minutes = Number(match[4])
  if (hours > 23 || minutes > 59) return null

  const direction = match[2] === '-' ? -1 : 1
  return direction * (hours * 60 + minutes)
}

function isIanaTimezone(value: string): boolean {
  if (value !== 'UTC' && !value.includes('/')) return false

  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format()
    return true
  } catch {
    return false
  }
}

function timezoneOffsetMinutes(timezone: string, date: Date): number | null {
  try {
    const offsetName = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'longOffset',
    })
      .formatToParts(date)
      .find((part) => part.type === 'timeZoneName')?.value

    if (offsetName === 'GMT' || offsetName === 'UTC') return 0

    const match = offsetName?.match(/^GMT([+-])(\d{1,2}):(\d{2})$/)
    if (!match) return null

    const direction = match[1] === '-' ? -1 : 1
    return direction * (Number(match[2]) * 60 + Number(match[3]))
  } catch {
    return null
  }
}

function timestampMatchesTimezone(
  timestamp: { date: Date; source: string },
  timezone: string
): boolean {
  const timestampOffset = timestampOffsetMinutes(timestamp.source)
  const timezoneOffset = timezoneOffsetMinutes(timezone, timestamp.date)

  return timestampOffset !== null && timestampOffset === timezoneOffset
}

function serializeEvent(row: EventRow) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    timezone: row.timezone,
    location: row.location,
    meetingUrl: row.meeting_url,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function isSameDraft(row: EventRow, event: NormalizedEvent): boolean {
  return (
    row.id === event.id &&
    row.title === event.title &&
    row.description === event.description &&
    new Date(row.starts_at).getTime() === new Date(event.startsAt).getTime() &&
    new Date(row.ends_at).getTime() === new Date(event.endsAt).getTime() &&
    row.timezone === event.timezone &&
    row.location === event.location &&
    row.meeting_url === event.meetingUrl &&
    row.status === 'draft'
  )
}

export async function POST(request: Request) {
  try {
    const authorization = await requireJaiAdmin()
    if (!authorization.ok) return authorization.response

    let untrustedBody: unknown
    try {
      untrustedBody = await request.json()
    } catch {
      return noStoreJson({ error: 'Invalid request.' }, 400)
    }

    if (!isRequestBody(untrustedBody)) {
      return noStoreJson({ error: 'Invalid request.' }, 400)
    }

    const idempotencyKey =
      typeof untrustedBody.idempotencyKey === 'string'
        ? untrustedBody.idempotencyKey.trim()
        : ''
    if (!UUID_V4_PATTERN.test(idempotencyKey)) {
      return noStoreJson({ error: 'Invalid save request.' }, 400)
    }

    const title =
      typeof untrustedBody.title === 'string' ? untrustedBody.title.trim() : ''
    if (characterCount(title) < 1 || characterCount(title) > 200) {
      return noStoreJson({ error: 'Enter an event title.' }, 400)
    }

    const description =
      untrustedBody.description === undefined
        ? ''
        : typeof untrustedBody.description === 'string'
          ? untrustedBody.description.trim()
          : null
    if (description === null || characterCount(description) > 10000) {
      return noStoreJson({ error: 'Check the event description.' }, 400)
    }

    const startsAt = parseTimestamp(untrustedBody.startsAt)
    const endsAt = parseTimestamp(untrustedBody.endsAt)
    if (!startsAt || !endsAt || endsAt.date.getTime() <= startsAt.date.getTime()) {
      return noStoreJson({ error: 'Check the event date and time.' }, 400)
    }

    const timezone =
      typeof untrustedBody.timezone === 'string'
        ? untrustedBody.timezone.trim()
        : ''
    if (
      characterCount(timezone) < 1 ||
      characterCount(timezone) > 100 ||
      !isIanaTimezone(timezone)
    ) {
      return noStoreJson({ error: 'Check the event timezone.' }, 400)
    }

    if (
      !timestampMatchesTimezone(startsAt, timezone) ||
      !timestampMatchesTimezone(endsAt, timezone)
    ) {
      return noStoreJson({ error: 'Check the event date and time.' }, 400)
    }

    const location = optionalTrimmedString(untrustedBody.location)
    if (location === undefined || (location && characterCount(location) > 500)) {
      return noStoreJson({ error: 'Check the event location.' }, 400)
    }

    const meetingUrl = optionalTrimmedString(untrustedBody.meetingUrl)
    if (
      meetingUrl === undefined ||
      (meetingUrl && characterCount(meetingUrl) > 2048)
    ) {
      return noStoreJson({ error: 'Check the meeting link.' }, 400)
    }

    if (meetingUrl) {
      try {
        const parsedMeetingUrl = new URL(meetingUrl)
        if (parsedMeetingUrl.protocol !== 'https:') {
          return noStoreJson({ error: 'Check the meeting link.' }, 400)
        }
      } catch {
        return noStoreJson({ error: 'Check the meeting link.' }, 400)
      }
    }

    const event: NormalizedEvent = {
      id: idempotencyKey,
      title,
      description,
      startsAt: startsAt.date.toISOString(),
      endsAt: endsAt.date.toISOString(),
      timezone,
      location,
      meetingUrl,
    }

    const { data: inserted, error: insertError } = await authorization.admin
      .from('artistalks_events')
      .insert({
        id: event.id,
        title: event.title,
        description: event.description,
        starts_at: event.startsAt,
        ends_at: event.endsAt,
        timezone: event.timezone,
        location: event.location,
        meeting_url: event.meetingUrl,
        status: 'draft',
        created_by: authorization.userId,
      })
      .select(EVENT_SELECT)
      .single()

    if (!insertError && inserted) {
      return noStoreJson({ event: serializeEvent(inserted as EventRow) }, 201)
    }

    if ((insertError as { code?: string } | null)?.code !== '23505') {
      console.error('artistalks_event_create_failed')
      return noStoreJson({ error: 'Unable to save event.' }, 500)
    }

    const { data: existing, error: existingError } = await authorization.admin
      .from('artistalks_events')
      .select(EVENT_SELECT)
      .eq('id', event.id)
      .eq('created_by', authorization.userId)
      .maybeSingle()

    if (existingError) {
      console.error('artistalks_event_create_failed')
      return noStoreJson({ error: 'Unable to save event.' }, 500)
    }

    if (!existing || !isSameDraft(existing as EventRow, event)) {
      return noStoreJson({ error: 'Save request conflict.' }, 409)
    }

    return noStoreJson({ event: serializeEvent(existing as EventRow) })
  } catch {
    console.error('artistalks_event_create_failed')
    return noStoreJson({ error: 'Unable to save event.' }, 500)
  }
}
