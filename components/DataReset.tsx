'use client'

import { RotateCcw } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import {
  dispatchDataReset,
  navigateHomeAfterReset,
  resetAnonymousLocalState,
} from '@/lib/sessionReset'

interface DataResetProps {
  isAnonymous?: boolean
}

export default function DataReset({ isAnonymous = false }: DataResetProps) {
  const supabase = createClient()

  async function handleReset() {
    try {
      resetAnonymousLocalState()
      dispatchDataReset()

      if (isAnonymous) {
        // Let listeners clear in-memory UI before navigation (mobile bfcache safety).
        await new Promise((resolve) => setTimeout(resolve, 0))
        navigateHomeAfterReset()
        return
      }

      // Authenticated: sign out and clear temporary session markers.
      // Never delete profiles, curriculum_answers, or uploads.
      await supabase.auth.signOut()
      await new Promise((resolve) => setTimeout(resolve, 0))
      navigateHomeAfterReset()
    } catch (error) {
      console.error('Error during data reset:', error)
      navigateHomeAfterReset()
    }
  }

  return (
    <button
      onClick={() => void handleReset()}
      className="fixed top-4 right-4 flex items-center gap-2 px-3 py-1.5 bg-zinc-900/80 border border-zinc-800 hover:border-red-500/50 text-zinc-500 hover:text-red-400 text-xs font-mono uppercase tracking-widest rounded-full transition-all z-50 backdrop-blur-sm"
    >
      <RotateCcw size={12} />
      Data Reset
    </button>
  )
}
