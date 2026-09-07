export type SaasSubscriptionStatus =
  | 'inactive'
  | 'active'
  | 'past_due'
  | 'comped'

export const SAAS_PLAN_KEY_8_MONTHLY = 'artistalks_8_monthly'

/** DIY curriculum access — past_due retains access until Jai sets inactive. */
export function grantsSaasCurriculumAccess(
  status: string | null | undefined
): boolean {
  return status === 'active' || status === 'past_due' || status === 'comped'
}

/**
 * Apply a Stripe-driven profile status without overwriting comped.
 * Returns the status that should remain on the profile.
 */
export function resolveStripeProfileStatusUpdate(
  current: string | null | undefined,
  next: 'active' | 'past_due'
): 'active' | 'past_due' | 'comped' | null {
  if (current === 'comped') return null
  if (next === 'past_due' && current !== 'active') return null
  return next
}
