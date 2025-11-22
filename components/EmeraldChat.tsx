'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowUp, Undo2 } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { CURRICULUM, StepId, getStep } from '@/lib/curriculum'
import { Profile } from '@/hooks/useProfile'

// Add prop type for the update function
interface EmeraldChatProps {
  onProfileUpdate?: (updates: Partial<Profile>) => void
}

export default function EmeraldChat({ onProfileUpdate }: EmeraldChatProps) {
  const [currentStepId, setCurrentStepId] = useState<StepId>('INIT')
  const [previousStepId, setPreviousStepId] = useState<StepId | null>(null)
  const [input, setInput] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [history, setHistory] = useState<Array<{role: 'assistant' | 'user', content: string}>>([])
  
  const currentStep = getStep(currentStepId)
  const supabase = createClient()
  const debounceTimer = useRef<NodeJS.Timeout | null>(null)

  // Initial Greeting
  useEffect(() => {
    if (history.length === 0) {
      setHistory([{ role: 'assistant', content: currentStep.question }])
    }
  }, [])

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
    }, 300)

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
    }
  }, [input, currentStep.key, onProfileUpdate, isSubmitting])

  const handleUndo = () => {
    if (previousStepId) {
      setCurrentStepId(previousStepId)
      setHistory(prev => prev.slice(0, -2))
      setPreviousStepId(null)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() || isSubmitting) return

    const answer = input.trim()
    setIsSubmitting(true)

    // 1. Update UI immediately (Optimistic)
    const newHistory = [
      ...history,
      { role: 'user' as const, content: answer }
    ]
    setHistory(newHistory)
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

      // 3. Move to Next Step
      const nextStepId = currentStep.nextStep
      const nextStep = getStep(nextStepId)
      
      setTimeout(() => {
        if (nextStepId !== 'COMPLETE') {
          setHistory(prev => [...prev, { role: 'assistant', content: nextStep.question }])
          setPreviousStepId(currentStepId)
          setCurrentStepId(nextStepId)
        } else {
          setHistory(prev => [...prev, { role: 'assistant', content: nextStep.question }])
          setPreviousStepId(currentStepId)
          setCurrentStepId('COMPLETE')
        }
        setIsSubmitting(false)
      }, 800)

    } catch (error) {
      console.error("Error in submit flow:", error)
      setIsSubmitting(false)
    }
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-2xl mx-auto bg-black/40 backdrop-blur-md border border-emerald-500/30 rounded-2xl overflow-hidden shadow-2xl shadow-emerald-900/20"
    >
      {/* Chat History Area */}
      <div className="h-[400px] overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-emerald-700 scrollbar-track-transparent">
        {history.map((msg, idx) => (
          <motion.div 
            key={idx}
            initial={{ opacity: 0, x: msg.role === 'assistant' ? -10 : 10 }}
            animate={{ opacity: 1, x: 0 }}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[80%] rounded-2xl px-5 py-3 text-lg font-light leading-relaxed ${
              msg.role === 'user' 
                ? 'bg-emerald-600 text-white rounded-tr-none' 
                : 'bg-zinc-800/80 text-zinc-100 border border-zinc-700 rounded-tl-none'
            }`}>
              {msg.content}
            </div>
          </motion.div>
        ))}
        
        {isSubmitting && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-start"
          >
            <div className="bg-zinc-800/50 text-zinc-400 rounded-2xl rounded-tl-none px-5 py-3 text-sm flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}/>
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}/>
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}/>
            </div>
          </motion.div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-emerald-500/20 bg-black/20">
        <form onSubmit={handleSubmit} className="relative flex items-center gap-2">
          {/* Undo Button */}
          {history.length > 1 && !isSubmitting && currentStepId !== 'INIT' && (
            <button
              type="button"
              onClick={handleUndo}
              className="p-2 text-zinc-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors"
              title="Go Back"
            >
              <Undo2 size={20} />
            </button>
          )}

          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={currentStep.placeholder || "Type your answer..."}
            disabled={currentStepId === 'COMPLETE' || isSubmitting}
            className="w-full bg-zinc-900/50 text-white placeholder-zinc-500 rounded-xl px-4 py-4 pr-12 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 border border-zinc-800 transition-all disabled:opacity-50"
            autoFocus
          />
          <button
            type="submit"
            disabled={!input.trim() || isSubmitting}
            className="absolute right-2 p-2 bg-emerald-500 hover:bg-emerald-400 text-black rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ArrowUp size={20} strokeWidth={3} />
          </button>
        </form>
      </div>
    </motion.div>
  )
}
