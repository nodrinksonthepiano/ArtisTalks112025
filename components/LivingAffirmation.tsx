'use client'

interface LivingAffirmationProps {
  text: string
}

/** Presentational gate block — exact assembled sentence above save/OTP. */
export default function LivingAffirmation({ text }: LivingAffirmationProps) {
  if (!text) return null

  return (
    <p
      className="gold-etched"
      style={{
        marginTop: '0',
        marginBottom: '24px',
        whiteSpace: 'pre-line',
        fontSize: '1.05rem',
        lineHeight: 1.45,
      }}
    >
      {text}
    </p>
  )
}
