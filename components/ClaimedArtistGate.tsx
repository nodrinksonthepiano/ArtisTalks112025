'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { getResendCooldownSeconds } from '@/lib/rateLimitConfig'

const RATE_LIMIT_MESSAGE =
  'Too many attempts. Wait about 15 minutes, then refresh and try one new code.'

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
  const [rateLimited, setRateLimited] = useState(false)
  const lastSubmittedTokenRef = useRef('')

  useEffect(() => {
    if (resendSecondsLeft <= 0) return
    const id = window.setInterval(() => {
      setResendSecondsLeft((s) => (s <= 1 ? 0 : s - 1))
    }, 1000)
    return () => window.clearInterval(id)
  }, [resendSecondsLeft])

  useEffect(() => {
    if (token.length < 6) {
      lastSubmittedTokenRef.current = ''
      setRateLimited(false)
    }
  }, [token])

  const handleVerify = useCallback(
    async (e?: React.FormEvent) => {
      if (e) e.preventDefault()
      const trimmed = token.trim()
      if (!trimmed || loading || rateLimited) return
      if (lastSubmittedTokenRef.current === trimmed) return

      lastSubmittedTokenRef.current = trimmed
      setLoading(true)
      setError('')
      setInfo('')

      try {
        const res = await fetch('/api/artist/verify-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ artist_name: artistName, token: trimmed }),
        })
        const data = (await res.json().catch(() => ({}))) as {
          verified?: boolean
          error?: string
        }

        if (res.status === 429) {
          setRateLimited(true)
          setError(RATE_LIMIT_MESSAGE)
          setLoading(false)
          return
        }

        if (!res.ok || !data.verified) {
          setError(
            typeof data.error === 'string' && data.error
              ? data.error
              : 'Invalid code'
          )
          setLoading(false)
          return
        }

        window.location.reload()
      } catch {
        setError('Unable to verify code')
        setLoading(false)
      }
    },
    [artistName, token, loading, rateLimited]
  )

  useEffect(() => {
    if (token.length === 6 && !loading && !rateLimited) {
      void handleVerify()
    }
  }, [token, loading, rateLimited, handleVerify])

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
        setRateLimited(true)
        setError(RATE_LIMIT_MESSAGE)
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
      lastSubmittedTokenRef.current = ''
      setRateLimited(false)
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
          disabled={loading}
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
        <button
          type="submit"
          disabled={loading || rateLimited || token.length !== 6}
          style={{
            ...sendButtonStyle,
            opacity: loading || rateLimited || token.length !== 6 ? 0.6 : 1,
            cursor: loading || rateLimited ? 'wait' : 'pointer',
          }}
        >
          {loading ? 'Verifying…' : 'Enter Sanctuary'}
        </button>
      </form>

      <button
        type="button"
        onClick={() => void handleResend()}
        disabled={loading || resendSecondsLeft > 0 || rateLimited}
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
