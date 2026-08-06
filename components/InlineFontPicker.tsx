'use client'

import { useState, useCallback, useEffect } from 'react'
import { Profile } from '@/hooks/useProfile'
import {
  DEFAULT_FONT_VALUE,
  FEATURED_FONTS,
  searchCatalogFonts,
} from '@/lib/fontCatalog'
import { applyCatalogFont } from '@/utils/applyCatalogFont'

interface InlineFontPickerProps {
  profile: Profile | null
  onFontChange: (updates: Partial<Profile>) => void // Autosave callback
}

export default function InlineFontPicker({ profile, onFontChange }: InlineFontPickerProps) {
  const [fontFamily, setFontFamily] = useState(profile?.font_family || DEFAULT_FONT_VALUE)
  const [showFontDropdown, setShowFontDropdown] = useState(false)
  const [fontSearch, setFontSearch] = useState('')
  const [fontError, setFontError] = useState<string | null>(null)

  const updateFontImmediately = useCallback(async (newFont: string) => {
    if (typeof document === 'undefined') return

    const result = await applyCatalogFont(newFont)
    if (!result.ok) {
      setFontError(result.error)
      return
    }

    setFontError(null)
    setFontFamily(result.fontValue)

    const { applyLogoBackground } = await import('@/utils/themeBackground')
    applyLogoBackground(
      {
        font_family: result.fontValue,
        primary_color: profile?.primary_color,
        accent_color: profile?.accent_color,
      } as Profile,
      undefined,
      undefined
    )

    onFontChange({ font_family: result.fontValue })
  }, [profile, onFontChange])

  useEffect(() => {
    if (profile?.font_family) setFontFamily(profile.font_family)
  }, [profile?.font_family])

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-white mb-2">Typography</h3>

        <div className="grid grid-cols-3 gap-2 mb-3">
          {FEATURED_FONTS.map((font) => (
            <button
              key={font.value}
              onClick={() => updateFontImmediately(font.value)}
              className={`p-3 rounded-lg border-2 transition-all ${
                fontFamily === font.value
                  ? 'border-emerald-500 bg-emerald-500 bg-opacity-20'
                  : 'border-gray-600 bg-gray-700 hover:border-gray-500'
              }`}
              style={{ fontFamily: font.value }}
            >
              <div className="text-white font-bold text-sm">{font.name}</div>
            </button>
          ))}
        </div>

        <div className="relative">
          <label className="block text-sm text-gray-300 mb-2">Or choose from common fonts:</label>
          <div className="relative">
            <input
              type="text"
              value={fontSearch}
              onChange={(e) => setFontSearch(e.target.value)}
              onFocus={() => setShowFontDropdown(true)}
              placeholder={fontFamily || 'Search fonts...'}
              className="w-full p-2 bg-gray-700 text-white rounded border border-gray-600 text-sm focus:border-emerald-500"
              style={{ fontFamily: fontFamily }}
            />

            {showFontDropdown && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-600 rounded max-h-40 overflow-y-auto z-50">
                {searchCatalogFonts(fontSearch).map((font) => (
                  <button
                    key={font.value}
                    onClick={() => {
                      updateFontImmediately(font.value)
                      setFontSearch('')
                      setShowFontDropdown(false)
                    }}
                    className="w-full text-left p-2 hover:bg-gray-700 text-white text-sm transition-colors"
                    style={{ fontFamily: font.value }}
                  >
                    {font.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {fontError ? (
            <p className="mt-2 text-sm text-red-400">{fontError}</p>
          ) : null}

          {showFontDropdown && (
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowFontDropdown(false)}
            />
          )}
        </div>
      </div>
    </div>
  )
}
