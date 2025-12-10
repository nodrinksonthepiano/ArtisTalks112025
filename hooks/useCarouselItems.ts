import { useState, useEffect, useRef, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'
import { CURRICULUM, getStep, StepId } from '@/lib/curriculum'

export interface CarouselItem {
  id: string
  stepId: StepId
  questionKey: string
  isCurrentQuestion?: boolean // Explicit marker for current question card (not answered yet)
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
  currentQuestionStepId: StepId | null, // Current question being asked (even if not answered)
  answeredKeys: Set<string> // CRITICAL: Pass answeredKeys for synchronous answered state check
) {
  const [items, setItems] = useState<CarouselItem[]>([])
  const supabase = createClient()
  const typingDebounceRef = useRef<NodeJS.Timeout | null>(null)
  const lastTypingInputRef = useRef<string>('')
  const typingInputRef = useRef<string>(currentTypingInput) // Track current typing input

  // Update ref immediately (for use in loadItems)
  typingInputRef.current = currentTypingInput

  // CRITICAL: Create current question card synchronously (before async database query)
  // This ensures card exists immediately when currentQuestionStepId changes, preventing flash
  const currentQuestionCard = useMemo(() => {
    if (!currentQuestionStepId) return null
    
    const currentStep = getStep(currentQuestionStepId)
    
    // CRITICAL: INIT card is special - only create when user starts typing (surprise moment)
    const isInitStep = currentQuestionStepId === 'INIT'
    const hasTypingStarted = currentTypingStepId === 'INIT' && currentTypingInput.length > 0
    
    // For INIT: Only create card if user has started typing
    // For all others: Create card immediately when question is asked
    if (isInitStep && !hasTypingStarted) {
      return null // Don't create INIT card until typing starts
    }
    
    // Use current typing input (always current, synchronous)
    const typingInput = currentTypingStepId === currentQuestionStepId ? currentTypingInput : ''
    const label = currentStep.key
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
    
    const cardTitle = typingInput ? `${label}: ${typingInput}` : `${label}: `
    
    return {
      id: `current-question-${currentQuestionStepId}`,
      stepId: currentQuestionStepId,
      questionKey: currentStep.key,
      isCurrentQuestion: true,
      title: cardTitle,
      content: '',
      type: (currentStep.phase === 'prod' ? 'pro' : currentStep.phase === 'legacy' ? 'loop' : currentStep.phase) || 'pre',
      createdAt: new Date().toISOString()
    } as CarouselItem
  }, [currentQuestionStepId, currentTypingStepId, currentTypingInput])

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
        const answeredItems: CarouselItem[] = (answers || [])
          .map((answer, answerIndex) => {
            // Extract content and media URLs from answer_data
            const answerData = answer.answer_data as any
            
            // CRITICAL: Find step first (needed for phase/type even if we use stored stepId)
            const step = Object.values(CURRICULUM).find(s => s.key === answer.question_key)
            
            // CRITICAL: Skip celebration steps - they should never appear as answered cards
            // Celebration cards are temporary, only shown as current question cards
            // They disappear when user clicks Continue, never saved permanently
            if (step?.id.includes('_COMPLETE')) {
              return null // Skip celebration steps
            }
            
            // CRITICAL: Try to get stepId from answer_data first (new answers have this)
            const storedStepId = answerData?.step_id
            
            let stepId: StepId
            if (storedStepId) {
              // New answer format: use stored stepId
              stepId = storedStepId as StepId
            } else {
              // Backward compatibility: infer stepId from question_key
              // All artist_name answers are INIT (MISSION_NAME removed)
              stepId = step?.id || answer.question_key as StepId
            }
            
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
              type: (step?.phase === 'prod' ? 'pro' : step?.phase === 'legacy' ? 'loop' : step?.phase) || 'pre',
              createdAt: answer.created_at
            }
          })
          .filter((item): item is CarouselItem => item !== null) // Remove nulls (celebration steps)

        // CRITICAL: Build final items list and ensure current question card exists immediately
        const answeredKeys = new Set(answeredItems.map(item => item.questionKey))
        let finalItems = [...answeredItems]
        
        // CRITICAL: Remove any old current question cards first (cleanup)
        // This ensures only ONE current question card exists at a time
        finalItems = finalItems.filter(item => !item.isCurrentQuestion)
        
        // CRITICAL: Use synchronously created current question card (from useMemo above)
        // This ensures card exists immediately when currentQuestionStepId changes, preventing flash
        // Card is created synchronously before async database query completes
        if (currentQuestionCard) {
          // CRITICAL: Always include current question card - it represents the question being asked
          // Filter out any answered items with the same stepId to prevent duplicates
          finalItems = finalItems.filter(item => item.stepId !== currentQuestionCard.stepId)
          
          // CRITICAL: Always add at the front (index 0) - featured spot
          // This ensures current question card is always visible immediately, preventing flash
          // Even if items state is stale, current card is at index 0
          finalItems = [currentQuestionCard, ...finalItems]
        }

        setItems(finalItems)
        lastTypingInputRef.current = typingInputRef.current
      } catch (err) {
        console.error('Error in useCarouselItems:', err)
      }
    }

    // Store loadItems function for typing debounce
    loadItemsRef.current = loadItems

    // Load immediately (not typing) - this will update items with DB data
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
  }, [userId, supabase, currentQuestionStepId, currentTypingStepId, currentQuestionCard]) // Added currentQuestionCard to deps

  // Separate effect: Debounce typing updates to prevent glitching
  useEffect(() => {
    if (!userId || !loadItemsRef.current) return
    
    const isTyping = currentTypingInput !== lastTypingInputRef.current && currentTypingStepId === currentQuestionStepId
    if (isTyping) {
      // Typing is happening - debounce the update (reduced from 250ms to 100ms for faster card updates)
      if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current)
      typingDebounceRef.current = setTimeout(() => {
        if (loadItemsRef.current) {
          loadItemsRef.current()
        }
      }, 100) // Reduced debounce for faster card updates (was 250ms)
    }
    
    return () => {
      if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current)
    }
  }, [currentTypingInput, currentTypingStepId, currentQuestionStepId, userId]) // Watch typing input separately

  // CRITICAL: Merge synchronous current question card with async items from database
  // This ensures card exists immediately when currentQuestionStepId changes, preventing flash
  const finalItems = useMemo(() => {
    // Remove any old current question cards from items (cleanup)
    const itemsWithoutCurrent = items.filter(item => !item.isCurrentQuestion)
    
    // CRITICAL: Always include current question card if it exists
    // It represents the question being asked, regardless of answered state
    if (currentQuestionCard) {
      // Filter out any answered items with the same stepId to prevent duplicates
      // The current question card takes precedence over answered cards
      const dedupedItems = itemsWithoutCurrent.filter(item => item.stepId !== currentQuestionCard.stepId)
      
      // CRITICAL: Always add at the front (index 0) - featured spot
      // This ensures current question card is always visible immediately, preventing flash
      // Even if items state is stale, current card is at index 0
      return [currentQuestionCard, ...dedupedItems]
    }
    
    return itemsWithoutCurrent
  }, [items, currentQuestionCard])

  return finalItems
}

