'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { wallTimeToRfc3339 } from '../../new/CreateEventForm'

export type EditableEvent = {
  eventId: string
  expectedUpdatedAt: string
  title: string
  description: string
  date: string
  startTime: string
  endTime: string
  timezone: string
  location: string
  meetingUrl: string
}

type EditEventFormProps = {
  event: EditableEvent
  timingLocked: boolean
}

const INPUT_CLASS_NAME =
  'mt-2 block min-h-12 w-full rounded-xl border border-[#8796aa] bg-white px-3 py-2 text-base text-[#111827] shadow-sm outline-none transition focus-visible:border-[#d8ad2a] focus-visible:ring-3 focus-visible:ring-[#d8ad2a]/35 disabled:cursor-not-allowed disabled:bg-[#dce2e8] disabled:text-[#4b5563] disabled:opacity-90'
const TEXTAREA_CLASS_NAME = `${INPUT_CLASS_NAME} min-h-32 resize-y`

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

function readSaved(payload: unknown): boolean {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'saved' in payload &&
    payload.saved === true
  )
}

export default function EditEventForm({
  event,
  timingLocked,
}: EditEventFormProps) {
  const router = useRouter()
  const [timezone, setTimezone] = useState(event.timezone)
  const [timezoneOptions, setTimezoneOptions] = useState<string[]>([
    event.timezone,
  ])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let supportedTimezones: string[] = []
    try {
      supportedTimezones = Intl.supportedValuesOf('timeZone')
    } catch {
      supportedTimezones = []
    }

    setTimezoneOptions(
      Array.from(new Set([event.timezone, 'UTC', ...supportedTimezones])).sort()
    )
  }, [event.timezone])

  async function handleSubmit(submitEvent: FormEvent<HTMLFormElement>) {
    submitEvent.preventDefault()
    if (saving) return
    setError(null)

    const formData = new FormData(submitEvent.currentTarget)
    const title = readString(formData, 'title')
    const description = readString(formData, 'description')
    const date = timingLocked ? event.date : readString(formData, 'date')
    const startTime = timingLocked
      ? event.startTime
      : readString(formData, 'startTime')
    const endTime = timingLocked
      ? event.endTime
      : readString(formData, 'endTime')
    const selectedTimezone = timingLocked
      ? event.timezone
      : readString(formData, 'timezone')
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
        method: 'PATCH',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: event.eventId,
          expectedUpdatedAt: event.expectedUpdatedAt,
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

      if (!response.ok || !readSaved(payload)) {
        throw new Error(
          responseError(payload) ??
            'Event changes could not be saved. Please try again.'
        )
      }

      router.replace(`/manage/events/${event.eventId}`)
      router.refresh()
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Event changes could not be saved. Please try again.'
      )
      setSaving(false)
    }
  }

  const timingDescriptionId = timingLocked
    ? 'event-timing-locked-description'
    : undefined

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
            defaultValue={event.title}
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
            Description
          </label>
          <textarea
            className={TEXTAREA_CLASS_NAME}
            defaultValue={event.description}
            disabled={saving}
            id="event-description"
            maxLength={10000}
            name="description"
          />
        </div>

        {timingLocked ? (
          <p
            className="rounded-xl border border-[#d8ad2a] px-3 py-2 text-sm leading-5 text-[#f5f1cf]"
            id={timingDescriptionId}
          >
            Timing is locked because invitations have already been prepared.
          </p>
        ) : null}

        <div>
          <label className="block text-base font-semibold" htmlFor="event-date">
            Date
          </label>
          <input
            aria-describedby={timingDescriptionId}
            className={INPUT_CLASS_NAME}
            defaultValue={event.date}
            disabled={saving || timingLocked}
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
              aria-describedby={timingDescriptionId}
              className={INPUT_CLASS_NAME}
              defaultValue={event.startTime}
              disabled={saving || timingLocked}
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
              aria-describedby={timingDescriptionId}
              className={INPUT_CLASS_NAME}
              defaultValue={event.endTime}
              disabled={saving || timingLocked}
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
            aria-describedby={timingDescriptionId}
            autoCapitalize="none"
            autoComplete="off"
            className={INPUT_CLASS_NAME}
            disabled={saving || timingLocked}
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
            defaultValue={event.location}
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
            autoComplete="url"
            className={INPUT_CLASS_NAME}
            defaultValue={event.meetingUrl}
            disabled={saving}
            id="event-meeting-url"
            inputMode="url"
            maxLength={2048}
            name="meetingUrl"
            placeholder="https://us05web.zoom.us/j/2531307980"
            spellCheck={false}
            type="url"
          />
        </div>
      </div>

      {error ? (
        <p
          className="mt-5 rounded-xl border border-[#d8ad2a] px-3 py-2 text-sm leading-5 text-[#f5f1cf]"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button
          className="min-h-12 rounded-xl border border-[#62d391] bg-[#1ea565] px-4 py-3 text-base font-semibold text-[#051340] outline-none transition focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#d8ad2a] disabled:cursor-not-allowed disabled:opacity-65"
          disabled={saving}
          type="submit"
        >
          {saving ? 'SAVING…' : 'SAVE CHANGES'}
        </button>
        <Link
          aria-disabled={saving}
          className={`min-h-12 rounded-xl border border-[#d8ad2a] px-4 py-3 text-center text-base font-semibold text-[#f5f1cf] outline-none transition focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#d8ad2a] ${saving ? 'pointer-events-none opacity-65' : ''}`}
          href={`/manage/events/${event.eventId}`}
          prefetch={false}
        >
          CANCEL
        </Link>
      </div>

      <p className="mt-4 text-center text-sm leading-5 text-[#b9c9b8]" aria-live="polite">
        {saving ? 'Saving event changes.' : 'Nothing is sent when you save.'}
      </p>
    </form>
  )
}
