import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'

/**
 * Shared hook for tracking answered curriculum questions
 * Extracted from EmeraldChat.tsx for reuse in ArtisTalksOrbitRenderer
 * 
 * Returns [answeredKeys, setAnsweredKeys] tuple for optimistic updates
 */
export function useAnsweredKeys(userId: string | null): [Set<string>, (updater: Set<string> | ((prev: Set<string>) => Set<string>)) => void] {
  const [answeredKeys, setAnsweredKeys] = useState<Set<string>>(new Set())
  const supabase = createClient()

  useEffect(() => {
    if (!userId) {
      setAnsweredKeys(new Set())
      return
    }

    async function loadAnsweredKeys() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          setAnsweredKeys(new Set())
          return
        }
        
        const { data: answers, error } = await supabase
          .from('curriculum_answers')
          .select('question_key')
          .eq('user_id', user.id)
        
        if (error) {
          console.error('Error loading answered keys:', error)
          return
        }
        
        const keys = new Set(answers?.map(a => a.question_key) || [])
        setAnsweredKeys(keys)
      } catch (err) {
        console.error('Error in loadAnsweredKeys:', err)
      }
    }
    
    loadAnsweredKeys()
    
    // Subscribe to changes
    const channel = supabase
      .channel('answered-keys')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'curriculum_answers',
        },
        () => {
          loadAnsweredKeys()
        }
      )
      .subscribe()
    
    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, supabase])

  // Return both state and setter for optimistic updates
  return [answeredKeys, setAnsweredKeys]
}

