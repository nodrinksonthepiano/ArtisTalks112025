'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowUp, Undo2, Redo2, Pencil, ChevronLeft } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { CURRICULUM, StepId, getStep } from '@/lib/curriculum'
import { Profile } from '@/hooks/useProfile'
import InlineColorPicker from '@/components/InlineColorPicker'

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
}

export default function EmeraldChat({ onProfileUpdate, onTriggerPanel, onTypingUpdate, onSubmitCard, onCurrentStepChange, profile, answeredKeys, setAnsweredKeys }: EmeraldChatProps) {
  const [currentStepId, setCurrentStepId] = useState<StepId>('INIT')
  const [previousStepId, setPreviousStepId] = useState<StepId | null>(null)
  const [input, setInput] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
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
  
  const currentStep = getStep(currentStepId)
  const supabase = createClient()
  const debounceTimer = useRef<NodeJS.Timeout | null>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const hasInitializedRef = useRef(false)
  
  // Notify parent of current step change (for carousel)
  useEffect(() => {
    if (onCurrentStepChange) {
      onCurrentStepChange(currentStepId)
    }
  }, [currentStepId, onCurrentStepChange])
  
  // Helper: Find first unanswered question in curriculum flow
  const findFirstUnansweredStep = useCallback((startFrom: StepId = 'INIT'): StepId => {
    let current: StepId = startFrom
    const visited = new Set<StepId>()
    
    while (current !== 'COMPLETE' && !visited.has(current)) {
      visited.add(current)
      const step = getStep(current)
      
      // CRITICAL: Completion steps (PRE_COMPLETE, PROD_COMPLETE, etc.) are celebrations
      // They should always be shown, even though they have empty keys
      if (step.id.includes('_COMPLETE')) {
        return current // Return completion step immediately - it's a celebration, not a question
      }
      
      // CRITICAL: Skip other steps with empty keys (shouldn't happen, but safety check)
      if (!step.key || step.key.length === 0) {
        current = step.nextStep
        continue
      }
      
      // CRITICAL: Panel steps are now shown inline, so don't skip them
      // Check if this step hasn't been answered (for panel steps, check if key exists in answeredKeys)
      if (!answeredKeys.has(step.key)) {
        return current
      }
      
      // Move to next step
      current = step.nextStep
    }
    
    return 'COMPLETE'
  }, [answeredKeys])
  
  // CRITICAL: Listen for token navigation events (from ArtisTalksOrbitRenderer)
  useEffect(() => {
    const handleTokenNavigate = (e: Event) => {
      const customEvent = e as CustomEvent<{ stepId: StepId }>
      const stepId = customEvent.detail?.stepId
      if (stepId) {
        const step = getStep(stepId)
        setCurrentStepId(stepId)
        const stepMessage = { role: 'assistant' as const, content: step.question, stepId }
        setHistory([stepMessage])
        setFullHistory(prev => [...prev, stepMessage])
        // Notify parent of step change
        if (onCurrentStepChange) {
          onCurrentStepChange(stepId)
        }
      }
    }
    
    window.addEventListener('tokenNavigate', handleTokenNavigate as EventListener)
    return () => {
      window.removeEventListener('tokenNavigate', handleTokenNavigate as EventListener)
    }
  }, [onCurrentStepChange])
  
  // CRITICAL: Listen for card edit events (from OrbitPeekCarousel)
  useEffect(() => {
    const handleCardEdit = async (e: Event) => {
      const customEvent = e as CustomEvent<{ stepId: StepId }>
      const stepId = customEvent.detail?.stepId
      if (stepId) {
        await handleEditStep(stepId)
        // Notify parent of step change
        if (onCurrentStepChange) {
          onCurrentStepChange(stepId)
        }
      }
    }
    
    window.addEventListener('cardEdit', handleCardEdit as EventListener)
    return () => {
      window.removeEventListener('cardEdit', handleCardEdit as EventListener)
    }
  }, [onCurrentStepChange])
  
  // Initialize chat on mount - start from INIT immediately, then update if answers exist
  useEffect(() => {
    // Only run once on initial mount (when history is empty)
    if (history.length > 0) return
    
    // CRITICAL: Set INIT immediately to ensure card appears right away
    // Don't wait for answeredKeys - it loads asynchronously and causes race conditions
    const initStep = getStep('INIT')
    setCurrentStepId('INIT')
    const initMessage = { role: 'assistant' as const, content: initStep.question, stepId: 'INIT' as StepId }
    setHistory([initMessage])
    setFullHistory([initMessage]) // Add to full history too
  }, []) // Only run once on mount - don't wait for answeredKeys
  
  // Update to first unanswered step once answeredKeys loads (if answers exist)
  // CRITICAL: Only run on initial load, not when user manually advances steps
  useEffect(() => {
    // Skip if history is empty (initialization effect hasn't run yet)
    if (history.length === 0) return
    
    // Skip if already initialized (user is actively progressing through curriculum)
    if (hasInitializedRef.current) return
    
    // CRITICAL: Skip if on PRE_COMPLETE or any completion step (celebration step - don't interfere)
    if (currentStepId === 'PRE_COMPLETE' || currentStepId.includes('_COMPLETE')) return
    
    // Skip if already on INIT and no answers exist
    if (currentStepId === 'INIT' && answeredKeys.size === 0) return
    
    // CRITICAL: Skip if we're past INIT (user has progressed manually)
    if (currentStepId !== 'INIT') return
    
    // Only update if we have answers and need to find first unanswered (initial load only)
    // This should only run once when answeredKeys first loads from database
    if (answeredKeys.size > 0) {
      const firstUnanswered = findFirstUnansweredStep('INIT')
      // Only update if different from current step and not a completion step
      if (firstUnanswered !== currentStepId && firstUnanswered !== 'COMPLETE' && !firstUnanswered.includes('_COMPLETE')) {
        const step = getStep(firstUnanswered)
        setCurrentStepId(firstUnanswered)
        const stepMessage = { role: 'assistant' as const, content: step.question, stepId: firstUnanswered }
        setHistory([stepMessage])
        setFullHistory([stepMessage]) // Add to full history too
      }
      // Mark as initialized so this effect doesn't run again
      // This prevents it from overriding manual step advancement
      hasInitializedRef.current = true
    }
  }, [answeredKeys.size, findFirstUnansweredStep, currentStepId, history.length]) // Update when answeredKeys loads
  
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
          setCurrentStepId(nextStepId)
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
    if (!onProfileUpdate) return
    
    // CRITICAL FIX: Don't update profile if input is empty or we're submitting
    // This prevents empty strings from overwriting saved values when input is cleared
    if (!input.trim() || isSubmitting) {
      // Clear any pending debounce timer if input is empty
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current)
        debounceTimer.current = null
      }
      return
    }

    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    
    debounceTimer.current = setTimeout(() => {
      // Double-check we still have a value (user might have cleared it during debounce)
      if (!input.trim()) return
      
      if (currentStep.key === 'artist_name') {
        onProfileUpdate({ artist_name: input })
      } else if (currentStep.key === 'gift_to_world') {
        onProfileUpdate({ mission_statement: input })
      }
      
      // Live typing update for carousel card
      if (onTypingUpdate) {
        onTypingUpdate(input, currentStepId)
      }
    }, 50) // Reduced from 300ms to 50ms for faster card updates

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
    }
  }, [input, currentStep.key, onProfileUpdate, isSubmitting])

  const handleUndo = () => {
    if (previousStepId) {
      // Save current state to redo stack
      setRedoStack(prev => [...prev, {
        stepId: currentStepId,
        previousStepId: previousStepId,
        history: [...history]
      }])
      
      // Go back to previous step
      setCurrentStepId(previousStepId)
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
      setCurrentStepId(lastUndone.stepId)
      setPreviousStepId(lastUndone.previousStepId)
      setHistory(lastUndone.history)
      
      // Remove from redo stack
      setRedoStack(prev => prev.slice(0, -1))
    }
  }

  const handleLast = () => {
    // Go back to previous question (Last button)
    if (previousStepId && !isSubmitting) {
      const prevStep = getStep(previousStepId)
      setCurrentStepId(previousStepId)
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
    // Skip current question (Next button) - don't create empty card, just move forward
    if (isSubmitting || currentStepId === 'COMPLETE') return
    
    const nextStepId = currentStep.nextStep
    const firstUnanswered = findFirstUnansweredStep(nextStepId)
    const nextStep = getStep(firstUnanswered)
    
    // Move to next unanswered question without saving
    setCurrentStepId(firstUnanswered)
    setPreviousStepId(currentStepId)
    // Only show current question (no history)
    const nextMessage = { role: 'assistant' as const, content: nextStep.question, stepId: firstUnanswered }
    setHistory([nextMessage])
    // Don't add to fullHistory - skipping doesn't create history entry
    setInput('')
  }

  // Helper: Load answer from fullHistory or database
  const loadAnswerForStep = async (stepId: StepId): Promise<string> => {
    const step = getStep(stepId)
    
    // Try 1: Check fullHistory first (fast, no DB query)
    const fullHistoryAnswer = fullHistory.find(
      msg => msg.stepId === stepId && msg.role === 'user'
    )
    if (fullHistoryAnswer) {
      return fullHistoryAnswer.content
    }
    
    // Try 2: Load from database (only if not found in fullHistory)
    if (!step.key) return ''
    
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
        const answerData = answer.answer_data as any
        return answerData?.text || answerData?.content || ''
      }
    } catch (err) {
      console.error('Error loading answer:', err)
    }
    
    return ''
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

  const handleEditStep = async (stepId: StepId) => {
    // Clear redo stack when editing (editing is a new action)
    setRedoStack([])
    
    // CRITICAL FIX: Load answer from fullHistory or database (not just history)
    const userAnswer = await loadAnswerForStep(stepId)
    
    // Find assistant question in history
    const assistantQuestionIndex = history.findIndex(msg => msg.stepId === stepId && msg.role === 'assistant')
    
    // If question not in history, add it
    if (assistantQuestionIndex === -1) {
      const step = getStep(stepId)
      const stepMessage = { role: 'assistant' as const, content: step.question, stepId }
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
    
    // Set current step back to this step
    setCurrentStepId(stepId)
    
    // Restore the answer in the input field
    setInput(userAnswer)
    
    // Find the step before this one for previousStepId
    const allSteps = Object.values(CURRICULUM)
    const prevStep = allSteps.find(s => s.nextStep === stepId)
    setPreviousStepId(prevStep?.id || null)
    
    // Notify parent of step change
    if (onCurrentStepChange) {
      onCurrentStepChange(stepId)
    }
    
    // Focus input after edit
    setTimeout(() => {
      inputRef.current?.focus()
    }, 100)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    // CRITICAL: If picker is active, save to curriculum_answers and advance to next step
    if (currentStep?.triggersPanel === 'colors') {
      // Profile is already updated by picker (live preview)
      // Now save to curriculum_answers when user clicks Send
      // CRITICAL: Use currentPickerState to get actual current values (handles removals correctly)
      const { data: { user } } = await supabase.auth.getUser()
      if (user && currentStep.key) {
        // Save colors, logo, and font together
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
        
        await supabase.from('curriculum_answers').upsert({
          user_id: user.id,
          question_key: currentStep.key,
          answer_data: {
            text: 'Colors, logo, and font set',
            primary: primaryColor,
            accent: accentColor,
            brand_color: brandColor,
            logo_url: logoUrl,
            logo_use_background: logoUseBackground,
            font_family: fontFamily,
            step_id: currentStepId // CRITICAL: Store stepId to fix duplicate key bug
          },
          project_id: null
        })
        
        // Mark step as answered
        setAnsweredKeys(prev => new Set([...prev, currentStep.key]))
        
        // Clear picker state for next step
        setCurrentPickerState({})
      }
      
      // Advance to next step - SKIP already answered questions
      let nextStepId = currentStep.nextStep
      
      // Skip to first unanswered question (starting from next step)
      const firstUnanswered = findFirstUnansweredStep(nextStepId)
      nextStepId = firstUnanswered
      const nextStep = getStep(nextStepId)
      
      setTimeout(() => {
        // CRITICAL: Panel steps are now shown inline, don't trigger old panel mode
        // Just advance to next step (inline picker will render automatically)
        const nextMessage = { role: 'assistant' as const, content: nextStep.question, stepId: nextStepId }
        setHistory([nextMessage])
        setFullHistory(prev => [...prev, nextMessage])
        setPreviousStepId(currentStepId)
        setCurrentStepId(nextStepId)
      }, 300)
      return
    }
    
    // CRITICAL: PRE_COMPLETE is a celebration - no input required, just show buttons
    if (currentStepId === 'PRE_COMPLETE') {
      // Skip saving - just advance to next step
      const nextStepId = currentStep.nextStep
      const nextStep = getStep(nextStepId)
      
      setTimeout(() => {
        const nextMessage = { role: 'assistant' as const, content: nextStep.question, stepId: nextStepId }
        setHistory([nextMessage])
        setFullHistory(prev => [...prev, nextMessage])
        setPreviousStepId(currentStepId)
        setCurrentStepId(nextStepId)
        setIsSubmitting(false)
        setTimeout(() => {
          inputRef.current?.focus()
        }, 100)
      }, 300)
      return
    }
    
    if (!input.trim() || isSubmitting) return

    const answer = input.trim()
    setIsSubmitting(true)

    // Trigger card swipe animation before saving
    if (onSubmitCard) {
      onSubmitCard(answer, currentStepId)
    }

    // 1. Update UI immediately (Optimistic)
    const userMessage = { role: 'user' as const, content: answer, stepId: currentStepId }
    
    // Add only user's answer to full history - question is already there from when it was shown
    setFullHistory(prev => [...prev, userMessage])
    
    // Clear chat history - only keep current question (will be replaced with next question)
    setHistory([])
    setInput('')

    try {
      // 2. Save to Supabase (The Log)
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        // Save the answer to the log
        const { error: insertError } = await supabase.from('curriculum_answers').insert({
          user_id: user.id,
          question_key: currentStep.key,
          answer_data: { 
            text: answer,
            step_id: currentStepId // CRITICAL: Store stepId to fix duplicate key bug
          },
          project_id: null 
        })
        
        if (insertError) {
          console.error('Error saving answer:', insertError.message)
        } else {
          // CRITICAL: Update answeredKeys optimistically (same as colors panel)
          // This ensures progress updates immediately, coins fill as user progresses
          setAnsweredKeys(prev => new Set([...prev, currentStep.key]))
        }
        
        // Force a final "Hard Save" of the profile to ensure consistency
        // This calls useProfile's updateProfile which handles the DB save for profile
        if (onProfileUpdate) {
           if (currentStep.key === 'artist_name') onProfileUpdate({ artist_name: answer })
           if (currentStep.key === 'gift_to_world') onProfileUpdate({ mission_statement: answer })
        }

      } else {
        console.log("No user logged in - skipping DB save.")
      }

      // Clear redo stack when user makes a new action (can't redo after new action)
      setRedoStack([])

      // 3. Move to Next Step - SKIP already answered questions
      let nextStepId = currentStep.nextStep
      
      // Skip to first unanswered question (starting from next step)
      const firstUnanswered = findFirstUnansweredStep(nextStepId)
      nextStepId = firstUnanswered
      const nextStep = getStep(nextStepId)
      
      setTimeout(() => {
        // CRITICAL: Panel steps are now shown inline, don't trigger old panel mode
        // Just advance to next step (inline picker will render automatically)
        
        // Normal chat flow - only show current question (no history building up)
        if (nextStepId !== 'COMPLETE') {
          // Only show current question in chat (clear previous)
          const nextMessage = { role: 'assistant' as const, content: nextStep.question, stepId: nextStepId }
          setHistory([nextMessage])
          setFullHistory(prev => [...prev, nextMessage]) // Add to full history
          setPreviousStepId(currentStepId)
          setCurrentStepId(nextStepId)
        } else {
          const completeMessage = { role: 'assistant' as const, content: nextStep.question, stepId: nextStepId }
          setHistory([completeMessage])
          setFullHistory(prev => [...prev, completeMessage]) // Add to full history
          setPreviousStepId(currentStepId)
          setCurrentStepId('COMPLETE')
        }
        setIsSubmitting(false)
        // Refocus input after submit (Zeyoda pattern)
        setTimeout(() => {
          inputRef.current?.focus()
        }, 100)
      }, 800)

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
        // CRITICAL: Expand height when picker is shown
        minHeight: currentStep?.triggersPanel === 'colors' ? '500px' : 'auto'
      }}
    >
      <div>
        {/* Current Question OR Inline Picker */}
        {currentStep && currentStep.question && (
          <>
            {/* Show inline picker if this step triggers a panel */}
            {currentStep.triggersPanel === 'colors' ? (
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
            ) : (
              <h1 className="gold-etched" style={{ marginTop: '0', marginBottom: '20px' }}>
                {currentStepId === 'INIT' 
                  ? "Welcome, My Champion! What is your artist name?"
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
                        onClick={async () => await handleEditStep(msg.stepId!)}
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
        
        {/* Input Area */}
      <form onSubmit={handleSubmit} id="artistForm">
        {/* Navigation Buttons - Back/Next/Undo/Redo */}
        <div className="flex items-center justify-center gap-2 mb-2">
          {/* History Button - View full conversation */}
          {fullHistory.length > 0 && (
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
          {!isSubmitting && currentStepId !== 'COMPLETE' && (
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

        {/* PRE_COMPLETE: Show celebration with Continue button instead of input */}
        {currentStepId === 'PRE_COMPLETE' ? (
          <div className="flex justify-center mt-4">
            <button
              type="button"
              onClick={() => {
                // CRITICAL: Mark as initialized BEFORE advancing to prevent initialization effect from interfering
                hasInitializedRef.current = true
                // CRITICAL: Go directly to PROJECT_NAME (first PROD question) - don't use findFirstUnansweredStep
                // because it might loop back if there's any issue with answeredKeys
                const targetStepId: StepId = 'PROJECT_NAME'
                const targetStep = getStep(targetStepId)
                const nextMessage = { role: 'assistant' as const, content: targetStep.question, stepId: targetStepId }
                setHistory([nextMessage])
                setFullHistory(prev => [...prev, nextMessage])
                setPreviousStepId(currentStepId)
                setCurrentStepId(targetStepId)
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
            {/* Hide input when picker is active - user clicks Send to advance */}
            {currentStep?.triggersPanel !== 'colors' && (
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={currentStep.placeholder || "Type your answer..."}
                disabled={currentStepId === 'COMPLETE' || isSubmitting}
                className="email-input"
                autoFocus
              />
            )}
            <button
              type="submit"
              disabled={
                (currentStep?.triggersPanel !== 'colors' && !input.trim()) 
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
      </div>
    </motion.div>
  )
}
