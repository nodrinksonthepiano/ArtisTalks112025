/**
 * Centralized auth rate-limit profiles.
 * Safe for server and client (UI cooldown mirrors server; server RPC is authoritative).
 * No bypass — durable Supabase limiter always runs.
 */

export type AuthRateLimitProfile = {
  ipClaimChallenge: { limit: number; windowSeconds: number }
  slugSend: { limit: number; windowSeconds: number }
  slugVerify: { limit: number; windowSeconds: number }
  /** limit 1 = one send per cooldown window */
  slugResendCooldown: { limit: number; windowSeconds: number }
}

const PRODUCTION_PROFILE: AuthRateLimitProfile = {
  ipClaimChallenge: { limit: 20, windowSeconds: 10 * 60 },
  slugSend: { limit: 3, windowSeconds: 15 * 60 },
  slugVerify: { limit: 10, windowSeconds: 15 * 60 },
  slugResendCooldown: { limit: 1, windowSeconds: 60 },
}

const DEVELOPMENT_PROFILE: AuthRateLimitProfile = {
  ipClaimChallenge: { limit: 200, windowSeconds: 10 * 60 },
  slugSend: { limit: 20, windowSeconds: 15 * 60 },
  slugVerify: { limit: 50, windowSeconds: 15 * 60 },
  slugResendCooldown: { limit: 1, windowSeconds: 15 },
}

export function getAuthRateLimitProfile(): AuthRateLimitProfile {
  return process.env.NODE_ENV === 'development'
    ? DEVELOPMENT_PROFILE
    : PRODUCTION_PROFILE
}

export function getResendCooldownSeconds(): number {
  return getAuthRateLimitProfile().slugResendCooldown.windowSeconds
}
