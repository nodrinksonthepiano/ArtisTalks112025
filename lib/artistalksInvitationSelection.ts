import 'server-only'

import { createHmac, timingSafeEqual } from 'crypto'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const HANDLE_DIGEST_PATTERN = /^[A-Za-z0-9_-]{43}$/
const RECIPIENT_SET_PREFIX = 'set_v1.'
const SEND_REVIEW_PREFIX = 'review_v1.'

export type InvitationSendReviewRecipient = {
  recipientUserId: string
  invitationId: string
  tokenExpiresAt: string
  rsvpStatus: 'pending' | 'accepted' | 'maybe' | 'declined' | 'unexpected'
  deliveryStatus: 'unsent' | 'sent' | 'failed' | 'unexpected'
  sendKeyState: 'unclaimed' | 'claimed'
  failureClassification: 'none' | 'provider_rejected' | 'uncertain'
  recipientEmail: string | null
  reviewState: 'Ready' | 'Sent' | 'Needs verification'
}

type SelectionDomain = 'artist' | 'group'

function selectionSecret(): Buffer {
  const secret = process.env.ARTISTALKS_SELECTION_HANDLE_SECRET
  if (!secret || Buffer.byteLength(secret, 'utf8') < 32) {
    throw new Error('ArtisTalks invitation selection is unavailable.')
  }

  return Buffer.from(secret, 'utf8')
}

function normalizedUuid(value: string): string {
  const normalized = value.trim().toLowerCase()
  if (!UUID_PATTERN.test(normalized)) {
    throw new Error('ArtisTalks invitation selection is unavailable.')
  }

  return normalized
}

function digest(value: string): string {
  return createHmac('sha256', selectionSecret())
    .update(value, 'utf8')
    .digest('base64url')
}

function suppliedDigestMatches(
  value: string,
  prefix: string,
  expectedValue: () => string
): boolean {
  if (!value.startsWith(prefix)) return false

  const suppliedDigest = value.slice(prefix.length)
  if (!HANDLE_DIGEST_PATTERN.test(suppliedDigest)) return false

  let expected: string
  try {
    expected = expectedValue()
  } catch {
    return false
  }

  const expectedDigest = expected.slice(prefix.length)
  return timingSafeEqual(
    Buffer.from(suppliedDigest, 'utf8'),
    Buffer.from(expectedDigest, 'utf8')
  )
}

function deriveSelectionHandle(domain: SelectionDomain, id: string): string {
  const normalizedId = normalizedUuid(id)
  return `${domain}_v1.${digest(
    `artistalks-selection:${domain}:v1:${normalizedId}`
  )}`
}

function selectionHandleMatches(
  domain: SelectionDomain,
  handle: string,
  id: string
): boolean {
  const prefix = `${domain}_v1.`
  return suppliedDigestMatches(handle, prefix, () =>
    deriveSelectionHandle(domain, id)
  )
}

export function deriveArtistSelectionHandle(artistUserId: string): string {
  return deriveSelectionHandle('artist', artistUserId)
}

export function artistSelectionHandleMatches(
  handle: string,
  artistUserId: string
): boolean {
  return selectionHandleMatches('artist', handle, artistUserId)
}

export function deriveGroupSelectionHandle(groupId: string): string {
  return deriveSelectionHandle('group', groupId)
}

export function groupSelectionHandleMatches(
  handle: string,
  groupId: string
): boolean {
  return selectionHandleMatches('group', handle, groupId)
}

export function deriveRecipientSetDigest(
  eventId: string,
  recipientUserIds: readonly string[]
): string {
  const normalizedEventId = normalizedUuid(eventId)
  const normalizedRecipientIds = [
    ...new Set(recipientUserIds.map(normalizedUuid)),
  ].sort()

  if (normalizedRecipientIds.length === 0) {
    throw new Error('ArtisTalks invitation selection is unavailable.')
  }

  return `${RECIPIENT_SET_PREFIX}${digest(
    `artistalks-selection:set:v1:${normalizedEventId}:${normalizedRecipientIds.join(
      ','
    )}`
  )}`
}

export function recipientSetDigestMatches(
  suppliedDigest: string,
  eventId: string,
  recipientUserIds: readonly string[]
): boolean {
  return suppliedDigestMatches(
    suppliedDigest,
    RECIPIENT_SET_PREFIX,
    () => deriveRecipientSetDigest(eventId, recipientUserIds)
  )
}

function canonicalEmailDigest(email: string | null): string {
  if (email === null) return 'missing'

  const normalized = email.trim().toLocaleLowerCase('en-US')
  if (!normalized || normalized.length > 320) {
    throw new Error('ArtisTalks invitation selection is unavailable.')
  }

  return digest(`artistalks-selection:recipient-email:v1:${normalized}`)
}

function canonicalSendReviewRecipient(
  recipient: InvitationSendReviewRecipient
) {
  const expiresAt = new Date(recipient.tokenExpiresAt)
  if (Number.isNaN(expiresAt.getTime())) {
    throw new Error('ArtisTalks invitation selection is unavailable.')
  }

  return {
    recipientUserId: normalizedUuid(recipient.recipientUserId),
    invitationId: normalizedUuid(recipient.invitationId),
    tokenExpiresAt: expiresAt.toISOString(),
    rsvpStatus: recipient.rsvpStatus,
    deliveryStatus: recipient.deliveryStatus,
    sendKeyState: recipient.sendKeyState,
    failureClassification: recipient.failureClassification,
    recipientEmailDigest: canonicalEmailDigest(recipient.recipientEmail),
    reviewState: recipient.reviewState,
  }
}

export function deriveSendReviewDigest(
  eventId: string,
  recipients: readonly InvitationSendReviewRecipient[]
): string {
  const normalizedEventId = normalizedUuid(eventId)
  const canonicalRecipients = recipients
    .map(canonicalSendReviewRecipient)
    .sort((a, b) => a.recipientUserId.localeCompare(b.recipientUserId))

  if (canonicalRecipients.length === 0) {
    throw new Error('ArtisTalks invitation selection is unavailable.')
  }

  const recipientIds = canonicalRecipients.map(
    (recipient) => recipient.recipientUserId
  )
  if (new Set(recipientIds).size !== recipientIds.length) {
    throw new Error('ArtisTalks invitation selection is unavailable.')
  }

  return `${SEND_REVIEW_PREFIX}${digest(
    `artistalks-selection:send-review:v1:${normalizedEventId}:${JSON.stringify(
      canonicalRecipients
    )}`
  )}`
}

export function sendReviewDigestMatches(
  suppliedDigest: string,
  eventId: string,
  recipients: readonly InvitationSendReviewRecipient[]
): boolean {
  return suppliedDigestMatches(
    suppliedDigest,
    SEND_REVIEW_PREFIX,
    () => deriveSendReviewDigest(eventId, recipients)
  )
}
