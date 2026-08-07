'use client'

import { RotateCcw } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { clearDraft } from '@/lib/draft'
import { clearReturningClaimMarker } from '@/lib/returningClaim'

interface DataResetProps {
  isAnonymous?: boolean
}

export default function DataReset({ isAnonymous = false }: DataResetProps) {
  const supabase = createClient()

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
    <button
      onClick={handleReset}
      className="fixed top-4 right-4 flex items-center gap-2 px-3 py-1.5 bg-zinc-900/80 border border-zinc-800 hover:border-red-500/50 text-zinc-500 hover:text-red-400 text-xs font-mono uppercase tracking-widest rounded-full transition-all z-50 backdrop-blur-sm"
    >
      <RotateCcw size={12} />
      Data Reset
    </button>
  )
}
