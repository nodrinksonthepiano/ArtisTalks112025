import 'server-only'

import { createHmac, timingSafeEqual } from 'crypto'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const HANDLE_DIGEST_PATTERN = /^[A-Za-z0-9_-]{43}$/

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
  if (!handle.startsWith(prefix)) return false

  const suppliedDigest = handle.slice(prefix.length)
  if (!HANDLE_DIGEST_PATTERN.test(suppliedDigest)) return false

  let expectedHandle: string
  try {
    expectedHandle = deriveSelectionHandle(domain, id)
  } catch {
    return false
  }

  const expectedDigest = expectedHandle.slice(prefix.length)
  return timingSafeEqual(
    Buffer.from(suppliedDigest, 'utf8'),
    Buffer.from(expectedDigest, 'utf8')
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

  return `set_v1.${digest(
    `artistalks-selection:set:v1:${normalizedEventId}:${normalizedRecipientIds.join(
      ','
    )}`
  )}`
}
