import { clearDraft } from '@/lib/draft'
import { clearReturningClaimMarker } from '@/lib/returningClaim'

export const DATA_RESET_EVENT = 'artistalks-data-reset'

/** Clear all anonymous local session markers (draft + returning-claim). */
export function resetAnonymousLocalState(): void {
  clearDraft()
  clearReturningClaimMarker()
}

export function dispatchDataReset(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(DATA_RESET_EVENT))
}

/** Hard navigation after reset — cache-bust so mobile browsers don't restore stale form state. */
export function navigateHomeAfterReset(): void {
  if (typeof window === 'undefined') return
  window.location.replace(`/?r=${Date.now()}`)
}
