import { NextResponse } from 'next/server'
import { grantsSaasCurriculumAccess } from '@/lib/saasEntitlement'
import { getPaypalPlanArtistalks8Monthly } from '@/lib/paypal'
import { getOrCreatePendingSaasPaypalAttempt } from '@/lib/saasPaypalDb'
import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'

export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }

  let planId: string
  try {
    planId = getPaypalPlanArtistalks8Monthly()
  } catch {
    return NextResponse.json(
      { error: 'PayPal checkout is not available yet.' },
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
    console.error('saas_paypal_prepare_profile_failed', profileError.message)
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
    const attempt = await getOrCreatePendingSaasPaypalAttempt(admin, user.id)
    return NextResponse.json({
      attemptId: attempt.id,
      planId,
    })
  } catch (err) {
    console.error(
      'saas_paypal_prepare_failed',
      err instanceof Error ? err.message : err
    )
    return NextResponse.json(
      { error: 'Unable to start checkout.' },
      { status: 500 }
    )
  }
}
