'use client'

import { useState } from 'react'
import { Profile } from '@/hooks/useProfile'

interface ColorPanelProps {
  profile: Profile | null
  onSave: (updates: Partial<Profile>) => void
  onClose: () => void
  onPreviewChange?: (preview: { primary_color?: string; accent_color?: string }) => void
}

// COPIED FROM ZEYODA ProfileEditPanel.tsx lines 12-21
const COLOR_PRESETS = {
  gold: { name: "Gold", primary: "#FFD700", accent: "#B8860B" },
  silver: { name: "Silver", primary: "#C0C0C0", accent: "#808080" },
  bronze: { name: "Bronze", primary: "#CD7F32", accent: "#A0522D" },
  emerald: { name: "Emerald", primary: "#50C878", accent: "#228B22" },
  sapphire: { name: "Sapphire", primary: "#0F52BA", accent: "#1E40AF" },
  ruby: { name: "Ruby", primary: "#E0115F", accent: "#B22222" },
  black: { name: "Black", primary: "#1a1a1a", accent: "#404040" },
  white: { name: "White", primary: "#F8F8FF", accent: "#4A4A4A" }
};

export default function ColorPanel({ profile, onSave, onClose, onPreviewChange }: ColorPanelProps) {
  const [primaryColor, setPrimaryColor] = useState(profile?.primary_color || '#10b981')
  const [accentColor, setAccentColor] = useState(profile?.accent_color || '#fbbf24')

  const applyPrimaryPreset = (presetKey: string) => {
    const preset = COLOR_PRESETS[presetKey as keyof typeof COLOR_PRESETS]
    if (preset) {
      setPrimaryColor(preset.primary)
      onPreviewChange?.({ primary_color: preset.primary, accent_color: accentColor })
    }
  }

  const applyAccentPreset = (presetKey: string) => {
    const preset = COLOR_PRESETS[presetKey as keyof typeof COLOR_PRESETS]
    if (preset) {
      setAccentColor(preset.accent)
      onPreviewChange?.({ primary_color: primaryColor, accent_color: preset.accent })
    }
  }

  const handleSave = async () => {
    onSave({ 
      primary_color: primaryColor,
      accent_color: accentColor,
      brand_color: primaryColor // Use primary as brand color
    })
    
    // Save completion to curriculum_answers
    if (profile?.id) {
      const { createClient } = await import('@/utils/supabase/client')
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('curriculum_answers').upsert({
          user_id: user.id,
          question_key: 'colors_set',
          answer_data: { 
            text: 'Colors set', 
            primary: primaryColor, 
            accent: accentColor,
            step_id: 'COLORS_PANEL' // CRITICAL: Store stepId to fix duplicate key bug
          },
          project_id: null
        })
      }
    }
    
    onClose()
  }

  return (
    <div className="space-y-6">
      {/* Primary Color Section - COPIED FROM ZEYODA ProfileEditPanel.tsx lines 441-481 */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-3">Primary Color (Background)</h3>
        <div className="grid grid-cols-4 gap-3 mb-4">
          {Object.entries(COLOR_PRESETS).map(([key, preset]) => (
            <button
              key={`primary-${key}`}
              onClick={() => applyPrimaryPreset(key)}
              className={`relative w-12 h-12 rounded-lg border-2 transition-all hover:scale-110 ${
                primaryColor === preset.primary
                  ? 'border-white'
                  : 'border-gray-600 hover:border-gray-400'
              }`}
              style={{ backgroundColor: preset.primary }}
              title={`${preset.name} Primary`}
            >
              {primaryColor === preset.primary && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-white text-lg font-bold">✓</span>
                </div>
              )}
            </button>
          ))}
        </div>
          
        <div className="flex gap-2">
          <input
            type="color"
            value={primaryColor}
            onChange={(e) => {
              const newColor = e.target.value
              setPrimaryColor(newColor)
              onPreviewChange?.({ primary_color: newColor, accent_color: accentColor })
            }}
            className="w-10 h-10 rounded border border-gray-600"
          />
          <input
            type="text"
            value={primaryColor}
            onChange={(e) => {
              const newColor = e.target.value
              setPrimaryColor(newColor)
              onPreviewChange?.({ primary_color: newColor, accent_color: accentColor })
            }}
            className="flex-1 p-2 bg-gray-700 text-white rounded border border-gray-600 text-sm"
            placeholder="#RRGGBB"
          />
        </div>
      </div>

      {/* Accent Color Section - COPIED FROM ZEYODA ProfileEditPanel.tsx lines 483-523 */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-3">Accent Color (Text/Highlights)</h3>
        <div className="grid grid-cols-4 gap-3 mb-4">
          {Object.entries(COLOR_PRESETS).map(([key, preset]) => (
            <button
              key={`accent-${key}`}
              onClick={() => applyAccentPreset(key)}
              className={`relative w-12 h-12 rounded-lg border-2 transition-all hover:scale-110 ${
                accentColor === preset.accent
                  ? 'border-white'
                  : 'border-gray-600 hover:border-gray-400'
              }`}
              style={{ backgroundColor: preset.accent }}
              title={`${preset.name} Accent`}
            >
              {accentColor === preset.accent && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-white text-lg font-bold">✓</span>
                </div>
              )}
            </button>
          ))}
        </div>
        
        <div className="flex gap-2">
          <input
            type="color"
            value={accentColor}
            onChange={(e) => {
              const newColor = e.target.value
              setAccentColor(newColor)
              onPreviewChange?.({ primary_color: primaryColor, accent_color: newColor })
            }}
            className="w-10 h-10 rounded border border-gray-600"
          />
          <input
            type="text"
            value={accentColor}
            onChange={(e) => {
              const newColor = e.target.value
              setAccentColor(newColor)
              onPreviewChange?.({ primary_color: primaryColor, accent_color: newColor })
            }}
            className="flex-1 p-2 bg-gray-700 text-white rounded border border-gray-600 text-sm"
            placeholder="#RRGGBB"
          />
        </div>
      </div>

      {/* Action Buttons */}
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

