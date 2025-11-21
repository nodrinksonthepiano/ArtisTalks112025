'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowUp } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { CURRICULUM, StepId, getStep } from '@/lib/curriculum'

export default function EmeraldChat() {
  const [currentStepId, setCurrentStepId] = useState<StepId>('INIT')
  const [input, setInput] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [history, setHistory] = useState<Array<{role: 'assistant' | 'user', content: string}>>([])
  
  const currentStep = getStep(currentStepId)
  const supabase = createClient()

  // Initial Greeting
  useEffect(() => {
    if (history.length === 0) {
      setHistory([{ role: 'assistant', content: currentStep.question }])
    }
  }, [])

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
      // 2. Save to Supabase
      // We need the user's ID. For now, we'll fetch the session.
      const { data: { user } } = await supabase.auth.getUser()
      
      // NOTE: If no user is logged in yet, this will fail or return null.
      // For this Phase 2 test, we might need to handle "Guest" mode or just log the error.
      
      if (user) {
        await supabase.from('curriculum_answers').insert({
          user_id: user.id,
          question_key: currentStep.key,
          answer_data: { text: answer }
        })
        
        // Also update profile if it's the name
        if (currentStep.key === 'artist_name') {
          await supabase.from('profiles').update({ artist_name: answer }).eq('id', user.id)
        }
      } else {
        console.log("No user logged in - skipping DB save for this test run.")
      }

      // 3. Move to Next Step
      const nextStepId = currentStep.nextStep
      const nextStep = getStep(nextStepId)
      
      if (nextStepId !== 'COMPLETE') {
         // Simulate a small "thinking" delay for the Champion feel
         setTimeout(() => {
            setHistory(prev => [...prev, { role: 'assistant', content: nextStep.question }])
            setCurrentStepId(nextStepId)
            setIsSubmitting(false)
         }, 600)
      } else {
         setTimeout(() => {
            setHistory(prev => [...prev, { role: 'assistant', content: nextStep.question }])
            setCurrentStepId('COMPLETE')
            setIsSubmitting(false)
         }, 600)
      }

    } catch (error) {
      console.error("Error saving answer:", error)
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
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-emerald-500/20 bg-black/20">
        <form onSubmit={handleSubmit} className="relative flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={currentStep.placeholder || "Type your answer..."}
            disabled={currentStepId === 'COMPLETE' || isSubmitting}
            className="w-full bg-zinc-900/50 text-white placeholder-zinc-500 rounded-xl px-4 py-4 pr-12 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 border border-zinc-800 transition-all"
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

