'use client'

import { useEffect, useRef, useState } from 'react'
import {
  sectionBodyLines,
  sectionChangedByAnswers,
  visibleSanctuarySections,
  type SanctuaryAnswers,
  type SanctuarySectionId,
} from '@/lib/sanctuarySections'

interface SanctuaryAccordionProps {
  answers: SanctuaryAnswers
  accentColor?: string | null
  fontFamily?: string | null
}

/**
 * Private sanctuary vision board — grows only as real answers arrive.
 * One visible section open at a time; edits happen only through EmeraldChat.
 */
export default function SanctuaryAccordion({
  answers,
  accentColor,
  fontFamily,
}: SanctuaryAccordionProps) {
  const visibleSections = visibleSanctuarySections(answers)
  const [openSectionId, setOpenSectionId] = useState<SanctuarySectionId | null>(
    null
  )
  const prevAnswersRef = useRef<SanctuaryAnswers | null>(null)
  const hydratedOpenRef = useRef(false)

  useEffect(() => {
    const visibleIds = visibleSanctuarySections(answers).map((s) => s.id)
    const prev = prevAnswersRef.current

    // First payload with content (returning artist or first anonymous answer):
    // open first visible section — do not replay progressive reveal.
    if (!hydratedOpenRef.current) {
      prevAnswersRef.current = answers
      if (visibleIds.length === 0) {
        setOpenSectionId(null)
        return
      }
      setOpenSectionId(visibleIds[0])
      hydratedOpenRef.current = true
      return
    }

    const changed = prev ? sectionChangedByAnswers(prev, answers) : null
    if (changed && visibleIds.includes(changed)) {
      setOpenSectionId(changed)
    } else {
      setOpenSectionId((current) => {
        if (visibleIds.length === 0) return null
        if (current && visibleIds.includes(current)) return current
        return visibleIds[0]
      })
    }

    prevAnswersRef.current = answers
  }, [answers])

  if (visibleSections.length === 0) return null

  const headingColor = accentColor || '#6ee7b7'
  const typeface = fontFamily || 'Geist Sans, sans-serif'
  const activeId =
    openSectionId && visibleSections.some((s) => s.id === openSectionId)
      ? openSectionId
      : visibleSections[0].id

  return (
    <div
      className="w-full max-w-xl mx-auto text-left"
      style={{
        marginTop: '8px',
        marginBottom: '8px',
        paddingLeft: '12px',
        paddingRight: '12px',
        position: 'relative',
        zIndex: 5,
      }}
    >
      {visibleSections.map((section) => {
        const isOpen = activeId === section.id
        const lines = sectionBodyLines(section, answers)

        return (
          <div
            key={section.id}
            style={{
              borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
            }}
          >
            <button
              type="button"
              onClick={() => setOpenSectionId(section.id)}
              aria-expanded={isOpen}
              className="w-full text-left"
              style={{
                background: 'transparent',
                border: 'none',
                padding: '14px 4px',
                cursor: 'pointer',
                color: headingColor,
                fontFamily: typeface,
                fontSize: '1.05rem',
                fontWeight: 600,
                letterSpacing: '0.02em',
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                <span
                  aria-hidden
                  style={{
                    display: 'inline-block',
                    width: '0.65em',
                    opacity: 0.85,
                    transform: isOpen ? 'rotate(90deg)' : 'none',
                    transition: 'transform 120ms ease',
                  }}
                >
                  ▸
                </span>
                {section.title}
              </span>
            </button>

            {isOpen ? (
              <div
                style={{
                  padding: '0 4px 16px 1.55rem',
                  color: '#d4d4d8',
                  fontFamily: typeface,
                  fontSize: '0.95rem',
                  lineHeight: 1.55,
                }}
              >
                {lines.map((line, index) => (
                  <p
                    key={`${section.id}-${index}`}
                    style={{
                      margin: index === 0 ? 0 : '10px 0 0',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {line}
                  </p>
                ))}
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
