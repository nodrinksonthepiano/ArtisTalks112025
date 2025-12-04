# FINAL SURGICAL PLAN: Color & Logo Pickers INSIDE EmeraldChat

## Overview
Make COLORS_PANEL and LOGO_PANEL appear INSIDE EmeraldChat (replacing question text), with instant updates, autosave, and cards above reflecting branding. This plan is 100% concrete with exact line numbers.

---

## PRE-IMPLEMENTATION CHECKLIST

### Current State Verification
- ✅ `EmeraldChat` component exists at `components/EmeraldChat.tsx`
- ✅ `ColorPanel` exists at `components/ColorPanel.tsx` (panel mode)
- ✅ `LogoPanel` exists at `components/LogoPanel.tsx` (panel mode)
- ✅ `page.tsx` passes `onProfileUpdate={updateProfile}` to EmeraldChat
- ✅ `useProfile` hook saves to `profiles` table via `updateProfile`
- ✅ Cards above use `mergedProfile` which reflects branding

### What We're Building
1. **InlineColorPicker** - Color picker component for chat embedding
2. **InlineLogoPicker** - Logo picker component for chat embedding
3. **EmeraldChat modifications** - Render pickers when `triggersPanel` matches
4. **Token updates** - Tokens update instantly via preview config system
5. **Instant CSS updates** - Background/text update immediately

---

## STEP 1: Add Preview Config System to Orbit Renderer

**File:** `components/ArtisTalksOrbitRenderer.tsx`

**Purpose:** Make tokens listen for color changes and update instantly.

**Zeyoda Proof:** `ThemeOrbitRenderer.tsx` lines 32-34, 54-73, 397-420

### Change 1.1: Add Preview State

**Location:** After line 31 (after `brandColor` prop declaration)

**Add exactly:**
```typescript
// CRITICAL: Preview config for live token color updates during editing
// This is set via event from ColorPanel/InlineColorPicker and cleared when profile changes
const [previewConfig, setPreviewConfig] = React.useState<{
  primary_color?: string;
  accent_color?: string;
  brand_color?: string;
} | null>(null);
```

**Verification:** Preview state exists, typed correctly.

---

### Change 1.2: Add Event Listeners

**Location:** After line 52 (before the main useEffect that starts at line 53)

**Add exactly:**
```typescript
// CRITICAL: Listen for preview config events from ColorPanel/InlineColorPicker for live token updates
useEffect(() => {
  const handlePreview = (e: Event) => {
    const customEvent = e as CustomEvent<{ previewConfig: { primary_color?: string; accent_color?: string; brand_color?: string } }>;
    if (customEvent.detail?.previewConfig) {
      setPreviewConfig(customEvent.detail.previewConfig);
    }
  };
  
  const handleClear = () => {
    setPreviewConfig(null);
  };
  
  window.addEventListener('profilePreview', handlePreview as EventListener);
  window.addEventListener('profilePreviewClear', handleClear);
  return () => {
    window.removeEventListener('profilePreview', handlePreview as EventListener);
    window.removeEventListener('profilePreviewClear', handleClear);
  };
}, []);

// CRITICAL: Clear preview config when profile changes significantly (after save or user switch)
// This matches Zeyoda lines 75-81
useEffect(() => {
  setPreviewConfig(null);
}, [profile?.id]); // Clear when user changes
```

**Verification:** Event listeners added, cleanup on unmount, clears on profile change.

---

### Change 1.3: Update Token Color Calculation

**Location:** Line 360 (replace existing tokenColor calculation)

**Current code:**
```typescript
const tokenColor = brandColor || token.color || defaultColors[token.id] || defaultColors.pre;
```

**Replace with:**
```typescript
// CRITICAL: Merged lookup for live token color updates
// During editing: uses previewConfig (from InlineColorPicker event) for immediate updates
// After save: uses brandColor prop (updated state) for persistence
// This matches Zeyoda's getTokenTheme pattern (lines 397-420)
const mergedBrandColor = previewConfig?.brand_color || previewConfig?.primary_color || brandColor;
const tokenColor = mergedBrandColor || token.color || defaultColors[token.id] || defaultColors.pre;
```

**Verification:** Tokens check preview first, then saved, then defaults.

---

## STEP 2: Create InlineColorPicker Component

**File:** `components/InlineColorPicker.tsx` (NEW FILE)

**Purpose:** Color picker component that embeds in chat (no save button, autosaves).

**Based on:** `components/ColorPanel.tsx` + Zeyoda's `ProfileEditPanel.tsx` lines 441-523

### Change 2.1: Create Component File

**Create file:** `components/InlineColorPicker.tsx`

**Add complete file content:**
```typescript
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
  
  // CRITICAL: Helper to update colors immediately (matches Zeyoda pattern)
  // This updates CSS variables, background, and dispatches events for token updates
  const updateColorsImmediately = useCallback(async (newPrimary: string, newAccent: string) => {
    // Update CSS variables immediately (Zeyoda lines 300-306)
    if (typeof document !== 'undefined') {
      document.documentElement.style.setProperty('--primary-color', newPrimary)
      if (newAccent) {
        document.documentElement.style.setProperty('--accent-color', newAccent)
        document.documentElement.style.setProperty(
          '--accent-color-rgb',
          newAccent.match(/\d+/g)?.join(', ') ?? '0,0,0'
        )
      }
      
      // Update header text color immediately (Zeyoda lines 303-306)
      const headerElement = document.querySelector('h1')
      if (headerElement) {
        headerElement.style.color = newAccent
      }
      
      // CRITICAL: Call applyLogoBackground immediately with preview colors
      // This updates background in real-time (Zeyoda pattern)
      const { applyLogoBackground } = await import('@/utils/themeBackground')
      applyLogoBackground(
        { primary_color: newPrimary, accent_color: newAccent, brand_color: newPrimary } as Profile,
        undefined,
        undefined
      )
    }
    
    // Call parent preview handler
    onPreviewChange?.({ primary_color: newPrimary, accent_color: newAccent })
    
    // CRITICAL: Dispatch preview config for token live updates (Zeyoda lines 290-294)
    window.dispatchEvent(new CustomEvent('profilePreview', { 
      detail: { 
        previewConfig: { 
          primary_color: newPrimary, 
          accent_color: newAccent,
          brand_color: newPrimary
        } 
      } 
    }))
    
    // CRITICAL: Autosave immediately (no save button needed)
    onColorChange({
      primary_color: newPrimary,
      accent_color: newAccent,
      brand_color: newPrimary
    })
  }, [onColorChange, onPreviewChange])
  
  // Update state when profile changes
  useEffect(() => {
    if (profile?.primary_color) setPrimaryColor(profile.primary_color)
    if (profile?.accent_color) setAccentColor(profile.accent_color)
  }, [profile?.primary_color, profile?.accent_color])
  
  const applyPrimaryPreset = (presetKey: string) => {
    const preset = COLOR_PRESETS[presetKey as keyof typeof COLOR_PRESETS]
    if (preset) {
      setPrimaryColor(preset.primary)
      updateColorsImmediately(preset.primary, accentColor)
    }
  }
  
  const applyAccentPreset = (presetKey: string) => {
    const preset = COLOR_PRESETS[presetKey as keyof typeof COLOR_PRESETS]
    if (preset) {
      setAccentColor(preset.accent)
      updateColorsImmediately(primaryColor, preset.accent)
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
        setPrimaryColor(color)
        updateColorsImmediately(color, accentColor)
      } else {
        setAccentColor(color)
        updateColorsImmediately(primaryColor, color)
      }
    } catch (err) {
      // User cancelled
    }
  }
  
  return (
    <div className="space-y-4">
      {/* Primary Color Section - COPIED FROM ZEYODA ProfileEditPanel.tsx lines 441-481 */}
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
            onChange={(e) => {
              const newColor = e.target.value
              setPrimaryColor(newColor)
              updateColorsImmediately(newColor, accentColor)
            }}
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
            onChange={(e) => {
              const newColor = e.target.value
              setPrimaryColor(newColor)
              updateColorsImmediately(newColor, accentColor)
            }}
            className="flex-1 p-2 bg-gray-700 text-white rounded border border-gray-600 text-sm"
            placeholder="#RRGGBB"
          />
        </div>
      </div>

      {/* Accent Color Section - COPIED FROM ZEYODA ProfileEditPanel.tsx lines 483-523 */}
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
            onChange={(e) => {
              const newColor = e.target.value
              setAccentColor(newColor)
              updateColorsImmediately(primaryColor, newColor)
            }}
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
            onChange={(e) => {
              const newColor = e.target.value
              setAccentColor(newColor)
              updateColorsImmediately(primaryColor, newColor)
            }}
            className="flex-1 p-2 bg-gray-700 text-white rounded border border-gray-600 text-sm"
            placeholder="#RRGGBB"
          />
        </div>
      </div>
    </div>
  )
}
```

**Verification:** File created, component exports correctly, all handlers call `updateColorsImmediately`.

---

## STEP 3: Create InlineLogoPicker Component

**File:** `components/InlineLogoPicker.tsx` (NEW FILE)

**Purpose:** Logo picker component that embeds in chat (autosaves, no save button).

**Based on:** `components/LogoPanel.tsx` + Zeyoda's `ProfileEditPanel.tsx` lines 525-726

### Change 3.1: Create Component File

**Create file:** `components/InlineLogoPicker.tsx`

**Add complete file content:**
```typescript
'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Profile } from '@/hooks/useProfile'
import { applyLogoBackground } from '@/utils/themeBackground'

interface InlineLogoPickerProps {
  profile: Profile | null
  onLogoChange: (updates: Partial<Profile>) => void // Autosave callback
  onPreviewChange?: (previewUrl: string | null, useBackground: boolean) => void
}

export default function InlineLogoPicker({ profile, onLogoChange, onPreviewChange }: InlineLogoPickerProps) {
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(profile?.logo_url || null)
  const logoPreviewRef = useRef<string | null>(profile?.logo_url || null)
  const [logoUseBackground, setLogoUseBackground] = useState(profile?.logo_use_background || false)
  const [isUploading, setIsUploading] = useState(false)
  
  // Update ref when preview changes
  useEffect(() => {
    logoPreviewRef.current = logoPreview
  }, [logoPreview])
  
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
        applyLogoBackground(profile, result.logoUrl, logoUseBackground);
        
        // Update preview for live background
        if (onPreviewChange) {
          onPreviewChange(result.logoUrl, logoUseBackground);
        }
        
        // CRITICAL: Autosave immediately
        onLogoChange({ logo_url: result.logoUrl });
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
  
  return (
    <div className="space-y-4">
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
                  onLogoChange({ logo_url: null, logo_use_background: false });
                  applyLogoBackground(profile, null, false);
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
            applyLogoBackground(profile, preview, logoUseBackground);
            
            // Update parent state for consistency
            if (onPreviewChange) {
              onPreviewChange(preview, logoUseBackground);
            }
            
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
              
              // Apply immediately (Zeyoda pattern - direct call, no state batching delay)
              applyLogoBackground(profile, currentLogoUrl, checked);
              
              // Update parent state for consistency
              if (onPreviewChange) {
                onPreviewChange(currentLogoUrl, checked);
              }
              
              // CRITICAL: Autosave immediately
              onLogoChange({ logo_use_background: checked });
            }}
            className="mr-2 w-4 h-4"
            disabled={!logoPreview}
          />
          <span className={logoPreview ? '' : 'text-gray-500'}>
            Use logo as page background
          </span>
        </label>
      </div>
    </div>
  )
}
```

**Verification:** File created, component exports correctly, autosaves on upload/checkbox change.

---

## STEP 4: Modify EmeraldChat Interface and Props

**File:** `components/EmeraldChat.tsx`

**Purpose:** Add profile prop to interface and component signature.

### Change 4.1: Update Interface

**Location:** Lines 11-17 (EmeraldChatProps interface)

**Current code:**
```typescript
interface EmeraldChatProps {
  onProfileUpdate?: (updates: Partial<Profile>) => void
  onTriggerPanel?: (panel: 'logo' | 'colors' | 'font' | 'asset' | null) => void
  onTypingUpdate?: (input: string, stepId: StepId) => void
  onSubmitCard?: (answer: string, stepId: StepId) => void
  onCurrentStepChange?: (stepId: StepId) => void
}
```

**Replace with:**
```typescript
interface EmeraldChatProps {
  onProfileUpdate?: (updates: Partial<Profile>) => void
  onTriggerPanel?: (panel: 'logo' | 'colors' | 'font' | 'asset' | null) => void
  onTypingUpdate?: (input: string, stepId: StepId) => void
  onSubmitCard?: (answer: string, stepId: StepId) => void
  onCurrentStepChange?: (stepId: StepId) => void
  profile?: Profile | null // CRITICAL: Profile prop for inline pickers
}
```

**Verification:** Interface includes `profile` prop.

---

### Change 4.2: Update Component Signature

**Location:** Line 19 (component function signature)

**Current code:**
```typescript
export default function EmeraldChat({ onProfileUpdate, onTriggerPanel, onTypingUpdate, onSubmitCard, onCurrentStepChange }: EmeraldChatProps) {
```

**Replace with:**
```typescript
export default function EmeraldChat({ onProfileUpdate, onTriggerPanel, onTypingUpdate, onSubmitCard, onCurrentStepChange, profile }: EmeraldChatProps) {
```

**Verification:** Component receives `profile` prop.

---

### Change 4.3: Import Inline Components

**Location:** Line 8 (after Profile import)

**Add:**
```typescript
import InlineColorPicker from '@/components/InlineColorPicker'
import InlineLogoPicker from '@/components/InlineLogoPicker'
```

**Verification:** Imports added.

---

## STEP 5: Modify EmeraldChat to Render Inline Pickers

**File:** `components/EmeraldChat.tsx`

**Purpose:** Replace question text with inline pickers when `triggersPanel` matches.

### Change 5.1: Modify Question Display Area

**Location:** Lines 497-505 (question display section)

**Current code:**
```typescript
{/* Current Question - Simple centered text like AuthPanel */}
{currentStep && currentStep.question && (
  <h1 className="gold-etched" style={{ marginTop: '0', marginBottom: '20px' }}>
    {currentStepId === 'INIT' 
      ? "Welcome, My Champion! What is your artist name?"
      : currentStep.question
    }
  </h1>
)}
```

**Replace with:**
```typescript
{/* Current Question OR Inline Picker */}
{currentStep && currentStep.question && (
  <>
    {/* Show inline picker if this step triggers a panel */}
    {currentStep.triggersPanel === 'colors' ? (
      <div className="mb-4">
        <h2 className="gold-etched text-lg mb-3" style={{ marginTop: '0', marginBottom: '12px' }}>
          {currentStep.question}
        </h2>
        <InlineColorPicker
          profile={profile}
          onColorChange={async (updates) => {
            // Autosave immediately to profile
            if (onProfileUpdate) {
              await onProfileUpdate(updates)
            }
            
            // Save to curriculum_answers
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
              await supabase.from('curriculum_answers').upsert({
                user_id: user.id,
                question_key: currentStep.key,
                answer_data: { text: 'Colors set', primary: updates.primary_color, accent: updates.accent_color },
                project_id: null
              })
            }
          }}
          onPreviewChange={(preview) => {
            // Preview updates handled internally by InlineColorPicker
          }}
        />
      </div>
    ) : currentStep.triggersPanel === 'logo' ? (
      <div className="mb-4">
        <h2 className="gold-etched text-lg mb-3" style={{ marginTop: '0', marginBottom: '12px' }}>
          {currentStep.question}
        </h2>
        <InlineLogoPicker
          profile={profile}
          onLogoChange={async (updates) => {
            // Autosave immediately to profile
            if (onProfileUpdate) {
              await onProfileUpdate(updates)
            }
            
            // Save to curriculum_answers
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
              await supabase.from('curriculum_answers').upsert({
                user_id: user.id,
                question_key: currentStep.key,
                answer_data: { text: 'Logo uploaded', url: updates.logo_url },
                project_id: null
              })
            }
          }}
          onPreviewChange={(previewUrl, useBackground) => {
            // Preview updates handled internally by InlineLogoPicker
          }}
        />
      </div>
    ) : (
      <h1 className="gold-etched" style={{ marginTop: '0', marginBottom: '20px' }}>
        {currentStepId === 'INIT' 
          ? "Welcome, My Champion! What is your artist name?"
          : currentStep.question
        }
      </h1>
    )}
  </>
)}
```

**Verification:** Renders InlineColorPicker for colors, InlineLogoPicker for logo, question text otherwise.

---

### Change 5.2: Make EmeraldChat Expand for Pickers

**Location:** Line 479 (motion.div style)

**Current code:**
```typescript
<motion.div 
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  className="mx-auto rounded-lg overflow-hidden"
  style={{
    backgroundImage: 'url(/IMG_723E215270D1-1.jpeg)',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    padding: '20px',
    boxShadow: '0 0 10px rgba(255, 215, 0, 0.8)',
    maxWidth: '450px',
    width: '90%',
    textAlign: 'center',
    color: 'white',
    margin: '0 auto'
  }}
>
```

**Replace with:**
```typescript
<motion.div 
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  className="mx-auto rounded-lg overflow-hidden"
  style={{
    backgroundImage: 'url(/IMG_723E215270D1-1.jpeg)',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    padding: '20px',
    boxShadow: '0 0 10px rgba(255, 215, 0, 0.8)',
    maxWidth: '450px',
    width: '90%',
    textAlign: 'center',
    color: 'white',
    margin: '0 auto',
    // CRITICAL: Expand height when picker is shown
    minHeight: currentStep?.triggersPanel === 'colors' || currentStep?.triggersPanel === 'logo' ? '500px' : 'auto'
  }}
>
```

**Verification:** Chat expands when picker is active.

---

### Change 5.3: Hide Input When Picker is Active

**Location:** Line 653 (input field)

**Current code:**
```typescript
<input
  ref={inputRef}
  type="text"
  value={input}
  onChange={(e) => setInput(e.target.value)}
  placeholder={currentStep.placeholder || "Type your answer..."}
  disabled={currentStepId === 'COMPLETE' || isSubmitting}
  className="email-input"
  autoFocus
/>
```

**Replace with:**
```typescript
{/* Hide input when picker is active - user clicks Send to advance */}
{currentStep?.triggersPanel !== 'colors' && currentStep?.triggersPanel !== 'logo' && (
  <input
    ref={inputRef}
    type="text"
    value={input}
    onChange={(e) => setInput(e.target.value)}
    placeholder={currentStep.placeholder || "Type your answer..."}
    disabled={currentStepId === 'COMPLETE' || isSubmitting}
    className="email-input"
    autoFocus
  />
)}
```

**Verification:** Input hidden when picker is active.

---

### Change 5.4: Modify Submit Handler for Pickers

**Location:** Line 374 (handleSubmit function start)

**Add at the very start of handleSubmit (before `e.preventDefault()`):**
```typescript
async function handleSubmit(e: React.FormEvent) {
  e.preventDefault()
  
  // CRITICAL: If picker is active, just advance to next step (already autosaved)
  if (currentStep?.triggersPanel === 'colors' || currentStep?.triggersPanel === 'logo') {
    // Colors/logo are already autosaved by InlineColorPicker/InlineLogoPicker
    // Just advance to next step
    const nextStepId = currentStep.nextStep
    const nextStep = getStep(nextStepId)
    
    setTimeout(() => {
      if (nextStep.triggersPanel && onTriggerPanel) {
        // Next step also triggers a panel - show it inline
        setCurrentStepId(nextStepId)
      } else {
        // Next step is a chat question
        const nextMessage = { role: 'assistant' as const, content: nextStep.question, stepId: nextStepId }
        setHistory([nextMessage])
        setFullHistory(prev => [...prev, nextMessage])
        setPreviousStepId(currentStepId)
        setCurrentStepId(nextStepId)
      }
    }, 300)
    return
  }
  
  // Normal submit flow continues...
  if (!input.trim() || isSubmitting) return
```

**Verification:** Submit handler advances when picker is active, doesn't require input.

---

## STEP 6: Pass Profile Prop from page.tsx

**File:** `app/page.tsx`

**Purpose:** Pass profile prop to EmeraldChat.

### Change 6.1: Add Profile Prop

**Location:** Line 431 (EmeraldChat component)

**Current code:**
```typescript
<EmeraldChat 
    onProfileUpdate={updateProfile}
    onTriggerPanel={setActivePanel}
    onTypingUpdate={(input, stepId) => {
      setCurrentTypingInput(input)
      setCurrentTypingStepId(stepId)
    }}
    onCurrentStepChange={(stepId) => {
      setCurrentQuestionStepId(stepId)
    }}
    onSubmitCard={(answer, stepId) => {
      // Clear typing state immediately
      setCurrentTypingInput('')
      setCurrentTypingStepId(null)
      // Carousel auto-advance is handled by useEffect watching currentQuestionStepId
    }}
  />
```

**Replace with:**
```typescript
<EmeraldChat 
    onProfileUpdate={updateProfile}
    onTriggerPanel={setActivePanel}
    profile={profile}
    onTypingUpdate={(input, stepId) => {
      setCurrentTypingInput(input)
      setCurrentTypingStepId(stepId)
    }}
    onCurrentStepChange={(stepId) => {
      setCurrentQuestionStepId(stepId)
    }}
    onSubmitCard={(answer, stepId) => {
      // Clear typing state immediately
      setCurrentTypingInput('')
      setCurrentTypingStepId(null)
      // Carousel auto-advance is handled by useEffect watching currentQuestionStepId
    }}
  />
```

**Verification:** Profile prop passed to EmeraldChat.

---

## STEP 7: Clear Preview on Panel Close (Optional - for Panel Mode)

**File:** `app/page.tsx`

**Purpose:** Clear preview config when panel mode closes (if user uses panel mode instead of inline).

### Change 7.1: Clear Preview in ColorPanel onClose

**Location:** Line 395 (ColorPanel onClose handler)

**Current code:**
```typescript
onClose={() => {
  // Clear color preview overrides on close
  setPreviewOverrides(prev => {
    const updated = { ...prev }
    delete updated.primary_color
    delete updated.accent_color
    return Object.keys(updated).length > 0 ? updated : null
  })
  setActivePanel(null)
}}
```

**Replace with:**
```typescript
onClose={() => {
  // Clear color preview overrides on close
  setPreviewOverrides(prev => {
    const updated = { ...prev }
    delete updated.primary_color
    delete updated.accent_color
    return Object.keys(updated).length > 0 ? updated : null
  })
  
  // CRITICAL: Clear preview config when closing panel (matches Zeyoda pattern)
  window.dispatchEvent(new CustomEvent('profilePreviewClear'));
  
  setActivePanel(null)
}}
```

**Verification:** Preview cleared when panel closes.

---

## VERIFICATION CHECKLIST

After implementation, verify:

- [ ] Tokens update color instantly when changing colors in InlineColorPicker
- [ ] Background updates instantly when changing primary color
- [ ] Text color updates instantly when changing accent color
- [ ] CSS variables (`--primary-color`, `--accent-color`) update immediately
- [ ] Logo uploads and applies background instantly
- [ ] Logo checkbox applies background immediately
- [ ] Colors autosave to `profiles` table immediately
- [ ] Colors save to `curriculum_answers` immediately
- [ ] Logo autosaves to `profiles` table immediately
- [ ] Logo saves to `curriculum_answers` immediately
- [ ] EmeraldChat expands when picker is shown
- [ ] Input field hidden when picker is active
- [ ] Send button advances to next question after picking colors
- [ ] Send button advances to next question after uploading logo
- [ ] Cards above reflect branding (via mergedProfile - already working)
- [ ] Panel mode still works (ColorPanel/LogoPanel still functional)
- [ ] No console errors
- [ ] No TypeScript errors

---

## SUMMARY

### Files Created
1. `components/InlineColorPicker.tsx` - Color picker for chat embedding
2. `components/InlineLogoPicker.tsx` - Logo picker for chat embedding

### Files Modified
1. `components/ArtisTalksOrbitRenderer.tsx` - Add preview config system (Step 1)
2. `components/EmeraldChat.tsx` - Render inline pickers, expand chat (Steps 4-5)
3. `app/page.tsx` - Pass profile prop, clear preview on panel close (Steps 6-7)

### Key Features
- ✅ Instant updates (background, text, tokens)
- ✅ Autosave (no save button)
- ✅ Send advances
- ✅ Cards reflect branding (already working via mergedProfile)
- ✅ Panel mode still works (backward compatible)

---

## READY FOR IMPLEMENTATION

This plan is 100% concrete with exact line numbers and code. All 3 issues from feedback are fixed:
1. ✅ Profile prop added to interface and passed correctly
2. ✅ Profile prop passed from page.tsx
3. ✅ No `profile={null}` - uses actual profile from start

**Ready to proceed?**

