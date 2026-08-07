'use client'

import { useState } from 'react'

interface LivingAffirmationProps {
  artistName: string
  affirmationText: string
  onAffirmationChange: (text: string) => void
  showValidation?: boolean
}

/** Editable living-page statement. It remains visible even when intentionally blank. */
export default function LivingAffirmation({
  artistName,
  affirmationText,
  onAffirmationChange,
  showValidation = false,
}: LivingAffirmationProps) {
  const displayName = artistName.trim()
  const [undoStack, setUndoStack] = useState<string[]>([])
  const [redoStack, setRedoStack] = useState<string[]>([])

  const updateText = (nextText: string, trackHistory: boolean = true) => {
    if (trackHistory && nextText !== affirmationText) {
      setUndoStack((current) => [...current, affirmationText])
      setRedoStack([])
    }
    onAffirmationChange(nextText)
  }

  const handleUndo = () => {
    setUndoStack((current) => {
      if (current.length === 0) return current
      const previousText = current[current.length - 1]
      setRedoStack((redo) => [affirmationText, ...redo])
      onAffirmationChange(previousText)
      return current.slice(0, -1)
    })
  }

  const handleRedo = () => {
    setRedoStack((current) => {
      if (current.length === 0) return current
      const nextText = current[0]
      setUndoStack((undo) => [...undo, affirmationText])
      onAffirmationChange(nextText)
      return current.slice(1)
    })
  }

  return (
    <div style={{ marginBottom: '16px', width: '100%', textAlign: 'center' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          marginBottom: '8px',
        }}
      >
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            type="button"
            onClick={handleUndo}
            disabled={undoStack.length === 0}
            className="text-xs rounded border border-emerald-400/40 px-2 py-1"
            style={{
              color: '#fffacd',
              opacity: undoStack.length === 0 ? 0.45 : 1,
            }}
          >
            Undo
          </button>
          <button
            type="button"
            onClick={handleRedo}
            disabled={redoStack.length === 0}
            className="text-xs rounded border border-emerald-400/40 px-2 py-1"
            style={{
              color: '#fffacd',
              opacity: redoStack.length === 0 ? 0.45 : 1,
            }}
          >
            Redo
          </button>
        </div>
      </div>
      <textarea
        value={affirmationText}
        onChange={(e) => updateText(e.target.value)}
        rows={4}
        aria-label={
          displayName
            ? `${displayName}'s living affirmation`
            : 'Your living affirmation'
        }
        className="gold-etched"
        style={{
          width: '100%',
          margin: 0,
          padding: '12px',
          fontSize: '1.05rem',
          lineHeight: 1.45,
          background: 'rgba(0, 0, 0, 0.25)',
          border: '1px solid rgba(255, 215, 0, 0.35)',
          borderRadius: '8px',
          resize: 'vertical',
          minHeight: '7rem',
          boxSizing: 'border-box',
          color: 'inherit',
          textAlign: 'center',
        }}
      />
      {showValidation ? (
        <p
          className="text-sm text-center"
          style={{ margin: '8px 0 0', color: '#fcd34d', lineHeight: 1.5 }}
        >
          Write your affirmation above before saving.
        </p>
      ) : null}
    </div>
  )
}
