/**
 * Non-sensitive session marker: this login is a returning claimed-name verify,
 * so establishSession must skip anonymous draft migration.
 */
export const RETURNING_CLAIM_MARKER_KEY = 'artistalks_returning_claim_v1'

export function setReturningClaimMarker(): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(RETURNING_CLAIM_MARKER_KEY, '1')
  } catch {
    // ignore quota / private mode
  }
}

export function hasReturningClaimMarker(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return sessionStorage.getItem(RETURNING_CLAIM_MARKER_KEY) === '1'
  } catch {
    return false
  }
}

export function clearReturningClaimMarker(): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(RETURNING_CLAIM_MARKER_KEY)
  } catch {
    // ignore
  }
}
