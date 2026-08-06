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
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-white">{label}</h3>
      <div className="grid grid-cols-3 gap-2 mb-2">
        {FEATURED_FONTS.map((font) => {
          const selected = isSameCatalogFont(value, font.value)
          return (
            <button
              key={`${label}-${font.value}`}
              type="button"
              onClick={() => void pick(font.value)}
              disabled={fontLoading}
              className={`p-3 rounded-lg border-2 transition-all ${
                selected
                  ? 'border-emerald-500 bg-emerald-500 bg-opacity-20 ring-2 ring-emerald-400/60'
                  : 'border-gray-600 bg-gray-700 hover:border-gray-500'
              }`}
              style={{ fontFamily: canShow(font) ? font.value : undefined }}
              aria-pressed={selected}
            >
              <div className="text-white font-bold text-sm">{font.name}</div>
            </button>
          )
        })}
      </div>
      <div className="relative">
        <input
          type="text"
          value={fontSearch}
          onChange={(e) => setFontSearch(e.target.value)}
          onFocus={() => setShowDropdown(true)}
          placeholder="Search fonts…"
          className="w-full p-2 bg-gray-700 text-white rounded border border-gray-600 text-sm focus:border-emerald-500"
          style={{ fontFamily: value }}
        />
        {showDropdown && (
          <>
            <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-600 rounded max-h-40 overflow-y-auto z-50">
              {searchCatalogFonts(fontSearch).map((font) => {
                const selected = isSameCatalogFont(value, font.value)
                return (
                  <button
                    key={font.value}
                    type="button"
                    onClick={() => void pick(font.value)}
                    disabled={fontLoading}
                    className={`w-full text-left p-2 text-white text-sm transition-colors flex items-center justify-between gap-2 ${
                      selected
                        ? 'bg-emerald-900/40 border-l-2 border-emerald-400'
                        : 'hover:bg-gray-700'
                    }`}
                    style={{ fontFamily: canShow(font) ? font.value : undefined }}
                  >
                    <span>{font.name}</span>
                    {selected ? (
                      <span className="text-emerald-400 text-xs shrink-0">Selected</span>
                    ) : null}
                  </button>
                )
              })}
            </div>
            <div className="fixed inset-0 z-40" onClick={() => setShowDropdown(false)} />
          </>
        )}
      </div>
      {fontLoading ? <p className="text-sm text-zinc-400">Loading font…</p> : null}
      {fontError ? <p className="text-sm text-red-400">{fontError}</p> : null}
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
    <div className="space-y-6">
      <FontChoiceRow
        label="Headline font"
        value={headlineFont}
        featuredReady={featuredReady}
        onPick={(fontValue) => {
          setHeadlineFont(fontValue)
          void applyTheme(fontValue, bodyFont)
          onFontChange({ font_family: fontValue })
        }}
      />
      <FontChoiceRow
        label="Body font"
        value={bodyFont}
        featuredReady={featuredReady}
        onPick={(fontValue) => {
          setBodyFont(fontValue)
          void applyTheme(headlineFont, fontValue)
          onFontChange({ body_font_family: fontValue })
        }}
      />
      <div className="rounded-lg border border-emerald-500/30 bg-black/20 p-4 text-left">
        <p
          className="text-lg text-white font-semibold"
          style={{ fontFamily: headlineFont }}
        >
          {profile?.artist_name?.trim() || 'Your artist name'}
        </p>
        <p className="text-sm text-zinc-300 mt-2" style={{ fontFamily: bodyFont }}>
          Your words and longer answers will read in this lettering.
        </p>
      </div>
    </div>
  )
}
