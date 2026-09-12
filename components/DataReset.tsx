'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CalendarPlus, RotateCcw } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { clearDraft } from '@/lib/draft'
import { clearReturningClaimMarker } from '@/lib/returningClaim'

interface DataResetProps {
  isAnonymous?: boolean
}

export default function DataReset({ isAnonymous = false }: DataResetProps) {
  const supabase = createClient()
  const [canManageEvents, setCanManageEvents] = useState(false)

  useEffect(() => {
    if (isAnonymous) return

    let active = true

    void fetch('/api/artistalks/manage-access', {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
    })
      .then(async (response) => {
        if (!response.ok) return false

        const result: unknown = await response.json()
        return (
          typeof result === 'object' &&
          result !== null &&
          'allowed' in result &&
          result.allowed === true
        )
      })
      .then((allowed) => {
        if (active) setCanManageEvents(allowed)
      })
      .catch(() => {
        if (active) setCanManageEvents(false)
      })

    return () => {
      active = false
    }
  }, [isAnonymous])

  async function handleReset() {
    try {
      if (isAnonymous) {
        // Local unsaved free taste only — nothing durable exists yet.
        clearDraft()
        clearReturningClaimMarker()
        window.location.href = '/'
        return
      }

      // Authenticated: Zeyoda-style exit — sign out and clear temporary
      // session markers. Never delete profiles, curriculum_answers, or uploads.
      clearReturningClaimMarker()
      await supabase.auth.signOut()
      window.location.href = '/'
    } catch (error) {
      console.error('Error during data reset:', error)
      window.location.href = '/'
    }
  }

  return (
    <div className="fixed top-4 right-4 z-50 flex max-w-[calc(100vw-2rem)] items-center justify-end gap-2">
      {!isAnonymous && canManageEvents ? (
        <Link
          aria-label="Create a new ArtisTalks event"
          className="flex min-h-11 items-center gap-2 whitespace-nowrap rounded-full border border-emerald-500/50 bg-zinc-900/80 px-3 py-1.5 font-mono text-xs uppercase tracking-widest text-emerald-300 backdrop-blur-sm transition-all hover:border-emerald-300 hover:text-emerald-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
          href="/manage/events/new"
          prefetch={false}
        >
          <CalendarPlus aria-hidden="true" size={12} />
          New Event
        </Link>
      ) : null}
      <button
        className="flex min-h-11 items-center gap-2 whitespace-nowrap rounded-full border border-zinc-800 bg-zinc-900/80 px-3 py-1.5 font-mono text-xs uppercase tracking-widest text-zinc-500 backdrop-blur-sm transition-all hover:border-red-500/50 hover:text-red-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400"
        onClick={handleReset}
        type="button"
      >
        <RotateCcw aria-hidden="true" size={12} />
        Data Reset
      </button>
    </div>
  )
}
