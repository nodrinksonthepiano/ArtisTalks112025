'use client'

import { useState } from 'react'
import { Profile } from '@/hooks/useProfile'
import {
  DEFAULT_FONT_VALUE,
  FEATURED_FONTS,
  searchCatalogFonts,
} from '@/lib/fontCatalog'
import { applyCatalogFont } from '@/utils/applyCatalogFont'

interface FontPanelProps {
  profile: Profile | null
  onSave: (updates: Partial<Profile>) => void
  onClose: () => void
}

export default function FontPanel({ profile, onSave, onClose }: FontPanelProps) {
  const [fontFamily, setFontFamily] = useState(profile?.font_family || DEFAULT_FONT_VALUE)
  const [showFontDropdown, setShowFontDropdown] = useState(false)
  const [fontSearch, setFontSearch] = useState('')
  const [fontError, setFontError] = useState<string | null>(null)

  const selectFont = async (newFont: string) => {
    const result = await applyCatalogFont(newFont)
    if (!result.ok) {
      setFontError(result.error)
      return
    }
    setFontError(null)
    setFontFamily(result.fontValue)
  }

  const handleSave = async () => {
    onSave({ font_family: fontFamily })

    if (profile?.id) {
      const { createClient } = await import('@/utils/supabase/client')
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('curriculum_answers').upsert({
          user_id: user.id,
          question_key: 'font_set',
          answer_data: {
            text: 'Font set',
            font: fontFamily,
            step_id: 'FONT_PANEL',
          },
          project_id: null,
        })
      }
    }

    onClose()
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-white mb-3">Typography</h3>

        <div className="grid grid-cols-3 gap-3 mb-4">
          {FEATURED_FONTS.map((font) => (
            <button
              key={font.value}
              onClick={() => selectFont(font.value)}
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
                      void selectFont(font.value)
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

      <div className="flex gap-3 pt-4 border-t border-gray-700">
        <button
          onClick={onClose}
          className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors"
        >
          Save
        </button>
      </div>
    </div>
  )
}
