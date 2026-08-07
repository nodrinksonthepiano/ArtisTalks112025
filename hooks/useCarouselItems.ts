import { useState, useEffect, useRef, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'
import { CURRICULUM, getStep, StepId } from '@/lib/curriculum'
import { loadDraft } from '@/lib/draft'

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
  activeStepId: StepId | null,
  activeStepIdForQuestion: StepId | null,
  isEditMode: boolean,
  answeredKeys?: Set<string>
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
    // CRITICAL: In edit mode, don't create a new current question card
    // The edited card is already in the answered items list
    if (isEditMode) {
      return null
    }
    
    if (!activeStepId) return null
    
    const currentStep = getStep(activeStepId)
    
    // CRITICAL: INIT card is special - only create when user has started typing
    const isInitStep = activeStepId === 'INIT'
    const hasTypingStarted = activeStepId === 'INIT' && currentTypingInput.length > 0
    
    if (isInitStep && !hasTypingStarted) {
      return null
    }
    
    // CRITICAL: Since activeStepId is single source of truth, typing always matches
    const typingInput = currentTypingInput
    const label = currentStep.key
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
    
    const cardTitle = typingInput ? `${label}: ${typingInput}` : `${label}: `
    
    return {
      id: `current-question-${activeStepId}`,
      stepId: activeStepId,
      questionKey: currentStep.key,
      isCurrentQuestion: true,
      title: cardTitle,
      content: '',
      type: (currentStep.phase === 'prod' ? 'pro' : currentStep.phase === 'legacy' ? 'loop' : currentStep.phase) || 'pre',
      createdAt: new Date().toISOString()
    } as CarouselItem
  }, [activeStepId, currentTypingInput, isEditMode])

  // Shared loadItems function
  const loadItemsRef = useRef<(() => Promise<void>) | null>(null)

  const keyToLabel = (key: string) =>
    key
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')

  const buildItemsFromAnswers = (
    answers: Array<{ question_key: string; answer_data: any; created_at: string }>
  ): CarouselItem[] => {
    const mappedItems: (CarouselItem | null)[] = answers.map((answer) => {
      const answerData = answer.answer_data as any
      const step = Object.values(CURRICULUM).find((s) => s.key === answer.question_key)

      if (step?.id.includes('_COMPLETE')) {
        return null
      }

      const storedStepId = answerData?.step_id
      let stepId: StepId
      if (storedStepId) {
        stepId = storedStepId as StepId
      } else {
        stepId = step?.id || (answer.question_key as StepId)
      }

      const statusTexts = new Set(['colors set', 'font set', 'logo uploaded'])
      const rawText = String(
        answerData?.label || answerData?.text || answerData?.content || ''
      ).trim()
      const isStatusText = statusTexts.has(rawText.toLowerCase())

      let cardTitle: string
      let cardContent = ''
      let imageUrl =
        answerData?.imageUrl || answerData?.image_url || answerData?.url || undefined

      if (answer.question_key === 'logo_uploaded') {
        if (answerData?.skipped) {
          cardTitle = 'Logo'
          cardContent = 'Skipped for now'
        } else if (imageUrl) {
          cardTitle = 'Logo'
          cardContent = !isStatusText && rawText ? rawText : ''
        } else if (rawText && !isStatusText) {
          cardTitle = 'Logo'
          cardContent = rawText
        } else {
          cardTitle = 'Logo'
        }
      } else if (answer.question_key === 'colors_set') {
        const primary = answerData?.primary || answerData?.brand_color || ''
        const accent = answerData?.accent || ''
        cardTitle = 'Colors'
        cardContent = [primary, accent].filter(Boolean).join(' · ')
      } else if (answer.question_key === 'font_set') {
        const headline = answerData?.headline_font || answerData?.font || ''
        const body = answerData?.body_font || ''
        const headlineName = String(headline).split(',')[0] || 'Headline'
        const bodyName = body ? String(body).split(',')[0] : ''
        cardTitle = 'Font'
        cardContent = bodyName
          ? `${headlineName} · ${bodyName}`
          : headlineName
      } else if (answer.question_key === 'artist_name') {
        cardTitle = rawText && !isStatusText ? rawText : ''
        cardContent = ''
      } else {
        const label = keyToLabel(answer.question_key)
        cardTitle =
          rawText && !isStatusText ? `${label}: ${rawText}` : `${label}: `
      }

      const itemType: CarouselItem['type'] =
        step?.phase === 'prod'
          ? 'pro'
          : step?.phase === 'legacy'
            ? 'loop'
            : step?.phase === 'post'
              ? 'post'
              : 'pre'

      return {
        id: `${answer.question_key}-${answer.created_at}`,
        stepId,
        questionKey: answer.question_key,
        title: cardTitle,
        content: cardContent,
        imageUrl,
        videoUrl: answerData?.videoUrl || answerData?.video_url,
        audioUrl: answerData?.audioUrl || answerData?.audio_url,
        type: itemType,
        createdAt: answer.created_at,
      }
    })

    return mappedItems.filter((item): item is CarouselItem => item !== null)
  }

  const mergeCurrentQuestionCard = (answeredItems: CarouselItem[]): CarouselItem[] => {
    let finalItems = answeredItems.filter((item) => !item.isCurrentQuestion)

    if (activeStepId && typingInputRef.current) {
      const editedCardIndex = finalItems.findIndex((item) => item.stepId === activeStepId)
      if (editedCardIndex !== -1) {
        const editedCard = finalItems[editedCardIndex]
        const step = getStep(activeStepId)
        const label = keyToLabel(step.key)
        finalItems[editedCardIndex] = {
          ...editedCard,
          title:
            step.key === 'artist_name'
              ? typingInputRef.current
              : `${label}: ${typingInputRef.current}`,
        }
      }
    }

    if (!isEditMode && currentQuestionCard) {
      const alreadyAnswered = finalItems.some(
        (item) => item.questionKey === currentQuestionCard.questionKey
      )
      if (!alreadyAnswered) {
        finalItems = [currentQuestionCard, ...finalItems]
      }
    }

    return finalItems
  }

  // Main effect: Load items (handles all non-typing changes)
  useEffect(() => {
    if (!userId) {
      const draft = loadDraft()
      const answeredItems = buildItemsFromAnswers(draft?.answers ?? [])
      setItems(mergeCurrentQuestionCard(answeredItems))
      lastTypingInputRef.current = typingInputRef.current

      loadItemsRef.current = async () => {
        const latestDraft = loadDraft()
        const latestAnswered = buildItemsFromAnswers(latestDraft?.answers ?? [])
        setItems(mergeCurrentQuestionCard(latestAnswered))
        lastTypingInputRef.current = typingInputRef.current
      }
      return
    }

    async function loadItems() {
      try {
        const { data: answers, error } = await supabase
          .from('curriculum_answers')
          .select('question_key, answer_data, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: true })

        if (error) {
          console.error('Error loading carousel items:', error)
          return
        }

        const answeredItems = buildItemsFromAnswers(answers || [])
        setItems(mergeCurrentQuestionCard(answeredItems))
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
  }, [userId, supabase, activeStepId, currentQuestionCard, isEditMode, answeredKeys])

  // Separate effect: Debounce typing updates to prevent glitching
  useEffect(() => {
    if (!loadItemsRef.current) return
    
    // CRITICAL: Since activeStepId is single source of truth, typing always matches when activeStepId is set
    const isTyping = currentTypingInput !== lastTypingInputRef.current && activeStepId !== null
    if (isTyping) {
      // Typing is happening - debounce the update
      if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current)
      typingDebounceRef.current = setTimeout(() => {
        if (loadItemsRef.current) {
          loadItemsRef.current()
        }
      }, 100)
    }
    
    return () => {
      if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current)
    }
  }, [currentTypingInput, activeStepId, userId, answeredKeys])

  // CRITICAL: Merge synchronous current question card with async items from database
  // This ensures card exists immediately when activeStepId changes, preventing flash
  const finalItems = useMemo(() => {
    // Remove any old current question cards from items (cleanup)
    const itemsWithoutCurrent = items.filter(item => !item.isCurrentQuestion)
    
    // CRITICAL: In edit mode, don't add a current question card - edited card is already in items
    if (isEditMode) {
      return itemsWithoutCurrent
    }
    
    // CRITICAL: If activeStepId exists, guarantee current card at index 0
    // Never fall back to answered items when question is active
    if (activeStepId) {
      // INIT special case: currentQuestionCard is null until typing starts.
      // Fresh user: no answered items either, so this stays empty (preserves the
      // "surprise" moment). Returning user who navigated back to the answered
      // name card: keep the answered deck visible instead of blanking it.
      if (!currentQuestionCard) {
        return itemsWithoutCurrent
      }
      
      // CRITICAL: If the active step is already answered (artist swiped/navigated to it),
      // keep the answered card in place - injecting a synthetic question card here
      // reordered the deck under the artist's finger and broke swiping.
      const alreadyAnswered = itemsWithoutCurrent.some(
        item => item.questionKey === currentQuestionCard.questionKey
      )
      if (alreadyAnswered) {
        return itemsWithoutCurrent
      }
      
      // Unanswered step: current question card leads at index 0 (featured spot)
      return [currentQuestionCard, ...itemsWithoutCurrent]
    }
    
    // No active step - return answered items only
    return itemsWithoutCurrent
  }, [items, currentQuestionCard, activeStepId, isEditMode])

  return finalItems
}

