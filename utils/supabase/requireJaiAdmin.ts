import 'server-only'

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'

type RequireJaiAdminResult =
  | {
      ok: true
      admin: ReturnType<typeof createAdminClient>
      userId: string
    }
  | {
      ok: false
      response: NextResponse
    }

function authorizationFailure(
  error: 'Authentication required.' | 'Forbidden.',
  status: 401 | 403
): RequireJaiAdminResult {
  return {
    ok: false,
    response: NextResponse.json(
      { error },
      {
        status,
        headers: { 'Cache-Control': 'no-store' },
      }
    ),
  }
}

export async function requireJaiAdmin(): Promise<RequireJaiAdminResult> {
  const supabase = await createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return authorizationFailure('Authentication required.', 401)
  }

  const jaiUserId = process.env.ARTISTALKS_JAI_USER_ID
  if (!jaiUserId || user.id !== jaiUserId) {
    return authorizationFailure('Forbidden.', 403)
  }

  const admin = createAdminClient()

  return {
    ok: true,
    admin,
    userId: user.id,
  }
}
