'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Profile } from '@/hooks/useProfile'
import { applyLogoBackground } from '@/utils/themeBackground'
import {
  FALLBACK_GOLD,
  FALLBACK_SILVER,
  getLogoPaletteSuggestion,
} from '@/utils/extractLogoPalette'
import { previewArtistPalette } from '@/utils/previewArtistPalette'
import {
  DEFAULT_FONT_VALUE,
  FEATURED_FONTS,
  type FontCatalogEntry,
  isSameCatalogFont,
  normalizeFontFamilyValue,
  searchCatalogFonts,
} from '@/lib/fontCatalog'
import { applyCatalogFont, preloadFeaturedFonts } from '@/utils/applyCatalogFont'

interface InlineColorPickerProps {
  profile: Profile | null
  onColorChange: (updates: Partial<Profile>) => void
  onPreviewChange?: (preview: {
    primary_color?: string
    accent_color?: string
    pop_color?: string | null
    brand_color?: string
  }) => void
  sessionPalette?: PaletteSessionState
  hasSavedArtistColors?: boolean
  /** `colors` = palette only (V2 brand spine). `full` = legacy combined panel. */
  variant?: 'colors' | 'full'
}

export type PaletteRole = 'primary' | 'accent' | 'pop'

export interface PaletteSessionState {
  primary_color: string
  accent_color: string
  pop_color: string | null
  brand_color: string
}

type EyeDropperWindow = Window & {
  EyeDropper?: new () => {
    open: () => Promise<{ sRGBHex: string }>
  }
}

const DEFAULT_PRIMARY = '#10b981'
const DEFAULT_ACCENT = '#fbbf24'

function normalizeHexColor(value: string): string | null {
  const trimmed = value.trim()
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed.toLowerCase()
  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    return `#${trimmed
      .slice(1)
      .split('')
      .map((character) => character + character)
      .join('')}`.toLowerCase()
  }
  return null
}

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

export default function InlineColorPicker({
  profile,
  onColorChange,
  onPreviewChange,
  sessionPalette,
  hasSavedArtistColors = false,
  variant = 'colors',
}: InlineColorPickerProps) {
  const showExtras = variant === 'full'
  const initialPaletteRef = useRef<PaletteSessionState | null>(null)
  if (!initialPaletteRef.current) {
    const logoSuggestion = getLogoPaletteSuggestion()
    const mayUseLogoSuggestion = !hasSavedArtistColors
    const primary =
      sessionPalette?.primary_color ||
      profile?.primary_color ||
      profile?.brand_color ||
      (mayUseLogoSuggestion ? logoSuggestion?.primary : null) ||
      DEFAULT_PRIMARY
    const accent =
      sessionPalette?.accent_color ||
      profile?.accent_color ||
      (mayUseLogoSuggestion ? logoSuggestion?.accent : null) ||
      DEFAULT_ACCENT
    const pop =
      sessionPalette !== undefined
        ? sessionPalette.pop_color
        : profile?.pop_color !== undefined
          ? profile.pop_color
          : mayUseLogoSuggestion
            ? logoSuggestion?.pop ?? null
            : null
    initialPaletteRef.current = {
      primary_color: primary,
      accent_color: accent,
      pop_color: pop,
      brand_color: primary,
    }
  }
  const initialPalette = initialPaletteRef.current
  const [primaryColor, setPrimaryColor] = useState(initialPalette.primary_color)
  const [accentColor, setAccentColor] = useState(initialPalette.accent_color)
  const [popColor, setPopColor] = useState<string | null>(initialPalette.pop_color)
  const [selectedRole, setSelectedRole] = useState<PaletteRole>('primary')
  const [hexDraft, setHexDraft] = useState(initialPalette.primary_color)
  const [fontFamily, setFontFamily] = useState(
    () => normalizeFontFamilyValue(profile?.font_family) || DEFAULT_FONT_VALUE
  )
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(profile?.logo_url || null)
  const logoPreviewRef = useRef<string | null>(profile?.logo_url || null)
  const [logoUseBackground, setLogoUseBackground] = useState(profile?.logo_use_background || false)
  const [isUploading, setIsUploading] = useState(false)
  const [showFontDropdown, setShowFontDropdown] = useState(false)
  const [fontSearch, setFontSearch] = useState('')
  const [fontError, setFontError] = useState<string | null>(null)
  const [fontLoading, setFontLoading] = useState(false)
  const [featuredFontsReady, setFeaturedFontsReady] = useState<Set<string>>(new Set())
  const [eyeDropperSupported, setEyeDropperSupported] = useState(false)

  const canUploadLogo = Boolean(profile?.id && profile.id !== 'anonymous')

  const canShowFontFace = useCallback(
    (entry: FontCatalogEntry) =>
      entry.source === 'geist' ||
      entry.source === 'system' ||
      featuredFontsReady.has(entry.value),
    [featuredFontsReady]
  )

  useEffect(() => {
    let cancelled = false
    void preloadFeaturedFonts().then((ready) => {
      if (!cancelled) setFeaturedFontsReady(ready)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    setEyeDropperSupported('EyeDropper' in window)
  }, [])
  
  // Update ref when preview changes
  useEffect(() => {
    logoPreviewRef.current = logoPreview
  }, [logoPreview])
  
  const publishPalette = useCallback((palette: PaletteSessionState) => {
    const currentLogoUrl =
      logoPreviewRef.current || logoPreview || profile?.logo_url || null
    previewArtistPalette({
      primary: palette.primary_color,
      accent: palette.accent_color,
      pop: palette.pop_color,
      logoUrl: currentLogoUrl,
      logoUseBackground,
      fontFamily,
      bodyFontFamily: profile?.body_font_family,
    })
    onPreviewChange?.(palette)
    // Session state only. EmeraldChat performs the durable write on Save colors.
    onColorChange(palette)
  }, [
    fontFamily,
    logoPreview,
    logoUseBackground,
    onColorChange,
    onPreviewChange,
    profile?.body_font_family,
    profile?.logo_url,
  ])

  const initializedPaletteRef = useRef(false)
  useEffect(() => {
    if (showExtras || initializedPaletteRef.current) return
    initializedPaletteRef.current = true
    publishPalette(initialPalette)
  }, [initialPalette, publishPalette, showExtras])

  const updatePrimaryColor = useCallback((newPrimary: string) => {
    setPrimaryColor(newPrimary)
    publishPalette({
      primary_color: newPrimary,
      accent_color: accentColor,
      pop_color: popColor,
      brand_color: newPrimary,
    })
  }, [accentColor, popColor, publishPalette])

  const updateAccentColor = useCallback((newAccent: string) => {
    setAccentColor(newAccent)
    publishPalette({
      primary_color: primaryColor,
      accent_color: newAccent,
      pop_color: popColor,
      brand_color: primaryColor,
    })
  }, [popColor, primaryColor, publishPalette])

  const updatePopColor = useCallback((newPop: string) => {
    setPopColor(newPop)
    publishPalette({
      primary_color: primaryColor,
      accent_color: accentColor,
      pop_color: newPop,
      brand_color: primaryColor,
    })
  }, [accentColor, primaryColor, publishPalette])
  
  // CRITICAL: Update font immediately (matches Zeyoda's handleFieldChange for font_family, lines 307-313)
  const updateFontImmediately = useCallback(async (newFont: string) => {
    if (typeof document === 'undefined' || fontLoading) return

    setFontLoading(true)
    setFontError(null)
    try {
      const result = await applyCatalogFont(newFont)
      if (!result.ok) {
        setFontError(result.error)
        return
      }

      setFontFamily(result.fontValue)
      onColorChange({ font_family: result.fontValue })
    } finally {
      setFontLoading(false)
    }
  }, [onColorChange, fontLoading])
  
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
    if (profile?.pop_color !== undefined) setPopColor(profile.pop_color)
    if (profile?.font_family) {
      setFontFamily(normalizeFontFamilyValue(profile.font_family))
    }
    if (profile?.logo_url) {
      setLogoPreview(profile.logo_url)
      logoPreviewRef.current = profile.logo_url
    }
    if (profile?.logo_use_background !== undefined && profile.logo_use_background !== null) setLogoUseBackground(profile.logo_use_background)
  }, [profile?.primary_color, profile?.accent_color, profile?.pop_color, profile?.font_family, profile?.logo_url, profile?.logo_use_background])
  
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
  
  const applyRoleColor = (role: PaletteRole, color: string) => {
    if (role === 'primary') updatePrimaryColor(color)
    else if (role === 'accent') updateAccentColor(color)
    else updatePopColor(color)
  }

  const flipMainAndSupport = () => {
    const nextPrimary = accentColor
    const nextAccent = primaryColor
    setPrimaryColor(nextPrimary)
    setAccentColor(nextAccent)
    publishPalette({
      primary_color: nextPrimary,
      accent_color: nextAccent,
      pop_color: popColor,
      brand_color: nextPrimary,
    })
  }

  const selectedColor =
    selectedRole === 'primary'
      ? primaryColor
      : selectedRole === 'accent'
        ? accentColor
        : popColor
  const paletteRoles = [
    {
      role: 'primary' as const,
      ratio: 60,
      label: 'Main',
      color: primaryColor,
      path: 'M 60 60 L 60 10 A 50 50 0 1 1 30.61 100.45 Z',
      textX: 88,
      textY: 70,
    },
    {
      role: 'accent' as const,
      ratio: 30,
      label: 'Support',
      color: accentColor,
      path: 'M 60 60 L 30.61 100.45 A 50 50 0 0 1 30.61 19.55 Z',
      textX: 30,
      textY: 63,
    },
    {
      role: 'pop' as const,
      ratio: 10,
      label: 'Pop',
      color: popColor || 'url(#artis-empty-pop)',
      path: 'M 60 60 L 30.61 19.55 A 50 50 0 0 1 60 10 Z',
      textX: 48,
      textY: 30,
    },
  ]
  const selectedRoleInfo =
    paletteRoles.find((item) => item.role === selectedRole) || paletteRoles[0]

  useEffect(() => {
    setHexDraft(selectedColor || '')
  }, [selectedColor, selectedRole])

  const logoSuggestion = getLogoPaletteSuggestion()
  const logoRoleColor =
    selectedRole === 'primary'
      ? logoSuggestion?.primary
      : selectedRole === 'accent'
        ? logoSuggestion?.accent
        : logoSuggestion?.pop
  const namedColorChoices = [
    { value: 'logo', label: 'Logo', color: logoRoleColor || null, disabled: !logoRoleColor },
    { value: 'gold', label: 'Gold', color: FALLBACK_GOLD, disabled: false },
    { value: 'silver', label: 'Silver', color: FALLBACK_SILVER, disabled: false },
    { value: 'emerald', label: 'Emerald', color: COLOR_PRESETS.emerald.primary, disabled: false },
    { value: 'ruby', label: 'Ruby', color: COLOR_PRESETS.ruby.primary, disabled: false },
    { value: 'sapphire', label: 'Sapphire', color: COLOR_PRESETS.sapphire.primary, disabled: false },
    ...(selectedRole === 'pop'
      ? [{ value: 'none', label: 'None', color: null, disabled: false }]
      : []),
    { value: 'custom', label: 'Custom', color: null, disabled: false },
  ]
  const selectedNamedColor =
    selectedRole === 'pop' && popColor === null
      ? 'none'
      : namedColorChoices.find(
          (choice) =>
            choice.color !== null &&
            selectedColor?.toLowerCase() === choice.color.toLowerCase()
        )?.value || 'custom'

  const clearPopColor = () => {
    setPopColor(null)
    publishPalette({
      primary_color: primaryColor,
      accent_color: accentColor,
      pop_color: null,
      brand_color: primaryColor,
    })
  }

  // EyeDropper handler (HTML5 API)
  const handleEyeDropper = async (role: PaletteRole) => {
    const EyeDropperApi = (window as EyeDropperWindow).EyeDropper
    if (!EyeDropperApi) return
    
    try {
      const eyeDropper = new EyeDropperApi()
      const result = await eyeDropper.open()
      const color = result.sRGBHex

      applyRoleColor(role, color)
    } catch {
      // User cancelled
    }
  }

  if (!showExtras) {
    return (
      <div className="artis-palette-control">
        <div className="artis-palette-layout">
          <div className="artis-palette-chart-column">
            <svg
              className="artis-palette-pie"
              viewBox="0 0 120 120"
              width="96"
              height="96"
              preserveAspectRatio="xMidYMid meet"
              role="group"
              aria-label="60 30 10 palette roles"
            >
              <defs>
                <pattern
                  id="artis-empty-pop"
                  width="7"
                  height="7"
                  patternUnits="userSpaceOnUse"
                  patternTransform="rotate(45)"
                >
                  <rect width="7" height="7" fill="#374151" />
                  <line
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="7"
                    stroke="#9ca3af"
                    strokeWidth="2"
                  />
                </pattern>
              </defs>
              {paletteRoles.map((item) => (
                <path
                  key={item.role}
                  className="artis-palette-pie-wedge"
                  d={item.path}
                  fill={item.color}
                  stroke="rgba(15, 23, 42, 0.55)"
                  strokeWidth="1"
                  role="button"
                  tabIndex={0}
                  aria-label={`${item.ratio} percent ${item.label}`}
                  aria-pressed={selectedRole === item.role}
                  onClick={() => setSelectedRole(item.role)}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter' && event.key !== ' ') return
                    event.preventDefault()
                    setSelectedRole(item.role)
                  }}
                />
              ))}
              <path
                className="artis-palette-pie-selection"
                d={selectedRoleInfo.path}
                fill="none"
                stroke="#ffffff"
                strokeWidth="3"
                pointerEvents="none"
              />
              {paletteRoles.map((item) => (
                <g
                  key={`${item.role}-label`}
                  className="artis-palette-pie-label"
                  aria-hidden="true"
                >
                  <text x={item.textX} y={item.textY}>
                    {item.ratio}
                  </text>
                </g>
              ))}
            </svg>
          </div>

          <div className="artis-palette-editor-panel">
            <div className="artis-palette-editor-heading">
              <strong>
                {selectedRoleInfo.label} · {selectedRoleInfo.ratio}%
              </strong>
              <button
                type="button"
                className="artis-palette-flip"
                onClick={flipMainAndSupport}
                aria-label="Flip Main and Support colors"
              >
                ↔ Flip
              </button>
            </div>

            <select
              className="artis-palette-select"
              value={selectedNamedColor}
              onChange={(event) => {
                const choice = namedColorChoices.find(
                  (item) => item.value === event.target.value
                )
                if (!choice) return
                if (choice.value === 'none') {
                  clearPopColor()
                  return
                }
                if (choice.color) applyRoleColor(selectedRole, choice.color)
              }}
              aria-label={`Named color for ${selectedRoleInfo.label}`}
            >
              {namedColorChoices.map((choice) => (
                <option
                  key={choice.value}
                  value={choice.value}
                  disabled={choice.disabled}
                >
                  {choice.label}
                </option>
              ))}
            </select>

            <div className="artis-palette-manual">
              <input
                type="color"
                value={selectedColor || '#6b7280'}
                onChange={(event) => applyRoleColor(selectedRole, event.target.value)}
                className="artis-color-picker-native"
                aria-label={`Custom ${selectedRole} color picker`}
              />
              {eyeDropperSupported ? (
                <button
                  type="button"
                  onClick={() => handleEyeDropper(selectedRole)}
                  className="artis-color-picker-eyedropper"
                  title="Pick color from screen"
                  aria-label={`Pick ${selectedRole} color from screen`}
                >
                  🎨
                </button>
              ) : null}
              <input
                type="text"
                value={hexDraft}
                onChange={(event) => {
                  const next = event.target.value
                  setHexDraft(next)
                  const normalized = normalizeHexColor(next)
                  if (normalized) applyRoleColor(selectedRole, normalized)
                }}
                onBlur={() => setHexDraft(selectedColor || '')}
                className="artis-color-picker-hex"
                placeholder={selectedRole === 'pop' && !popColor ? 'Optional Pop' : '#RRGGBB'}
                spellCheck={false}
                aria-label={`${selectedRole} hex color`}
              />
            </div>
          </div>
        </div>
      </div>
    )
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
              type="button"
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
          {eyeDropperSupported && (
            <button
              type="button"
              onClick={() => handleEyeDropper('primary')}
              className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded text-xs"
              title="Pick color from screen"
            >
              🎨
            </button>
          )}
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
              type="button"
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
          {eyeDropperSupported && (
            <button
              type="button"
              onClick={() => handleEyeDropper('accent')}
              className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded text-xs"
              title="Pick color from screen"
            >
              🎨
            </button>
          )}
          <input
            type="text"
            value={accentColor}
            onChange={(e) => updateAccentColor(e.target.value)}
            className="flex-1 p-2 bg-gray-700 text-white rounded border border-gray-600 text-sm"
            placeholder="#RRGGBB"
          />
        </div>
      </div>

      {/* Logo Upload Section — only in legacy full variant */}
      {showExtras ? (
      <div>
        <h3 className="text-sm font-semibold text-white mb-2">Logo Upload</h3>
        
        {/* Current logo preview */}
        {logoPreview && (
          <div className="mb-3 relative">
            <button
              type="button"
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
            
            // Auto-upload only when authenticated (not anonymous preview)
            if (canUploadLogo && profile?.id) {
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
      ) : null}

      {/* Typography Section — only in legacy full variant */}
      {showExtras ? (
      <div>
        <h3 className="text-sm font-semibold text-white mb-2">Typography</h3>
        
        {/* Standard Font Buttons */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          {FEATURED_FONTS.map((font) => {
            const selected = isSameCatalogFont(fontFamily, font.value)
            return (
            <button
              key={font.value}
              type="button"
              onClick={() => updateFontImmediately(font.value)}
              disabled={fontLoading}
              className={`p-3 rounded-lg border-2 transition-all ${
                selected
                  ? 'border-emerald-500 bg-emerald-500 bg-opacity-20 ring-2 ring-emerald-400/60'
                  : 'border-gray-600 bg-gray-700 hover:border-gray-500'
              }`}
              style={{
                fontFamily: canShowFontFace(font) ? font.value : undefined,
              }}
              aria-pressed={selected}
            >
              <div className="text-white font-bold text-sm">{font.name}</div>
            </button>
            )
          })}
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
                {searchCatalogFonts(fontSearch)
                  .map((font) => {
                    const selected = isSameCatalogFont(fontFamily, font.value)
                    return (
                    <button
                      key={font.value}
                      type="button"
                      onClick={() => {
                        updateFontImmediately(font.value)
                        setFontSearch('')
                        setShowFontDropdown(false)
                      }}
                      disabled={fontLoading}
                      className={`w-full text-left p-2 text-white text-sm transition-colors flex items-center justify-between gap-2 ${
                        selected
                          ? 'bg-emerald-900/40 border-l-2 border-emerald-400'
                          : 'hover:bg-gray-700'
                      }`}
                      style={{
                        fontFamily: canShowFontFace(font) ? font.value : undefined,
                      }}
                      aria-pressed={selected}
                    >
                      <span>{font.name}</span>
                      {selected ? (
                        <span className="text-emerald-400 text-xs shrink-0">Selected</span>
                      ) : null}
                    </button>
                    )
                  })}
              </div>
            )}
          </div>

          {fontLoading ? (
            <p className="mt-2 text-sm text-zinc-400">Loading font…</p>
          ) : null}

          {fontError ? (
            <p className="mt-2 text-sm text-red-400">{fontError}</p>
          ) : null}
          
          {/* Close dropdown when clicking outside */}
          {showFontDropdown && (
            <div 
              className="fixed inset-0 z-40" 
              onClick={() => setShowFontDropdown(false)}
            />
          )}
        </div>
      </div>
      ) : null}
    </div>
  )
}
