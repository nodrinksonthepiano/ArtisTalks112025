import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'

export interface CurriculumProgress {
  preProgress: number    // 0-100 (binary for v1)
  proProgress: number    // 0-100
  postProgress: number   // 0-100
  loopProgress: number   // 0-100
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

        // PRE Phase: artist_name + gift_to_world + logo + colors + font
        const preComplete = 
          answeredKeys.includes('artist_name') && 
          answeredKeys.includes('gift_to_world') &&
          answeredKeys.includes('logo_uploaded') &&
          answeredKeys.includes('colors_set') &&
          answeredKeys.includes('font_set')
        const preProgress = preComplete ? 100 : 0

        // PROD Phase: project_name + project_description + asset
        const prodComplete = 
          answeredKeys.includes('project_name') &&
          answeredKeys.includes('project_description') &&
          answeredKeys.includes('asset_uploaded')
        const proProgress = prodComplete ? 100 : 0

        // POST Phase: promo_strategy + target_audience + launch_date
        const postComplete = 
          answeredKeys.includes('promo_strategy') &&
          answeredKeys.includes('target_audience') &&
          answeredKeys.includes('launch_date')
        const postProgress = postComplete ? 100 : 0

        // LEGACY Phase: gratitude + legacy_vision + feedback_loop
        const legacyComplete = 
          answeredKeys.includes('gratitude_practice') &&
          answeredKeys.includes('legacy_vision') &&
          answeredKeys.includes('feedback_loop')
        const loopProgress = legacyComplete ? 100 : 0

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

