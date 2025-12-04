'use client'

import { useState, useCallback, useEffect } from 'react'
import { Profile } from '@/hooks/useProfile'

interface InlineColorPickerProps {
  profile: Profile | null
  onColorChange: (updates: Partial<Profile>) => void // Autosave callback
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
}

export default function InlineColorPicker({ profile, onColorChange, onPreviewChange }: InlineColorPickerProps) {
  const [primaryColor, setPrimaryColor] = useState(profile?.primary_color || '#10b981')
  const [accentColor, setAccentColor] = useState(profile?.accent_color || '#fbbf24')
  
  // CRITICAL: Update PRIMARY color only (background, halo, tokens, slides)
  // Matches Zeyoda's handleFieldChange for primary_color (lines 280-295)
  const updatePrimaryColor = useCallback(async (newPrimary: string) => {
    if (typeof document === 'undefined') return
    
    // CRITICAL: Set background color DIRECTLY and IMMEDIATELY (bypass logo logic)
    // This ensures primary color shows instantly, even if logo is set
    document.body.style.setProperty("background-color", newPrimary, "important");
    document.body.style.setProperty("background", newPrimary, "important");
    document.body.style.setProperty("background-image", "none", "important");
    
    // CRITICAL: Update primary color CSS variable immediately
    document.documentElement.style.setProperty("--primary-color", newPrimary);
    
    // Build preview config (Zeyoda pattern)
    // CRITICAL: Explicitly null logo to override any existing logo when primary color changes
    const previewConfig = {
      primary_color: newPrimary,
      accent_color: accentColor, // Keep current accent color (don't change it)
      brand_color: newPrimary,
      logo_url: null, // CRITICAL: Explicitly null to override logo
      logo_use_background: false // CRITICAL: Explicitly false to disable logo
    }
    
    // CRITICAL: Call applyLogoBackground to update CSS vars, tokens, slides
    // Pass null, false to explicitly override logo and use primary color
    // This matches Zeyoda's applyArtistBackground call (line 289)
    const { applyLogoBackground } = await import('@/utils/themeBackground')
    applyLogoBackground(previewConfig as Profile, null, false)
    
    // CRITICAL: Dispatch primaryColorChange event for halo (Zeyoda line 291-293)
    window.dispatchEvent(new CustomEvent('primaryColorChange', { 
      detail: { color: newPrimary } 
    }))
    
    // CRITICAL: Dispatch preview config for token live updates (Zeyoda lines 295-298)
    // CRITICAL: Include logo_url: null and logo_use_background: false to clear logo in page.tsx
    window.dispatchEvent(new CustomEvent('profilePreview', { 
      detail: { 
        previewConfig: { 
          primary_color: newPrimary, 
          accent_color: accentColor,
          brand_color: newPrimary,
          logo_url: null, // CRITICAL: Clear logo in previewOverrides
          logo_use_background: false // CRITICAL: Disable logo in previewOverrides
        } 
      } 
    }))
    
    // Update state
    setPrimaryColor(newPrimary)
    
    // Call parent preview handler
    onPreviewChange?.({ primary_color: newPrimary, accent_color: accentColor })
    
    // CRITICAL: Autosave immediately
    onColorChange({
      primary_color: newPrimary,
      brand_color: newPrimary
    })
  }, [accentColor, profile, onColorChange, onPreviewChange])
  
  // CRITICAL: Update ACCENT color only (text/fonts, NOT background)
  // Matches Zeyoda's handleFieldChange for accent_color (lines 300-310)
  const updateAccentColor = useCallback(async (newAccent: string) => {
    if (typeof document === 'undefined') return
    
    // CRITICAL: Update accent color CSS variables directly (Zeyoda lines 300-306)
    // This is the ONLY place accent color CSS vars should be updated
    document.documentElement.style.setProperty('--accent-color', newAccent)
    document.documentElement.style.setProperty(
      '--accent-color-rgb',
      newAccent.match(/\d+/g)?.join(', ') ?? '0,0,0'
    )
    
    // CRITICAL: Update header text color immediately (Zeyoda lines 303-306)
    const headerElement = document.querySelector('h1')
    if (headerElement) {
      headerElement.style.color = newAccent
    }
    
    // CRITICAL: Do NOT call applyLogoBackground when accent color changes
    // Accent color should ONLY affect text/fonts, NOT background
    // Zeyoda pattern: accent color changes don't call applyArtistBackground for background
    
    // CRITICAL: Dispatch preview config for token live updates (Zeyoda lines 295-298)
    window.dispatchEvent(new CustomEvent('profilePreview', { 
      detail: { 
        previewConfig: { 
          primary_color: primaryColor, 
          accent_color: newAccent,
          brand_color: primaryColor
        } 
      } 
    }))
    
    // Update state
    setAccentColor(newAccent)
    
    // Call parent preview handler
    onPreviewChange?.({ primary_color: primaryColor, accent_color: newAccent })
    
    // CRITICAL: Autosave immediately
    onColorChange({
      accent_color: newAccent
    })
  }, [primaryColor, profile, onColorChange, onPreviewChange])
  
  // Update state when profile changes
  useEffect(() => {
    if (profile?.primary_color) setPrimaryColor(profile.primary_color)
    if (profile?.accent_color) setAccentColor(profile.accent_color)
  }, [profile?.primary_color, profile?.accent_color])
  
  const applyPrimaryPreset = (presetKey: string) => {
    const preset = COLOR_PRESETS[presetKey as keyof typeof COLOR_PRESETS]
    if (preset) {
      updatePrimaryColor(preset.primary)
    }
  }
  
  const applyAccentPreset = (presetKey: string) => {
    const preset = COLOR_PRESETS[presetKey as keyof typeof COLOR_PRESETS]
    if (preset) {
      updateAccentColor(preset.accent)
    }
  }
  
  // EyeDropper handler (HTML5 API)
  const handleEyeDropper = async (type: 'primary' | 'accent') => {
    if (!('EyeDropper' in window)) {
      alert('EyeDropper API not supported in your browser')
      return
    }
    
    try {
      const eyeDropper = new (window as any).EyeDropper()
      const result = await eyeDropper.open()
      const color = result.sRGBHex
      
      if (type === 'primary') {
        updatePrimaryColor(color)
      } else {
        updateAccentColor(color)
      }
    } catch (err) {
      // User cancelled
    }
  }
  
  return (
    <div className="space-y-4">
      {/* Primary Color Section - FIRST (Background/Halo/Tokens/Slides) */}
      <div>
        <h3 className="text-sm font-semibold text-white mb-2">Primary Color (Background)</h3>
        <div className="grid grid-cols-4 gap-2 mb-3">
          {Object.entries(COLOR_PRESETS).map(([key, preset]) => (
            <button
              key={`primary-${key}`}
              onClick={() => applyPrimaryPreset(key)}
              className={`relative w-10 h-10 rounded-lg border-2 transition-all hover:scale-110 ${
                primaryColor === preset.primary
                  ? 'border-white'
                  : 'border-gray-600 hover:border-gray-400'
              }`}
              style={{ backgroundColor: preset.primary }}
              title={`${preset.name} Primary`}
            >
              {primaryColor === preset.primary && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-white text-xs font-bold">✓</span>
                </div>
              )}
            </button>
          ))}
        </div>
          
        <div className="flex gap-2">
          <input
            type="color"
            value={primaryColor}
            onChange={(e) => updatePrimaryColor(e.target.value)}
            className="w-10 h-10 rounded border border-gray-600"
          />
          <button
            onClick={() => handleEyeDropper('primary')}
            className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded text-xs"
            title="Pick color from screen"
          >
            🎨
          </button>
          <input
            type="text"
            value={primaryColor}
            onChange={(e) => updatePrimaryColor(e.target.value)}
            className="flex-1 p-2 bg-gray-700 text-white rounded border border-gray-600 text-sm"
            placeholder="#RRGGBB"
          />
        </div>
      </div>

      {/* Accent Color Section - SECOND (Text/Fonts Only) */}
      <div>
        <h3 className="text-sm font-semibold text-white mb-2">Accent Color (Text/Highlights)</h3>
        <div className="grid grid-cols-4 gap-2 mb-3">
          {Object.entries(COLOR_PRESETS).map(([key, preset]) => (
            <button
              key={`accent-${key}`}
              onClick={() => applyAccentPreset(key)}
              className={`relative w-10 h-10 rounded-lg border-2 transition-all hover:scale-110 ${
                accentColor === preset.accent
                  ? 'border-white'
                  : 'border-gray-600 hover:border-gray-400'
              }`}
              style={{ backgroundColor: preset.accent }}
              title={`${preset.name} Accent`}
            >
              {accentColor === preset.accent && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-white text-xs font-bold">✓</span>
                </div>
              )}
            </button>
          ))}
        </div>
        
        <div className="flex gap-2">
          <input
            type="color"
            value={accentColor}
            onChange={(e) => updateAccentColor(e.target.value)}
            className="w-10 h-10 rounded border border-gray-600"
          />
          <button
            onClick={() => handleEyeDropper('accent')}
            className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded text-xs"
            title="Pick color from screen"
          >
            🎨
          </button>
          <input
            type="text"
            value={accentColor}
            onChange={(e) => updateAccentColor(e.target.value)}
            className="flex-1 p-2 bg-gray-700 text-white rounded border border-gray-600 text-sm"
            placeholder="#RRGGBB"
          />
        </div>
      </div>
    </div>
  )
}
