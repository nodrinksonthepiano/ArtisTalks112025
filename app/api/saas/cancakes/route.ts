import { NextResponse } from 'next/server'
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

  const expectedAccessWord = process.env.SAAS_ACCESS_WORD
  if (!expectedAccessWord) {
    return NextResponse.json(
      { error: 'Access is not available yet.' },
      { status: 503 }
    )
  }

  let body: { accessWord?: unknown; amount?: unknown }
  try {
    body = (await request.json()) as { accessWord?: unknown; amount?: unknown }
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const typedAccessWord =
    typeof body.accessWord === 'string' ? body.accessWord.trim() : ''
  if (!typedAccessWord || typedAccessWord !== expectedAccessWord) {
    return NextResponse.json({ error: 'Unable to continue.' }, { status: 403 })
  }

  const amountProvided =
    Object.prototype.hasOwnProperty.call(body, 'amount') &&
    body.amount !== undefined &&
    body.amount !== null &&
    body.amount !== ''

  // Word-only recognition — no activation until amount is submitted.
  if (!amountProvided) {
    return NextResponse.json({ recognized: true })
  }

  const amount =
    typeof body.amount === 'number'
      ? body.amount
      : typeof body.amount === 'string'
        ? Number(body.amount)
        : Number.NaN

  if (!Number.isFinite(amount) || amount !== 0) {
    return NextResponse.json(
      { error: 'That amount is not available for this path yet.' },
      { status: 400 }
    )
  }

  const admin = createAdminClient()
  const { data: updatedProfile, error: updateError } = await admin
    .from('profiles')
    .update({ saas_subscription_status: 'comped' })
    .eq('id', user.id)
    .select('saas_subscription_status')
    .maybeSingle()

  if (updateError) {
    console.error('cancakes_comp_update_failed', updateError.message)
    return NextResponse.json({ error: 'Unable to continue.' }, { status: 500 })
  }

  if (!updatedProfile) {
    const { data: insertedProfile, error: insertError } = await admin
      .from('profiles')
      .upsert({
        id: user.id,
        email: user.email ?? null,
        artist_name: null,
        mission_statement: null,
        saas_subscription_status: 'comped',
      })
      .select('saas_subscription_status')
      .single()

    if (insertError) {
      console.error('cancakes_comp_insert_failed', insertError.message)
      return NextResponse.json({ error: 'Unable to continue.' }, { status: 500 })
    }

    return NextResponse.json({
      saas_subscription_status: insertedProfile.saas_subscription_status,
    })
  }

  return NextResponse.json({
    saas_subscription_status: updatedProfile.saas_subscription_status,
  })
}
