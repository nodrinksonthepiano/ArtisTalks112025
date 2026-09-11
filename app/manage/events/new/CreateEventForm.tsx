'use client'

import { FormEvent, useEffect, useRef, useState } from 'react'

type WallTime = {
  rfc3339: string
  instant: number
}

type SavedEvent = {
  title: string
  startsAt: string
  endsAt: string
  timezone: string
  status: 'draft'
}

const INPUT_CLASS_NAME =
  'mt-2 block min-h-12 w-full rounded-xl border border-[#8796aa] bg-white px-3 py-2 text-base text-[#111827] shadow-sm outline-none transition focus-visible:border-[#d8ad2a] focus-visible:ring-3 focus-visible:ring-[#d8ad2a]/35 disabled:cursor-not-allowed disabled:opacity-70'

const TEXTAREA_CLASS_NAME = `${INPUT_CLASS_NAME} min-h-32 resize-y`

function parseWallClock(dateValue: string, timeValue: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) return null
  if (!/^\d{2}:\d{2}$/.test(timeValue)) return null

  const wallClock = new Date(`${dateValue}T${timeValue}:00.000Z`)
  if (Number.isNaN(wallClock.getTime())) return null

  return wallClock.toISOString().slice(0, 16) === `${dateValue}T${timeValue}`
    ? wallClock.getTime()
    : null
}

function isIanaTimezone(timezone: string): boolean {
  if (timezone !== 'UTC' && !timezone.includes('/')) return false

  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format()
    return true
  } catch {
    return false
  }
}

function timezoneOffsetMinutes(timezone: string, instant: number): number | null {
  try {
    const offsetName = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'longOffset',
    })
      .formatToParts(new Date(instant))
      .find((part) => part.type === 'timeZoneName')?.value

    if (offsetName === 'GMT' || offsetName === 'UTC') return 0

    const match = offsetName?.match(/^GMT([+-])(\d{1,2})(?::(\d{2}))?$/)
    if (!match) return null

    const direction = match[1] === '-' ? -1 : 1
    return direction * (Number(match[2]) * 60 + Number(match[3] ?? 0))
  } catch {
    return null
  }
}

function wallClockParts(timezone: string, instant: number) {
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
  }).formatToParts(new Date(instant))

  return Object.fromEntries(
    parts
      .filter((part) =>
        ['year', 'month', 'day', 'hour', 'minute'].includes(part.type)
      )
      .map((part) => [part.type, part.value])
  )
}

function formatOffset(offsetMinutes: number): string {
  const direction = offsetMinutes < 0 ? '-' : '+'
  const absoluteMinutes = Math.abs(offsetMinutes)
  const hours = Math.floor(absoluteMinutes / 60)
  const minutes = absoluteMinutes % 60

  return `${direction}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

export function wallTimeToRfc3339(
  dateValue: string,
  timeValue: string,
  timezone: string
): WallTime {
  const wallClock = parseWallClock(dateValue, timeValue)
  if (wallClock === null) {
    throw new Error('Check the event date and time.')
  }

  if (!isIanaTimezone(timezone)) {
    throw new Error('Check the event timezone.')
  }

  const sampleDistance = 36 * 60 * 60 * 1000
  const offsets = new Set<number>()

  for (const sample of [
    wallClock - sampleDistance,
    wallClock,
    wallClock + sampleDistance,
  ]) {
    const offset = timezoneOffsetMinutes(timezone, sample)
    if (offset !== null) offsets.add(offset)
  }

  const expectedParts = {
    year: dateValue.slice(0, 4),
    month: dateValue.slice(5, 7),
    day: dateValue.slice(8, 10),
    hour: timeValue.slice(0, 2),
    minute: timeValue.slice(3, 5),
  }

  const candidates = Array.from(offsets).flatMap((offset) => {
    const instant = wallClock - offset * 60 * 1000
    const actualOffset = timezoneOffsetMinutes(timezone, instant)
    if (actualOffset !== offset) return []

    const actualParts = wallClockParts(timezone, instant)
    const matches = Object.entries(expectedParts).every(
      ([key, value]) => actualParts[key] === value
    )
    if (!matches) return []

    return [
      {
        rfc3339: `${dateValue}T${timeValue}:00${formatOffset(offset)}`,
        instant,
      },
    ]
  })

  const uniqueCandidates = candidates.filter(
    (candidate, index) =>
      candidates.findIndex((item) => item.instant === candidate.instant) === index
  )

  if (uniqueCandidates.length === 0) {
    throw new Error(
      'That time does not exist in the selected timezone. Choose another time.'
    )
  }

  if (uniqueCandidates.length > 1) {
    throw new Error(
      'That time happens twice in the selected timezone. Choose another time.'
    )
  }

  return uniqueCandidates[0]
}

function readString(formData: FormData, name: string): string {
  const value = formData.get(name)
  return typeof value === 'string' ? value.trim() : ''
}

function responseError(payload: unknown): string | null {
  if (
    typeof payload === 'object' &&
    payload !== null &&
    'error' in payload &&
    typeof payload.error === 'string'
  ) {
    return payload.error
  }

  return null
}

function readSavedEvent(payload: unknown): SavedEvent | null {
  if (typeof payload !== 'object' || payload === null || !('event' in payload)) {
    return null
  }

  const event = payload.event
  if (
    typeof event !== 'object' ||
    event === null ||
    !('title' in event) ||
    typeof event.title !== 'string' ||
    !('startsAt' in event) ||
    typeof event.startsAt !== 'string' ||
    !('endsAt' in event) ||
    typeof event.endsAt !== 'string' ||
    !('timezone' in event) ||
    typeof event.timezone !== 'string' ||
    !('status' in event) ||
    event.status !== 'draft'
  ) {
    return null
  }

  return {
    title: event.title,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    timezone: event.timezone,
    status: event.status,
  }
}

function formatSavedTime(event: SavedEvent): string {
  try {
    const date = new Intl.DateTimeFormat(undefined, {
      dateStyle: 'full',
      timeZone: event.timezone,
    }).format(new Date(event.startsAt))
    const timeFormatter = new Intl.DateTimeFormat(undefined, {
      timeStyle: 'short',
      timeZone: event.timezone,
    })

    return `${date}, ${timeFormatter.format(new Date(event.startsAt))}–${timeFormatter.format(new Date(event.endsAt))} (${event.timezone})`
  } catch {
    return `${event.startsAt}–${event.endsAt} (${event.timezone})`
  }
}

export default function CreateEventForm() {
  const idempotencyKey = useRef<string | null>(null)
  const [timezone, setTimezone] = useState('')
  const [timezoneOptions, setTimezoneOptions] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedEvent, setSavedEvent] = useState<SavedEvent | null>(null)

  useEffect(() => {
    let detectedTimezone = 'UTC'

    try {
      detectedTimezone =
        Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    } catch {
      detectedTimezone = 'UTC'
    }

    let supportedTimezones: string[] = []
    try {
      supportedTimezones = Intl.supportedValuesOf('timeZone')
    } catch {
      supportedTimezones = []
    }

    setTimezone(detectedTimezone)
    setTimezoneOptions(
      Array.from(new Set([detectedTimezone, 'UTC', ...supportedTimezones])).sort()
    )
  }, [])

  async function handleSubmit(submitEvent: FormEvent<HTMLFormElement>) {
    submitEvent.preventDefault()
    if (saving || savedEvent) return

    setError(null)

    if (!idempotencyKey.current) {
      idempotencyKey.current = crypto.randomUUID()
    }

    const formData = new FormData(submitEvent.currentTarget)
    const title = readString(formData, 'title')
    const description = readString(formData, 'description')
    const date = readString(formData, 'date')
    const startTime = readString(formData, 'startTime')
    const endTime = readString(formData, 'endTime')
    const selectedTimezone = readString(formData, 'timezone')
    const location = readString(formData, 'location')
    const meetingUrl = readString(formData, 'meetingUrl')

    try {
      if (!title) throw new Error('Enter an event title.')

      if (meetingUrl) {
        const parsedMeetingUrl = new URL(meetingUrl)
        if (parsedMeetingUrl.protocol !== 'https:') {
          throw new Error('Enter an HTTPS meeting link.')
        }
      }

      const startsAt = wallTimeToRfc3339(
        date,
        startTime,
        selectedTimezone
      )
      const endsAt = wallTimeToRfc3339(date, endTime, selectedTimezone)

      if (endsAt.instant <= startsAt.instant) {
        throw new Error('End time must be after start time.')
      }

      setSaving(true)

      const response = await fetch('/api/artistalks/events', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          idempotencyKey: idempotencyKey.current,
          title,
          description,
          startsAt: startsAt.rfc3339,
          endsAt: endsAt.rfc3339,
          timezone: selectedTimezone,
          location,
          meetingUrl,
        }),
      })

      let payload: unknown = null
      try {
        payload = await response.json()
      } catch {
        payload = null
      }

      if (!response.ok) {
        throw new Error(
          responseError(payload) ?? 'Draft could not be saved. Please try again.'
        )
      }

      const nextSavedEvent = readSavedEvent(payload)
      if (!nextSavedEvent) {
        throw new Error('Draft could not be saved. Please try again.')
      }

      setSavedEvent(nextSavedEvent)
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Draft could not be saved. Please try again.'
      )
    } finally {
      setSaving(false)
    }
  }

  if (savedEvent) {
    return (
      <section
        aria-labelledby="draft-saved-title"
        className="rounded-2xl border border-[#d8ad2a] bg-[#091b54] p-5 shadow-[0_16px_50px_rgba(0,0,0,0.3)] sm:p-7"
        role="status"
      >
        <p className="font-mono text-sm font-semibold uppercase tracking-[0.16em] text-[#62d391]">
          Draft saved
        </p>
        <h2
          id="draft-saved-title"
          className="mt-3 text-2xl font-semibold text-[#f5f1cf]"
        >
          {savedEvent.title}
        </h2>
        <dl className="mt-5 space-y-4 text-base leading-6">
          <div>
            <dt className="font-semibold text-[#d8ad2a]">Date and time</dt>
            <dd className="mt-1 text-[#f5f1cf]">
              {formatSavedTime(savedEvent)}
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-[#d8ad2a]">Status</dt>
            <dd className="mt-1 text-[#f5f1cf]">Draft</dd>
          </div>
        </dl>
      </section>
    )
  }

  return (
    <form
      className="rounded-2xl border border-[#d8ad2a] bg-[#091b54] p-5 shadow-[0_16px_50px_rgba(0,0,0,0.3)] sm:p-7"
      onSubmit={handleSubmit}
    >
      <div className="space-y-5">
        <div>
          <label className="block text-base font-semibold" htmlFor="event-title">
            Title
          </label>
          <input
            autoComplete="off"
            className={INPUT_CLASS_NAME}
            disabled={saving}
            id="event-title"
            maxLength={200}
            name="title"
            required
            type="text"
          />
        </div>

        <div>
          <label
            className="block text-base font-semibold"
            htmlFor="event-description"
          >
            Description{' '}
            <span className="font-normal text-[#b9c9b8]">— optional for draft</span>
          </label>
          <textarea
            className={TEXTAREA_CLASS_NAME}
            disabled={saving}
            id="event-description"
            maxLength={10000}
            name="description"
          />
        </div>

        <div>
          <label className="block text-base font-semibold" htmlFor="event-date">
            Date
          </label>
          <input
            className={INPUT_CLASS_NAME}
            disabled={saving}
            id="event-date"
            name="date"
            required
            type="date"
          />
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label
              className="block text-base font-semibold"
              htmlFor="event-start-time"
            >
              Start time
            </label>
            <input
              className={INPUT_CLASS_NAME}
              disabled={saving}
              id="event-start-time"
              name="startTime"
              required
              type="time"
            />
          </div>

          <div>
            <label
              className="block text-base font-semibold"
              htmlFor="event-end-time"
            >
              End time
            </label>
            <input
              className={INPUT_CLASS_NAME}
              disabled={saving}
              id="event-end-time"
              name="endTime"
              required
              type="time"
            />
          </div>
        </div>

        <div>
          <label
            className="block text-base font-semibold"
            htmlFor="event-timezone"
          >
            Timezone
          </label>
          <input
            autoCapitalize="none"
            autoComplete="off"
            className={INPUT_CLASS_NAME}
            disabled={saving || !timezone}
            id="event-timezone"
            list="event-timezone-options"
            maxLength={100}
            name="timezone"
            onChange={(changeEvent) => setTimezone(changeEvent.target.value)}
            required
            spellCheck={false}
            type="text"
            value={timezone}
          />
          <datalist id="event-timezone-options">
            {timezoneOptions.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
          <p className="mt-2 text-sm leading-5 text-[#b9c9b8]">
            Your device timezone is selected automatically.
          </p>
        </div>

        <div>
          <label
            className="block text-base font-semibold"
            htmlFor="event-location"
          >
            Location <span className="font-normal text-[#b9c9b8]">— optional</span>
          </label>
          <input
            autoComplete="off"
            className={INPUT_CLASS_NAME}
            disabled={saving}
            id="event-location"
            maxLength={500}
            name="location"
            type="text"
          />
        </div>

        <div>
          <label
            className="block text-base font-semibold"
            htmlFor="event-meeting-url"
          >
            Meeting URL{' '}
            <span className="font-normal text-[#b9c9b8]">— optional</span>
          </label>
          <input
            autoCapitalize="none"
            autoComplete="off"
            className={INPUT_CLASS_NAME}
            disabled={saving}
            id="event-meeting-url"
            inputMode="url"
            maxLength={2048}
            name="meetingUrl"
            placeholder="https://"
            spellCheck={false}
            type="url"
          />
        </div>
      </div>

      {error ? (
        <p
          className="mt-5 rounded-xl border border-[#f4a3a3] bg-[#4b1625] px-4 py-3 text-base leading-6 text-white"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <button
        className="mt-6 min-h-12 w-full rounded-xl bg-[#047857] px-5 py-3 text-base font-bold tracking-[0.08em] text-white shadow-lg transition hover:bg-[#056b50] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#d8ad2a] disabled:cursor-not-allowed disabled:opacity-65"
        disabled={saving || !timezone}
        type="submit"
      >
        {saving ? 'SAVING…' : 'SAVE DRAFT'}
      </button>

      <p className="mt-4 text-center text-sm leading-5 text-[#b9c9b8]" aria-live="polite">
        {saving ? 'Saving your private draft.' : 'Nothing is sent when you save.'}
      </p>
    </form>
  )
}
