'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowUp, Undo2, Redo2, Pencil, ChevronLeft } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { CURRICULUM, StepId, getStep } from '@/lib/curriculum'
import { Profile } from '@/hooks/useProfile'
import InlineColorPicker from '@/components/InlineColorPicker'
import InlineLogoPicker from '@/components/InlineLogoPicker'
import InlineFontPicker from '@/components/InlineFontPicker'

// Add prop type for the update function
interface EmeraldChatProps {
  onProfileUpdate?: (updates: Partial<Profile>) => void
  onTriggerPanel?: (panel: 'logo' | 'colors' | 'font' | 'asset' | null) => void
  onTypingUpdate?: (input: string, stepId: StepId) => void // Live typing updates for carousel card
  onSubmitCard?: (answer: string, stepId: StepId) => void // Trigger card swipe animation on submit
  onCurrentStepChange?: (stepId: StepId) => void // Notify parent of current step for carousel
  profile?: Profile | null // CRITICAL: Profile prop for inline pickers
}

export default function EmeraldChat({ onProfileUpdate, onTriggerPanel, onTypingUpdate, onSubmitCard, onCurrentStepChange, profile }: EmeraldChatProps) {
  const [currentStepId, setCurrentStepId] = useState<StepId>('INIT')
  const [previousStepId, setPreviousStepId] = useState<StepId | null>(null)
  const [input, setInput] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [history, setHistory] = useState<Array<{role: 'assistant' | 'user', content: string, stepId?: StepId}>>([])
  const [fullHistory, setFullHistory] = useState<Array<{role: 'assistant' | 'user', content: string, stepId?: StepId}>>([]) // Full history for history button
  const [showHistory, setShowHistory] = useState(false) // Toggle history modal
  const [answeredKeys, setAnsweredKeys] = useState<Set<string>>(new Set())
  
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
  
  // Load answered questions on mount and when user changes
  useEffect(() => {
    async function loadAnsweredKeys() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          setAnsweredKeys(new Set())
          return
        }
        
        const { data: answers, error } = await supabase
          .from('curriculum_answers')
          .select('question_key')
          .eq('user_id', user.id)
        
        if (error) {
          console.error('Error loading answered keys:', error)
          return
        }
        
        const keys = new Set(answers?.map(a => a.question_key) || [])
        setAnsweredKeys(keys)
      } catch (err) {
        console.error('Error in loadAnsweredKeys:', err)
      }
    }
    
    loadAnsweredKeys()
    
    // Subscribe to changes
    const channel = supabase
      .channel('answered-keys')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'curriculum_answers',
        },
        () => {
          loadAnsweredKeys()
        }
      )
      .subscribe()
    
    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase])
  
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
    
    // Skip if already on INIT and no answers exist
    if (currentStepId === 'INIT' && answeredKeys.size === 0) return
    
    // Only update if we have answers and need to find first unanswered (initial load only)
    // This should only run once when answeredKeys first loads from database
    if (answeredKeys.size > 0) {
      const firstUnanswered = findFirstUnansweredStep('INIT')
      // Only update if different from current step
      if (firstUnanswered !== currentStepId && firstUnanswered !== 'COMPLETE') {
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
    }, 300)

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

  const handleBack = () => {
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
          handleEditStep(lastUserMessage.stepId)
        }
      }
    }
  }

  const handleEditStep = (stepId: StepId) => {
    // Clear redo stack when editing (editing is a new action)
    setRedoStack([])
    
    // Find the user's answer for this step
    const userAnswerIndex = history.findIndex(msg => msg.stepId === stepId && msg.role === 'user')
    const assistantQuestionIndex = history.findIndex(msg => msg.stepId === stepId && msg.role === 'assistant')
    
    if (assistantQuestionIndex !== -1) {
      // Get the user's answer if it exists
      const userAnswer = userAnswerIndex !== -1 ? history[userAnswerIndex].content : ''
      
      // Remove all messages after the assistant question for this step
      setHistory(prev => prev.slice(0, assistantQuestionIndex + 1))
      
      // Set current step back to this step
      setCurrentStepId(stepId)
      
      // Restore the answer in the input field
      if (userAnswer) {
        setInput(userAnswer)
      } else {
        setInput('')
      }
      
      // Find the step before this one for previousStepId
      const allSteps = Object.values(CURRICULUM)
      const prevStep = allSteps.find(s => s.nextStep === stepId)
      setPreviousStepId(prevStep?.id || null)
      
      // Focus input after edit
      setTimeout(() => {
        inputRef.current?.focus()
      }, 100)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    // CRITICAL: If picker is active, mark as answered and advance to next step (already autosaved)
    if (currentStep?.triggersPanel === 'colors' || currentStep?.triggersPanel === 'logo' || currentStep?.triggersPanel === 'font') {
      // Colors/logo are already autosaved by InlineColorPicker/InlineLogoPicker
      // Mark step as answered optimistically (database save is async but should be done)
      if (currentStep.key) {
        setAnsweredKeys(prev => new Set([...prev, currentStep.key]))
      }
      
      // Advance to next step
      const nextStepId = currentStep.nextStep
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
          answer_data: { text: answer },
          project_id: null 
        })
        
        if (insertError) {
          console.error('Error saving answer:', insertError.message)
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
        minHeight: currentStep?.triggersPanel === 'colors' || currentStep?.triggersPanel === 'logo' || currentStep?.triggersPanel === 'font' ? '500px' : 'auto'
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
                    // Autosave immediately to profile
                    if (onProfileUpdate) {
                      await onProfileUpdate(updates)
                    }
                    
                    // Save to curriculum_answers
                    const { data: { user } } = await supabase.auth.getUser()
                    if (user) {
                      await supabase.from('curriculum_answers').upsert({
                        user_id: user.id,
                        question_key: currentStep.key,
                        answer_data: { text: 'Colors set', primary: updates.primary_color, accent: updates.accent_color },
                        project_id: null
                      })
                    }
                  }}
                  onPreviewChange={(preview) => {
                    // Preview updates handled internally by InlineColorPicker
                    // No need to dispatch events - InlineColorPicker handles everything
                  }}
                />
              </div>
            ) : currentStep.triggersPanel === 'logo' ? (
              <div className="mb-4">
                <h2 className="gold-etched text-lg mb-3" style={{ marginTop: '0', marginBottom: '12px' }}>
                  {currentStep.question}
                </h2>
                <InlineLogoPicker
                  profile={profile || null}
                  onLogoChange={async (updates) => {
                    // Autosave immediately to profile
                    if (onProfileUpdate) {
                      await onProfileUpdate(updates)
                    }
                    
                    // Save to curriculum_answers
                    const { data: { user } } = await supabase.auth.getUser()
                    if (user) {
                      await supabase.from('curriculum_answers').upsert({
                        user_id: user.id,
                        question_key: currentStep.key,
                        answer_data: { text: 'Logo uploaded', url: updates.logo_url },
                        project_id: null
                      })
                    }
                  }}
                  onPreviewChange={(previewUrl, useBackground) => {
                    // CRITICAL: Update previewOverrides so page.tsx knows about logo changes
                    // This prevents page.tsx useEffect from reapplying logo when unchecked
                    window.dispatchEvent(new CustomEvent('logoPreviewChange', { 
                      detail: { 
                        logo_url: previewUrl,
                        logo_use_background: useBackground
                      } 
                    }))
                  }}
                />
              </div>
            ) : currentStep.triggersPanel === 'font' ? (
              <div className="mb-4">
                <h2 className="gold-etched text-lg mb-3" style={{ marginTop: '0', marginBottom: '12px' }}>
                  {currentStep.question}
                </h2>
                <InlineFontPicker
                  profile={profile || null}
                  onFontChange={async (updates) => {
                    // Autosave immediately to profile
                    if (onProfileUpdate) {
                      await onProfileUpdate(updates)
                    }
                    
                    // Save to curriculum_answers
                    const { data: { user } } = await supabase.auth.getUser()
                    if (user) {
                      await supabase.from('curriculum_answers').upsert({
                        user_id: user.id,
                        question_key: currentStep.key,
                        answer_data: { text: 'Font set', font: updates.font_family },
                        project_id: null
                      })
                    }
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
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
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

        {/* Hide input when picker is active - user clicks Send to advance */}
        {currentStep?.triggersPanel !== 'colors' && currentStep?.triggersPanel !== 'logo' && currentStep?.triggersPanel !== 'font' && (
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
            (currentStep?.triggersPanel !== 'colors' && currentStep?.triggersPanel !== 'logo' && currentStep?.triggersPanel !== 'font' && !input.trim()) 
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
      </form>
      </div>
    </motion.div>
  )
}
