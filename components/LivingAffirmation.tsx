'use client'

interface LivingAffirmationProps {
  artistName: string
  text: string
  editable?: boolean
  onTextChange?: (text: string) => void
}

/** Living Affirmation — artist name as heading, editable at gate and saved playground. */
export default function LivingAffirmation({
  artistName,
  text,
  editable = false,
  onTextChange,
}: LivingAffirmationProps) {
  if (!text && !artistName) return null

  return (
    <div style={{ marginBottom: '24px' }}>
      {artistName ? (
        <h2
          className="gold-etched"
          style={{
            marginTop: 0,
            marginBottom: '12px',
            fontSize: '1.35rem',
            lineHeight: 1.25,
            fontWeight: 600,
          }}
        >
          {artistName}
        </h2>
      ) : null}
      {editable ? (
        <textarea
          value={text}
          onChange={(e) => onTextChange?.(e.target.value)}
          rows={4}
          className="w-full p-3 rounded-lg bg-gray-800/80 border border-gray-600 text-white text-sm"
          style={{
            lineHeight: 1.45,
            resize: 'vertical',
            minHeight: '5rem',
          }}
          aria-label="Living Affirmation"
        />
      ) : text ? (
        <p
          className="gold-etched"
          style={{
            marginTop: 0,
            marginBottom: 0,
            whiteSpace: 'pre-line',
            fontSize: '1.05rem',
            lineHeight: 1.45,
          }}
        >
          {text}
        </p>
      ) : null}
    </div>
  )
}
