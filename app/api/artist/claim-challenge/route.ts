import { NextRequest, NextResponse } from 'next/server'
import { normalizeArtistNameSlug } from '@/lib/artistName'
import {
  checkAuthRateLimit,
  getClaimChallengeIpLimit,
  getClaimChallengeIpWindowSeconds,
  getClaimSlugResendLimit,
  getClaimSlugResendWindowSeconds,
  getClaimSlugSendLimit,
  getClaimSlugSendWindowSeconds,
  getRequestClientIp,
  hashIp,
  ipBucket,
  slugResendBucket,
  slugSendBucket,
} from '@/lib/rateLimit'
import { createAdminClient } from '@/utils/supabase/admin'

export const dynamic = 'force-dynamic'

function noStoreJson(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
    },
  })
}

export async function POST(request: NextRequest) {
  try {
    const admin = createAdminClient()

    // 1. IP rate limit before any profile lookup
    const hashedIp = hashIp(getRequestClientIp(request.headers))
    const ipAllowed = await checkAuthRateLimit(
      admin,
      ipBucket(hashedIp),
      getClaimChallengeIpLimit(),
      getClaimChallengeIpWindowSeconds()
    )
    if (!ipAllowed) {
      return noStoreJson({ error: 'Too many attempts. Try again later.' }, 429)
    }

    // 2. Validate + normalize artist name
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return noStoreJson({ error: 'Invalid artist name' }, 400)
    }

    const artistName =
      typeof body === 'object' &&
      body !== null &&
      'artist_name' in body &&
      typeof (body as { artist_name: unknown }).artist_name === 'string'
        ? (body as { artist_name: string }).artist_name
        : null

    const slug = artistName ? normalizeArtistNameSlug(artistName) : null
    if (!slug) {
      return noStoreJson({ error: 'Invalid artist name' }, 400)
    }

    // 3. Lookup by generated artist_name_slug (id only for private auth resolve)
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('id')
      .eq('artist_name_slug', slug)
      .maybeSingle()

    if (profileError) {
      console.error('claim_challenge_lookup_failed')
      return noStoreJson({ error: 'Unable to send code' }, 503)
    }

    // 4. Unclaimed
    if (!profile?.id) {
      return noStoreJson({ claimed: false })
    }

    // 5. Claimed — send window + durable resend cooldown, then private OTP send
    const sendAllowed = await checkAuthRateLimit(
      admin,
      slugSendBucket(slug),
      getClaimSlugSendLimit(),
      getClaimSlugSendWindowSeconds()
    )
    if (!sendAllowed) {
      return noStoreJson({ error: 'Too many attempts. Try again later.' }, 429)
    }

    const resendAllowed = await checkAuthRateLimit(
      admin,
      slugResendBucket(slug),
      getClaimSlugResendLimit(),
      getClaimSlugResendWindowSeconds()
    )
    if (!resendAllowed) {
      return noStoreJson({ error: 'Please wait before requesting another code.' }, 429)
    }

    const { data: authData, error: authLookupError } =
      await admin.auth.admin.getUserById(profile.id)

    if (authLookupError || !authData?.user?.email) {
      console.error('claim_challenge_send_failed')
      return noStoreJson({ error: 'Unable to send code' }, 503)
    }

    const email = authData.user.email

    const { error: otpError } = await admin.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
      },
    })

    if (otpError) {
      console.error('claim_challenge_send_failed')
      return noStoreJson({ error: 'Unable to send code' }, 503)
    }

    return noStoreJson({ claimed: true, sent: true })
  } catch {
    console.error('claim_challenge_failed')
    return noStoreJson({ error: 'Unable to send code' }, 503)
  }
}
