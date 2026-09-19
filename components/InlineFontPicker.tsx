'use client'

import { useState, useCallback, useEffect } from 'react'
import { Profile } from '@/hooks/useProfile'
import {
  DEFAULT_FONT_VALUE,
  FEATURED_FONTS,
  searchCatalogFonts,
  type FontCatalogEntry,
  isSameCatalogFont,
  normalizeFontFamilyValue,
} from '@/lib/fontCatalog'
import { applyCatalogFont, preloadFeaturedFonts } from '@/utils/applyCatalogFont'

interface InlineFontPickerProps {
  profile: Profile | null
  onFontChange: (updates: Partial<Profile>) => void
}

function FontChoiceRow({
  label,
  value,
  featuredReady,
  onPick,
}: {
  label: string
  value: string
  featuredReady: Set<string>
  onPick: (fontValue: string) => void
}) {
  const [showDropdown, setShowDropdown] = useState(false)
  const [fontSearch, setFontSearch] = useState('')
  const [fontError, setFontError] = useState<string | null>(null)
  const [fontLoading, setFontLoading] = useState(false)

  const canShow = useCallback(
    (entry: FontCatalogEntry) =>
      entry.source === 'geist' ||
      entry.source === 'system' ||
      featuredReady.has(entry.value),
    [featuredReady]
  )

  const pick = async (fontValue: string) => {
    setFontLoading(true)
    const result = await applyCatalogFont(fontValue)
    setFontLoading(false)
    if (!result.ok) {
      setFontError(result.error)
      return
    }
    setFontError(null)
    onPick(result.fontValue)
    setFontSearch('')
    setShowDropdown(false)
  }

  return (
    <div className="artis-font-picker-group">
      <p className="artis-font-picker-label">{label}</p>
      <div className="artis-font-picker-featured" role="group" aria-label={`${label} featured fonts`}>
        {FEATURED_FONTS.map((font) => {
          const selected = isSameCatalogFont(value, font.value)
          return (
            <button
              key={`${label}-${font.value}`}
              type="button"
              onClick={() => void pick(font.value)}
              disabled={fontLoading}
              className={`artis-font-picker-choice${selected ? ' is-selected' : ''}`}
              style={{ fontFamily: canShow(font) ? font.value : undefined }}
              title={font.name}
              aria-label={`${label} ${font.name}`}
              aria-pressed={selected}
            >
              <span className="artis-font-picker-choice-name">{font.name}</span>
            </button>
          )
        })}
      </div>
      <div className="artis-font-picker-search-wrap">
        <input
          type="text"
          value={fontSearch}
          onChange={(e) => setFontSearch(e.target.value)}
          onFocus={() => setShowDropdown(true)}
          placeholder="Search fonts…"
          className="artis-font-picker-search"
          style={{ fontFamily: value }}
          aria-label={`Search ${label} fonts`}
        />
        {showDropdown && (
          <>
            <div className="artis-font-picker-dropdown">
              {searchCatalogFonts(fontSearch).map((font) => {
                const selected = isSameCatalogFont(value, font.value)
                return (
                  <button
                    key={font.value}
                    type="button"
                    onClick={() => void pick(font.value)}
                    disabled={fontLoading}
                    className={`artis-font-picker-option${selected ? ' is-selected' : ''}`}
                    style={{ fontFamily: canShow(font) ? font.value : undefined }}
                  >
                    <span className="artis-font-picker-option-name">{font.name}</span>
                    {selected ? (
                      <span className="artis-font-picker-option-selected">Selected</span>
                    ) : null}
                  </button>
                )
              })}
            </div>
            <div className="fixed inset-0 z-40" onClick={() => setShowDropdown(false)} />
          </>
        )}
      </div>
      {fontLoading ? (
        <p className="artis-font-picker-status is-loading">Loading font…</p>
      ) : null}
      {fontError ? (
        <p className="artis-font-picker-status is-error">{fontError}</p>
      ) : null}
    </div>
  )
}

export default function InlineFontPicker({ profile, onFontChange }: InlineFontPickerProps) {
  const [headlineFont, setHeadlineFont] = useState(
    () => normalizeFontFamilyValue(profile?.font_family) || DEFAULT_FONT_VALUE
  )
  const [bodyFont, setBodyFont] = useState(
    () => normalizeFontFamilyValue(profile?.body_font_family) || DEFAULT_FONT_VALUE
  )
  const [featuredReady, setFeaturedReady] = useState<Set<string>>(new Set())

  useEffect(() => {
    let cancelled = false
    void preloadFeaturedFonts().then((ready) => {
      if (!cancelled) setFeaturedReady(ready)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (profile?.font_family) {
      setHeadlineFont(normalizeFontFamilyValue(profile.font_family))
    }
    if (profile?.body_font_family) {
      setBodyFont(normalizeFontFamilyValue(profile.body_font_family))
    }
  }, [profile?.font_family, profile?.body_font_family])

  const applyTheme = useCallback(
    async (headline: string, body: string) => {
      const { applyLogoBackground } = await import('@/utils/themeBackground')
      applyLogoBackground(
        {
          ...profile,
          font_family: headline,
          body_font_family: body,
        } as Profile,
        undefined,
        undefined
      )
    },
    [profile]
  )

  return (
    <div className="artis-font-picker--compact">
      <FontChoiceRow
        label="Headline"
        value={headlineFont}
        featuredReady={featuredReady}
        onPick={(fontValue) => {
          setHeadlineFont(fontValue)
          void applyTheme(fontValue, bodyFont)
          onFontChange({ font_family: fontValue })
        }}
      />
      <FontChoiceRow
        label="Body"
        value={bodyFont}
        featuredReady={featuredReady}
        onPick={(fontValue) => {
          setBodyFont(fontValue)
          void applyTheme(headlineFont, fontValue)
          onFontChange({ body_font_family: fontValue })
        }}
      />
    </div>
  )
}
