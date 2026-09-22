import { useCallback, useState, useEffect, useRef, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'
import { CURRICULUM, getCurriculumSpineOrder, getStep, StepId } from '@/lib/curriculum'
import { loadDraft } from '@/lib/draft'
import { isManagedDraftLogoUrl } from '@/lib/draftLogoAsset'

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

export interface LiveCarouselMedia {
  logoUrl?: string | null
  logoRemoved?: boolean
}

function keyToLabel(key: string) {
  if (key === 'logo_uploaded') return 'Logo'
  if (key === 'colors_set') return 'Colors'
  if (key === 'font_set') return 'Font'
  return key
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function itemTypeForStep(step: { phase?: string } | undefined): CarouselItem['type'] {
  if (step?.phase === 'prod') return 'pro'
  if (step?.phase === 'legacy') return 'loop'
  if (step?.phase === 'post') return 'post'
  return 'pre'
}

function sortBySpine(items: CarouselItem[]): CarouselItem[] {
  const spine = getCurriculumSpineOrder()
  return [...items].sort((a, b) => {
    const ai = spine.indexOf(a.stepId)
    const bi = spine.indexOf(b.stepId)
    const aRank = ai === -1 ? 999 : ai
    const bRank = bi === -1 ? 999 : bi
    if (aRank !== bRank) return aRank - bRank
    return a.createdAt.localeCompare(b.createdAt)
  })
}

function carouselItemsEqual(
  previous: CarouselItem[],
  next: CarouselItem[]
): boolean {
  if (previous.length !== next.length) return false

  return previous.every((item, index) => {
    const candidate = next[index]
    return (
      item.id === candidate.id &&
      item.stepId === candidate.stepId &&
      item.questionKey === candidate.questionKey &&
      item.isCurrentQuestion === candidate.isCurrentQuestion &&
      item.title === candidate.title &&
      item.content === candidate.content &&
      item.imageUrl === candidate.imageUrl &&
      item.videoUrl === candidate.videoUrl &&
      item.audioUrl === candidate.audioUrl &&
      item.type === candidate.type &&
      item.createdAt === candidate.createdAt
    )
  })
}

export function useCarouselItems(
  userId: string | null,
  currentTypingInput: string,
  pendingStepId: StepId | null,
  viewedStepId: StepId | null,
  answeredKeys?: Set<string>,
  liveMedia?: LiveCarouselMedia
) {
  const [items, setItems] = useState<CarouselItem[]>([])
  const supabase = createClient()
  const typingDebounceRef = useRef<NodeJS.Timeout | null>(null)
  const lastTypingInputRef = useRef<string>('')
  const typingInputRef = useRef<string>(currentTypingInput)
  const liveMediaRef = useRef<LiveCarouselMedia | undefined>(liveMedia)
  const liveLogoUrl = liveMedia?.logoUrl
  const liveLogoRemoved = liveMedia?.logoRemoved
  const pendingCardCreatedAt = useMemo(
    () => (pendingStepId ? new Date().toISOString() : ''),
    [pendingStepId]
  )

  const commitItems = useCallback((nextItems: CarouselItem[]) => {
    setItems((previous) =>
      carouselItemsEqual(previous, nextItems) ? previous : nextItems
    )
  }, [])

  useEffect(() => {
    typingInputRef.current = currentTypingInput
    liveMediaRef.current = liveMedia
  })

  const pendingQuestionCard = useMemo(() => {
    if (!pendingStepId) return null
    if (answeredKeys?.has(getStep(pendingStepId).key)) return null

    const currentStep = getStep(pendingStepId)
    const typingForPending = viewedStepId === pendingStepId ? currentTypingInput : ''
    const logoUrl = liveLogoUrl || undefined
    const logoRemoved = liveLogoRemoved === true && !logoUrl

    if (currentStep.key === 'logo_uploaded') {
      return {
        id: `current-question-${pendingStepId}`,
        stepId: pendingStepId,
        questionKey: currentStep.key,
        isCurrentQuestion: true,
        title: 'Logo',
        content: logoRemoved ? 'Removed' : '',
        imageUrl: logoUrl,
        type: itemTypeForStep(currentStep),
        createdAt: pendingCardCreatedAt,
      } as CarouselItem
    }

    const label = keyToLabel(currentStep.key)
    const cardTitle =
      currentStep.key === 'artist_name'
        ? typingForPending
        : typingForPending
          ? `${label}: ${typingForPending}`
          : label

    return {
      id: `current-question-${pendingStepId}`,
      stepId: pendingStepId,
      questionKey: currentStep.key,
      isCurrentQuestion: true,
      title: cardTitle,
      content: '',
      type: itemTypeForStep(currentStep),
      createdAt: pendingCardCreatedAt,
    } as CarouselItem
  }, [
    pendingStepId,
    currentTypingInput,
    viewedStepId,
    answeredKeys,
    liveLogoUrl,
    liveLogoRemoved,
    pendingCardCreatedAt,
  ])

  const loadItemsRef = useRef<(() => Promise<void>) | null>(null)

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
        // Historical object URLs have no image after a reload. Current live media wins below.
        if (typeof imageUrl === 'string' && imageUrl.startsWith('blob:') && !isManagedDraftLogoUrl(imageUrl)) {
          imageUrl = undefined
        }
        const liveUrl = liveMediaRef.current?.logoUrl
        const liveRemoved = liveMediaRef.current?.logoRemoved === true
        if (liveUrl) {
          imageUrl = liveUrl
        } else if (liveRemoved) {
          imageUrl = undefined
        }
        if (answerData?.skipped && !liveUrl) {
          cardTitle = 'Logo'
          cardContent = 'Skipped for now'
        } else if (imageUrl) {
          cardTitle = 'Logo'
          cardContent = !isStatusText && rawText ? rawText : ''
        } else if (liveRemoved) {
          cardTitle = 'Logo'
          cardContent = 'Removed'
        } else if (rawText && !isStatusText) {
          cardTitle = 'Logo'
          cardContent = rawText
        } else {
          cardTitle = 'Logo'
        }
      } else if (answer.question_key === 'colors_set') {
        const primary = answerData?.primary || answerData?.brand_color || ''
        const accent = answerData?.accent || ''
        const pop = answerData?.pop || ''
        cardTitle = 'Colors'
        cardContent = [primary, accent, pop].filter(Boolean).join(' · ')
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
      } else {
        const label = keyToLabel(answer.question_key)
        cardTitle =
          rawText && !isStatusText ? `${label}: ${rawText}` : label
      }

      return {
        id: `${answer.question_key}-${answer.created_at}`,
        stepId,
        questionKey: answer.question_key,
        title: cardTitle,
        content: cardContent,
        imageUrl,
        videoUrl: answerData?.videoUrl || answerData?.video_url,
        audioUrl: answerData?.audioUrl || answerData?.audio_url,
        type: itemTypeForStep(step),
        createdAt: answer.created_at,
      }
    })

    return sortBySpine(mappedItems.filter((item): item is CarouselItem => item !== null))
  }

  const mergePendingCard = (answeredItems: CarouselItem[]): CarouselItem[] => {
    let finalItems = sortBySpine(answeredItems.filter((item) => !item.isCurrentQuestion))

    const typingTargetId = viewedStepId || pendingStepId
    if (typingTargetId && typingInputRef.current) {
      const editedCardIndex = finalItems.findIndex((item) => item.stepId === typingTargetId)
      if (editedCardIndex !== -1) {
        const editedCard = finalItems[editedCardIndex]
        const step = getStep(typingTargetId)
        if (step.key === 'logo_uploaded') {
          finalItems[editedCardIndex] = {
            ...editedCard,
            title: 'Logo',
            imageUrl: liveMediaRef.current?.logoUrl || editedCard.imageUrl,
            content:
              liveMediaRef.current?.logoRemoved && !liveMediaRef.current?.logoUrl
                ? 'Removed'
                : editedCard.content,
          }
        } else {
          finalItems[editedCardIndex] = {
            ...editedCard,
            title:
              step.key === 'artist_name'
                ? typingInputRef.current
                : `${keyToLabel(step.key)}: ${typingInputRef.current}`,
          }
        }
      }
    }

    if (pendingQuestionCard) {
      const alreadyAnswered = finalItems.some(
        (item) => item.questionKey === pendingQuestionCard.questionKey
      )
      if (!alreadyAnswered) {
        finalItems = sortBySpine([...finalItems, pendingQuestionCard])
      }
    }

    return finalItems
  }

  useEffect(() => {
    if (!userId) {
      const draft = loadDraft()
      const answeredItems = buildItemsFromAnswers(draft?.answers ?? [])
      commitItems(mergePendingCard(answeredItems))
      lastTypingInputRef.current = typingInputRef.current

      loadItemsRef.current = async () => {
        const latestDraft = loadDraft()
        const latestAnswered = buildItemsFromAnswers(latestDraft?.answers ?? [])
        commitItems(mergePendingCard(latestAnswered))
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
        commitItems(mergePendingCard(answeredItems))
        lastTypingInputRef.current = typingInputRef.current
      } catch (err) {
        console.error('Error in useCarouselItems:', err)
      }
    }

    loadItemsRef.current = loadItems
    loadItems()

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
  }, [
    userId,
    supabase,
    pendingStepId,
    pendingQuestionCard,
    answeredKeys,
    viewedStepId,
    liveLogoUrl,
    liveLogoRemoved,
    commitItems,
  ])

  useEffect(() => {
    if (!loadItemsRef.current) return

    const isTyping = currentTypingInput !== lastTypingInputRef.current && pendingStepId !== null
    if (isTyping) {
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
  }, [currentTypingInput, pendingStepId, viewedStepId, userId, answeredKeys])

  const finalItems = useMemo(() => {
    const itemsWithoutCurrent = sortBySpine(items.filter((item) => !item.isCurrentQuestion))

    if (pendingQuestionCard) {
      const alreadyAnswered = itemsWithoutCurrent.some(
        (item) => item.questionKey === pendingQuestionCard.questionKey
      )
      if (alreadyAnswered) {
        return itemsWithoutCurrent.map((item) => {
          if (item.questionKey !== 'logo_uploaded') return item
          const liveUrl = liveLogoUrl
          if (liveUrl) {
            return { ...item, title: 'Logo', imageUrl: liveUrl, content: item.content }
          }
          if (liveLogoRemoved) {
            return { ...item, title: 'Logo', imageUrl: undefined, content: 'Removed' }
          }
          return item
        })
      }
      return sortBySpine([...itemsWithoutCurrent, pendingQuestionCard])
    }

    return itemsWithoutCurrent.map((item) => {
      if (item.questionKey !== 'logo_uploaded') return item
      const liveUrl = liveLogoUrl
      if (liveUrl) {
        return { ...item, title: 'Logo', imageUrl: liveUrl, content: item.content }
      }
      if (liveLogoRemoved) {
        return { ...item, title: 'Logo', imageUrl: undefined, content: 'Removed' }
      }
      return item
    })
  }, [items, pendingQuestionCard, liveLogoUrl, liveLogoRemoved])

  return finalItems
}
