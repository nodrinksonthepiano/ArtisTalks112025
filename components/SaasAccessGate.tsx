'use client'

import { useState } from 'react'

const primaryButtonStyle: React.CSSProperties = {
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

interface SaasAccessGateProps {
  onActivated: () => Promise<void> | void
}

export default function SaasAccessGate({ onActivated }: SaasAccessGateProps) {
  const [accessWord, setAccessWord] = useState('')
  const [amount, setAmount] = useState('0')
  const [showAmount, setShowAmount] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleAccessWordSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!accessWord.trim()) return
    setError('')
    setShowAmount(true)
  }

  async function handleAmountSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (loading) return

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/saas/cancakes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessWord,
          amount: Number(amount),
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }

      if (!res.ok) {
        setError(data.error || 'Unable to activate access.')
        setLoading(false)
        return
      }

      await onActivated()
    } catch {
      setError('Unable to activate access.')
      setLoading(false)
    }
  }

  return (
    <div className="w-full text-left">
      <div className="text-center">
        <h1 className="gold-etched" style={{ marginTop: 0, marginBottom: '14px' }}>
          Keep building your ArtisTalks - $8/month
        </h1>
        <p className="text-sm text-zinc-200" style={{ lineHeight: 1.5 }}>
          Your saved page, affirmation, and answers stay here. To continue deeper
          into your artist development, pay $8 through Venmo and Jai will activate
          your access after payment.
        </p>
      </div>

      <div
        className="mt-4 rounded-lg border border-emerald-500/30 bg-black/35 p-3"
        style={{ boxShadow: 'inset 0 0 12px rgba(16, 185, 129, 0.08)' }}
      >
        <p className="text-sm text-emerald-100 text-center" style={{ marginBottom: '10px' }}>
          Beta access
        </p>

        {!showAmount ? (
          <form onSubmit={handleAccessWordSubmit}>
            <input
              type="text"
              value={accessWord}
              onChange={(e) => setAccessWord(e.target.value)}
              placeholder="Enter access word"
              className="email-input"
              autoComplete="off"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={!accessWord.trim() || loading}
              style={{
                ...primaryButtonStyle,
                cursor: !accessWord.trim() || loading ? 'not-allowed' : 'pointer',
              }}
            >
              Continue
            </button>
          </form>
        ) : (
          <form onSubmit={handleAmountSubmit}>
            <label className="block text-sm text-zinc-200 text-center mb-2">
              What can you pay today?
            </label>
            <input
              type="number"
              min="0"
              step="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="email-input"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || amount.trim() === ''}
              style={{
                ...primaryButtonStyle,
                cursor: loading || amount.trim() === '' ? 'wait' : 'pointer',
              }}
            >
              {loading ? 'Activating...' : 'Activate beta access'}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                setShowAmount(false)
                setAmount('0')
                setError('')
              }}
              className="w-full text-zinc-400 text-sm hover:text-emerald-300 transition-colors"
              style={{ marginTop: '12px' }}
            >
              Change access word
            </button>
          </form>
        )}

        {error && (
          <p className="text-red-400 text-sm text-center" style={{ marginTop: '10px' }}>
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
