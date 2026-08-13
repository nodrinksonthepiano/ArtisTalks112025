import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('saas_subscription_status')
    .eq('id', user.id)
    .maybeSingle()

  if (error) {
    console.error('saas_status_failed', error.message)
    return NextResponse.json({ error: 'Unable to load status.' }, { status: 500 })
  }

  return NextResponse.json({
    saas_subscription_status: data?.saas_subscription_status ?? 'inactive',
  })
}
