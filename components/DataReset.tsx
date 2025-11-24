'use client'

import { RotateCcw } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'

export default function DataReset() {
  const supabase = createClient()

  async function handleReset() {
    // 1. Sign out from Supabase (kills session)
    await supabase.auth.signOut()

    // 2. Clear local storage
    // TODO: Future refinement - only clear keys starting with 'artistalks_' 
    // once we have other features sharing this origin.
    if (typeof window !== 'undefined') {
      localStorage.clear()
    }

    // 3. Hard reload to ensure fresh state
    window.location.href = '/'
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


