'use client'

import { useState } from 'react'
import { Profile } from '@/hooks/useProfile'

interface FontPanelProps {
  profile: Profile | null
  onSave: (updates: Partial<Profile>) => void
  onClose: () => void
}

// COPIED FROM ZEYODA ProfileEditPanel.tsx lines 23-30
const FONT_OPTIONS = [
  { name: "Bungee", value: "Bungee, cursive" },
  { name: "Geist", value: "Geist, sans-serif" },
  { name: "Inter", value: "Inter, sans-serif" },
  { name: "DM Sans", value: "DM Sans, sans-serif" },
  { name: "Space Grotesk", value: "Space Grotesk, sans-serif" },
  { name: "Instrument Sans", value: "Instrument Sans, sans-serif" }
];

// COPIED FROM ZEYODA ProfileEditPanel.tsx lines 32-65
const COMMON_FONTS = [
  "Arial, sans-serif",
  "Helvetica, sans-serif", 
  "Times New Roman, serif",
  "Georgia, serif",
  "Verdana, sans-serif",
  "Trebuchet MS, sans-serif",
  "Palatino, serif",
  "Garamond, serif",
  "Bookman, serif",
  "Comic Sans MS, cursive",
  "Impact, sans-serif",
  "Lucida Console, monospace",
  "Monaco, monospace",
  "Courier New, monospace",
  "Roboto, sans-serif",
  "Open Sans, sans-serif",
  "Lato, sans-serif",
  "Montserrat, sans-serif",
  "Poppins, sans-serif",
  "Nunito, sans-serif",
  "Raleway, sans-serif",
  "Source Sans Pro, sans-serif",
  "Ubuntu, sans-serif",
  "Merriweather, serif",
  "Playfair Display, serif",
  "Lora, serif",
  "Crimson Text, serif",
  "Oswald, sans-serif",
  "Bebas Neue, cursive",
  "Pacifico, cursive",
  "Dancing Script, cursive",
  "Lobster, cursive"
];

export default function FontPanel({ profile, onSave, onClose }: FontPanelProps) {
  const [fontFamily, setFontFamily] = useState(profile?.font_family || 'Inter, sans-serif')
  const [showFontDropdown, setShowFontDropdown] = useState(false)
  const [fontSearch, setFontSearch] = useState('')

  const handleSave = async () => {
    onSave({ font_family: fontFamily })
    
    // Save completion to curriculum_answers
    if (profile?.id) {
      const { createClient } = await import('@/utils/supabase/client')
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('curriculum_answers').upsert({
          user_id: user.id,
          question_key: 'font_set',
          answer_data: { text: 'Font set', font: fontFamily },
          project_id: null
        })
      }
    }
    
    onClose()
  }

  return (
    <div className="space-y-6">
      {/* Typography Section - COPIED FROM ZEYODA ProfileEditPanel.tsx lines 926-993 */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-3">Typography</h3>
        
        {/* Standard Font Buttons */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          {FONT_OPTIONS.map((font) => (
            <button
              key={font.value}
              onClick={() => setFontFamily(font.value)}
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

        {/* Font Dropdown */}
        <div className="relative">
          <label className="block text-sm text-gray-300 mb-2">Or choose from common fonts:</label>
          <div className="relative">
            <input
              type="text"
              value={fontSearch}
              onChange={(e) => setFontSearch(e.target.value)}
              onFocus={() => setShowFontDropdown(true)}
              placeholder={fontFamily || "Search fonts... (e.g. Arial, Roboto, Times)"}
              className="w-full p-2 bg-gray-700 text-white rounded border border-gray-600 text-sm focus:border-emerald-500"
              style={{ fontFamily: fontFamily }}
            />
            
            {showFontDropdown && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-600 rounded max-h-40 overflow-y-auto z-50">
                {COMMON_FONTS
                  .filter(font => font.toLowerCase().includes(fontSearch.toLowerCase()))
                  .map((font) => (
                    <button
                      key={font}
                      onClick={() => {
                        setFontFamily(font);
                        setFontSearch('');
                        setShowFontDropdown(false);
                      }}
                      className="w-full text-left p-2 hover:bg-gray-700 text-white text-sm transition-colors"
                      style={{ fontFamily: font }}
                    >
                      {font}
                    </button>
                  ))}
              </div>
            )}
          </div>
          
          {/* Close dropdown when clicking outside */}
          {showFontDropdown && (
            <div 
              className="fixed inset-0 z-40" 
              onClick={() => setShowFontDropdown(false)}
            />
          )}
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

