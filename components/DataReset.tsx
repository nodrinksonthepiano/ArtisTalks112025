'use client'

import { RotateCcw } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'

export default function DataReset() {
  const supabase = createClient()

  async function handleReset() {
    try {
      // 1. Get current user before signing out
      const { data: { user } } = await supabase.auth.getUser()
      
      // 2. Delete ALL curriculum_answers for this user (complete reset)
      if (user) {
        const { error: deleteError } = await supabase
          .from('curriculum_answers')
          .delete()
          .eq('user_id', user.id)
        
        if (deleteError) {
          console.error('Error deleting curriculum answers:', deleteError)
        }
      }
      
      // 3. Sign out from Supabase (kills session)
      await supabase.auth.signOut()

      // 4. Clear local storage
      if (typeof window !== 'undefined') {
        localStorage.clear()
      }

      // 5. Hard reload to ensure fresh state
      window.location.href = '/'
    } catch (error) {
      console.error('Error during data reset:', error)
      // Still reload even if there's an error
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


