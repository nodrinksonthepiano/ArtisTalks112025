import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { CURRICULUM } from '@/lib/curriculum'

export interface CurriculumProgress {
  preProgress: number    // 0-100 (calculated dynamically from curriculum)
  proProgress: number    // 0-100 (calculated dynamically from curriculum)
  postProgress: number   // 0-100 (calculated dynamically from curriculum)
  loopProgress: number   // 0-100 (calculated dynamically from curriculum - maps to 'legacy' phase)
  currentModule?: {
    id: string
    title: string
    content: string
    type: 'pre' | 'pro' | 'post' | 'loop'
  }
}

export function useCurriculumProgress(userId: string | null): CurriculumProgress {
  const [progress, setProgress] = useState<CurriculumProgress>({
    preProgress: 0,
    proProgress: 0,
    postProgress: 0,
    loopProgress: 0,
  })
  const supabase = createClient()

  useEffect(() => {
    if (!userId) {
      setProgress({
        preProgress: 0,
        proProgress: 0,
        postProgress: 0,
        loopProgress: 0,
      })
      return
    }

    async function loadProgress() {
      try {
        // Query curriculum_answers for this user
        const { data: answers, error } = await supabase
          .from('curriculum_answers')
          .select('question_key, answer_data')
          .eq('user_id', userId)

        if (error) {
          console.error('Error loading curriculum progress:', error)
          return
        }

        // Extract question_key values
        const answeredKeys = answers?.map(a => a.question_key) || []

        // Helper function to calculate progress for a phase dynamically
        const calculatePhaseProgress = (phase: 'pre' | 'prod' | 'post' | 'legacy'): number => {
          // Get all steps for this phase from CURRICULUM
          // Exclude completion steps (PRE_COMPLETE, PROD_COMPLETE, etc.) and INIT
          const phaseSteps = Object.values(CURRICULUM).filter(step => {
            if (!step.phase || step.phase !== phase) return false
            // Exclude completion/transition steps
            if (step.id.includes('_COMPLETE') || step.id === 'INIT' || step.id === 'COMPLETE') return false
            // Only count steps that have a key (actual work steps)
            return step.key && step.key.length > 0
          })

          if (phaseSteps.length === 0) return 0

          // Get unique keys (some steps may share the same key, e.g., INIT and MISSION_NAME both use 'artist_name')
          const uniqueKeys = Array.from(new Set(phaseSteps.map(step => step.key)))

          // Count how many unique keys are completed
          const completedKeys = uniqueKeys.filter(key => answeredKeys.includes(key)).length

          // Calculate percentage: (completed / total) * 100
          return Math.round((completedKeys / uniqueKeys.length) * 100)
        }

        // Calculate progress dynamically for each phase
        const preProgress = calculatePhaseProgress('pre')
        const proProgress = calculatePhaseProgress('prod')
        const postProgress = calculatePhaseProgress('post')
        const loopProgress = calculatePhaseProgress('legacy')

        // Determine current module based on progress
        let currentModule: CurriculumProgress['currentModule'] | undefined
        
        // If they've answered gift_to_world, create the first tile
        if (answeredKeys.includes('gift_to_world')) {
          const giftAnswer = answers?.find(a => a.question_key === 'gift_to_world')
          const giftText = giftAnswer?.answer_data?.text || ''
          
          currentModule = {
            id: 'gift-to-world',
            title: 'Your Gift to the World',
            content: giftText,
            type: 'pre'
          }
        }

        setProgress({
          preProgress,
          proProgress,
          postProgress,
          loopProgress,
          currentModule,
        })
      } catch (err) {
        console.error('Error in useCurriculumProgress:', err)
      }
    }

    loadProgress()

    // Subscribe to changes in curriculum_answers
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
  }, [userId, supabase])

  return progress
}

