'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import LivingAffirmation from '@/components/LivingAffirmation'
import { type SanctuaryAnswers } from '@/lib/sanctuarySections'

interface SanctuaryAccordionProps {
  answers: SanctuaryAnswers
  accentColor?: string | null
  fontFamily?: string | null
  showAffirmation?: boolean
  artistName?: string
  affirmationText?: string
  affirmationReady?: boolean
  onAffirmationChange?: (text: string) => void
}

type LivingSectionId = 'affirmation'

type LivingSection = {
  id: 'affirmation'
  preview: string
}

function previewText(text: string, fallback: string): string {
  const normalized = text.trim().replace(/\s+/g, ' ')
  if (!normalized) return fallback
  return normalized.length > 140 ? `${normalized.slice(0, 137)}...` : normalized
}

export default function SanctuaryAccordion({
  answers: _answers,
  accentColor,
  fontFamily,
  showAffirmation = false,
  artistName = '',
  affirmationText = '',
  affirmationReady = true,
  onAffirmationChange,
}: SanctuaryAccordionProps) {
  const sections = useMemo<LivingSection[]>(() => {
    if (!showAffirmation) return []

    return [
      {
        id: 'affirmation',
        preview: previewText(affirmationText, 'Affirmation in progress'),
      },
    ]
  }, [showAffirmation, affirmationText])

  const [openSectionIds, setOpenSectionIds] = useState<Set<LivingSectionId>>(
    () => new Set()
  )
  const previousVisibleIdsRef = useRef<LivingSectionId[]>([])
  const hydratedOpenRef = useRef(false)
  const visibleIds = useMemo(
    () => sections.map((section) => section.id),
    [sections]
  )
  const visibleIdsSignature = visibleIds.join('|')

  useEffect(() => {
    if (visibleIds.length === 0) {
      previousVisibleIdsRef.current = []
      setOpenSectionIds(new Set())
      return
    }

    const previousVisibleIds = previousVisibleIdsRef.current
    const newestVisibleId = visibleIds[visibleIds.length - 1]

    if (!hydratedOpenRef.current) {
      setOpenSectionIds(new Set([newestVisibleId]))
      previousVisibleIdsRef.current = visibleIds
      hydratedOpenRef.current = true
      return
    }

    const newlyVisibleIds = visibleIds.filter(
      (id) => !previousVisibleIds.includes(id)
    )

    if (newlyVisibleIds.length > 0) {
      const newSectionId = newlyVisibleIds[newlyVisibleIds.length - 1]
      const previouslyNewestId =
        previousVisibleIds[previousVisibleIds.length - 1]

      setOpenSectionIds((current) => {
        const next = new Set(
          [...current].filter((id) => visibleIds.includes(id))
        )
        if (previouslyNewestId && previouslyNewestId !== newSectionId) {
          next.delete(previouslyNewestId)
        }
        next.add(newSectionId)
        return next
      })
    } else {
      setOpenSectionIds((current) => {
        const next = new Set(
          [...current].filter((id) => visibleIds.includes(id))
        )
        return next.size === current.size ? current : next
      })
    }

    previousVisibleIdsRef.current = visibleIds
  }, [visibleIdsSignature, visibleIds])

  if (sections.length === 0) return null

  const headingColor = accentColor || '#6ee7b7'
  const typeface = fontFamily || 'Geist Sans, sans-serif'

  const toggleSection = (sectionId: LivingSectionId) => {
    setOpenSectionIds((current) => {
      const next = new Set(current)
      if (next.has(sectionId)) {
        next.delete(sectionId)
      } else {
        next.add(sectionId)
      }
      return next
    })
  }

  return (
    <div
      className="w-full max-w-xl mx-auto text-center"
      style={{
        marginTop: '8px',
        marginBottom: '12px',
        paddingLeft: '12px',
        paddingRight: '12px',
        position: 'relative',
        zIndex: 5,
      }}
    >
      {sections.map((section) => {
        const isOpen = openSectionIds.has(section.id)
        const preview = section.preview

        return (
          <div
            key={section.id}
            style={{
              borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
            }}
          >
            <button
              type="button"
              onClick={() => toggleSection(section.id)}
              aria-expanded={isOpen}
              className="w-full"
              style={{
                background: 'transparent',
                border: 'none',
                padding: isOpen ? '10px 4px 6px' : '14px 4px',
                cursor: 'pointer',
                color: headingColor,
                fontFamily: typeface,
                fontSize: '0.98rem',
                fontWeight: 600,
                letterSpacing: '0.02em',
                textAlign: 'center',
              }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  maxWidth: '100%',
                }}
              >
                <span
                  aria-hidden
                  style={{
                    display: 'inline-block',
                    width: '0.65em',
                    opacity: 0.85,
                    transform: isOpen ? 'rotate(90deg)' : 'none',
                    transition: 'transform 120ms ease',
                    flexShrink: 0,
                  }}
                >
                  ▸
                </span>
                {!isOpen ? (
                  <span
                    style={{
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      lineHeight: 1.35,
                    }}
                  >
                    {preview}
                  </span>
                ) : null}
              </span>
            </button>

            {isOpen ? (
              <div
                style={{
                  padding: '0 4px 18px',
                  color: '#d4d4d8',
                  fontFamily: typeface,
                  fontSize: '0.95rem',
                  lineHeight: 1.55,
                  textAlign: 'center',
                }}
              >
                <LivingAffirmation
                  artistName={artistName}
                  affirmationText={affirmationText}
                  onAffirmationChange={onAffirmationChange || (() => {})}
                  showValidation={!affirmationReady}
                />
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
