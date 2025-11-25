import { useState, useEffect, useMemo, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { CURRICULUM, getStep, StepId } from '@/lib/curriculum'

export interface CarouselItem {
  id: string
  stepId: StepId
  questionKey: string
  title: string
  content: string
  imageUrl?: string
  videoUrl?: string
  audioUrl?: string
  type: 'pre' | 'pro' | 'post' | 'loop'
  createdAt: string
}

export function useCarouselItems(
  userId: string | null,
  currentTypingInput: string,
  currentTypingStepId: StepId | null,
  currentQuestionStepId: StepId | null // Current question being asked (even if not answered)
) {
  const [items, setItems] = useState<CarouselItem[]>([])
  const supabase = createClient()
  const typingDebounceRef = useRef<NodeJS.Timeout | null>(null)
  const lastTypingInputRef = useRef<string>('')
  const typingInputRef = useRef<string>(currentTypingInput) // Track current typing input

  // Update ref immediately (for use in loadItems)
  typingInputRef.current = currentTypingInput

  // Shared loadItems function
  const loadItemsRef = useRef<(() => Promise<void>) | null>(null)

  // Main effect: Load items (handles all non-typing changes)
  useEffect(() => {
    if (!userId) {
      setItems([])
      return
    }

    async function loadItems() {
      try {
        // Query curriculum_answers ordered by created_at ASC (oldest first for carousel order)
        const { data: answers, error } = await supabase
          .from('curriculum_answers')
          .select('question_key, answer_data, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: true }) // Oldest first = carousel order

        if (error) {
          console.error('Error loading carousel items:', error)
          return
        }

        // Helper: Convert question key to display format (e.g., "artist_name" -> "Artist Name")
        const keyToLabel = (key: string) => {
          return key
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ')
        }

        // Build carousel items from answers
        const answeredItems: CarouselItem[] = (answers || []).map((answer) => {
          const step = Object.values(CURRICULUM).find(s => s.key === answer.question_key)
          const stepId = step?.id || answer.question_key as StepId
          
          // Extract content and media URLs from answer_data
          const answerData = answer.answer_data as any
          const content = answerData?.text || answerData?.content || ''
          const imageUrl = answerData?.imageUrl || answerData?.image_url || answerData?.url
          const videoUrl = answerData?.videoUrl || answerData?.video_url
          const audioUrl = answerData?.audioUrl || answerData?.audio_url

          // Format title as mad lib: "Question Key: Answer" (e.g., "Artist Name: JaiTea")
          const label = keyToLabel(answer.question_key)
          const cardTitle = content ? `${label}: ${content}` : `${label}: `

          return {
            id: `${answer.question_key}-${answer.created_at}`,
            stepId,
            questionKey: answer.question_key,
            title: cardTitle, // Mad lib format: "Artist Name: JaiTea"
            content: '', // Don't set content for mad lib cards - answer is already in title
            imageUrl,
            videoUrl,
            audioUrl,
            type: step?.phase || 'pre',
            createdAt: answer.created_at
          }
        })

        // Add current question card if it exists and hasn't been answered yet
        const answeredKeys = new Set(answeredItems.map(item => item.questionKey))
        let finalItems = [...answeredItems]
        
        if (currentQuestionStepId) {
          const currentStep = getStep(currentQuestionStepId)
          const isAnswered = answeredKeys.has(currentStep.key)
          
          // Only add current question card if it hasn't been answered
          if (!isAnswered) {
            // Use ref value (always current, even during debounce)
            const typingInput = typingInputRef.current && currentTypingStepId === currentQuestionStepId ? typingInputRef.current : ''
            const label = keyToLabel(currentStep.key)
            
            // Card title: Always show "Label: " format, append typing input if available
            const cardTitle = typingInput ? `${label}: ${typingInput}` : `${label}: `
            
            const currentQuestionCard: CarouselItem = {
              id: `current-question-${currentQuestionStepId}`,
              stepId: currentQuestionStepId,
              questionKey: currentStep.key,
              title: cardTitle, // Mad lib format: "Artist Name: " or "Artist Name: JaiTea..."
              content: '', // Don't set content - answer is already in title (prevents duplication)
              type: currentStep.phase || 'pre',
              createdAt: new Date().toISOString()
            }
            // Add at the end (most recent)
            finalItems.push(currentQuestionCard)
          }
        }

        setItems(finalItems)
        lastTypingInputRef.current = typingInputRef.current
      } catch (err) {
        console.error('Error in useCarouselItems:', err)
      }
    }

    // Store loadItems function for typing debounce
    loadItemsRef.current = loadItems

    // Load immediately (not typing)
    loadItems()

    // Subscribe to changes
    const channel = supabase
      .channel(`carousel-items-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'curriculum_answers',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          loadItems()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, supabase, currentQuestionStepId, currentTypingStepId]) // Removed currentTypingInput - handled separately

  // Separate effect: Debounce typing updates to prevent glitching
  useEffect(() => {
    if (!userId || !loadItemsRef.current) return
    
    const isTyping = currentTypingInput !== lastTypingInputRef.current && currentTypingStepId === currentQuestionStepId
    if (isTyping) {
      // Typing is happening - debounce the update
      if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current)
      typingDebounceRef.current = setTimeout(() => {
        if (loadItemsRef.current) {
          loadItemsRef.current()
        }
      }, 250) // Debounce typing updates (longer to prevent glitching)
    }
    
    return () => {
      if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current)
    }
  }, [currentTypingInput, currentTypingStepId, currentQuestionStepId, userId]) // Watch typing input separately

  return items
}

