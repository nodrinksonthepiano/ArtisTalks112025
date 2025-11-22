'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Mail, Lock } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'

export default function AuthPanel() {
  const [email, setEmail] = useState('')
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [verifying, setVerifying] = useState(false) // New state for Step 2
  const [error, setError] = useState('')

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
  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault()
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
    }
  }

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
      className="w-full max-w-md mx-auto bg-black/40 backdrop-blur-md border border-emerald-500/30 rounded-2xl p-8 shadow-2xl shadow-emerald-900/20"
    >
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-white mb-2">Identify Yourself</h2>
        <p className="text-zinc-400 text-sm">Enter your email to access your legacy.</p>
      </div>

      <form onSubmit={handleSendCode} className="space-y-4">
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 w-5 h-5" />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="artist@example.com"
            className="w-full bg-zinc-900/50 text-white placeholder-zinc-600 rounded-xl pl-10 pr-4 py-3 border border-zinc-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
            required
          />
        </div>

        {error && (
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-red-400 text-sm text-center"
          >
            {error}
          </motion.p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl py-3 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group"
        >
          {loading ? 'Sending...' : 'Send Code'}
          {!loading && <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />}
        </button>
      </form>
    </motion.div>
  )
}
