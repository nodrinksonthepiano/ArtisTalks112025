'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowUp, Undo2, Redo2, Pencil, ChevronLeft } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { CURRICULUM, StepId, getStep, isSelectStep, isColorsPanelStep, getStepPlaceholder, getSelectLabel, resolveSelectValue, FREE_TASTE_LAST_STEP_ID, FREE_TASTE_LAST_KEY, ANONYMOUS_GATE_MESSAGE, isFreeTasteGateReached, isBeyondFreeTaste, findFirstUnansweredInFreeTaste, clampStepToFreeTaste, withProfileSatisfiedArtistName } from '@/lib/curriculum'
import { Profile } from '@/hooks/useProfile'
import {
  getDraftAnswerText,
  getDraftAnsweredKeys,
  loadDraft,
  setDraftCurrentStepId,
  setDraftProfilePreview,
  upsertDraftAnswer,
  clearDraftArtistNameAttempt,
} from '@/lib/draft'
import InlineColorPicker from '@/components/InlineColorPicker'
import InlineSelectPicker from '@/components/InlineSelectPicker'
import LivingAffirmation from '@/components/LivingAffirmation'
import ClaimedArtistGate from '@/components/ClaimedArtistGate'
import OtpEmailFlow from '@/components/OtpEmailFlow'
import { assembleLivingAffirmation } from '@/lib/livingAffirmation'
import {
  clearReturningClaimMarker,
  setReturningClaimMarker,
} from '@/lib/returningClaim'

// Add prop type for the update function
interface EmeraldChatProps {
  onProfileUpdate?: (updates: Partial<Profile>) => void
  onTriggerPanel?: (panel: 'logo' | 'colors' | 'font' | 'asset' | null) => void
  onTypingUpdate?: (input: string, stepId: StepId) => void // Live typing updates for carousel card
  onSubmitCard?: (answer: string, stepId: StepId) => void // Trigger card swipe animation on submit
  onCurrentStepChange?: (stepId: StepId) => void // Notify parent of current step for carousel
  profile?: Profile | null // CRITICAL: Profile prop for inline pickers
  answeredKeys: Set<string> // ADD: Shared answered keys state
  setAnsweredKeys: (updater: Set<string> | ((prev: Set<string>) => Set<string>)) => void // ADD: Setter for optimistic updates
  /** Authenticated: true after first curriculum_answers fetch (may be empty). Anonymous: always true. */
  answeredKeysReady?: boolean
  isAnonymous?: boolean
  onDraftRefresh?: () => void
}

const INIT_WELCOME_HEADLINE = 'Welcome, My Champion...'

export default function EmeraldChat({ onProfileUpdate, onTriggerPanel, onTypingUpdate, onSubmitCard, onCurrentStepChange, profile, answeredKeys, setAnsweredKeys, answeredKeysReady = true, isAnonymous = false, onDraftRefresh }: EmeraldChatProps) {
  const [currentStepId, setCurrentStepId] = useState<StepId>('INIT')
  const [previousStepId, setPreviousStepId] = useState<StepId | null>(null)
  const [input, setInput] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [history, setHistory] = useState<Array<{role: 'assistant' | 'user', content: string, stepId?: StepId}>>([])
  const [fullHistory, setFullHistory] = useState<Array<{role: 'assistant' | 'user', content: string, stepId?: StepId}>>([]) // Full history for history button
  const [showHistory, setShowHistory] = useState(false) // Toggle history modal
  
  // CRITICAL: Track current picker state to know what to save when Send is clicked
  // This ensures we save the actual current state, not stale profile values
  const [currentPickerState, setCurrentPickerState] = useState<{
    colors?: { primary_color?: string | null; accent_color?: string | null }
    logo?: { logo_url?: string | null; logo_use_background?: boolean | null }
    font?: { font_family?: string | null }
  }>({})
  
  // Redo stack: track undone states so user can redo
  const [redoStack, setRedoStack] = useState<Array<{
    stepId: StepId
    previousStepId: StepId | null
    history: Array<{role: 'assistant' | 'user', content: string, stepId?: StepId}>
  }>>([])
  
  // CRITICAL: The full color picker should only render when the artist is actively
  // answering the colors step (unanswered) or explicitly chose to edit their brand.
  // Swiping/navigating onto an ANSWERED colors card shows a compact summary instead -
  // the full picker hijacking the chat on a casual swipe was a tested pain point.
  const [pickerOpenedExplicitly, setPickerOpenedExplicitly] = useState(false)
  const keepPickerOpenRef = useRef(false)
  
  const currentStep = getStep(currentStepId)
  const supabase = createClient()
  const debounceTimer = useRef<NodeJS.Timeout | null>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const hasInitializedRef = useRef(false)
  const [anonymousGateView, setAnonymousGateView] = useState(false)
  const [claimedGateView, setClaimedGateView] = useState(false)
  const [claimedArtistName, setClaimedArtistName] = useState('')
  const [claimError, setClaimError] = useState('')

  const isGated = isAnonymous && isFreeTasteGateReached(answeredKeys)
  const showGateUI = isGated && anonymousGateView && !claimedGateView
  const showClaimedGate = isAnonymous && claimedGateView && claimedArtistName.length > 0

  const gateEmailPlaceholder = useMemo(() => {
    const artistName =
      profile?.artist_name?.trim() || getDraftAnswerText('artist_name').trim()
    return artistName ? `Enter ${artistName}'s email` : 'Enter your email'
  }, [profile?.artist_name, answeredKeys])

  /** Gate-only Living Affirmation — derived from exact draft answers; no persistence. */
  const livingAffirmationText = useMemo(() => {
    if (!showGateUI) return ''
    return assembleLivingAffirmation({
      artist_name: getDraftAnswerText('artist_name'),
      genre_associations: getDraftAnswerText('genre_associations'),
      business_type_products_services: getDraftAnswerText('business_type_products_services'),
      known_for_expression: getDraftAnswerText('known_for_expression'),
      known_for_legacy: getDraftAnswerText('known_for_legacy'),
    })
  }, [showGateUI, answeredKeys])

  /** BUSINESS_OFFERING input hint only — display copy; curriculum question untouched. */
  const stepInputPlaceholder = useMemo(() => {
    if (currentStep.key !== 'business_type_products_services') {
      return getStepPlaceholder(currentStep)
    }
    const artistName =
      profile?.artist_name?.trim() || getDraftAnswerText('artist_name').trim()
    return artistName
      ? `What products or services will you offer? Where is ${artistName}'s first dollar made?`
      : 'What products or services will you offer? Where is your first dollar made?'
  }, [currentStep, profile?.artist_name, answeredKeys])

  const hasUserHistory = fullHistory.some((m) => m.role === 'user')
  const hideAnonymousInitNav =
    isAnonymous && currentStepId === 'INIT' && !answeredKeys.has('artist_name')
  const showNavToolbar = !hideAnonymousInitNav
  
  const openColorsPickerForStep = useCallback((stepId: StepId) => {
    if (isColorsPanelStep(getStep(stepId))) {
      keepPickerOpenRef.current = true
      setPickerOpenedExplicitly(true)
    }
  }, [])

  // Reset the explicit-open flag whenever the step changes, unless the step change
  // itself carried the intent to open the picker (pencil edit on the colors card).
  useEffect(() => {
    if (keepPickerOpenRef.current) {
      keepPickerOpenRef.current = false
      return
    }
    setPickerOpenedExplicitly(false)
  }, [currentStepId])
  
  const isColorsStep = isColorsPanelStep(getStep(currentStepId))
  const isSelectInputStep = isSelectStep(getStep(currentStepId))
  const showColorsPicker = isColorsStep && (!answeredKeys.has(getStep(currentStepId).key) || pickerOpenedExplicitly)
  const showColorsSummary = isColorsStep && !showColorsPicker
  
  // Notify parent of current step change (for carousel)
  // CRITICAL: Always notify parent when currentStepId changes
  // Parent's onCurrentStepChange handler will check isEditMode and only update if not editing
  // For INIT: Only notify when typing has started (input.length > 0)
  useEffect(() => {
    if (!onCurrentStepChange) return
    
    const isInitStep = currentStepId === 'INIT'
    
    // CRITICAL: Always notify parent when currentStepId changes
    // Parent's onCurrentStepChange handler will check isEditMode and only update if not editing
    // For INIT: Only notify when typing has started (input.length > 0)
    if (!isInitStep || input.length > 0) {
      onCurrentStepChange(currentStepId)
    }
  }, [currentStepId, onCurrentStepChange, input])
  
  // Helper: Find first unanswered question in curriculum flow
  // CRITICAL: Accept optional answeredKeysOverride to use updated keys immediately after state update
  const findFirstUnansweredStep = useCallback((startFrom: StepId = 'INIT', answeredKeysOverride?: Set<string>): StepId => {
    let keysToCheck = answeredKeysOverride || answeredKeys
    if (!isAnonymous) {
      keysToCheck = withProfileSatisfiedArtistName(keysToCheck, profile?.artist_name)
    }

    if (isAnonymous && isFreeTasteGateReached(keysToCheck)) {
      return FREE_TASTE_LAST_STEP_ID
    }

    let current: StepId = isAnonymous ? clampStepToFreeTaste(startFrom) : startFrom
    const visited = new Set<StepId>()
    
    while (current !== 'COMPLETE' && !visited.has(current)) {
      visited.add(current)

      if (isAnonymous && isBeyondFreeTaste(current)) {
        return findFirstUnansweredInFreeTaste(keysToCheck)
      }

      const step = getStep(current)
      
      // CRITICAL: Completion steps (PRE_COMPLETE, PROD_COMPLETE, etc.) are celebrations
      // They should be shown when all questions in their phase are answered
      if (step.id.includes('_COMPLETE')) {
        // Check if all questions in this phase are answered before showing completion step
        const phase = step.phase
        if (phase) {
          // Get all steps in this phase (excluding completion steps)
          const phaseSteps = Object.values(CURRICULUM).filter(s => 
            s.phase === phase && 
            !s.id.includes('_COMPLETE') && 
            s.key && 
            s.key.length > 0
          )
          
          // Check if all phase questions are answered
          const allPhaseAnswered = phaseSteps.every(s => keysToCheck.has(s.key))
          
          if (allPhaseAnswered) {
            // All questions answered - show completion step
            return current
          } else {
            // Not all answered - continue to next step (skip completion)
            current = step.nextStep
            continue
          }
        } else {
          // No phase - return completion step (safety)
          return current
        }
      }
      
      // CRITICAL: Skip other steps with empty keys (shouldn't happen, but safety check)
      if (!step.key || step.key.length === 0) {
        current = step.nextStep
        continue
      }
      
      // CRITICAL: Panel steps are now shown inline, so don't skip them
      // Check if this step hasn't been answered (for panel steps, check if key exists in answeredKeys)
      if (!keysToCheck.has(step.key)) {
        return current
      }
      
      // Move to next step
      current = step.nextStep
    }
    
    return 'COMPLETE'
  }, [answeredKeys, isAnonymous, profile?.artist_name])
  
  // Helper: Load answer from fullHistory or database
  const loadAnswerForStep = useCallback(async (stepId: StepId): Promise<string> => {
    const step = getStep(stepId)
    
    // Try 1: Check fullHistory first (fast, no DB query)
    const fullHistoryAnswer = fullHistory.find(
      msg => msg.stepId === stepId && msg.role === 'user'
    )
    if (fullHistoryAnswer) {
      if (isSelectStep(step)) {
        return resolveSelectValue(step, fullHistoryAnswer.content)
      }
      return fullHistoryAnswer.content
    }
    
    // Try 2: Load from database (only if not found in fullHistory)
    if (!step.key) return ''
    
    if (isAnonymous) {
      const draftText = getDraftAnswerText(step.key)
      if (draftText) {
        if (isSelectStep(step)) {
          return resolveSelectValue(step, draftText)
        }
        return draftText
      }
      return ''
    }
    
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return ''
      
      const { data: answer } = await supabase
        .from('curriculum_answers')
        .select('answer_data')
        .eq('user_id', user.id)
        .eq('question_key', step.key)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      
      if (answer?.answer_data) {
        const answerData = answer.answer_data as { text?: string; content?: string; label?: string }
        const raw = answerData?.text || answerData?.content || ''
        if (isSelectStep(step)) {
          return resolveSelectValue(step, raw)
        }
        return answerData?.label || raw
      }
    } catch (err) {
      console.error('Error loading answer:', err)
    }
    
    return ''
  }, [fullHistory, supabase, isAnonymous])
  
  // CRITICAL: Update question IMMEDIATELY (synchronous) - no async delay
  // This prevents flash of wrong question (like INIT) during carousel navigation
  const handleEditStep = useCallback(async (stepId: StepId, focusInput: boolean = false) => {
    if (isAnonymous && isBeyondFreeTaste(stepId)) return

    setAnonymousGateView(false)
    // Clear redo stack when editing (editing is a new action)
    setRedoStack([])
    const step = getStep(stepId)
    const stepMessage = { role: 'assistant' as const, content: step.question, stepId }
    
    // Pencil-editing the colors card is an EXPLICIT request to open the brand picker
    // (survives the reset-on-step-change effect via keepPickerOpenRef)
    if (isColorsPanelStep(step)) {
      keepPickerOpenRef.current = true
      setPickerOpenedExplicitly(true)
    }
    
    // Find assistant question in history
    const assistantQuestionIndex = history.findIndex(msg => msg.stepId === stepId && msg.role === 'assistant')
    
    // Update history immediately
    if (assistantQuestionIndex === -1) {
      setHistory([stepMessage])
      setFullHistory(prev => {
        // Only add if not already there
        const exists = prev.some(msg => msg.stepId === stepId && msg.role === 'assistant')
        if (!exists) {
          return [...prev, stepMessage]
        }
        return prev
      })
    } else {
      // Remove all messages after the assistant question
      setHistory(prev => prev.slice(0, assistantQuestionIndex + 1))
    }
    
    // Update currentStepId immediately (effect at line 55-59 will notify parent automatically)
    setCurrentStepId(stepId)
    
    // Find previous step immediately
    const allSteps = Object.values(CURRICULUM)
    const prevStep = allSteps.find(s => s.nextStep === stepId)
    setPreviousStepId(prevStep?.id || null)
    
    // CRITICAL: Load answer asynchronously AFTER question is shown
    // This ensures question appears instantly, answer loads in background
    const userAnswer = await loadAnswerForStep(stepId)
    setInput(userAnswer) // Restore answer when loaded
    
    // Focus input if requested (e.g., when edit pencil is clicked)
    if (focusInput) {
      setTimeout(() => {
        inputRef.current?.focus()
      }, 50)
    }
  }, [history, loadAnswerForStep, isAnonymous])
  
  // CRITICAL: Listen for token navigation events (from ArtisTalksOrbitRenderer)
  useEffect(() => {
    const handleTokenNavigate = (e: Event) => {
      const customEvent = e as CustomEvent<{ stepId: StepId }>
      const stepId = customEvent.detail?.stepId
      if (stepId) {
        if (isAnonymous && isBeyondFreeTaste(stepId)) return
        setAnonymousGateView(false)
        const step = getStep(stepId)
        openColorsPickerForStep(stepId)
        setCurrentStepId(stepId) // Effect at line 55-59 handles notification automatically
        setInput('') // Token jumps target unanswered questions - leftover text from the previous step must not carry over
        const stepMessage = { role: 'assistant' as const, content: step.question, stepId }
        setHistory([stepMessage])
        setFullHistory(prev => [...prev, stepMessage])
      }
    }
    
    window.addEventListener('tokenNavigate', handleTokenNavigate as EventListener)
    return () => {
      window.removeEventListener('tokenNavigate', handleTokenNavigate as EventListener)
    }
  }, [onCurrentStepChange, isAnonymous, openColorsPickerForStep])
  
  // CRITICAL: Listen for card edit events (from OrbitPeekCarousel)
  useEffect(() => {
    const handleCardEdit = async (e: Event) => {
      const customEvent = e as CustomEvent<{ stepId: StepId; focusInput?: boolean }>
      const stepId = customEvent.detail?.stepId
      const focusInput = customEvent.detail?.focusInput ?? false
      if (stepId) {
        await handleEditStep(stepId, focusInput)
        // Effect at line 55-59 handles notification automatically when currentStepId changes
      }
    }
    
    window.addEventListener('cardEdit', handleCardEdit as EventListener)
    return () => {
      window.removeEventListener('cardEdit', handleCardEdit as EventListener)
    }
  }, [handleEditStep]) // Include handleEditStep in dependencies for correct closure
  
  // CRITICAL: Listen for card navigation events (swiping, NOT editing)
  // Navigation should update chat without entering edit mode
  useEffect(() => {
    const handleCardNavigate = async (e: Event) => {
      const customEvent = e as CustomEvent<{ stepId: StepId }>
      const stepId = customEvent.detail?.stepId
      if (stepId) {
        if (isAnonymous && isBeyondFreeTaste(stepId)) return
        // CRITICAL: Navigation is NOT editing - don't call handleEditStep
        setAnonymousGateView(false)
        const step = getStep(stepId)
        openColorsPickerForStep(stepId)
        setCurrentStepId(stepId) // Effect at line 55-59 handles notification automatically
        const stepMessage = { role: 'assistant' as const, content: step.question, stepId }
        setHistory([stepMessage])
        // Don't add to fullHistory - navigation isn't new content
        
        // Load answer if it exists (for answered cards being viewed)
        const userAnswer = await loadAnswerForStep(stepId)
        setInput(userAnswer) // Show answer if editing, empty if new question
      }
    }
    
    window.addEventListener('cardNavigate', handleCardNavigate as EventListener)
    return () => {
      window.removeEventListener('cardNavigate', handleCardNavigate as EventListener)
    }
  }, [loadAnswerForStep, isAnonymous, openColorsPickerForStep])
  
  // Initialize chat on mount - start from INIT immediately, then update if answers exist
  useEffect(() => {
    if (history.length > 0) return

    if (isAnonymous) {
      const draft = loadDraft()
      const hasDraftProgress =
        draft &&
        (draft.answers.length > 0 ||
          draft.currentStepId !== 'INIT' ||
          !!draft.profilePreview.artist_name)

      if (hasDraftProgress && draft) {
        hasInitializedRef.current = true
        const draftKeys = getDraftAnsweredKeys()

        if (isFreeTasteGateReached(draftKeys)) {
          setAnonymousGateView(true)
          setCurrentStepId(FREE_TASTE_LAST_STEP_ID)
          if (draft.currentStepId !== FREE_TASTE_LAST_STEP_ID) {
            setDraftCurrentStepId(FREE_TASTE_LAST_STEP_ID)
          }
          const gateMessage = {
            role: 'assistant' as const,
            content: ANONYMOUS_GATE_MESSAGE,
            stepId: FREE_TASTE_LAST_STEP_ID,
          }
          setHistory([gateMessage])
          setFullHistory([gateMessage])
          return
        }

        let stepId = clampStepToFreeTaste(draft.currentStepId)
        if (isBeyondFreeTaste(draft.currentStepId)) {
          stepId = findFirstUnansweredInFreeTaste(draftKeys)
          setDraftCurrentStepId(stepId)
        }
        const step = getStep(stepId)
        setCurrentStepId(stepId)
        const assistantContent = stepId === 'INIT' ? getStep('INIT').question : step.question
        const stepMessage = {
          role: 'assistant' as const,
          content: assistantContent,
          stepId,
        }
        setHistory([stepMessage])
        setFullHistory([stepMessage])

        if (stepId === 'INIT' && draft.profilePreview.artist_name) {
          setInput(draft.profilePreview.artist_name)
          if (onTypingUpdate) {
            onTypingUpdate(draft.profilePreview.artist_name, 'INIT')
          }
        } else if (step.key) {
          const saved = getDraftAnswerText(step.key)
          if (saved) setInput(saved)
        }
        return
      }
    }

    const initStep = getStep('INIT')
    setCurrentStepId('INIT')
    const initMessage = {
      role: 'assistant' as const,
      content: initStep.question,
      stepId: 'INIT' as StepId,
    }
    setHistory([initMessage])
    setFullHistory([initMessage])
  }, [onCurrentStepChange, isAnonymous, onTypingUpdate])
  
  // Track previous answeredKeys size to detect initial load (0 -> N) vs new answers (N -> N+1)
  const prevAnsweredKeysSizeRef = useRef<number>(0)
  
  // CRITICAL: Reset refs when answeredKeys is cleared (data reset)
  useEffect(() => {
    if (answeredKeys.size === 0 && prevAnsweredKeysSizeRef.current > 0) {
      // Data was reset - reset initialization state
      hasInitializedRef.current = false
      prevAnsweredKeysSizeRef.current = 0
    }
  }, [answeredKeys.size])
  
  // Update to first unanswered step once answeredKeys loads (if answers exist)
  // CRITICAL: Only run ONCE when answeredKeys first loads from database (0 -> N), not when new answers are saved (N -> N+1)
  useEffect(() => {
    // Skip if history is empty (initialization effect hasn't run yet)
    if (history.length === 0) return
    
    // Skip if already initialized (user is actively progressing through curriculum)
    if (hasInitializedRef.current) return

    if (isAnonymous && isFreeTasteGateReached(answeredKeys)) {
      hasInitializedRef.current = true
      return
    }

    // Authenticated: wait until first curriculum_answers fetch completes (may be empty)
    if (!isAnonymous && !answeredKeysReady) return
    
    // CRITICAL: Only sync on initial load (0 -> N), not when new answers are saved (N -> N+1)
    const currentSize = answeredKeys.size
    const prevSize = prevAnsweredKeysSizeRef.current
    const isInitialLoad = prevSize === 0 && currentSize > 0
    const profileName = !isAnonymous ? profile?.artist_name?.trim() : ''
    const effectiveKeys = withProfileSatisfiedArtistName(answeredKeys, profileName)
    // Resume when keys arrive, or when durable profile name satisfies INIT with empty/partial keys
    const shouldResumeAuthenticated =
      !isAnonymous &&
      !!profileName &&
      answeredKeysReady &&
      currentStepId === 'INIT'
    
    // Update ref for next check
    prevAnsweredKeysSizeRef.current = currentSize
    
    // Skip if not initial load and not authenticated profile-resume
    if (!isInitialLoad && !shouldResumeAuthenticated) return
    
    // CRITICAL: Skip if on PRE_COMPLETE or any completion step (celebration step - don't interfere)
    if (currentStepId === 'PRE_COMPLETE' || currentStepId.includes('_COMPLETE')) return
    
    // Skip if already on INIT and no answers exist and no profile name (shouldn't happen with isInitialLoad check, but safety)
    if (currentStepId === 'INIT' && currentSize === 0 && !profileName) return
    
    // CRITICAL: Skip if we're past INIT (user has progressed manually)
    // This prevents resetting to INIT when user is actively answering questions
    if (currentStepId !== 'INIT') {
      // User has already progressed - mark as initialized to prevent any interference
      hasInitializedRef.current = true
      return
    }
    
    // Resume from first unanswered (profile.artist_name counts as artist_name for authenticated)
    if (currentSize > 0 || profileName) {
      const firstUnanswered = findFirstUnansweredStep('INIT', effectiveKeys)
      if (firstUnanswered !== currentStepId) {
        const step = getStep(firstUnanswered)
        setCurrentStepId(firstUnanswered)
        const stepMessage = {
          role: 'assistant' as const,
          content: step.question,
          stepId: firstUnanswered,
        }
        setHistory([stepMessage])
        setFullHistory([stepMessage])
      }
      hasInitializedRef.current = true
    }
  }, [answeredKeys.size, findFirstUnansweredStep, currentStepId, history.length, isAnonymous, answeredKeys, answeredKeysReady, profile?.artist_name])
  
  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight
    }
  }
  
  // Listen for panel completion events to advance curriculum
  useEffect(() => {
    const handlePanelComplete = (e: Event) => {
      const customEvent = e as CustomEvent<{ stepId: StepId }>
      const stepId = customEvent.detail?.stepId
      
      // Only advance if this panel matches the current step
      if (stepId && stepId === currentStepId) {
        const nextStepId = currentStep.nextStep
        const nextStep = getStep(nextStepId)
        
        setTimeout(() => {
          // CRITICAL: Panel steps are now shown inline, don't trigger old panel mode
          // Just advance to next step (inline picker will render automatically)
          const nextMessage = { role: 'assistant' as const, content: nextStep.question, stepId: nextStepId }
          setHistory([nextMessage])
          setFullHistory(prev => [...prev, nextMessage]) // Add to full history
          setPreviousStepId(currentStepId)
          setCurrentStepId(nextStepId) // Effect at line 55-59 handles notification automatically
        }, 300) // Small delay to let panel close animation finish
      }
    }
    
    window.addEventListener('panelComplete', handlePanelComplete as EventListener)
    return () => {
      window.removeEventListener('panelComplete', handlePanelComplete as EventListener)
    }
  }, [currentStepId, currentStep, onTriggerPanel])

  // Auto-scroll chat to bottom when messages change
  useEffect(() => {
    scrollToBottom()
  }, [history, isSubmitting])

  // Initial greeting is now handled in the answeredKeys effect above

  // Live Typing Effect
  useEffect(() => {
    if (isSelectInputStep) return
    if (claimedGateView) return
    
    if (!input.trim() || isSubmitting) {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current)
        debounceTimer.current = null
      }
      return
    }

    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    
    debounceTimer.current = setTimeout(() => {
      if (!input.trim()) return
      
      if (isAnonymous) {
        if (currentStep.key === 'artist_name') {
          setDraftProfilePreview({ artist_name: input })
          onDraftRefresh?.()
        } else if (currentStep.key === 'gift_to_world') {
          setDraftProfilePreview({ mission_statement: input })
          onDraftRefresh?.()
        }
      } else if (onProfileUpdate) {
        if (currentStep.key === 'artist_name') {
          onProfileUpdate({ artist_name: input })
        } else if (currentStep.key === 'gift_to_world') {
          onProfileUpdate({ mission_statement: input })
        }
      }
      
      if (onTypingUpdate) {
        onTypingUpdate(input, currentStepId)
      }
    }, 50)

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
    }
  }, [input, currentStep.key, onProfileUpdate, isSubmitting, isSelectInputStep, onTypingUpdate, currentStepId, isAnonymous, onDraftRefresh, claimedGateView])

  // Keep portal headline on the claimed name while the sanctuary gate is open
  useEffect(() => {
    if (!claimedGateView || !claimedArtistName) return
    onTypingUpdate?.(claimedArtistName, 'INIT')
  }, [claimedGateView, claimedArtistName, onTypingUpdate])

  const handleUseDifferentArtistName = () => {
    clearReturningClaimMarker()
    clearDraftArtistNameAttempt()
    setClaimedGateView(false)
    setClaimedArtistName('')
    setClaimError('')
    setAnonymousGateView(false)
    setAnsweredKeys((prev) => {
      const next = new Set(prev)
      next.delete('artist_name')
      return next
    })
    setCurrentStepId('INIT')
    setPreviousStepId(null)
    setInput('')
    setHistory([])
    setFullHistory([])
    onTypingUpdate?.('', 'INIT')
    onDraftRefresh?.()
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const handleUndo = () => {
    if (previousStepId) {
      // Save current state to redo stack
      setRedoStack(prev => [...prev, {
        stepId: currentStepId,
        previousStepId: previousStepId,
        history: [...history]
      }])
      
      // Go back to previous step
      setCurrentStepId(previousStepId) // Effect at line 55-59 handles notification automatically
      setHistory(prev => prev.slice(0, -2))
      
      // Find the step before the previous one
      const allSteps = Object.values(CURRICULUM)
      const prevPrevStep = allSteps.find(s => s.nextStep === previousStepId)
      setPreviousStepId(prevPrevStep?.id || null)
    }
  }

  const handleRedo = () => {
    if (redoStack.length > 0) {
      const lastUndone = redoStack[redoStack.length - 1]
      
      // Restore the undone state
      setCurrentStepId(lastUndone.stepId) // Effect at line 55-59 handles notification automatically
      setPreviousStepId(lastUndone.previousStepId)
      setHistory(lastUndone.history)
      
      // Remove from redo stack
      setRedoStack(prev => prev.slice(0, -1))
    }
  }

  const handleLast = () => {
    if (previousStepId && !isSubmitting) {
      setAnonymousGateView(false)
      const prevStep = getStep(previousStepId)
      setCurrentStepId(previousStepId) // Effect at line 55-59 handles notification automatically
      // Find the step before previous for new previousStepId
      const allSteps = Object.values(CURRICULUM)
      const prevPrevStep = allSteps.find(s => s.nextStep === previousStepId)
      setPreviousStepId(prevPrevStep?.id || null)
      // Only show current question
      const prevMessage = { role: 'assistant' as const, content: prevStep.question, stepId: previousStepId }
      setHistory([prevMessage])
      // Don't add to fullHistory - it's navigation, not new content
      setInput('')
    }
  }
  
  const handleNext = () => {
    if (isSubmitting || currentStepId === 'COMPLETE') return
    if (isAnonymous && currentStepId === 'INIT') return
    if (isAnonymous && isFreeTasteGateReached(answeredKeys)) return
    if (isAnonymous && isBeyondFreeTaste(currentStep.nextStep)) return
    
    const nextStepId = currentStep.nextStep
    const firstUnanswered = findFirstUnansweredStep(nextStepId)
    const nextStep = getStep(firstUnanswered)
    
    // Move to next unanswered question without saving
    setCurrentStepId(firstUnanswered) // Effect at line 55-59 handles notification automatically
    setPreviousStepId(currentStepId)
    // Only show current question (no history)
    const nextMessage = { role: 'assistant' as const, content: nextStep.question, stepId: firstUnanswered }
    setHistory([nextMessage])
    // Don't add to fullHistory - skipping doesn't create history entry
    setInput('')
  }

  const handleBack = async () => {
    // Go back to edit the last answer (same as clicking edit pencil on last user message)
    // Find last answered question from fullHistory
    if (fullHistory.length > 0) {
      // Find last user message by iterating backwards
      let lastUserMessageIndex = -1
      for (let i = fullHistory.length - 1; i >= 0; i--) {
        if (fullHistory[i].role === 'user') {
          lastUserMessageIndex = i
          break
        }
      }
      if (lastUserMessageIndex !== -1) {
        const lastUserMessage = fullHistory[lastUserMessageIndex]
        if (lastUserMessage.stepId) {
          await handleEditStep(lastUserMessage.stepId)
        }
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    // CRITICAL: If picker is active, save to curriculum_answers and advance to next step
    if (isColorsPanelStep(currentStep)) {
      // Profile is already updated by picker (live preview)
      // Now save to curriculum_answers when user clicks Send
      // CRITICAL: Use currentPickerState to get actual current values (handles removals correctly)
      const { data: { user } } = isAnonymous
        ? { data: { user: null } }
        : await supabase.auth.getUser()
      
      let nextStepId = currentStep.nextStep
      let finalStep = getStep(nextStepId)
      
      if ((user || isAnonymous) && currentStep.key) {
        const primaryColor = currentPickerState.colors?.primary_color || profile?.primary_color
        const accentColor = currentPickerState.colors?.accent_color || profile?.accent_color
        const brandColor = (currentPickerState.colors as any)?.brand_color || profile?.brand_color || primaryColor
        const logoUrl = currentPickerState.logo?.logo_url !== undefined 
          ? currentPickerState.logo.logo_url 
          : profile?.logo_url
        const logoUseBackground = currentPickerState.logo?.logo_use_background !== undefined
          ? currentPickerState.logo.logo_use_background
          : profile?.logo_use_background || false
        const fontFamily = currentPickerState.font?.font_family || profile?.font_family
        
        if (user) {
          const { error: colorsError } = await supabase.from('curriculum_answers').upsert({
            user_id: user.id,
            question_key: 'colors_set',
            answer_data: {
              text: 'Colors set',
              primary: primaryColor,
              accent: accentColor,
              brand_color: brandColor,
              step_id: currentStepId
            },
            project_id: null
          })
          if (colorsError) {
            console.error('Error saving colors_set:', colorsError.message)
            setSaveError('Your brand choices could not be saved. Try Send again.')
            setIsSubmitting(false)
            return
          }
          
          if (logoUrl) {
            const { error: logoError } = await supabase.from('curriculum_answers').upsert({
              user_id: user.id,
              question_key: 'logo_uploaded',
              answer_data: {
                text: 'Logo uploaded',
                url: logoUrl,
                logo_use_background: logoUseBackground,
                step_id: currentStepId
              },
              project_id: null
            })
            if (logoError) {
              console.error('Error saving logo_uploaded:', logoError.message)
              setSaveError('Your brand choices could not be saved. Try Send again.')
              setIsSubmitting(false)
              return
            }
          }
          
          if (fontFamily) {
            const { error: fontError } = await supabase.from('curriculum_answers').upsert({
              user_id: user.id,
              question_key: 'font_set',
              answer_data: {
                text: 'Font set',
                font: fontFamily,
                step_id: currentStepId
              },
              project_id: null
            })
            if (fontError) {
              console.error('Error saving font_set:', fontError.message)
              setSaveError('Your brand choices could not be saved. Try Send again.')
              setIsSubmitting(false)
              return
            }
          }
          setSaveError('')
        } else {
          upsertDraftAnswer('colors_set', {
            text: 'Colors set',
            primary: primaryColor,
            accent: accentColor,
            brand_color: brandColor,
            step_id: currentStepId,
          })
          if (logoUrl) {
            upsertDraftAnswer('logo_uploaded', {
              text: 'Logo uploaded',
              url: logoUrl,
              logo_use_background: logoUseBackground,
              step_id: currentStepId,
            })
          }
          if (fontFamily) {
            upsertDraftAnswer('font_set', {
              text: 'Font set',
              font: fontFamily,
              step_id: currentStepId,
            })
          }
          setDraftProfilePreview({
            primary_color: primaryColor ?? undefined,
            accent_color: accentColor ?? undefined,
            brand_color: brandColor ?? undefined,
            logo_url: logoUrl ?? undefined,
            logo_use_background: logoUseBackground,
            font_family: fontFamily ?? undefined,
          })
          onDraftRefresh?.()
        }
        
        const updatedAnsweredKeys = new Set(answeredKeys)
        updatedAnsweredKeys.add('colors_set')
        if (logoUrl) updatedAnsweredKeys.add('logo_uploaded')
        if (fontFamily) updatedAnsweredKeys.add('font_set')
        setAnsweredKeys(updatedAnsweredKeys)
        
        setCurrentPickerState({})
        
        nextStepId = currentStep.nextStep
        finalStep = getStep(nextStepId)
        
        if (finalStep.id.includes('_COMPLETE')) {
          const phase = finalStep.phase
          if (phase) {
            const phaseSteps = Object.values(CURRICULUM).filter(s => 
              s.phase === phase && 
              !s.id.includes('_COMPLETE') && 
              s.key && 
              s.key.length > 0
            )
            
            const allPhaseAnswered = phaseSteps.every(s => updatedAnsweredKeys.has(s.key))
            
            if (!allPhaseAnswered) {
              const firstUnanswered = findFirstUnansweredStep(nextStepId, updatedAnsweredKeys)
              nextStepId = firstUnanswered
              finalStep = getStep(nextStepId)
            }
          }
        } else {
          const firstUnanswered = findFirstUnansweredStep(nextStepId, updatedAnsweredKeys)
          nextStepId = firstUnanswered
          finalStep = getStep(nextStepId)
        }

        if (isAnonymous) {
          if (isBeyondFreeTaste(nextStepId)) {
            nextStepId = findFirstUnansweredInFreeTaste(updatedAnsweredKeys)
            finalStep = getStep(nextStepId)
          }
          setDraftCurrentStepId(nextStepId)
        }
      }
      
      setTimeout(() => {
        const nextMessage = { role: 'assistant' as const, content: finalStep.question, stepId: nextStepId }
        setHistory([nextMessage])
        setFullHistory(prev => [...prev, nextMessage])
        setPreviousStepId(currentStepId)
        setCurrentStepId(nextStepId)
      }, 300)
      return
    }
    
    // CRITICAL: All celebration steps (PRE_COMPLETE, PROD_COMPLETE, POST_COMPLETE) are temporary
    // No input required, just show Continue button
    // Celebration cards disappear immediately when Continue is clicked, next card appears instantly
    if (currentStepId.includes('_COMPLETE') && currentStepId !== 'COMPLETE') {
      if (isAnonymous && isFreeTasteGateReached(answeredKeys)) return
      const nextStepId = currentStep.nextStep
      if (isAnonymous && isBeyondFreeTaste(nextStepId)) return
      const firstUnanswered = findFirstUnansweredStep(nextStepId, answeredKeys)
      const finalStep = getStep(firstUnanswered)
      
      // CRITICAL: No delay - instant transition for smooth UX
      // Celebration card disappears immediately, next question card appears instantly
      const nextMessage = { role: 'assistant' as const, content: finalStep.question, stepId: firstUnanswered }
      setHistory([nextMessage])
      setFullHistory(prev => [...prev, nextMessage])
      setPreviousStepId(currentStepId)
      setCurrentStepId(firstUnanswered) // Effect at line 55-59 handles notification automatically
      setIsSubmitting(false)
      setTimeout(() => {
        inputRef.current?.focus()
      }, 100)
      return
    }
    
    const isSelectSubmit = isSelectStep(currentStep)
    const selectedEnum = isSelectSubmit ? input.trim() : ''
    const displayAnswer = isSelectSubmit
      ? (getSelectLabel(currentStep, selectedEnum) || '')
      : input.trim()

    if (isSelectSubmit) {
      if (!selectedEnum || !displayAnswer || isSubmitting) return
    } else if (!input.trim() || isSubmitting) {
      return
    }

    const answer = isSelectSubmit ? displayAnswer : input.trim()
    setIsSubmitting(true)
    setClaimError('')

    // Returning-artist recognition — only after Submit on artist_name (anonymous)
    if (isAnonymous && currentStep.key === 'artist_name') {
      try {
        const res = await fetch('/api/artist/claim-challenge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ artist_name: answer }),
        })
        const data = (await res.json().catch(() => ({}))) as {
          claimed?: boolean
          sent?: boolean
          error?: string
        }

        if (res.status === 429) {
          setClaimError(
            typeof data.error === 'string' && data.error
              ? data.error
              : 'Too many attempts. Try again later.'
          )
          setIsSubmitting(false)
          return
        }

        if (!res.ok) {
          setClaimError(
            typeof data.error === 'string' && data.error
              ? data.error
              : 'Unable to continue. Try again.'
          )
          setIsSubmitting(false)
          return
        }

        if (data.claimed) {
          // Do not keep claimed name in anonymous curriculum draft
          clearDraftArtistNameAttempt()
          setReturningClaimMarker()
          setClaimedArtistName(answer)
          setClaimedGateView(true)
          onTypingUpdate?.(answer, 'INIT')
          onDraftRefresh?.()
          setInput('')
          setIsSubmitting(false)
          return
        }
        // unclaimed → continue into free taste below
      } catch {
        setClaimError('Unable to continue. Try again.')
        setIsSubmitting(false)
        return
      }
    }

    // Trigger card swipe animation before saving
    if (onSubmitCard) {
      onSubmitCard(answer, currentStepId)
    }

    // 1. Update UI immediately (Optimistic)
    const userMessage = { role: 'user' as const, content: answer, stepId: currentStepId }
    
    // Add only user's answer to full history - question is already there from when it was shown
    setFullHistory(prev => [...prev, userMessage])
    
    // Keep the current question visible until the next one is ready.
    // Clearing history here creates an empty render gap where INIT can flash.
    setInput('')
    setSaveError('')

    try {
      // 2. Save to Supabase (The Log)
      const user = isAnonymous ? null : (await supabase.auth.getUser()).data.user
      
      if (user) {
        // Save the answer to the log (use upsert to update existing answer or insert new)
        // This prevents duplicate cards when editing a question
        // CRITICAL: Check if answer already exists, then update or insert accordingly
        const { data: existingAnswer, error: checkError } = await supabase
          .from('curriculum_answers')
          .select('id')
          .eq('user_id', user.id)
          .eq('question_key', currentStep.key)
          .maybeSingle() // Use maybeSingle() instead of single() to avoid error when no row exists

        if (checkError) {
          console.error('Error checking answer:', checkError.message)
          setInput(answer)
          setSaveError('Your answer could not be saved. It is still in the box — try again.')
          setIsSubmitting(false)
          return
        }
        
        if (existingAnswer) {
          // Update existing answer
          const { error: updateError } = await supabase
            .from('curriculum_answers')
            .update({
              answer_data: isSelectSubmit
                ? {
                    text: selectedEnum,
                    label: displayAnswer,
                    step_id: currentStepId,
                  }
                : {
                    text: answer,
                    step_id: currentStepId,
                  },
            })
            .eq('id', existingAnswer.id)
          
          if (updateError) {
            console.error('Error updating answer:', updateError.message)
            setInput(answer)
            setSaveError('Your answer could not be saved. It is still in the box — try again.')
            setIsSubmitting(false)
            return
          }
        } else {
          // Insert new answer
          const { error: insertError } = await supabase.from('curriculum_answers').insert({
            user_id: user.id,
            question_key: currentStep.key,
            answer_data: isSelectSubmit
              ? {
                  text: selectedEnum,
                  label: displayAnswer,
                  step_id: currentStepId,
                }
              : {
                  text: answer,
                  step_id: currentStepId,
                },
            project_id: null 
          })
          
          if (insertError) {
            console.error('Error inserting answer:', insertError.message)
            setInput(answer)
            setSaveError('Your answer could not be saved. It is still in the box — try again.')
            setIsSubmitting(false)
            return
          }
        }
        
        // Force a final "Hard Save" of the profile to ensure consistency
        // This calls useProfile's updateProfile which handles the DB save for profile
        if (onProfileUpdate) {
           if (currentStep.key === 'artist_name') onProfileUpdate({ artist_name: answer })
           if (currentStep.key === 'gift_to_world') onProfileUpdate({ mission_statement: answer })
        }

      } else if (isAnonymous && currentStep.key) {
        upsertDraftAnswer(
          currentStep.key,
          isSelectSubmit
            ? {
                text: selectedEnum,
                label: displayAnswer,
                step_id: currentStepId,
              }
            : {
                text: answer,
                step_id: currentStepId,
              }
        )
        if (currentStep.key === 'artist_name') {
          setDraftProfilePreview({ artist_name: answer })
        }
        if (currentStep.key === 'gift_to_world') {
          setDraftProfilePreview({ mission_statement: answer })
        }
        onDraftRefresh?.()
      }

      // Clear redo stack when user makes a new action (can't redo after new action)
      setRedoStack([])

      // CRITICAL: Update answeredKeys only after durable save succeeded
      const updatedAnsweredKeys = new Set([...answeredKeys, currentStep.key])
      setAnsweredKeys(updatedAnsweredKeys)

      if (isAnonymous && updatedAnsweredKeys.has(FREE_TASTE_LAST_KEY)) {
        setAnonymousGateView(true)
        setDraftCurrentStepId(FREE_TASTE_LAST_STEP_ID)
        const gateMessage = {
          role: 'assistant' as const,
          content: ANONYMOUS_GATE_MESSAGE,
          stepId: FREE_TASTE_LAST_STEP_ID,
        }
        setHistory([gateMessage])
        setFullHistory((prev) => [...prev, gateMessage])
        setPreviousStepId(currentStepId)
        setCurrentStepId(FREE_TASTE_LAST_STEP_ID)
        setIsSubmitting(false)
        return
      }

      // 3. Move to Next Step
      let nextStepId = currentStep.nextStep
      const nextStep = getStep(nextStepId)
      
      // CRITICAL: If next step is a completion step, check if we should show it
      // Completion steps should be shown when all questions in their phase are answered
      if (nextStep.id.includes('_COMPLETE')) {
        const phase = nextStep.phase
        if (phase) {
          // Get all steps in this phase (excluding completion steps)
          const phaseSteps = Object.values(CURRICULUM).filter(s => 
            s.phase === phase && 
            !s.id.includes('_COMPLETE') && 
            s.key && 
            s.key.length > 0
          )
          
          // CRITICAL: Use updatedAnsweredKeys (includes current answer) not stale answeredKeys
          const allPhaseAnswered = phaseSteps.every(s => updatedAnsweredKeys.has(s.key))
          
          if (allPhaseAnswered) {
            // All questions answered - show completion step
            // Don't call findFirstUnansweredStep - just use the completion step
          } else {
            // Not all answered - skip to first unanswered question
            // CRITICAL: Pass updatedAnsweredKeys to use immediately updated keys
            const firstUnanswered = findFirstUnansweredStep(nextStepId, updatedAnsweredKeys)
            nextStepId = firstUnanswered
          }
        }
      } else {
        const firstUnanswered = findFirstUnansweredStep(nextStepId, updatedAnsweredKeys)
        nextStepId = firstUnanswered
      }
      
      if (isAnonymous) {
        if (isBeyondFreeTaste(nextStepId)) {
          nextStepId = findFirstUnansweredInFreeTaste(updatedAnsweredKeys)
        }
        setDraftCurrentStepId(nextStepId === 'COMPLETE' ? 'COMPLETE' : nextStepId)
      }

      const finalStep = getStep(nextStepId)
      
      // CRITICAL: Instant transition - no delay for seamless UX
      // Card and question appear together immediately, no flash of wrong card
      // Normal chat flow - only show current question (no history building up)
      if (nextStepId !== 'COMPLETE') {
        // Only show current question in chat (clear previous)
        const nextMessage = { role: 'assistant' as const, content: finalStep.question, stepId: nextStepId }
        setHistory([nextMessage])
        setFullHistory(prev => [...prev, nextMessage]) // Add to full history
        setPreviousStepId(currentStepId)
        setCurrentStepId(nextStepId) // Effect at line 55-59 handles notification automatically
      } else {
        const completeMessage = { role: 'assistant' as const, content: finalStep.question, stepId: nextStepId }
        setHistory([completeMessage])
        setFullHistory(prev => [...prev, completeMessage]) // Add to full history
        setPreviousStepId(currentStepId)
        setCurrentStepId('COMPLETE') // Effect at line 55-59 handles notification automatically
      }
      setIsSubmitting(false)
      // Refocus input after submit (Zeyoda pattern)
      setTimeout(() => {
        inputRef.current?.focus()
      }, 100)

    } catch (error) {
      console.error("Error in submit flow:", error)
      setIsSubmitting(false)
      // Refocus input on error too
      setTimeout(() => {
        inputRef.current?.focus()
      }, 100)
    }
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto rounded-lg overflow-hidden"
      style={{
        backgroundImage: 'url(/IMG_723E215270D1-1.jpeg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        padding: '20px', /* EXACT from nodrinks */
        boxShadow: '0 0 10px rgba(255, 215, 0, 0.8)', /* Golden glimmer - EXACT from nodrinks */
        maxWidth: '450px', /* Slightly wider than nodrinks 400px */
        width: '90%', /* EXACT from nodrinks */
        textAlign: 'center', /* EXACT from nodrinks */
        color: 'white', /* EXACT from nodrinks */
        margin: '0 auto', /* Zeyoda pattern: no extra margin, parent handles spacing */
        // CRITICAL: Expand height only when the full picker is shown (not the compact summary)
        minHeight: showColorsPicker ? '500px' : 'auto'
      }}
    >
      <div>
        {/* Current Question OR Inline Picker OR anonymous gate OR claimed sanctuary */}
        {showClaimedGate ? (
          <ClaimedArtistGate
            artistName={claimedArtistName}
            onUseDifferentName={handleUseDifferentArtistName}
          />
        ) : showGateUI ? (
          <>
            <LivingAffirmation text={livingAffirmationText} />
            <p
              className="gold-etched"
              style={{ marginTop: '0', marginBottom: '20px', whiteSpace: 'pre-line' }}
            >
              {ANONYMOUS_GATE_MESSAGE}
            </p>
          </>
        ) : currentStep && currentStep.question && (
          <>
            {/* Show inline picker if this step triggers a panel AND the artist is actively answering/editing it */}
            {showColorsPicker ? (
              <div className="mb-4">
                <h2 className="gold-etched text-lg mb-3" style={{ marginTop: '0', marginBottom: '12px' }}>
                  {currentStep.question}
                </h2>
                <InlineColorPicker
                  profile={profile || null}
                  onColorChange={async (updates) => {
                    // CRITICAL: Track current state for saving when Send is clicked
                    // Now handles colors, logo, and font together
                    setCurrentPickerState(prev => ({
                      ...prev,
                      colors: {
                        primary_color: updates.primary_color,
                        accent_color: updates.accent_color,
                        brand_color: updates.brand_color
                      },
                      logo: {
                        logo_url: updates.logo_url !== undefined ? updates.logo_url : prev.logo?.logo_url,
                        logo_use_background: updates.logo_use_background !== undefined ? updates.logo_use_background : prev.logo?.logo_use_background
                      },
                      font: {
                        font_family: updates.font_family
                      }
                    }))
                    
                    // Update profile for live preview
                    if (onProfileUpdate) {
                      await onProfileUpdate(updates)
                    }
                  }}
                  onPreviewChange={(preview) => {
                    // Preview updates handled internally by InlineColorPicker
                    // No need to dispatch events - InlineColorPicker handles everything
                  }}
                />
              </div>
            ) : showColorsSummary ? (
              /* Browsing an already-answered colors card: compact summary, no picker hijack */
              <div className="mb-4">
                <h2 className="gold-etched text-lg mb-3" style={{ marginTop: '0', marginBottom: '12px' }}>
                  Your brand is set.
                </h2>
                <div className="flex items-center justify-center gap-3 mb-4">
                  <span
                    title="Primary color"
                    style={{
                      width: 22, height: 22, borderRadius: 6, display: 'inline-block',
                      backgroundColor: profile?.primary_color || '#10b981',
                      border: '1px solid rgba(255,255,255,0.4)'
                    }}
                  />
                  <span
                    title="Accent color"
                    style={{
                      width: 22, height: 22, borderRadius: 6, display: 'inline-block',
                      backgroundColor: profile?.accent_color || '#fbbf24',
                      border: '1px solid rgba(255,255,255,0.4)'
                    }}
                  />
                  {profile?.logo_url && (
                    <img
                      src={profile.logo_url}
                      alt="Logo"
                      style={{ height: 22, width: 'auto', borderRadius: 4 }}
                    />
                  )}
                  <span
                    className="text-sm text-zinc-200"
                    style={{ fontFamily: profile?.font_family || undefined }}
                  >
                    {(profile?.font_family || 'Default').split(',')[0]}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setPickerOpenedExplicitly(true)}
                  className="px-4 py-2 rounded-lg border border-emerald-400/50 text-emerald-200 hover:bg-emerald-500/10 transition-colors text-sm"
                >
                  Open brand settings
                </button>
              </div>
            ) : (
              <h1 className="gold-etched" style={{ marginTop: '0', marginBottom: '20px' }}>
                {currentStepId === 'INIT'
                  ? INIT_WELCOME_HEADLINE
                  : currentStep.question
                }
              </h1>
            )}
          </>
        )}
        
        {/* History Window - Inline scrollable container */}
        {showHistory && fullHistory.length > 0 && (
          <div className="relative mb-4 rounded-lg border border-emerald-500/30 bg-black/40 backdrop-blur-sm" style={{ maxHeight: '400px' }}>
            {/* Floating Close Button - Fixed at top right */}
            <button
              onClick={() => setShowHistory(false)}
              className="absolute top-2 right-2 z-20 p-2 text-zinc-400 hover:text-emerald-400 hover:bg-emerald-500/20 rounded-lg transition-colors bg-black/70 backdrop-blur-sm"
              style={{
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title="Close history"
              aria-label="Close history"
            >
              <span className="text-xl font-bold leading-none">×</span>
            </button>
            
            {/* Scrollable History Container */}
            <div 
              className="overflow-y-auto p-4"
              style={{
                maxHeight: '400px'
              }}
            >
              <div className="space-y-3">
                {fullHistory.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {/* Edit button for user messages */}
                    {msg.role === 'user' && msg.stepId && (
                      <button
                        onClick={async () => await handleEditStep(msg.stepId!, true)}
                        className="p-1.5 rounded-lg transition-colors hover:bg-emerald-500/20 flex-shrink-0"
                        style={{
                          color: '#fffacd',
                          textShadow: '0 0 5px rgba(255, 215, 0, 0.8), 2px 2px 4px rgba(0, 0, 0, 0.7)',
                        }}
                        title="Edit answer"
                        aria-label="Edit answer"
                      >
                        <Pencil size={14} />
                      </button>
                    )}
                    
                    <div className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm font-light leading-relaxed ${
                      msg.role === 'user' 
                        ? 'bg-emerald-600 text-white rounded-tr-none' 
                        : 'bg-zinc-800/80 text-zinc-100 border border-zinc-700 rounded-tl-none'
                    }`}>
                      {msg.content}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        
        {/* Input Area — claimed sanctuary / gate OTP are separate from curriculum submit */}
        {showClaimedGate ? null : showGateUI ? (
          <div className="w-full">
            {showNavToolbar && hasUserHistory && (
              <div className="flex items-center justify-center gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => setShowHistory(!showHistory)}
                  className="p-2 rounded-lg transition-colors hover:bg-emerald-500/10"
                  style={{
                    color: '#fffacd',
                    textShadow: '0 0 5px rgba(255, 215, 0, 0.8), 2px 2px 4px rgba(0, 0, 0, 0.7)',
                    fontFamily: 'Arial, sans-serif',
                    fontWeight: 'bold',
                  }}
                  title="View history"
                >
                  <span className="text-xs font-medium">H</span>
                </button>
              </div>
            )}
            <OtpEmailFlow emailPlaceholder={gateEmailPlaceholder} sendButtonLabel="Send code" />
          </div>
        ) : (
      <form onSubmit={handleSubmit} id="artistForm">
        {/* Navigation Buttons - Back/Next/Undo/Redo */}
        {showNavToolbar && (
        <div className="flex items-center justify-center gap-2 mb-2">
          {/* History Button - View full conversation */}
          {hasUserHistory && (
            <button
              type="button"
              onClick={() => setShowHistory(!showHistory)}
              className="p-2 rounded-lg transition-colors hover:bg-emerald-500/10"
              style={{
                color: '#fffacd',
                textShadow: '0 0 5px rgba(255, 215, 0, 0.8), 2px 2px 4px rgba(0, 0, 0, 0.7)',
                fontFamily: 'Arial, sans-serif',
                fontWeight: 'bold'
              }}
              title="View history"
            >
              <span className="text-xs font-medium">H</span>
            </button>
          )}
          
          {/* Back Button - Go back to previous question */}
          {previousStepId && !isSubmitting && currentStepId !== 'INIT' && (
            <button
              type="button"
              onClick={handleLast}
              className="p-2 rounded-lg transition-colors hover:bg-emerald-500/10"
              style={{
                color: '#fffacd',
                textShadow: '0 0 5px rgba(255, 215, 0, 0.8), 2px 2px 4px rgba(0, 0, 0, 0.7)',
                fontFamily: 'Arial, sans-serif',
                fontWeight: 'bold'
              }}
              title="Previous question"
              aria-label="Go back to previous question"
            >
              <ChevronLeft size={20} />
            </button>
          )}
          
          {/* Next Button - Skip current question */}
          {!isSubmitting && currentStepId !== 'COMPLETE' && !(isAnonymous && isGated) && (
            <button
              type="button"
              onClick={handleNext}
              className="p-2 rounded-lg transition-colors hover:bg-emerald-500/10"
              style={{
                color: '#fffacd',
                textShadow: '0 0 5px rgba(255, 215, 0, 0.8), 2px 2px 4px rgba(0, 0, 0, 0.7)',
                fontFamily: 'Arial, sans-serif',
                fontWeight: 'bold'
              }}
              title="Skip to next question"
              aria-label="Skip to next question"
            >
              <ChevronLeft size={20} className="rotate-180" />
            </button>
          )}
          
          {/* Undo Button - Undo last step */}
          {previousStepId && !isSubmitting && currentStepId !== 'INIT' && (
            <button
              type="button"
              onClick={handleUndo}
              className="p-2 rounded-lg transition-colors hover:bg-emerald-500/10"
              style={{
                color: '#fffacd',
                textShadow: '0 0 5px rgba(255, 215, 0, 0.8), 2px 2px 4px rgba(0, 0, 0, 0.7)',
                fontFamily: 'Arial, sans-serif',
                fontWeight: 'bold'
              }}
              title="Undo last step"
              aria-label="Undo last action"
            >
              <Undo2 size={20} />
            </button>
          )}
          
          {/* Redo Button - Redo last undone step */}
          {redoStack.length > 0 && !isSubmitting && (
            <button
              type="button"
              onClick={handleRedo}
              className="p-2 rounded-lg transition-colors hover:bg-emerald-500/10"
              style={{
                color: '#fffacd',
                textShadow: '0 0 5px rgba(255, 215, 0, 0.8), 2px 2px 4px rgba(0, 0, 0, 0.7)',
                fontFamily: 'Arial, sans-serif',
                fontWeight: 'bold'
              }}
              title="Redo last undone step"
              aria-label="Redo last undone action"
            >
              <Redo2 size={20} />
            </button>
          )}
        </div>
        )}

        {/* CRITICAL: All celebration steps show Continue button instead of input */}
        {/* Celebration cards are temporary - disappear immediately when Continue is clicked */}
        {currentStepId.includes('_COMPLETE') && currentStepId !== 'COMPLETE' ? (
          <div className="flex justify-center mt-4">
            <button
              type="button"
              onClick={() => {
                if (isAnonymous && isFreeTasteGateReached(answeredKeys)) return
                hasInitializedRef.current = true
                const nextStepId = currentStep.nextStep
                if (isAnonymous && isBeyondFreeTaste(nextStepId)) return
                const firstUnanswered = findFirstUnansweredStep(nextStepId, answeredKeys)
                const finalStep = getStep(firstUnanswered)
                const nextMessage = { role: 'assistant' as const, content: finalStep.question, stepId: firstUnanswered }
                setHistory([nextMessage])
                setFullHistory(prev => [...prev, nextMessage])
                setPreviousStepId(currentStepId)
                setCurrentStepId(firstUnanswered) // Effect at line 55-59 handles notification automatically
                setTimeout(() => {
                  inputRef.current?.focus()
                }, 100)
              }}
              className="px-8 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-semibold transition-colors"
            >
              Continue
            </button>
          </div>
        ) : (
          <>
            {/* Hide text input when picker or select is active */}
            {!isColorsStep && !isSelectInputStep && (
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={stepInputPlaceholder}
                disabled={currentStepId === 'COMPLETE' || isSubmitting}
                className="email-input"
                autoFocus
              />
            )}
            {claimError && (
              <p className="text-red-400 text-sm text-center" style={{ marginTop: '10px' }}>
                {claimError}
              </p>
            )}
            {saveError && (
              <p className="text-red-400 text-sm text-center" style={{ marginTop: '10px' }}>
                {saveError}
              </p>
            )}
            {isSelectInputStep && currentStep.input?.kind === 'select' && (
              <InlineSelectPicker
                options={currentStep.input.options}
                value={input || null}
                disabled={currentStepId === 'COMPLETE' || isSubmitting}
                onChange={(value) => {
                  setInput(value)
                  const label = getSelectLabel(currentStep, value)
                  if (onTypingUpdate && label) {
                    onTypingUpdate(label, currentStepId)
                  }
                }}
              />
            )}
            <button
              type="submit"
              disabled={
                (isColorsStep
                  ? false
                  : isSelectInputStep
                    ? !input.trim() || !getSelectLabel(currentStep, input)
                    : !input.trim())
                || isSubmitting 
                || currentStepId === 'COMPLETE'
              }
              style={{
                marginTop: '10px',
                padding: '10px',
            backgroundColor: '#047857', /* Deeper emerald - emerald-700 */
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            boxShadow: '0 0 5px rgba(255, 215, 0, 0.8)',
            width: '100%'
          }}
        >
          {isSubmitting ? 'Sending...' : 'Send'}
        </button>
          </>
        )}
      </form>
        )}
      </div>
    </motion.div>
  )
}
