'use client'

import { RotateCcw } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { clearDraft } from '@/lib/draft'

interface DataResetProps {
  isAnonymous?: boolean
}

export default function DataReset({ isAnonymous = false }: DataResetProps) {
  const supabase = createClient()

  async function handleReset() {
    try {
      if (isAnonymous) {
        clearDraft()
        window.location.href = '/'
        return
      }

      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        const { error: deleteError } = await supabase
          .from('curriculum_answers')
          .delete()
          .eq('user_id', user.id)

        if (deleteError) {
          console.error('Error deleting curriculum answers:', deleteError)
        }
      }

      await supabase.auth.signOut()

      if (typeof window !== 'undefined') {
        localStorage.clear()
      }

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
