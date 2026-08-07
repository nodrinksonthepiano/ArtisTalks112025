import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import type {
  OrbitApplicationRow,
  SixMonthReady,
} from '@/lib/orbitApplication'

type SaveBody = {
  phone?: unknown
  why_orbit?: unknown
  six_month_ready?: unknown
  submit?: unknown
}

function asTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function parseSixMonthReady(value: unknown): SixMonthReady | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  if (value === 'yes' || value === 'not_yet') return value
  return undefined
}

function validateForSubmit(
  phone: string,
  whyOrbit: string,
  sixMonthReady: SixMonthReady | null
): string | null {
  if (!phone) return 'Enter your best phone number.'
  if (!whyOrbit) {
    return 'Share why Orbit now, and what you want to accomplish over six months.'
  }
  if (sixMonthReady !== 'yes' && sixMonthReady !== 'not_yet') {
    return 'Choose Yes or Not yet for the six-month commitment question.'
  }
  return null
}

async function requireUser() {
  const supabase = await createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return {
      supabase,
      user: null,
      errorResponse: NextResponse.json(
        { error: 'Authentication required.' },
        { status: 401 }
      ),
    }
  }

  return { supabase, user, errorResponse: null }
}

export async function GET() {
  const { supabase, user, errorResponse } = await requireUser()
  if (errorResponse || !user) return errorResponse!

  const { data, error } = await supabase
    .from('orbit_applications')
    .select(
      'id, user_id, phone, why_orbit, six_month_ready, status, created_at, updated_at, submitted_at'
    )
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) {
    console.error('orbit_application_get_failed', error.message)
    return NextResponse.json(
      { error: 'Unable to load Orbit application.' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    application: (data as OrbitApplicationRow | null) ?? null,
  })
}

export async function POST(request: Request) {
  const { supabase, user, errorResponse } = await requireUser()
  if (errorResponse || !user) return errorResponse!

  let body: SaveBody
  try {
    body = (await request.json()) as SaveBody
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const phoneProvided = body.phone !== undefined
  const whyProvided = body.why_orbit !== undefined
  const readyProvided = body.six_month_ready !== undefined
  const submit = body.submit === true

  const parsedReady = parseSixMonthReady(body.six_month_ready)
  if (readyProvided && parsedReady === undefined) {
    return NextResponse.json(
      { error: 'Choose Yes or Not yet for the six-month commitment question.' },
      { status: 400 }
    )
  }

  const { data: existing, error: existingError } = await supabase
    .from('orbit_applications')
    .select(
      'id, user_id, phone, why_orbit, six_month_ready, status, created_at, updated_at, submitted_at'
    )
    .eq('user_id', user.id)
    .maybeSingle()

  if (existingError) {
    console.error('orbit_application_lookup_failed', existingError.message)
    return NextResponse.json(
      { error: 'Unable to save Orbit application.' },
      { status: 500 }
    )
  }

  if (existing && existing.status !== 'draft') {
    return NextResponse.json(
      { error: 'This Orbit application is read-only.' },
      { status: 403 }
    )
  }

  const phone = phoneProvided
    ? asTrimmedString(body.phone)
    : (existing?.phone ?? '')
  const whyOrbit = whyProvided
    ? asTrimmedString(body.why_orbit)
    : (existing?.why_orbit ?? '')
  const readyValue: SixMonthReady | null = readyProvided
    ? (parsedReady as SixMonthReady | null)
    : ((existing?.six_month_ready as SixMonthReady | null | undefined) ?? null)

  if (submit) {
    const submitError = validateForSubmit(phone, whyOrbit, readyValue)
    if (submitError) {
      return NextResponse.json({ error: submitError }, { status: 400 })
    }
  }

  const draftFields = {
    phone,
    why_orbit: whyOrbit,
    six_month_ready: readyValue,
  }

  let draftRow: OrbitApplicationRow

  if (!existing) {
    const { data: inserted, error: insertError } = await supabase
      .from('orbit_applications')
      .insert({
        user_id: user.id,
        ...draftFields,
        status: 'draft',
      })
      .select(
        'id, user_id, phone, why_orbit, six_month_ready, status, created_at, updated_at, submitted_at'
      )
      .single()

    if (insertError || !inserted) {
      console.error('orbit_application_insert_failed', insertError?.message)
      return NextResponse.json(
        { error: 'Unable to save Orbit application.' },
        { status: 500 }
      )
    }

    draftRow = inserted as OrbitApplicationRow
  } else {
    const { data: updatedDraft, error: updateError } = await supabase
      .from('orbit_applications')
      .update({
        ...draftFields,
        status: 'draft',
      })
      .eq('id', existing.id)
      .eq('user_id', user.id)
      .eq('status', 'draft')
      .select(
        'id, user_id, phone, why_orbit, six_month_ready, status, created_at, updated_at, submitted_at'
      )
      .maybeSingle()

    if (updateError) {
      console.error('orbit_application_update_failed', updateError.message)
      return NextResponse.json(
        { error: 'Unable to save Orbit application.' },
        { status: 500 }
      )
    }

    if (!updatedDraft) {
      return NextResponse.json(
        { error: 'This Orbit application is read-only.' },
        { status: 403 }
      )
    }

    draftRow = updatedDraft as OrbitApplicationRow
  }

  if (!submit) {
    return NextResponse.json({ application: draftRow })
  }

  const { data: submitted, error: submitError } = await supabase
    .from('orbit_applications')
    .update({ status: 'submitted' })
    .eq('id', draftRow.id)
    .eq('user_id', user.id)
    .eq('status', 'draft')
    .select(
      'id, user_id, phone, why_orbit, six_month_ready, status, created_at, updated_at, submitted_at'
    )
    .maybeSingle()

  if (submitError) {
    console.error('orbit_application_submit_failed', submitError.message)
    return NextResponse.json(
      { error: 'Unable to submit Orbit application.' },
      { status: 500 }
    )
  }

  if (!submitted) {
    return NextResponse.json(
      { error: 'This Orbit application is read-only.' },
      { status: 403 }
    )
  }

  return NextResponse.json({
    application: submitted as OrbitApplicationRow,
  })
}
