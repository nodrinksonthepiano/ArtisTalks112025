'use client'

import { useState, useCallback, useEffect } from 'react'
import { Profile } from '@/hooks/useProfile'

interface InlineFontPickerProps {
  profile: Profile | null
  onFontChange: (updates: Partial<Profile>) => void // Autosave callback
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

export default function InlineFontPicker({ profile, onFontChange }: InlineFontPickerProps) {
  const [fontFamily, setFontFamily] = useState(profile?.font_family || 'Inter, sans-serif')
  const [showFontDropdown, setShowFontDropdown] = useState(false)
  const [fontSearch, setFontSearch] = useState('')
  
  // CRITICAL: Update font immediately (matches Zeyoda's handleFieldChange for font_family, lines 300-310)
  const updateFontImmediately = useCallback(async (newFont: string) => {
    if (typeof document === 'undefined') return
    
    // CRITICAL: Update body and h1 font family immediately (Zeyoda lines 300-310)
    document.body.style.fontFamily = newFont
    const headerElement = document.querySelector('h1')
    if (headerElement) {
      headerElement.style.fontFamily = newFont
    }
    
    // CRITICAL: Call applyLogoBackground to update CSS vars (Zeyoda pattern)
    const { applyLogoBackground } = await import('@/utils/themeBackground')
    applyLogoBackground(
      { font_family: newFont, primary_color: profile?.primary_color, accent_color: profile?.accent_color } as Profile,
      undefined,
      undefined
    )
    
    // Update state
    setFontFamily(newFont)
    
    // CRITICAL: Autosave immediately
    onFontChange({ font_family: newFont })
  }, [profile, onFontChange])
  
  // Update state when profile changes
  useEffect(() => {
    if (profile?.font_family) setFontFamily(profile.font_family)
  }, [profile?.font_family])
  
  return (
    <div className="space-y-4">
      {/* Typography Section - COPIED FROM ZEYODA ProfileEditPanel.tsx lines 926-993 */}
      <div>
        <h3 className="text-sm font-semibold text-white mb-2">Typography</h3>
        
        {/* Standard Font Buttons */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          {FONT_OPTIONS.map((font) => (
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
                        updateFontImmediately(font)
                        setFontSearch('')
                        setShowFontDropdown(false)
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
    </div>
  )
}

