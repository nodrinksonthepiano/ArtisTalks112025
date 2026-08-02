import { NextRequest, NextResponse } from 'next/server'
import { normalizeArtistNameSlug } from '@/lib/artistName'
import {
  checkAuthRateLimit,
  getClaimChallengeIpLimit,
  getClaimChallengeIpWindowSeconds,
  getClaimSlugVerifyLimit,
  getClaimSlugVerifyWindowSeconds,
  getRequestClientIp,
  hashIp,
  ipBucket,
  slugVerifyBucket,
} from '@/lib/rateLimit'
import { createAdminClient } from '@/utils/supabase/admin'
import { createClient as createServerClient } from '@/utils/supabase/server'

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

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return noStoreJson({ error: 'Invalid request' }, 400)
    }

    const artistName =
      typeof body === 'object' &&
      body !== null &&
      'artist_name' in body &&
      typeof (body as { artist_name: unknown }).artist_name === 'string'
        ? (body as { artist_name: string }).artist_name
        : null

    const token =
      typeof body === 'object' &&
      body !== null &&
      'token' in body &&
      typeof (body as { token: unknown }).token === 'string'
        ? (body as { token: string }).token.trim()
        : ''

    const slug = artistName ? normalizeArtistNameSlug(artistName) : null
    if (!slug || !/^\d{6}$/.test(token)) {
      return noStoreJson({ error: 'Invalid request' }, 400)
    }

    const verifyAllowed = await checkAuthRateLimit(
      admin,
      slugVerifyBucket(slug),
      getClaimSlugVerifyLimit(),
      getClaimSlugVerifyWindowSeconds()
    )
    if (!verifyAllowed) {
      return noStoreJson({ error: 'Too many attempts. Try again later.' }, 429)
    }

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('id')
      .eq('artist_name_slug', slug)
      .maybeSingle()

    if (profileError || !profile?.id) {
      console.error('verify_otp_lookup_failed')
      return noStoreJson({ error: 'Unable to verify code' }, 503)
    }

    const { data: authData, error: authLookupError } =
      await admin.auth.admin.getUserById(profile.id)

    if (authLookupError || !authData?.user?.email) {
      console.error('verify_otp_resolve_failed')
      return noStoreJson({ error: 'Unable to verify code' }, 503)
    }

    const email = authData.user.email
    const supabase = await createServerClient()
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email',
    })

    if (verifyError) {
      console.error('verify_otp_failed')
      return noStoreJson({ error: 'Invalid code' }, 401)
    }

    return noStoreJson({ verified: true })
  } catch {
    console.error('verify_otp_failed')
    return noStoreJson({ error: 'Unable to verify code' }, 503)
  }
}
