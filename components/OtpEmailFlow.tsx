'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'

const sendButtonStyle: React.CSSProperties = {
  marginTop: '10px',
  padding: '10px',
  backgroundColor: '#047857',
  color: 'white',
  border: 'none',
  borderRadius: '5px',
  cursor: 'pointer',
  boxShadow: '0 0 5px rgba(255, 215, 0, 0.8)',
  width: '100%',
}

interface OtpEmailFlowProps {
  emailPlaceholder?: string
  sendButtonLabel?: string
  verifyButtonLabel?: string
}

/**
 * Shared Supabase email OTP flow (signInWithOtp → verifyOtp).
 * Extracted from AuthPanel for reuse at the anonymous save/apply gate.
 */
export default function OtpEmailFlow({
  emailPlaceholder = 'Your email',
  sendButtonLabel = 'Send code',
  verifyButtonLabel = 'Enter Sanctuary',
}: OtpEmailFlowProps) {
  const [email, setEmail] = useState('')
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState('')
  const [isAutoSubmitting, setIsAutoSubmitting] = useState(false)

  const supabase = createClient()

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return

    setLoading(true)
    setError('')

    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          shouldCreateUser: true,
        },
      })

      if (otpError) throw otpError

      setVerifying(true)
    } catch (err: unknown) {
      console.error('Login error:', err)
      const message = err instanceof Error ? err.message : 'Failed to send code'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyCode = useCallback(
    async (e?: React.FormEvent) => {
      if (e) e.preventDefault()
      if (!token.trim()) return

      setLoading(true)
      setError('')

      try {
        const { error: verifyError } = await supabase.auth.verifyOtp({
          email: email.trim(),
          token: token.trim(),
          type: 'email',
        })

        if (verifyError) throw verifyError
        // page.tsx auth listener picks up the session
      } catch (err: unknown) {
        console.error('Verify error:', err)
        const message = err instanceof Error ? err.message : 'Invalid code'
        setError(message)
        setLoading(false)
        setIsAutoSubmitting(false)
      }
    },
    [email, token, supabase.auth]
  )

  useEffect(() => {
    if (token.length === 6 && !isAutoSubmitting && !loading) {
      setIsAutoSubmitting(true)
      void handleVerifyCode()
    }
  }, [token, isAutoSubmitting, loading, handleVerifyCode])

  if (verifying) {
    return (
      <form onSubmit={handleVerifyCode} className="w-full">
        <p className="text-sm text-zinc-200 mb-3" style={{ lineHeight: 1.5 }}>
          We sent a code to{' '}
          <span style={{ color: '#6ee7b7', fontFamily: 'monospace' }}>{email}</span>
        </p>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={token}
          onChange={(e) => setToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="123456"
          maxLength={6}
          className="email-input"
          style={{ textAlign: 'center', letterSpacing: '0.35em', fontFamily: 'monospace' }}
          autoFocus
          required
        />
        {error && (
          <p className="text-red-400 text-sm text-center" style={{ marginTop: '10px' }}>
            {error}
          </p>
        )}
        <button type="submit" disabled={loading} style={sendButtonStyle}>
          {loading ? 'Verifying...' : verifyButtonLabel}
        </button>
        <button
          type="button"
          onClick={() => {
            setVerifying(false)
            setToken('')
            setError('')
            setIsAutoSubmitting(false)
          }}
          className="w-full text-zinc-400 text-sm hover:text-emerald-300 transition-colors"
          style={{ marginTop: '12px' }}
        >
          Start over
        </button>
      </form>
    )
  }

  return (
    <form onSubmit={handleSendCode} className="w-full">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={emailPlaceholder}
        className="email-input"
        autoComplete="email"
        required
      />
      {error && (
        <p className="text-red-400 text-sm text-center" style={{ marginTop: '10px' }}>
          {error}
        </p>
      )}
      <button type="submit" disabled={loading || !email.trim()} style={sendButtonStyle}>
        {loading ? 'Sending...' : sendButtonLabel}
      </button>
    </form>
  )
}
