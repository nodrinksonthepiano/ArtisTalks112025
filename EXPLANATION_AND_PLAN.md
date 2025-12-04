# What's Going On (4th Grade Explanation)

## The Problem (Simple Version)

Right now, when you change colors in the color picker, **three things DON'T update right away**:

1. **The background color** - It stays the old color until you save
2. **The text color** - It stays the old color until you save  
3. **The orbiting tokens** - They stay the old color until you save

It's like changing the paint color on a paintbrush, but the wall doesn't change until you click "Save" - you want to see it change **right now**!

---

## What We're Going to Fix (Simple Version)

We're going to make **everything update instantly** when you move the color slider, just like Zeyoda does.

**Three things will happen instantly:**
1. Background changes color immediately ✅
2. Text changes color immediately ✅
3. Orbiting tokens change color immediately ✅

---

## How It Works (Simple Version)

Think of it like a walkie-talkie system:

1. **You change a color** → ColorCard sends a message: "Hey! Colors changed!"
2. **Background hears the message** → Background changes color right away
3. **Tokens hear the message** → Tokens change color right away
4. **Everything updates instantly** → No waiting for "Save" button!

When you click "Save", it's like saying "OK, keep these colors forever" - then everything uses the saved colors instead of the preview colors.

---

# STEP-BY-STEP PLAN

## STEP 1: Add Preview System to Orbit Renderer (COMPLETE DETAIL)

**What:** Make the orbiting tokens listen for color changes and update instantly.

**File:** `components/ArtisTalksOrbitRenderer.tsx`

**Zeyoda Proof:** `app/components/ThemeOrbitRenderer.tsx` lines 32-34, 54-73, 397-420

### Change 1.1.1: Add Preview State

**Location:** After line 31 (right after `brandColor` prop)

**Add this code (EXACT from Zeyoda pattern):**
```typescript
// CRITICAL: Preview config for live token color updates during editing
// This is set via event from ColorPanel/ColorCard and cleared when profile changes
const [previewConfig, setPreviewConfig] = React.useState<{
  primary_color?: string;
  accent_color?: string;
  brand_color?: string;
} | null>(null);
```

**Why:** This stores the "preview" colors (the ones you're picking) separately from the "saved" colors.

---

### Change 1.1.2: Add Event Listeners

**Location:** After line 52 (before the main useEffect that starts at line 53)

**Add this code (EXACT from Zeyoda lines 54-73, adapted for ArtisTalks):**
```typescript
// CRITICAL: Listen for preview config events from ColorPanel/ColorCard for live token updates
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

**Why:** This makes the tokens "listen" for color change messages. When ColorCard says "colors changed!", tokens hear it and update.

---

### Change 1.1.3: Update Token Color Calculation

**Location:** Line 360 (replace the existing tokenColor calculation)

**Current code:**
```typescript
const tokenColor = brandColor || token.color || defaultColors[token.id] || defaultColors.pre;
```

**Replace with (EXACT from Zeyoda pattern lines 397-420, adapted):**
```typescript
// CRITICAL: Merged lookup for live token color updates
// During editing: uses previewConfig (from ColorCard event) for immediate updates
// After save: uses brandColor prop (updated state) for persistence
// This matches Zeyoda's getTokenTheme pattern (lines 397-420)
const mergedBrandColor = previewConfig?.brand_color || previewConfig?.primary_color || brandColor;
const tokenColor = mergedBrandColor || token.color || defaultColors[token.id] || defaultColors.pre;
```

**Why:** This checks preview colors FIRST (if you're picking), then saved colors, then defaults. This makes tokens update instantly.

---

## STEP 2: Make ColorPanel Send Events + Update CSS Immediately (COMPLETE DETAIL)

**What:** When colors change, immediately update background/text AND tell tokens to update.

**File:** `components/ColorPanel.tsx`

**Zeyoda Proof:** `app/components/ProfileEditPanel.tsx` lines 290-294 (events), lines 300-306 (CSS vars)

### Change 1.2.1: Create Helper Function for Color Updates

**Location:** After line 27 (after state declarations, before `applyPrimaryPreset`)

**Add this code (EXACT from Zeyoda lines 262-314, adapted):**
```typescript
// CRITICAL: Helper to update colors immediately (matches Zeyoda pattern)
// This updates CSS variables, background, and dispatches events for token updates
const updateColorsImmediately = useCallback((newPrimary: string, newAccent: string) => {
  // Update CSS variables immediately (Zeyoda lines 300-306)
  if (typeof document !== 'undefined') {
    document.documentElement.style.setProperty('--primary-color', newPrimary);
    if (newAccent) {
      document.documentElement.style.setProperty('--accent-color', newAccent);
      document.documentElement.style.setProperty(
        '--accent-color-rgb',
        newAccent.match(/\d+/g)?.join(', ') ?? '0,0,0'
      );
    }
    
    // Update header text color immediately (Zeyoda lines 303-306)
    const headerElement = document.querySelector('h1');
    if (headerElement) {
      headerElement.style.color = newAccent;
    }
    
    // CRITICAL: Call applyLogoBackground immediately with preview colors
    // This updates background in real-time (Zeyoda pattern - calls applyArtistBackground immediately)
    import('@/utils/themeBackground').then(({ applyLogoBackground }) => {
      applyLogoBackground(
        { primary_color: newPrimary, accent_color: newAccent, brand_color: newPrimary } as Profile,
        undefined,
        undefined
      );
    });
  }
  
  // Call parent preview handler
  onPreviewChange?.({ primary_color: newPrimary, accent_color: newAccent });
  
  // CRITICAL: Dispatch preview config for token live updates (Zeyoda lines 290-294)
  // This allows ArtisTalksOrbitRenderer to update token colors immediately during editing
  window.dispatchEvent(new CustomEvent('profilePreview', { 
    detail: { 
      previewConfig: { 
        primary_color: newPrimary, 
        accent_color: newAccent,
        brand_color: newPrimary // Use primary as brand color
      } 
    } 
  }));
}, [onPreviewChange]);
```

**Why:** This one function does everything: updates CSS, updates background, tells tokens to update. All instantly.

---

### Change 1.2.2: Update All Color Change Handlers

**Location:** Lines 33, 41, 104, 114, 154, 164

**Current code (example from line 104):**
```typescript
onChange={(e) => {
  const newColor = e.target.value
  setPrimaryColor(newColor)
  onPreviewChange?.({ primary_color: newColor, accent_color: accentColor })
}}
```

**Replace ALL instances with:**
```typescript
onChange={(e) => {
  const newColor = e.target.value
  setPrimaryColor(newColor)
  updateColorsImmediately(newColor, accentColor)
}}
```

**For accent color handlers (lines 154, 164), use:**
```typescript
onChange={(e) => {
  const newColor = e.target.value
  setAccentColor(newColor)
  updateColorsImmediately(primaryColor, newColor)
}}
```

**For preset handlers (lines 29-35, 37-43), update to:**
```typescript
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
```

**Why:** Now every color change calls the helper function, which updates everything instantly.

---

### Change 1.2.3: Clear Preview on Save

**Location:** Line 67 (after `onClose()`)

**Add after `onClose()`:**
```typescript
// CRITICAL: Clear preview config when save completes (Zeyoda lines 357-359)
// This ensures tokens use saved state instead of preview
window.dispatchEvent(new CustomEvent('profilePreviewClear'));
```

**Why:** When you save, we want tokens to use the saved colors, not preview colors.

---

### Change 1.2.4: Add useCallback Import

**Location:** Line 3 (import statement)

**Current:**
```typescript
import { useState } from 'react'
```

**Change to:**
```typescript
import { useState, useCallback } from 'react'
```

**Why:** We need `useCallback` for the helper function.

---

## STEP 3: Update page.tsx to Clear Preview on Panel Close (LIMITED DETAIL)

**What:** When user closes ColorPanel, clear the preview so tokens go back to saved colors.

**File:** `app/page.tsx`

**Location:** Line 395 (in the `onClose` handler for ColorPanel)

**Add after clearing `previewOverrides`:**
```typescript
// CRITICAL: Clear preview config when closing panel (matches Zeyoda pattern)
window.dispatchEvent(new CustomEvent('profilePreviewClear'));
```

**Why:** If user closes panel without saving, tokens should revert to saved colors.

---

## STEP 4: Create ColorCard Component (LIMITED DETAIL)

**What:** Create a card component that shows color picker after artist name (always visible, not a panel).

**New File:** `components/ColorCard.tsx`

**Based on:** Zeyoda's `ProfileEditPanel.tsx` lines 441-523 (color sections)

**Structure:**
- Copy ColorPanel code
- Remove `onClose` prop (cards don't close)
- Remove Cancel button (cards are always visible)
- Use same `updateColorsImmediately` helper from Step 2
- Add Save button that calls `onSave` and clears preview

**Key Features:**
- Same color presets (8 presets from Zeyoda)
- Same color picker inputs
- Same live preview system
- EyeDropper button (HTML5 API) next to color picker
- Auto-updates background/tokens/text instantly

**Note:** This will be created in detail in a future step. For now, we focus on Steps 1-3.

---

## STEP 5: Create LogoCard Component (LIMITED DETAIL)

**What:** Create a card component for logo upload after artist name.

**New File:** `components/LogoCard.tsx`

**Based on:** `components/LogoPanel.tsx` (existing code)

**Changes:**
- Extract from LogoPanel
- Remove "Save & Continue" button
- Keep upload functionality
- Keep background checkbox (with Zeyoda's atomic update pattern)
- Auto-saves on upload/checkbox change

**Note:** This will be created in detail in a future step.

---

## STEP 6: Add Cards to page.tsx (LIMITED DETAIL)

**What:** Display ColorCard and LogoCard after mission statement.

**File:** `app/page.tsx`

**Location:** After line 261 (after mission statement paragraph)

**Add:**
- Two card components side-by-side (responsive: stack on mobile)
- ColorCard with same props as ColorPanel
- LogoCard with same props as LogoPanel
- Cards always visible when user is logged in

**Note:** This will be added in detail in a future step.

---

# SUMMARY: What We're Doing First (Steps 1-3)

## Immediate Focus: Steps 1-3

**Step 1:** Make tokens listen for color changes ✅
- Add preview state
- Add event listeners  
- Update color calculation

**Step 2:** Make ColorPanel update everything instantly ✅
- Create helper function
- Update all color handlers
- Clear preview on save

**Step 3:** Clear preview when panel closes ✅
- Add event dispatch in page.tsx

## Later Steps: Steps 4-6

**Step 4:** Create ColorCard (always-visible card)
**Step 5:** Create LogoCard (always-visible card)  
**Step 6:** Add cards to page.tsx

---

# ZEYODA CODE REFERENCES

## For Step 1 (Orbit Renderer):
- **Preview state:** `ThemeOrbitRenderer.tsx` lines 32-34
- **Event listeners:** `ThemeOrbitRenderer.tsx` lines 54-73
- **Clear preview:** `ThemeOrbitRenderer.tsx` lines 75-81
- **Merged lookup:** `ThemeOrbitRenderer.tsx` lines 397-420

## For Step 2 (ColorPanel):
- **Event dispatch:** `ProfileEditPanel.tsx` lines 290-294
- **CSS var updates:** `ProfileEditPanel.tsx` lines 300-306
- **Clear on save:** `ProfileEditPanel.tsx` lines 357-359

## For Step 3 (page.tsx):
- **Clear on close:** Pattern from Zeyoda's `handleCancel` (lines 420-425)

---

# TESTING CHECKLIST (After Steps 1-3)

- [ ] Change primary color → Background changes instantly
- [ ] Change primary color → CSS variable `--primary-color` updates instantly
- [ ] Change accent color → Text color changes instantly
- [ ] Change accent color → CSS variable `--accent-color` updates instantly
- [ ] Change colors → Tokens change color instantly
- [ ] Click Save → Tokens use saved colors (preview cleared)
- [ ] Close panel → Tokens revert to saved colors (preview cleared)
- [ ] Background applies immediately (no delay)
- [ ] No console errors

---

# READY TO PROCEED?

**Steps 1-3 are ready for implementation.**
**Steps 4-6 will be detailed after Steps 1-3 are complete.**

**Do you approve Steps 1-3?**

