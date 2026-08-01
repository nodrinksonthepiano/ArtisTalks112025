import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { getPhaseCandidateKeys } from '@/lib/curriculum'
import { getDraftAnswerText, loadDraft } from '@/lib/draft'

export interface CurriculumProgress {
  preProgress: number
  proProgress: number
  postProgress: number
  loopProgress: number
  currentModule?: {
    id: string
    title: string
    content: string
    type: 'pre' | 'pro' | 'post' | 'loop'
  }
}

function computeProgressFromKeys(answeredKeysArray: string[]): Omit<CurriculumProgress, 'currentModule'> {
  const calculatePhaseProgress = (phase: 'pre' | 'prod' | 'post' | 'legacy'): number => {
    const candidateKeys = getPhaseCandidateKeys(phase)
    if (candidateKeys.length === 0) return 0
    const completedKeys = candidateKeys.filter((key) => answeredKeysArray.includes(key)).length
    return Math.round((completedKeys / candidateKeys.length) * 100)
  }

  return {
    preProgress: calculatePhaseProgress('pre'),
    proProgress: calculatePhaseProgress('prod'),
    postProgress: calculatePhaseProgress('post'),
    loopProgress: calculatePhaseProgress('legacy'),
  }
}

export function useCurriculumProgress(
  userId: string | null,
  answeredKeys?: Set<string>
): CurriculumProgress {
  const [progress, setProgress] = useState<CurriculumProgress>({
    preProgress: 0,
    proProgress: 0,
    postProgress: 0,
    loopProgress: 0,
  })
  const supabase = createClient()

  useEffect(() => {
    if (!userId) {
      const keys = answeredKeys ? Array.from(answeredKeys).filter((k) => k && k.length > 0) : []
      const phaseProgress = computeProgressFromKeys(keys)

      let currentModule: CurriculumProgress['currentModule'] | undefined
      if (keys.includes('gift_to_world')) {
        const giftText = getDraftAnswerText('gift_to_world')
        currentModule = {
          id: 'gift-to-world',
          title: 'Your Gift to the World',
          content: giftText,
          type: 'pre',
        }
      }

      setProgress({ ...phaseProgress, currentModule })
      return
    }

    async function loadProgress() {
      try {
        let answeredKeysArray: string[] = []
        let answers: any[] | null = null

        if (answeredKeys && answeredKeys.size > 0) {
          answeredKeysArray = Array.from(answeredKeys).filter((k) => k && k.length > 0)
          const { data: dbAnswers } = await supabase
            .from('curriculum_answers')
            .select('question_key, answer_data, created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
          answers = dbAnswers || null
        } else {
          const { data: dbAnswers, error } = await supabase
            .from('curriculum_answers')
            .select('question_key, answer_data, created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })

          if (error) {
            console.error('Error loading curriculum progress:', error)
            return
          }

          answers = dbAnswers || null
          answeredKeysArray = answers?.map((a) => a.question_key).filter((k) => k && k.length > 0) || []
        }

        const phaseProgress = computeProgressFromKeys(answeredKeysArray)

        let currentModule: CurriculumProgress['currentModule'] | undefined
        if (answeredKeysArray.includes('gift_to_world')) {
          let giftAnswer: any = null
          if (answers) {
            giftAnswer = answers.find((a: any) => a.question_key === 'gift_to_world')
          } else {
            const { data: giftData } = await supabase
              .from('curriculum_answers')
              .select('answer_data')
              .eq('user_id', userId)
              .eq('question_key', 'gift_to_world')
              .order('created_at', { ascending: false })
              .limit(1)
              .single()
            giftAnswer = giftData
          }
          const giftText = giftAnswer?.answer_data?.text || ''
          currentModule = {
            id: 'gift-to-world',
            title: 'Your Gift to the World',
            content: giftText,
            type: 'pre',
          }
        }

        setProgress({ ...phaseProgress, currentModule })
      } catch (err) {
        console.error('Error in useCurriculumProgress:', err)
      }
    }

    loadProgress()

    const channel = supabase
      .channel(`curriculum-progress-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'curriculum_answers',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          loadProgress()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, supabase, answeredKeys])

  return progress
}
