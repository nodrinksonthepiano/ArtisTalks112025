'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { getResendCooldownSeconds } from '@/lib/rateLimitConfig'

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

interface ClaimedArtistGateProps {
  artistName: string
  onUseDifferentName: () => void
}

/**
 * Returning-artist locked door: code entry only — never email.
 */
export default function ClaimedArtistGate({
  artistName,
  onUseDifferentName,
}: ClaimedArtistGateProps) {
  const cooldownSeconds = getResendCooldownSeconds()
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [resendSecondsLeft, setResendSecondsLeft] = useState(cooldownSeconds)
  const [isAutoSubmitting, setIsAutoSubmitting] = useState(false)
  const [isRateLimited, setIsRateLimited] = useState(false)
  const lastSubmittedTokenRef = useRef('')

  useEffect(() => {
    if (resendSecondsLeft <= 0) return
    const id = window.setInterval(() => {
      setResendSecondsLeft((s) => (s <= 1 ? 0 : s - 1))
    }, 1000)
    return () => window.clearInterval(id)
  }, [resendSecondsLeft])

  const handleVerify = useCallback(
    async (e?: React.FormEvent) => {
      if (e) e.preventDefault()
      if (!token.trim() || loading) return

      setLoading(true)
      setError('')
      setInfo('')

      try {
        const res = await fetch('/api/artist/verify-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ artist_name: artistName, token: token.trim() }),
        })
        const data = (await res.json().catch(() => ({}))) as {
          verified?: boolean
          error?: string
        }

        const trimmed = token.trim()
        lastSubmittedTokenRef.current = trimmed

        if (res.status === 429) {
          setIsRateLimited(true)
          setError(
            typeof data.error === 'string' && data.error
              ? data.error
              : 'Too many attempts. Please wait before trying again.'
          )
          setLoading(false)
          setIsAutoSubmitting(false)
          return
        }

        if (!res.ok || !data.verified) {
          setError(
            typeof data.error === 'string' && data.error
              ? data.error
              : 'Invalid code'
          )
          setLoading(false)
          setIsAutoSubmitting(false)
          return
        }

        window.location.reload()
      } catch {
        setError('Unable to verify code')
        setLoading(false)
        setIsAutoSubmitting(false)
      }
    },
    [artistName, token, loading]
  )

  useEffect(() => {
    if (token.length === 6 && token !== lastSubmittedTokenRef.current) {
      setIsRateLimited(false)
    }
  }, [token])

  useEffect(() => {
    if (
      token.length === 6 &&
      !isAutoSubmitting &&
      !loading &&
      !isRateLimited &&
      token !== lastSubmittedTokenRef.current
    ) {
      setIsAutoSubmitting(true)
      void handleVerify()
    }
  }, [token, isAutoSubmitting, loading, isRateLimited, handleVerify])

  async function handleResend() {
    if (resendSecondsLeft > 0 || loading) return

    setLoading(true)
    setError('')
    setInfo('')

    try {
      const res = await fetch('/api/artist/claim-challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artist_name: artistName }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        claimed?: boolean
        sent?: boolean
        error?: string
      }

      if (res.status === 429) {
        setError(
          typeof data.error === 'string' && data.error
            ? data.error
            : 'Please wait before requesting another code.'
        )
        setResendSecondsLeft(cooldownSeconds)
        return
      }

      if (!res.ok || !data.sent) {
        setError(
          typeof data.error === 'string' && data.error
            ? data.error
            : 'Unable to send code'
        )
        return
      }

      setInfo('A new code was sent.')
      setResendSecondsLeft(cooldownSeconds)
      setToken('')
      setIsAutoSubmitting(false)
      setIsRateLimited(false)
      lastSubmittedTokenRef.current = ''
    } catch {
      setError('Unable to send code')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full">
      <p
        className="gold-etched"
        style={{ marginTop: '0', marginBottom: '12px', whiteSpace: 'pre-line' }}
      >
        That artist name already has a sanctuary.
      </p>
      <p
        style={{
          marginTop: '0',
          marginBottom: '20px',
          lineHeight: 1.5,
          color: '#e4e4e7',
          fontSize: '0.95rem',
        }}
      >
        We sent a code to the email connected to{' '}
        <span style={{ color: '#6ee7b7', fontWeight: 600 }}>{artistName}</span>.
      </p>

      <form onSubmit={handleVerify} className="w-full">
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={token}
          onChange={(e) => setToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="Enter code"
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
        {info && !error && (
          <p className="text-emerald-300 text-sm text-center" style={{ marginTop: '10px' }}>
            {info}
          </p>
        )}
        <button type="submit" disabled={loading || token.length !== 6} style={sendButtonStyle}>
          {loading ? 'Verifying...' : 'Enter Sanctuary'}
        </button>
      </form>

      <button
        type="button"
        onClick={() => void handleResend()}
        disabled={loading || resendSecondsLeft > 0}
        className="w-full text-zinc-300 text-sm hover:text-emerald-300 transition-colors disabled:opacity-50 disabled:hover:text-zinc-300"
        style={{ marginTop: '14px' }}
      >
        {resendSecondsLeft > 0
          ? `Resend code (${resendSecondsLeft}s)`
          : 'Resend code'}
      </button>

      <button
        type="button"
        onClick={onUseDifferentName}
        disabled={loading}
        className="w-full text-zinc-400 text-sm hover:text-emerald-300 transition-colors"
        style={{ marginTop: '12px' }}
      >
        Use a different artist name
      </button>
    </div>
  )
}
