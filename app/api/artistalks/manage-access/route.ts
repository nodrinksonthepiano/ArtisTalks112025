import { NextResponse } from 'next/server'
import { requireJaiAdmin } from '@/utils/supabase/requireJaiAdmin'

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store',
}

export const dynamic = 'force-dynamic'

export async function GET() {
  const authorization = await requireJaiAdmin()

  if (!authorization.ok) {
    return new NextResponse(null, {
      status: 404,
      headers: NO_STORE_HEADERS,
    })
  }

  return NextResponse.json(
    { allowed: true },
    {
      headers: NO_STORE_HEADERS,
    }
  )
}
