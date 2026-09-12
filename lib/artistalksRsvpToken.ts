import 'server-only'

import { createHash, createHmac } from 'crypto'

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const TOKEN_VERSION = 'artistalks-rsvp:v1'
const MINIMUM_SECRET_BYTES = 32

function requireRsvpTokenSecret(): string {
  const secret = process.env.ARTISTALKS_RSVP_TOKEN_SECRET

  if (!secret || Buffer.byteLength(secret, 'utf8') < MINIMUM_SECRET_BYTES) {
    throw new Error('RSVP token configuration unavailable.')
  }

  return secret
}

function canonicalExpiry(expiresAt: string | Date): string {
  const expiry = expiresAt instanceof Date ? expiresAt : new Date(expiresAt)

  if (Number.isNaN(expiry.getTime())) {
    throw new Error('Invalid RSVP token expiry.')
  }

  return expiry.toISOString()
}

export function deriveArtistTalksRsvpToken(
  invitationId: string,
  expiresAt: string | Date
): string {
  if (!UUID_V4_PATTERN.test(invitationId)) {
    throw new Error('Invalid invitation identity.')
  }

  const payload = `${TOKEN_VERSION}:${invitationId.toLowerCase()}:${canonicalExpiry(expiresAt)}`

  return createHmac('sha256', requireRsvpTokenSecret())
    .update(payload)
    .digest('base64url')
}

export function hashArtistTalksRsvpToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex')
}

export function deriveArtistTalksRsvpTokenHash(
  invitationId: string,
  expiresAt: string | Date
): string {
  const rawToken = deriveArtistTalksRsvpToken(invitationId, expiresAt)
  return hashArtistTalksRsvpToken(rawToken)
}
