'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import type { AnonymousDraft } from '@/lib/draft'
import {
  emptySanctuaryAnswers,
  SANCTUARY_ANSWER_KEYS,
  textFromAnswerData,
  type SanctuaryAnswers,
  type SanctuaryAnswerKey,
} from '@/lib/sanctuarySections'

function answersFromDraft(draft: AnonymousDraft | null): SanctuaryAnswers {
  const next = emptySanctuaryAnswers()
  if (!draft?.answers?.length) return next

  for (const answer of draft.answers) {
    if (!SANCTUARY_ANSWER_KEYS.includes(answer.question_key as SanctuaryAnswerKey)) {
      continue
    }
    const key = answer.question_key as SanctuaryAnswerKey
    next[key] = textFromAnswerData(answer.answer_data)
  }
  return next
}

function answersFromRows(
  rows: Array<{ question_key: string; answer_data: unknown }> | null | undefined
): SanctuaryAnswers {
  const next = emptySanctuaryAnswers()
  if (!rows?.length) return next

  for (const row of rows) {
    if (!SANCTUARY_ANSWER_KEYS.includes(row.question_key as SanctuaryAnswerKey)) {
      continue
    }
    const key = row.question_key as SanctuaryAnswerKey
    next[key] = textFromAnswerData(row.answer_data)
  }
  return next
}

/**
 * Dedicated read-only source for the six sanctuary keys.
 * Anonymous: local draft (updates when draft reference refreshes).
 * Logged-in: single curriculum_answers query + realtime refresh.
 */
export function useSanctuaryAnswers(
  userId: string | null,
  draft: AnonymousDraft | null
): SanctuaryAnswers {
  const [answers, setAnswers] = useState<SanctuaryAnswers>(emptySanctuaryAnswers)
  const supabase = createClient()

  const loadLoggedIn = useCallback(async () => {
    if (!userId) return

    const { data, error } = await supabase
      .from('curriculum_answers')
      .select('question_key, answer_data')
      .eq('user_id', userId)
      .in('question_key', [...SANCTUARY_ANSWER_KEYS])

    if (error) {
      console.error('sanctuary_answers_load_failed')
      return
    }

    setAnswers(answersFromRows(data))
  }, [userId, supabase])

  useEffect(() => {
    if (userId) return
    setAnswers(answersFromDraft(draft))
  }, [userId, draft])

  useEffect(() => {
    if (!userId) return

    void loadLoggedIn()

    const channel = supabase
      .channel(`sanctuary-answers-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'curriculum_answers',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void loadLoggedIn()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, supabase, loadLoggedIn])

  return answers
}
