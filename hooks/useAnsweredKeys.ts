import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import { getDraftAnsweredKeys } from '@/lib/draft'

/**
 * Shared hook for tracking answered curriculum questions
 * Extracted from EmeraldChat.tsx for reuse in ArtisTalksOrbitRenderer
 */
export function useAnsweredKeys(
  userId: string | null
): [
  Set<string>,
  (updater: Set<string> | ((prev: Set<string>) => Set<string>)) => void,
  () => Promise<Set<string>>,
] {
  const [answeredKeys, setAnsweredKeysState] = useState<Set<string>>(new Set())
  const supabase = createClient()

  const setAnsweredKeys = useCallback(
    (updater: Set<string> | ((prev: Set<string>) => Set<string>)) => {
      setAnsweredKeysState((prev) =>
        typeof updater === 'function' ? updater(prev) : updater
      )
    },
    []
  )

  const reloadAnsweredKeys = useCallback(async (): Promise<Set<string>> => {
    if (!userId) {
      const draftKeys = getDraftAnsweredKeys()
      setAnsweredKeysState(draftKeys)
      return draftKeys
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        const empty = new Set<string>()
        setAnsweredKeysState(empty)
        return empty
      }

      const { data: answers, error } = await supabase
        .from('curriculum_answers')
        .select('question_key')
        .eq('user_id', user.id)

      if (error) {
        console.error('Error loading answered keys:', error)
        return new Set()
      }

      const keys = new Set(answers?.map((a) => a.question_key) || [])
      setAnsweredKeysState(keys)
      return keys
    } catch (err) {
      console.error('Error in reloadAnsweredKeys:', err)
      return new Set()
    }
  }, [userId, supabase])

  useEffect(() => {
    if (!userId) {
      setAnsweredKeysState(getDraftAnsweredKeys())
      return
    }

    void reloadAnsweredKeys()

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
          void reloadAnsweredKeys()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, supabase, reloadAnsweredKeys])

  return [answeredKeys, setAnsweredKeys, reloadAnsweredKeys]
}
