'use client'

import { useState } from 'react'
import type { ArtistEvidence } from '@/hooks/useArtistEvidence'
import type { PillarChoice } from '@/lib/curriculum'

interface EvidenceStackProps {
  items: ArtistEvidence[]
  count: number
  loading: boolean
  journeyStage: PillarChoice | null
  onAdd: (
    text: string,
    evidenceUrl?: string | null
  ) => Promise<{ error: string | null }>
}

export default function EvidenceStack({
  items,
  count,
  loading,
  journeyStage,
  onAdd,
}: EvidenceStackProps) {
  const [text, setText] = useState('')
  const [link, setLink] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!journeyStage) return
    setSubmitting(true)
    setError('')
    const result = await onAdd(text, link || null)
    if (result.error) {
      setError(result.error)
    } else {
      setText('')
      setLink('')
    }
    setSubmitting(false)
  }

  return (
    <div className="w-full" style={{ marginTop: '16px' }}>
      <p
        className="gold-etched text-sm"
        style={{ margin: '0 0 8px', fontWeight: 600 }}
      >
        Evidence ({count})
      </p>

      {loading && count === 0 ? (
        <p className="text-zinc-400 text-sm" style={{ margin: 0 }}>Loading…</p>
      ) : null}

      {items.length > 0 ? (
        <ul
          className="flex flex-col gap-2 mb-4"
          style={{ listStyle: 'none', padding: 0, margin: '0 0 16px' }}
        >
          {items.map((item) => (
            <li
              key={item.id}
              className="rounded-lg px-3 py-2 text-sm"
              style={{
                background: 'rgba(0, 0, 0, 0.35)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#ecfdf5',
                lineHeight: 1.45,
              }}
            >
              {item.text ? <p style={{ margin: '0 0 4px' }}>{item.text}</p> : null}
              {item.evidence_url ? (
                <a
                  href={item.evidence_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-300 text-xs underline"
                  style={{ wordBreak: 'break-all' }}
                >
                  {item.evidence_url}
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {journeyStage ? (
        <form onSubmit={(e) => void handleSubmit(e)}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="What you made, moved, told, or explored…"
            rows={3}
            disabled={submitting}
            className="w-full p-3 rounded-lg bg-gray-800/80 border border-gray-600 text-white text-sm mb-2"
          />
          <input
            type="url"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="Optional link"
            disabled={submitting}
            className="w-full p-3 rounded-lg bg-gray-800/80 border border-gray-600 text-white text-sm mb-2"
          />
          {error ? (
            <p className="text-red-400 text-sm text-center mb-2" style={{ margin: '0 0 8px' }}>
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={submitting || (!text.trim() && !link.trim())}
            style={{
              padding: '10px',
              backgroundColor: '#047857',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: submitting ? 'wait' : 'pointer',
              boxShadow: '0 0 5px rgba(255, 215, 0, 0.8)',
              width: '100%',
              opacity: submitting || (!text.trim() && !link.trim()) ? 0.6 : 1,
            }}
          >
            {submitting ? 'Saving…' : 'Add evidence'}
          </button>
        </form>
      ) : null}
    </div>
  )
}
