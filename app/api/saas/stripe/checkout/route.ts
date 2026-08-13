import { NextResponse } from 'next/server'
import { grantsSaasCurriculumAccess } from '@/lib/saasEntitlement'
import {
  findSaasStripeSubscriptionByUser,
  isBlockingStripeProviderStatus,
} from '@/lib/saasStripeDb'
import { getStripe, getStripePriceArtistalks8Monthly } from '@/lib/stripe'
import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }

  let body: { idempotencyKey?: unknown } = {}
  try {
    body = (await request.json()) as { idempotencyKey?: unknown }
  } catch {
    body = {}
  }

  const idempotencyKey =
    typeof body.idempotencyKey === 'string' && body.idempotencyKey.trim()
      ? body.idempotencyKey.trim().slice(0, 255)
      : null
  if (!idempotencyKey) {
    return NextResponse.json(
      { error: 'Unable to start checkout.' },
      { status: 400 }
    )
  }

  let priceId: string
  let stripe
  try {
    priceId = getStripePriceArtistalks8Monthly()
    stripe = getStripe()
  } catch {
    return NextResponse.json(
      { error: 'Card checkout is not available yet.' },
      { status: 503 }
    )
  }

  const admin = createAdminClient()

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('saas_subscription_status')
    .eq('id', user.id)
    .maybeSingle()
  if (profileError) {
    console.error('saas_stripe_checkout_profile_failed', profileError.message)
    return NextResponse.json({ error: 'Unable to start checkout.' }, { status: 500 })
  }

  if (grantsSaasCurriculumAccess(profile?.saas_subscription_status)) {
    return NextResponse.json(
      {
        already_entitled: true,
        saas_subscription_status: profile?.saas_subscription_status,
      },
      { status: 409 }
    )
  }

  try {
    const existing = await findSaasStripeSubscriptionByUser(admin, user.id)
    if (
      existing &&
      isBlockingStripeProviderStatus(existing.provider_status)
    ) {
      return NextResponse.json(
        { error: 'A subscription is already in progress.' },
        { status: 409 }
      )
    }

    const origin = new URL(request.url).origin
    // ui_mode 'custom' = Checkout Sessions + Payment Element (own layout).
    // Card-only for this slice; return_url is a safety net for rare auth redirects —
    // it never grants access (webhook + /api/saas/status do).
    const session = await stripe.checkout.sessions.create(
      {
        ui_mode: 'elements',
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [{ price: priceId, quantity: 1 }],
        return_url: `${origin}/?saas_return=1`,
        client_reference_id: user.id,
        customer: existing?.provider_customer_id || undefined,
        customer_email: existing?.provider_customer_id
          ? undefined
          : user.email || undefined,
        metadata: {
          supabase_user_id: user.id,
          plan_key: 'artistalks_8_monthly',
        },
        subscription_data: {
          metadata: {
            supabase_user_id: user.id,
            plan_key: 'artistalks_8_monthly',
          },
        },
      },
      { idempotencyKey }
    )

    if (!session.client_secret) {
      return NextResponse.json(
        { error: 'Unable to start checkout.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ clientSecret: session.client_secret })
  } catch (err) {
    console.error(
      'saas_stripe_checkout_failed',
      err instanceof Error ? err.message : err
    )
    return NextResponse.json(
      { error: 'Unable to start checkout.' },
      { status: 500 }
    )
  }
}
