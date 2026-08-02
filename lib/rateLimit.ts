import { createHash } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getAuthRateLimitProfile } from '@/lib/rateLimitConfig'

export {
  getAuthRateLimitProfile,
  getResendCooldownSeconds,
} from '@/lib/rateLimitConfig'

const profile = () => getAuthRateLimitProfile()

/** @deprecated use getAuthRateLimitProfile() — kept as live getters for routes */
export const getClaimChallengeIpLimit = () => profile().ipClaimChallenge.limit
export const getClaimChallengeIpWindowSeconds = () =>
  profile().ipClaimChallenge.windowSeconds
export const getClaimSlugSendLimit = () => profile().slugSend.limit
export const getClaimSlugSendWindowSeconds = () => profile().slugSend.windowSeconds
export const getClaimSlugVerifyLimit = () => profile().slugVerify.limit
export const getClaimSlugVerifyWindowSeconds = () =>
  profile().slugVerify.windowSeconds
export const getClaimSlugResendLimit = () => profile().slugResendCooldown.limit
export const getClaimSlugResendWindowSeconds = () =>
  profile().slugResendCooldown.windowSeconds

/** Hash a client IP before it enters a durable rate-limit bucket. */
export function hashIp(ip: string): string {
  return createHash('sha256').update(ip).digest('hex')
}

export function ipBucket(hashedIp: string): string {
  return `ip:${hashedIp}`
}

export function slugSendBucket(slug: string): string {
  return `slug-send:${slug}`
}

export function slugResendBucket(slug: string): string {
  return `slug-resend:${slug}`
}

export function slugVerifyBucket(slug: string): string {
  return `slug-verify:${slug}`
}

/** Client IP from Vercel-trusted headers (production) with documented fallbacks. */
export function getRequestClientIp(headers: Headers): string {
  const vercel = headers.get('x-vercel-forwarded-for')
  const forwarded = headers.get('x-forwarded-for')
  const realIp = headers.get('x-real-ip')

  const fromVercel = vercel?.split(',')[0]?.trim()
  if (fromVercel) return fromVercel

  const fromForwarded = forwarded?.split(',')[0]?.trim()
  if (fromForwarded) return fromForwarded

  const fromReal = realIp?.trim()
  if (fromReal) return fromReal

  return 'unknown'
}

/**
 * Durable rate limit via private.auth_rate_limits RPC (service_role only).
 * Returns true if the request is allowed.
 */
export async function checkAuthRateLimit(
  admin: SupabaseClient,
  bucket: string,
  limit: number,
  windowSeconds: number
): Promise<boolean> {
  const { data, error } = await admin.rpc('check_auth_rate_limit', {
    p_bucket: bucket,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  })

  if (error) {
    throw new Error('rate_limit_unavailable')
  }

  return data === true
}
