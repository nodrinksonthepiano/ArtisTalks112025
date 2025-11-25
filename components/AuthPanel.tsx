'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Mail, Lock } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'

export default function AuthPanel() {
  const [email, setEmail] = useState('')
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [verifying, setVerifying] = useState(false) // New state for Step 2
  const [error, setError] = useState('')
  const [isAutoSubmitting, setIsAutoSubmitting] = useState(false)

  const supabase = createClient()

  // Step 1: Send the code
  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault()
    if (!email) return

    setLoading(true)
    setError('')

    try {
      // We use type: 'email' to force standard OTP if configured
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
          // No redirect needed for OTP flow, but good practice to keep clean
        },
      })

      if (error) throw error

      setVerifying(true) // Switch UI to Step 2
    } catch (err: any) {
      console.error('Login error:', err)
      setError(err.message || 'Failed to send code')
    } finally {
      setLoading(false)
    }
  }

  // Step 2: Verify the code
  async function handleVerifyCode(e?: React.FormEvent) {
    if (e) e.preventDefault()
    if (!token) return

    setLoading(true)
    setError('')

    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'email',
      })

      if (error) throw error

      // Success! The parent component (page.tsx) listener will pick up the session automatically.
    } catch (err: any) {
      console.error('Verify error:', err)
      setError(err.message || 'Invalid code')
      setLoading(false) // Only stop loading on error; on success, page unmounts
      setIsAutoSubmitting(false) // Reset lock
    }
  }

  // Auto-submit effect
  useEffect(() => {
    if (token.length === 6 && !isAutoSubmitting && !loading) {
      setIsAutoSubmitting(true)
      handleVerifyCode()
    }
  }, [token])

  if (verifying) {
    return (
      <motion.div 
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="w-full max-w-md mx-auto bg-black/40 backdrop-blur-md border border-emerald-500/30 rounded-2xl p-8 shadow-2xl shadow-emerald-900/20"
      >
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="text-emerald-400 w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Enter Code</h2>
          <p className="text-zinc-400 text-sm">
            We sent a code to <span className="text-emerald-400 font-mono">{email}</span>
          </p>
        </div>

        <form onSubmit={handleVerifyCode} className="space-y-4">
          <input
            type="text"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="123456"
            maxLength={6}
            className="w-full bg-zinc-900/50 text-white text-center text-2xl tracking-[0.5em] font-mono placeholder-zinc-700 rounded-xl py-4 border border-zinc-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
            autoFocus
            required
          />

          {error && (
            <p className="text-red-400 text-sm text-center animate-pulse">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl py-3 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Verifying...' : 'Enter Sanctuary'}
          </button>
          
          <button 
            type="button"
            onClick={() => setVerifying(false)}
            className="w-full text-zinc-500 text-sm hover:text-emerald-400 transition-colors mt-2"
          >
            Start over
          </button>
        </form>
      </motion.div>
    )
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
        margin: '20px' /* EXACT from nodrinks */
      }}
    >
      <div>
        <h1 className="gold-etched" style={{ marginTop: '0', marginBottom: '20px' }}>Welcome, My Champion...</h1>

        <form onSubmit={handleSendCode} id="artistForm">
          <input
            type="text"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter Artist Name or Email"
            className="email-input"
            required
          />
          {error && (
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-red-400 text-sm text-center"
              style={{ marginTop: '10px' }}
            >
              {error}
            </motion.p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: '10px', /* EXACT from nodrinks */
              padding: '10px', /* EXACT from nodrinks */
              backgroundColor: '#047857', /* Deeper emerald - emerald-700 */
              color: 'white', /* EXACT from nodrinks */
              border: 'none', /* EXACT from nodrinks */
              borderRadius: '5px', /* EXACT from nodrinks */
              cursor: 'pointer',
              boxShadow: '0 0 5px rgba(255, 215, 0, 0.8)' /* Golden glimmer */
            }}
          >
            {loading ? 'Sending...' : 'Send'}
          </button>
      </form>
      </div>
    </motion.div>
  )
}
