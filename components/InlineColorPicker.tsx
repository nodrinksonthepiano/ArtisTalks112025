'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Profile } from '@/hooks/useProfile'
import { applyLogoBackground } from '@/utils/themeBackground'

interface InlineColorPickerProps {
  profile: Profile | null
  onColorChange: (updates: Partial<Profile>) => void // Autosave callback for colors, logo, font
  onPreviewChange?: (preview: { primary_color?: string; accent_color?: string }) => void
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
  const [fontFamily, setFontFamily] = useState(profile?.font_family || 'Inter, sans-serif')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(profile?.logo_url || null)
  const logoPreviewRef = useRef<string | null>(profile?.logo_url || null)
  const [logoUseBackground, setLogoUseBackground] = useState(profile?.logo_use_background || false)
  const [isUploading, setIsUploading] = useState(false)
  const [showFontDropdown, setShowFontDropdown] = useState(false)
  const [fontSearch, setFontSearch] = useState('')
  
  // Update ref when preview changes
  useEffect(() => {
    logoPreviewRef.current = logoPreview
  }, [logoPreview])
  
  // CRITICAL: Update PRIMARY color only (background, halo, tokens, slides)
  // Matches Zeyoda's handleFieldChange for primary_color (lines 280-295)
  // FIXED: Preserve logo when primary color changes (Zeyoda line 278-280)
  const updatePrimaryColor = useCallback(async (newPrimary: string) => {
    if (typeof document === 'undefined') return
    
    // CRITICAL: Update primary color CSS variable immediately
    document.documentElement.style.setProperty("--primary-color", newPrimary);
    
    // Build preview config (Zeyoda pattern)
    // CRITICAL: PRESERVE logo_url and logo_use_background (Zeyoda lines 278-280)
    const currentLogoUrl = logoPreviewRef.current || logoPreview || profile?.logo_url || null
    const previewConfig = {
      primary_color: newPrimary,
      accent_color: accentColor,
      brand_color: newPrimary,
      font_family: fontFamily,
      logo_url: currentLogoUrl, // PRESERVE logo (Zeyoda line 278)
      logo_use_background: logoUseBackground // PRESERVE logo background setting (Zeyoda line 280)
    }
    
    // CRITICAL: Call applyLogoBackground with preserved logo settings
    // This matches Zeyoda's applyArtistBackground call (line 283)
    applyLogoBackground(previewConfig as Profile, currentLogoUrl, logoUseBackground)
    
    // CRITICAL: Dispatch primaryColorChange event for halo (Zeyoda line 286-288)
    window.dispatchEvent(new CustomEvent('primaryColorChange', { 
      detail: { color: newPrimary } 
    }))
    
    // CRITICAL: Dispatch preview config for token live updates (Zeyoda lines 292-294)
    // PRESERVE logo in preview config
    window.dispatchEvent(new CustomEvent('profilePreview', { 
      detail: { 
        previewConfig: { 
          primary_color: newPrimary, 
          accent_color: accentColor,
          brand_color: newPrimary,
          font_family: fontFamily,
          logo_url: currentLogoUrl, // PRESERVE logo
          logo_use_background: logoUseBackground // PRESERVE logo background setting
        } 
      } 
    }))
    
    // Update state
    setPrimaryColor(newPrimary)
    
    // Call parent preview handler
    onPreviewChange?.({ primary_color: newPrimary, accent_color: accentColor })
    
    // CRITICAL: Autosave immediately (only colors, preserve logo/font)
    onColorChange({
      primary_color: newPrimary,
      brand_color: newPrimary
    })
  }, [accentColor, fontFamily, logoPreview, logoUseBackground, profile, onColorChange, onPreviewChange])
  
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
    const currentLogoUrl = logoPreviewRef.current || logoPreview || profile?.logo_url || null
    window.dispatchEvent(new CustomEvent('profilePreview', { 
      detail: { 
        previewConfig: { 
          primary_color: primaryColor, 
          accent_color: newAccent,
          brand_color: primaryColor,
          font_family: fontFamily,
          logo_url: currentLogoUrl,
          logo_use_background: logoUseBackground
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
  }, [primaryColor, fontFamily, logoPreview, logoUseBackground, profile, onColorChange, onPreviewChange])
  
  // CRITICAL: Update font immediately (matches Zeyoda's handleFieldChange for font_family, lines 307-313)
  const updateFontImmediately = useCallback(async (newFont: string) => {
    if (typeof document === 'undefined') return
    
    // CRITICAL: Update body and h1 font family immediately (Zeyoda lines 308-312)
    document.body.style.fontFamily = newFont
    const headerElement = document.querySelector('h1')
    if (headerElement) {
      headerElement.style.fontFamily = newFont
    }
    
    // Update state
    setFontFamily(newFont)
    
    // CRITICAL: Autosave immediately
    onColorChange({ font_family: newFont })
  }, [onColorChange])
  
  // Upload logo file to server - COPIED FROM ZEYODA ProfileEditPanel.tsx lines 148-206
  const uploadLogoFile = async (file: File, userId: string) => {
    setIsUploading(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        alert('You must be logged in to upload a logo')
        return
      }

      const uploadFormData = new FormData();
      uploadFormData.append('file', file);
      uploadFormData.append('userId', userId);
      
      const response = await fetch('/api/uploadLogo', {
        method: 'POST',
        body: uploadFormData
      });
      
      const result = await response.json();
      
      if (response.ok) {
        setLogoPreview(result.logoUrl);
        logoPreviewRef.current = result.logoUrl;
        
        // Zeyoda pattern: Apply background IMMEDIATELY if checkbox is checked
        const previewConfig = {
          ...profile,
          primary_color: primaryColor,
          accent_color: accentColor,
          brand_color: primaryColor,
          font_family: fontFamily,
          logo_url: result.logoUrl,
          logo_use_background: logoUseBackground
        } as Profile
        applyLogoBackground(previewConfig, result.logoUrl, logoUseBackground);
        
        // Dispatch preview for live background
        window.dispatchEvent(new CustomEvent('logoPreviewChange', { 
          detail: { 
            logo_url: result.logoUrl,
            logo_use_background: logoUseBackground
          } 
        }))
        
        // CRITICAL: Autosave immediately
        onColorChange({ logo_url: result.logoUrl });
      } else {
        alert(result.error || 'Failed to upload logo');
      }
    } catch (error) {
      console.error('Logo upload error:', error);
      alert('Failed to upload logo');
    } finally {
      setIsUploading(false)
    }
  };
  
  // Update state when profile changes
  useEffect(() => {
    if (profile?.primary_color) setPrimaryColor(profile.primary_color)
    if (profile?.accent_color) setAccentColor(profile.accent_color)
    if (profile?.font_family) setFontFamily(profile.font_family)
    if (profile?.logo_url) {
      setLogoPreview(profile.logo_url)
      logoPreviewRef.current = profile.logo_url
    }
    if (profile?.logo_use_background !== undefined && profile.logo_use_background !== null) setLogoUseBackground(profile.logo_use_background)
  }, [profile?.primary_color, profile?.accent_color, profile?.font_family, profile?.logo_url, profile?.logo_use_background])
  
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

      {/* Logo Upload Section - COPIED FROM ZEYODA ProfileEditPanel.tsx lines 525-726 */}
      <div>
        <h3 className="text-sm font-semibold text-white mb-2">Logo Upload</h3>
        
        {/* Current logo preview */}
        {logoPreview && (
          <div className="mb-3 relative">
            <button
              onClick={() => {
                if (confirm('Are you sure you want to remove the logo?')) {
                  if (logoPreview.startsWith('blob:')) {
                    URL.revokeObjectURL(logoPreview);
                  }
                  setLogoPreview(null);
                  logoPreviewRef.current = null;
                  setLogoFile(null);
                  
                  const previewConfig = {
                    ...profile,
                    primary_color: primaryColor,
                    accent_color: accentColor,
                    brand_color: primaryColor,
                    font_family: fontFamily,
                    logo_url: null,
                    logo_use_background: false
                  } as Profile
                  applyLogoBackground(previewConfig, null, false);
                  
                  window.dispatchEvent(new CustomEvent('logoPreviewChange', { 
                    detail: { 
                      logo_url: null,
                      logo_use_background: false
                    } 
                  }))
                  
                  onColorChange({ logo_url: null, logo_use_background: false });
                }
              }}
              className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white rounded-full w-8 h-8 flex items-center justify-center text-lg font-bold transition-colors shadow-lg z-10"
              title="Remove logo"
            >
              ×
            </button>
            <img 
              src={logoPreview} 
              alt="Logo preview" 
              className="w-full h-64 object-contain rounded border border-gray-600 bg-gray-800"
            />
          </div>
        )}
        
        {/* File input */}
        <input
          type="file"
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            
            // Validate file type
            if (!file.type.startsWith('image/')) {
              alert('Please upload an image file (JPG, PNG, SVG, or WebP)');
              return;
            }
            
            // Validate file size (5MB max)
            if (file.size > 5 * 1024 * 1024) {
              alert('File size must be less than 5MB');
              return;
            }
            
            setLogoFile(file);
            // Revoke old preview URL to prevent memory leaks
            if (logoPreview && logoPreview.startsWith('blob:')) {
              URL.revokeObjectURL(logoPreview);
            }
            const preview = URL.createObjectURL(file);
            setLogoPreview(preview);
            logoPreviewRef.current = preview;
            
            // Zeyoda pattern: Apply background IMMEDIATELY when file selected
            const previewConfig = {
              ...profile,
              primary_color: primaryColor,
              accent_color: accentColor,
              brand_color: primaryColor,
              font_family: fontFamily,
              logo_url: preview,
              logo_use_background: logoUseBackground
            } as Profile
            applyLogoBackground(previewConfig, preview, logoUseBackground);
            
            window.dispatchEvent(new CustomEvent('logoPreviewChange', { 
              detail: { 
                logo_url: preview,
                logo_use_background: logoUseBackground
              } 
            }))
            
            // Auto-upload immediately
            if (profile?.id) {
              uploadLogoFile(file, profile.id);
            }
          }}
          className="w-full p-3 bg-gray-700 text-white rounded-lg border border-gray-600 mb-3 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-yellow-500 file:text-white hover:file:bg-yellow-600"
          disabled={isUploading}
        />
        
        {/* Checkbox - Use logo as background */}
        <label className="flex items-center text-white cursor-pointer">
          <input
            type="checkbox"
            checked={logoUseBackground}
            onChange={(e) => {
              const checked = e.target.checked;
              setLogoUseBackground(checked);
              
              // Zeyoda pattern: Apply background IMMEDIATELY (bypass React state batching)
              const currentLogoUrl = logoPreviewRef.current || logoPreview || profile?.logo_url || null;
              const logoUrlToUse = checked ? currentLogoUrl : null;
              
              const previewConfig = {
                ...profile,
                primary_color: primaryColor,
                accent_color: accentColor,
                brand_color: primaryColor,
                font_family: fontFamily,
                logo_use_background: checked,
                logo_url: currentLogoUrl
              } as Profile;
              
              applyLogoBackground(previewConfig, logoUrlToUse, checked);
              
              window.dispatchEvent(new CustomEvent('logoPreviewChange', { 
                detail: { 
                  logo_url: logoUrlToUse,
                  logo_use_background: checked
                } 
              }))
              
              // CRITICAL: Autosave immediately
              onColorChange({ logo_use_background: checked });
            }}
            className="mr-2 w-4 h-4"
            disabled={!logoPreview}
          />
          <span className={logoPreview ? '' : 'text-gray-500'}>
            Use logo as page background
          </span>
        </label>
      </div>

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
