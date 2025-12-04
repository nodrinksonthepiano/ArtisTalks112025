# PLAN: Fix Token Colors Live Update + Add Cards After Artist Name

## Overview
Fix tokens in orbit to update colors in real-time as user selects colors, matching Zeyoda's live preview system. Add cards after artist name and mission statement for color/logo selection.

---

## PART 1: Fix Token Colors Live Update (Zeyoda Pattern)

### Problem
**Current State:** Tokens use static `brandColor` prop that doesn't update when user changes colors in ColorPanel.

**Zeyoda Solution:** Uses preview config system with event listeners for live coin color updates.

---

### ZEYODA PROOF: Live Token Color Updates

**File:** `app/components/ThemeOrbitRenderer.tsx` (Zeyoda)

**Lines 32-34:** Preview config state for live updates
```typescript
const [previewConfig, setPreviewConfig] = React.useState<ArtistConfig | null>(null);
```

**Lines 54-73:** Event listeners for preview config
```typescript
useEffect(() => {
  const handlePreview = (e: Event) => {
    const customEvent = e as CustomEvent<{ previewConfig: ArtistConfig }>;
    if (customEvent.detail?.previewConfig) {
      setPreviewConfig(customEvent.detail.previewConfig);
    }
  };
  
  const handleClear = () => {
    setPreviewConfig(null);
  };
  
  window.addEventListener('artistConfigPreview', handlePreview as EventListener);
  window.addEventListener('artistConfigPreviewClear', handleClear);
  return () => {
    window.removeEventListener('artistConfigPreview', handlePreview as EventListener);
    window.removeEventListener('artistConfigPreviewClear', handleClear);
  };
}, []);
```

**Lines 75-81:** Clear preview when artistConfig changes
```typescript
useEffect(() => {
  setPreviewConfig(null);
}, [artistConfig?.id, artistConfig?.name]);
```

**Lines 397-420:** CRITICAL - Merged lookup for token colors
```typescript
const getTokenTheme = (artistId: string | undefined) => {
  if (!artistId) return undefined;
  const aid = artistId.toLowerCase();
  
  // Check if this token belongs to the current artist being edited
  const currentArtistId = artistConfig?.id?.toLowerCase() || artistConfig?.name?.toLowerCase();
  if (currentArtistId === aid) {
    // Current artist: use previewConfig during editing (live), fallback to artistConfig after save
    return previewConfig?.theme || artistConfig?.theme;
  }
  
  // Other artists: use allArtistsConfig (from hook, updates on refresh)
  return allArtistsConfig?.[aid]?.theme;
};

const aid = token.artistId ? token.artistId.toLowerCase() : undefined as string | undefined;
const tokenTheme = getTokenTheme(token.artistId);
const bg = tokenTheme?.primaryColor || '#0a1230';
const fg = tokenTheme?.accentColor || '#1e5cff';
const ff = tokenTheme?.fontFamily || 'Bungee, cursive';
```

**Lines 435-439:** Apply colors to token
```typescript
style={{
  background: bg,
  color: fg,
  border: `2px solid ${fg}`,
  fontFamily: ff,
  cursor: 'grab'
}}
```

**File:** `app/components/ProfileEditPanel.tsx` (Zeyoda)

**Lines 290-294:** Dispatch preview config event
```typescript
// CRITICAL: Dispatch preview config for coin live updates
// This allows ThemeOrbitRenderer to update coin colors immediately during editing
window.dispatchEvent(new CustomEvent('artistConfigPreview', { 
  detail: { previewConfig: previewConfig as ArtistConfig } 
}));
```

**Lines 357-359:** Clear preview on save
```typescript
// CRITICAL: Clear preview config when save completes
// This ensures coins use saved state instead of preview
window.dispatchEvent(new CustomEvent('artistConfigPreviewClear'));
```

---

### ARTISTALKS CURRENT STATE

**File:** `components/ArtisTalksOrbitRenderer.tsx`

**Line 360:** Static token color (no live updates)
```typescript
const tokenColor = brandColor || token.color || defaultColors[token.id] || defaultColors.pre;
```

**Line 301:** Passes static brandColor prop
```typescript
brandColor={profile?.brand_color || undefined}
```

**Missing:**
- ❌ No preview config state
- ❌ No event listeners for live updates
- ❌ No merged lookup system

**File:** `components/ColorPanel.tsx`

**Lines 33, 41, 104, 114, 154, 164:** Calls `onPreviewChange` but doesn't dispatch events to orbit renderer
```typescript
onPreviewChange?.({ primary_color: newColor, accent_color: accentColor })
```

**Missing:**
- ❌ No event dispatch to orbit renderer for live token updates

---

### PROPOSED CHANGES: Part 1

#### Change 1.1: Add Preview Config System to ArtisTalksOrbitRenderer

**File:** `components/ArtisTalksOrbitRenderer.tsx`

**Add after line 31 (after brandColor prop):**
```typescript
// CRITICAL: Preview config for live token color updates during editing
// This is set via event from ColorPanel and cleared when profile changes
const [previewConfig, setPreviewConfig] = React.useState<{
  primary_color?: string;
  accent_color?: string;
  brand_color?: string;
} | null>(null);
```

**Add after line 52 (before useEffect):**
```typescript
// CRITICAL: Listen for preview config events from ColorPanel for live token updates
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
useEffect(() => {
  setPreviewConfig(null);
}, [profile?.id]); // Clear when user changes
```

**Change line 360 (token color calculation):**
```typescript
// CRITICAL: Merged lookup for live token color updates
// During editing: uses previewConfig (from ColorPanel event) for immediate updates
// After save: uses brandColor prop (updated state) for persistence
const mergedBrandColor = previewConfig?.brand_color || previewConfig?.primary_color || brandColor;
const tokenColor = mergedBrandColor || token.color || defaultColors[token.id] || defaultColors.pre;
```

**Note:** ArtisTalks uses `brandColor` prop (single color), not separate primary/accent like Zeyoda. We'll use `primary_color` as `brand_color` fallback.

---

#### Change 1.2: Dispatch Preview Events from ColorPanel

**File:** `components/ColorPanel.tsx`

**Change lines 33, 41, 104, 114, 154, 164:** Add event dispatch after `onPreviewChange`
```typescript
onPreviewChange?.({ primary_color: newColor, accent_color: accentColor })

// CRITICAL: Dispatch preview config for token live updates
// This allows ArtisTalksOrbitRenderer to update token colors immediately during editing
window.dispatchEvent(new CustomEvent('profilePreview', { 
  detail: { 
    previewConfig: { 
      primary_color: newColor, 
      accent_color: accentColor,
      brand_color: newColor // Use primary as brand color
    } 
  } 
}));
```

**Change line 67 (after save):**
```typescript
onClose()

// CRITICAL: Clear preview config when save completes
// This ensures tokens use saved state instead of preview
window.dispatchEvent(new CustomEvent('profilePreviewClear'));
```

**Change line 395 (onClose handler in page.tsx):**
```typescript
onClose={() => {
  // Clear color preview overrides on close
  setPreviewOverrides(prev => {
    const updated = { ...prev }
    delete updated.primary_color
    delete updated.accent_color
    return Object.keys(updated).length > 0 ? updated : null
  })
  
  // CRITICAL: Clear preview config when closing panel
  window.dispatchEvent(new CustomEvent('profilePreviewClear'));
  
  setActivePanel(null)
}}
```

---

## PART 2: Add Cards After Artist Name and Mission Statement

### Problem
User wants cards displayed after artist name and mission statement (gift to the world) for color/logo selection, instead of panels triggered by chat.

---

### ZEYODA PROOF: Panel Structure

**File:** `app/components/ProfileEditPanel.tsx` (Zeyoda)

**Lines 441-523:** Color selection UI (bundled in one panel)
- Primary color section (lines 441-481)
- Accent color section (lines 483-523)

**Lines 525-726:** Logo upload section
- Logo preview (lines 530-618)
- File input (lines 622-654)
- Checkbox for background (lines 656-725)

**Lines 664-669:** CRITICAL - Failproof checkbox UX
```typescript
// Update both fields atomically: if checking logo, uncheck background
setFormData(prev => {
  const updated = {
    ...prev,
    logo_use_background: checked,
    background_use_image: checked ? false : prev.background_use_image
  };
```

**Lines 861-869:** Background checkbox (same pattern)
```typescript
// Update both fields atomically: if checking background, uncheck logo
setFormData(prev => {
  const updated = {
    ...prev,
    background_use_image: checked,
    logo_use_background: checked ? false : prev.logo_use_background
  };
```

---

### ARTISTALKS CURRENT STATE

**File:** `app/page.tsx`

**Lines 246-261:** Artist name and mission statement displayed
```typescript
<h1>{profile?.artist_name || "ArtisTalks"}</h1>
<p>{profile?.mission_statement || "The Champion is ready for you."}</p>
```

**Lines 318-406:** Panels rendered conditionally based on `activePanel` state
- Panels appear below carousel, above chat
- Triggered by EmeraldChat when `step.triggersPanel` is set

**Missing:**
- ❌ No cards displayed after artist name/mission statement
- ❌ Cards should be separate (not one panel like Zeyoda)

---

### PROPOSED CHANGES: Part 2

#### Change 2.1: Create ColorCard Component (Bundled Primary/Secondary)

**New File:** `components/ColorCard.tsx`

**Based on:** Zeyoda's `ProfileEditPanel.tsx` lines 441-523 (color sections)

**Structure:**
- Single card component
- Contains both primary and accent color sections
- Live preview via `onPreviewChange`
- Dispatches `profilePreview` events for token updates
- Saves via `onSave` callback

**Key Features:**
- Color presets (8 presets from Zeyoda)
- Color picker inputs
- Text input for hex codes
- Live preview updates tokens immediately
- Save button saves to profile

**Color Dropper Feature:**
- Add eyedropper button next to color picker
- Uses HTML5 EyeDropper API (standard web API, not inventing)
- Opens eyedropper, user clicks on logo/image to pick color
- Sets selected color to input field

**Code Structure:**
```typescript
'use client'

import { useState } from 'react'
import { Profile } from '@/hooks/useProfile'

interface ColorCardProps {
  profile: Profile | null
  onSave: (updates: Partial<Profile>) => void
  onPreviewChange?: (preview: { primary_color?: string; accent_color?: string }) => void
}

export default function ColorCard({ profile, onSave, onPreviewChange }: ColorCardProps) {
  const [primaryColor, setPrimaryColor] = useState(profile?.primary_color || '#10b981')
  const [accentColor, setAccentColor] = useState(profile?.accent_color || '#fbbf24')
  
  // Color presets from Zeyoda (lines 12-21)
  const COLOR_PRESETS = { /* ... */ }
  
  // EyeDropper handler
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
        onPreviewChange?.({ primary_color: color, accent_color: accentColor })
        window.dispatchEvent(new CustomEvent('profilePreview', { 
          detail: { previewConfig: { primary_color: color, accent_color: accentColor, brand_color: color } } 
        }))
      } else {
        setAccentColor(color)
        onPreviewChange?.({ primary_color: primaryColor, accent_color: color })
        window.dispatchEvent(new CustomEvent('profilePreview', { 
          detail: { previewConfig: { primary_color: primaryColor, accent_color: color, brand_color: primaryColor } } 
        }))
      }
    } catch (err) {
      // User cancelled
    }
  }
  
  // Rest of component (presets, inputs, save button)
}
```

---

#### Change 2.2: Update LogoPanel to Match Zeyoda's Failproof Checkbox UX

**File:** `components/LogoPanel.tsx`

**Current:** Lines 206-226 have checkbox handler but doesn't uncheck background checkbox

**Zeyoda Proof:** Lines 664-669, 861-869 show atomic checkbox updates

**Change:** Add `background_use_image` field to state and uncheck it when logo checkbox is checked

**Note:** ArtisTalks doesn't have separate background image upload (only logo), so we only need to ensure logo checkbox works correctly. But if we add background image later, the pattern is ready.

**Current checkbox handler (lines 206-226):**
```typescript
onChange={(e) => {
  const checked = e.target.checked;
  setLogoUseBackground(checked);
  // ... rest
}}
```

**Proposed:** Keep as-is (no background image in ArtisTalks yet), but add comment referencing Zeyoda pattern for future.

---

#### Change 2.3: Add Cards to page.tsx After Mission Statement

**File:** `app/page.tsx`

**Add after line 261 (after mission statement):**
```typescript
{/* Color and Logo Cards - Display after artist name and mission statement */}
{user && profile && (
  <div className="flex flex-col md:flex-row gap-4 justify-center items-start mt-6 mb-4 max-w-4xl mx-auto px-4">
    {/* Color Card - Bundled Primary/Secondary */}
    <div className="flex-1 bg-gray-800 bg-opacity-90 rounded-lg p-6 backdrop-blur-sm border border-gray-600">
      <ColorCard
        profile={profile}
        onSave={async (updates) => {
          await updateProfile(updates)
          setPreviewOverrides(prev => {
            const updated = { ...prev }
            delete updated.primary_color
            delete updated.accent_color
            return Object.keys(updated).length > 0 ? updated : null
          })
          window.dispatchEvent(new CustomEvent('profilePreviewClear'))
        }}
        onPreviewChange={(preview) => {
          setPreviewOverrides(prev => ({ ...prev, ...preview }))
        }}
      />
    </div>
    
    {/* Logo Card - Upload with Background Checkbox */}
    <div className="flex-1 bg-gray-800 bg-opacity-90 rounded-lg p-6 backdrop-blur-sm border border-gray-600">
      <LogoCard
        profile={profile}
        onSave={async (updates) => {
          await updateProfile(updates)
          setLogoPreviewUrl(null)
          setLogoPreviewUseBackground(false)
          setPreviewOverrides(prev => {
            const updated = { ...prev }
            delete updated.logo_url
            delete updated.logo_use_background
            return Object.keys(updated).length > 0 ? updated : null
          })
          const updatedProfile = profile ? { ...profile, ...updates } : null
          if (updatedProfile) {
            applyLogoBackground(updatedProfile, undefined, undefined)
          }
        }}
        onPreviewChange={(previewUrl, useBackground) => {
          setLogoPreviewUrl(previewUrl)
          setLogoPreviewUseBackground(useBackground)
          setPreviewOverrides(prev => ({
            ...prev,
            logo_url: previewUrl || undefined,
            logo_use_background: useBackground
          }))
        }}
      />
    </div>
  </div>
)}
```

---

#### Change 2.4: Create LogoCard Component (Extracted from LogoPanel)

**New File:** `components/LogoCard.tsx`

**Based on:** `components/LogoPanel.tsx` (existing code)

**Changes:**
- Remove "Save & Continue" button (cards are always visible, no "continue")
- Keep upload functionality
- Keep background checkbox
- Keep live preview
- Match Zeyoda's checkbox pattern (lines 664-669)

**Structure:**
- Logo preview section
- File input
- Upload button (if file selected)
- Background checkbox (with Zeyoda's atomic update pattern)
- Auto-saves on upload/checkbox change (no manual save button)

---

## PART 3: Ensure Live Updates Work End-to-End

### Flow Verification

1. **User opens ColorCard**
   - ColorCard renders with current profile colors
   - User changes primary color
   - `onPreviewChange` called → updates `previewOverrides` in page.tsx
   - `profilePreview` event dispatched → ArtisTalksOrbitRenderer receives it
   - Tokens update color immediately

2. **User saves colors**
   - `onSave` called → saves to profile
   - `profilePreviewClear` event dispatched → clears preview config
   - Tokens use saved `brandColor` prop

3. **User uploads logo**
   - LogoCard uploads file
   - Background checkbox toggles
   - `applyLogoBackground` called immediately (Zeyoda pattern)
   - Background updates live

---

## Summary of Changes

### Files to Create
1. `components/ColorCard.tsx` - Bundled color selection card
2. `components/LogoCard.tsx` - Logo upload card (extracted from LogoPanel)

### Files to Modify
1. `components/ArtisTalksOrbitRenderer.tsx` - Add preview config system
2. `components/ColorPanel.tsx` - Add event dispatch (keep for panel mode)
3. `components/LogoPanel.tsx` - Add comment about Zeyoda checkbox pattern
4. `app/page.tsx` - Add cards after mission statement

### Key Patterns from Zeyoda
1. ✅ Preview config state in orbit renderer
2. ✅ Event listeners (`profilePreview`, `profilePreviewClear`)
3. ✅ Merged lookup (preview → saved → default)
4. ✅ Atomic checkbox updates (logo unchecks background)
5. ✅ Live background application (`applyLogoBackground` immediately)

---

## Testing Checklist

- [ ] Tokens update color immediately when changing colors in ColorCard
- [ ] Tokens persist color after save
- [ ] ColorCard shows current profile colors on load
- [ ] LogoCard uploads logo successfully
- [ ] LogoCard background checkbox applies background immediately
- [ ] Cards appear after artist name and mission statement
- [ ] Cards are responsive (stack on mobile, side-by-side on desktop)
- [ ] EyeDropper works (if browser supports it)
- [ ] Preview config clears on save
- [ ] Preview config clears on panel close

---

## Notes

1. **Color Dropper:** Uses HTML5 EyeDropper API (standard web API). If not supported, shows alert. This is standard technology, not inventing a solution.

2. **Separate Cards:** Unlike Zeyoda's single panel, ArtisTalks uses separate cards. This matches user requirement.

3. **Panel Mode:** Keep existing ColorPanel and LogoPanel for panel mode (triggered by chat). Cards are additional UI for always-visible editing.

4. **Event Names:** Using `profilePreview` instead of `artistConfigPreview` to match ArtisTalks naming (`profile` vs `artistConfig`).

---

## Approval Required

Please review this plan and approve before I make any code changes.

**Key Questions:**
1. Should cards be always visible, or only show when user hasn't completed those steps?
2. Should cards replace panel mode, or coexist with it?
3. EyeDropper API - is this acceptable, or prefer canvas-based color picking?

