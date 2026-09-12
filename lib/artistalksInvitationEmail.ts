import 'server-only'

const RESEND_EMAIL_ENDPOINT = 'https://api.resend.com/emails'
const INVITATION_SENDER = 'ArtisTalks <community@updates.artistalks.org>'
const INVITATION_REPLY_TO = 'jai@artistalks.org'
const RSVP_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/
const PROVIDER_MESSAGE_ID_MAX_LENGTH = 500
const PROVIDER_REQUEST_TIMEOUT_MS = 10_000

export type ArtistTalksCalendarEvent = {
  title: string
  description: string
  startsAt: string
  endsAt: string
  timezone: string
  location: string | null
  meetingUrl: string
}

type SendArtistTalksInvitationInput = {
  recipientEmail: string
  idempotencyKey: string
  artistName: string
  eventTitle: string
  eventDescription: string
  eventDate: string
  eventTime: string
  eventTimezone: string
  eventLocation: string
  meetingUrl: string
  rsvpUrl: string
  googleCalendarUrl: string
}

export type SendArtistTalksInvitationResult =
  | { status: 'accepted'; providerMessageId: string }
  | { status: 'rejected' }
  | { status: 'uncertain' }

function googleCalendarTimestamp(value: string): string | null {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null

  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z')
}

export function buildArtistTalksGoogleCalendarUrl(
  event: ArtistTalksCalendarEvent
): string | null {
  const startsAt = googleCalendarTimestamp(event.startsAt)
  const endsAt = googleCalendarTimestamp(event.endsAt)
  if (!startsAt || !endsAt || new Date(event.endsAt) <= new Date(event.startsAt)) {
    return null
  }

  let meetingUrl: URL
  try {
    meetingUrl = new URL(event.meetingUrl)
  } catch {
    return null
  }
  if (meetingUrl.protocol !== 'https:') return null

  try {
    new Intl.DateTimeFormat('en-US', { timeZone: event.timezone }).format()
  } catch {
    return null
  }

  const details = [
    event.description.trim(),
    `Join meeting: ${meetingUrl.toString()}`,
  ]
    .filter(Boolean)
    .join('\n\n')
  const calendarUrl = new URL('https://calendar.google.com/calendar/render')
  calendarUrl.searchParams.set('action', 'TEMPLATE')
  calendarUrl.searchParams.set('text', event.title)
  calendarUrl.searchParams.set('dates', `${startsAt}/${endsAt}`)
  calendarUrl.searchParams.set('details', details)
  calendarUrl.searchParams.set(
    'location',
    event.location?.trim() || meetingUrl.toString()
  )
  calendarUrl.searchParams.set('ctz', event.timezone)

  return calendarUrl.toString()
}

export function buildArtistTalksRsvpUrl(rawToken: string): string | null {
  if (!RSVP_TOKEN_PATTERN.test(rawToken)) return null

  const rsvpUrl = new URL('https://artistalks.org/rsvp')
  rsvpUrl.hash = `token=${rawToken}`
  return rsvpUrl.toString()
}

function requireEmailConfiguration() {
  const apiKey = process.env.RESEND_API_KEY
  const templateId =
    process.env.ARTISTALKS_MASTERMIND_INVITATION_TEMPLATE_ID

  if (!apiKey || !templateId) {
    throw new Error('Invitation email configuration unavailable.')
  }

  return { apiKey, templateId }
}

export function assertArtistTalksInvitationEmailConfigured(): void {
  requireEmailConfiguration()
}

function readProviderMessageId(value: unknown): string | null {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('id' in value) ||
    typeof value.id !== 'string'
  ) {
    return null
  }

  const id = value.id.trim()
  return id && id.length <= PROVIDER_MESSAGE_ID_MAX_LENGTH ? id : null
}

export async function sendArtistTalksInvitation(
  input: SendArtistTalksInvitationInput
): Promise<SendArtistTalksInvitationResult> {
  const { apiKey, templateId } = requireEmailConfiguration()

  let response: Response
  try {
    response = await fetch(RESEND_EMAIL_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': input.idempotencyKey,
      },
      body: JSON.stringify({
        from: INVITATION_SENDER,
        to: [input.recipientEmail],
        reply_to: INVITATION_REPLY_TO,
        template: {
          id: templateId,
          variables: {
            ARTIST_NAME: input.artistName,
            EVENT_TITLE: input.eventTitle,
            EVENT_DESCRIPTION: input.eventDescription,
            EVENT_DATE: input.eventDate,
            EVENT_TIME: input.eventTime,
            EVENT_TIMEZONE: input.eventTimezone,
            EVENT_LOCATION: input.eventLocation,
            MEETING_URL: input.meetingUrl,
            RSVP_URL: input.rsvpUrl,
            GOOGLE_CALENDAR_URL: input.googleCalendarUrl,
          },
        },
      }),
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(PROVIDER_REQUEST_TIMEOUT_MS),
    })
  } catch {
    return { status: 'uncertain' }
  }

  if (!response.ok) {
    return response.status >= 400 && response.status < 500
      ? { status: 'rejected' }
      : { status: 'uncertain' }
  }

  try {
    const providerMessageId = readProviderMessageId(await response.json())
    return providerMessageId
      ? { status: 'accepted', providerMessageId }
      : { status: 'uncertain' }
  } catch {
    return { status: 'uncertain' }
  }
}
