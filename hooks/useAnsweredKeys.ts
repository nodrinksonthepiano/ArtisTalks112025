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
  boolean,
] {
  const [answeredKeys, setAnsweredKeysState] = useState<Set<string>>(new Set())
  const [ready, setReady] = useState(!userId)
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
      setReady(true)
      return draftKeys
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        const empty = new Set<string>()
        setAnsweredKeysState(empty)
        setReady(true)
        return empty
      }

      const { data: answers, error } = await supabase
        .from('curriculum_answers')
        .select('question_key')
        .eq('user_id', user.id)

      if (error) {
        console.error('Error loading answered keys:', error)
        setReady(true)
        return new Set()
      }

      const keys = new Set(answers?.map((a) => a.question_key) || [])
      setAnsweredKeysState(keys)
      setReady(true)
      return keys
    } catch (err) {
      console.error('Error in reloadAnsweredKeys:', err)
      setReady(true)
      return new Set()
    }
  }, [userId, supabase])

  useEffect(() => {
    if (!userId) {
      setAnsweredKeysState(getDraftAnsweredKeys())
      setReady(true)
      return
    }

    setReady(false)
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

  return [answeredKeys, setAnsweredKeys, reloadAnsweredKeys, ready]
}
