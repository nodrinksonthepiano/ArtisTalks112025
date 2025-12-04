# ArtisTalks Project - Complete Breakdown

## Project Overview

**ArtisTalks** is a Next.js curriculum application where users answer questions through 4 phases (PRE, PROD, POST, LEGACY). Progress is visualized with orbiting tokens that fill from bottom based on completion percentage. The project is based on Zeyoda's architecture but simplified for curriculum-only (no Web3/token buying).

**Repository:** `/Users/j/Dev/ArtisTalks112025`  
**Zeyoda Reference:** `https://github.com/nodrinksonthepiano/zeyoda-nextjs-52925/tree/feature/coin-colors-live-update`

---

## Tech Stack

- **Framework:** Next.js 16.0.3 (App Router)
- **React:** 19.2.0
- **Database:** Supabase (PostgreSQL)
- **Auth:** Supabase Auth
- **Storage:** Supabase Storage (`artis-talks-assets` bucket)
- **Styling:** Tailwind CSS 4
- **Animations:** Framer Motion
- **Icons:** Lucide React

---

## Project Structure

```
ArtisTalks112025/
├── app/
│   ├── api/
│   │   └── uploadLogo/
│   │       └── route.ts          # Logo upload API endpoint
│   ├── globals.css                # Global styles
│   ├── layout.tsx                 # Root layout
│   └── page.tsx                   # Main page (orchestrates everything)
├── components/
│   ├── ArtisTalksOrbitRenderer.tsx  # Orbiting tokens (4 phases)
│   ├── AuthPanel.tsx              # Login/auth UI
│   ├── ColorPanel.tsx            # Color selection panel
│   ├── DataReset.tsx             # Reset all user data
│   ├── EmeraldChat.tsx           # Chat interface for questions
│   ├── FontPanel.tsx             # Font selection panel
│   ├── LogoPanel.tsx             # Logo upload panel
│   ├── OrbitPeekCarousel.tsx     # Content carousel (cards)
│   └── OvalGlowBackdrop.tsx      # Halo effect around carousel
├── hooks/
│   ├── useCarouselItems.ts       # Generates carousel cards from answers
│   ├── useCurriculumProgress.ts  # Calculates progress % per phase
│   └── useProfile.ts             # Profile data management
├── lib/
│   └── curriculum.ts             # Curriculum definition (all steps/phases)
├── utils/
│   ├── supabase/
│   │   ├── client.ts            # Supabase client (browser)
│   │   └── server.ts            # Supabase client (server)
│   └── themeBackground.ts       # Logo background application (Zeyoda pattern)
└── public/                       # Static assets
```

---

## Database Schema

### `profiles` table
```typescript
{
  id: string (uuid, primary key, matches auth.users.id)
  artist_name: string | null
  mission_statement: string | null
  email: string | null
  logo_url: string | null
  primary_color: string | null
  accent_color: string | null
  font_family: string | null
  logo_use_background: boolean | null
  brand_color: string | null
}
```

### `curriculum_answers` table
```typescript
{
  id: uuid (primary key)
  user_id: uuid (foreign key to auth.users.id)
  question_key: string (matches CURRICULUM step.key)
  answer_data: jsonb (e.g., { text: "answer" })
  created_at: timestamp
  project_id: uuid | null
}
```

**Storage Bucket:** `artis-talks-assets`
- Path: `{userId}/logo.{uuid}.{ext}`
- Used for logo uploads

---

## Core Concepts

### 1. Curriculum Flow

**File:** `lib/curriculum.ts`

**Structure:**
- **4 Phases:** PRE → PROD → POST → LEGACY
- **Steps:** Each phase has multiple steps with `id`, `question`, `nextStep`, `key`, `phase`
- **Panel Steps:** Steps with `triggersPanel` open panels instead of chat questions
- **Keys:** Each step has a `key` that matches `curriculum_answers.question_key`

**Example:**
```typescript
LOGO_PANEL: {
  id: 'LOGO_PANEL',
  question: "Perfect! Now let's set up your branding. First, upload your logo.",
  nextStep: 'COLORS_PANEL',
  key: 'logo_uploaded',  // ← Saved to curriculum_answers.question_key
  triggersPanel: 'logo', // ← Opens LogoPanel instead of chat
  phase: 'pre'
}
```

**Current Steps:**
- **PRE:** INIT → MISSION_NAME → MISSION_GIFT → LOGO_PANEL → COLORS_PANEL → FONT_PANEL → PRE_COMPLETE
- **PROD:** PROJECT_NAME → PROJECT_DESCRIPTION → ASSET_UPLOAD_PANEL → PROD_COMPLETE
- **POST:** PROMO_STRATEGY → TARGET_AUDIENCE → LAUNCH_DATE → POST_COMPLETE
- **LEGACY:** GRATITUDE → LEGACY_VISION → FEEDBACK_LOOP → COMPLETE

---

### 2. Progress Calculation

**File:** `hooks/useCurriculumProgress.ts`

**How it works:**
1. Queries `curriculum_answers` for user's `question_key` values
2. Filters CURRICULUM steps by phase (excludes `_COMPLETE` steps and `INIT`)
3. Gets unique `step.key` values for each phase
4. Counts how many keys are in `answeredKeys`
5. Calculates: `(completed / total) * 100`

**Example for PRE phase:**
- Expected keys: `['artist_name', 'gift_to_world', 'logo_uploaded', 'colors_set', 'font_set']`
- If user has: `['artist_name', 'gift_to_world']` → 2/5 = 40% progress

**Real-time updates:** Subscribes to `curriculum_answers` table changes via Supabase realtime

---

### 3. Panel System

**How panels work:**
1. EmeraldChat detects `step.triggersPanel` → calls `onTriggerPanel(panelType)`
2. `app/page.tsx` sets `activePanel` state → renders panel component
3. Panel saves to `curriculum_answers` with `question_key` matching step's `key`
4. Panel dispatches `panelComplete` event → EmeraldChat advances to next step

**Panel Components:**
- **LogoPanel** (`components/LogoPanel.tsx`): Uploads logo, saves `logo_uploaded` key
- **ColorPanel** (`components/ColorPanel.tsx`): Selects colors, saves `colors_set` key
- **FontPanel** (`components/FontPanel.tsx`): Selects font, saves `font_set` key
- **AssetPanel** (not implemented): Would upload project assets, save `asset_uploaded` key

**Current Issue:** Panel steps (`logo_uploaded`, `colors_set`, `font_set`) are not saving to database, causing progress to be 0% even when panels are completed.

---

### 4. Token Orbiting System

**File:** `components/ArtisTalksOrbitRenderer.tsx`

**Based on:** Zeyoda's `ThemeOrbitRenderer.tsx`

**Key Features:**
- **4 Tokens:** PRE, PROD, POST, LEGACY
- **Orbit Speed:** `ORBIT_SPEED = 0.3` radians/sec (matches Zeyoda)
- **Positioning:** Viewport coordinates (`position: fixed`) - tokens orbit around carousel center
- **Fill:** Bottom-up fill based on `token.progress` (0-100%)
- **Interaction:** Pause on hover, drag to rotate, wheel to rotate

**Current Status:**
- ✅ Centered around carousel (viewport coordinates)
- ✅ Speed matches Zeyoda (0.3 rad/sec)
- ✅ Fill implementation exists but not visible (progress values are 0)
- ⚠️ Fill uses height-based approach with `overflow-hidden` clipping

**Fill Implementation (Lines 456-466):**
```typescript
{fillPercentage > 0 && (
  <div
    className="absolute bottom-0 left-0 right-0 transition-all duration-500 ease-out"
    style={{
      height: `${fillPercentage}%`,
      backgroundColor: tokenColor,
      zIndex: 1,
    }}
  />
)}
```

---

### 5. Profile & Theme System

**File:** `hooks/useProfile.ts`

**Profile Fields:**
- `artist_name`, `mission_statement`, `email`
- `logo_url`, `logo_use_background`
- `primary_color`, `accent_color`, `brand_color`
- `font_family`

**Theme Application:**
- **File:** `utils/themeBackground.ts` (copied from Zeyoda)
- **Priority:** Logo background (if `logo_use_background === true`) → Primary color fallback
- **Live Preview:** Panels use `onPreviewChange` to update background immediately

**Zeyoda Pattern:**
- Uses `applyLogoBackground()` function
- Applies CSS variables (`--primary-color`, `--accent-color`)
- Preloads logo image before applying
- Cache-busting for logo URLs

---

## Current Implementation Status

### ✅ Working

1. **Authentication:** Supabase Auth via `AuthPanel`
2. **Chat Flow:** EmeraldChat handles question/answer flow
3. **Carousel:** OrbitPeekCarousel displays answer cards
4. **Progress Calculation:** `useCurriculumProgress` calculates percentages
5. **Token Rendering:** Tokens orbit correctly around carousel
6. **Profile Management:** `useProfile` loads/saves profile data
7. **Logo Upload API:** `/api/uploadLogo` handles file uploads

### ⚠️ Issues

1. **Panel Steps Not Saving:** `logo_uploaded`, `colors_set`, `font_set` keys not appearing in database
   - **Impact:** Progress stays at 0% even after completing panels
   - **Location:** `LogoPanel.tsx` Line 90, `ColorPanel.tsx` Line 58, `FontPanel.tsx` Line 72
   - **Fix Needed:** Verify `upsert` operations are succeeding

2. **Token Fill Not Visible:** Fill div renders but progress is 0, so no fill shows
   - **Root Cause:** Progress calculation returns 0 because panel keys are missing
   - **Fix:** Once panel keys save correctly, fill should work

3. **Tokens Not Visible on Login:** Tokens only render when `carouselItems.length >= 1`
   - **Impact:** No tokens shown until first question card appears
   - **Location:** `app/page.tsx` Line 267

---

## How to Reference Zeyoda for Proof

### Zeyoda Repository
**URL:** `https://github.com/nodrinksonthepiano/zeyoda-nextjs-52925/tree/feature/coin-colors-live-update`

### Key Files to Reference

1. **ThemeOrbitRenderer.tsx**
   - **Path:** `app/components/ThemeOrbitRenderer.tsx`
   - **Purpose:** Token orbiting logic
   - **What to check:**
     - `ORBIT_SPEED` constant value
     - `useEffect` dependency array
     - Token positioning (viewport vs wrapper coordinates)
     - Animation loop structure

2. **ProfileEditPanel.tsx**
   - **Path:** `app/components/ProfileEditPanel.tsx`
   - **Purpose:** Logo upload and color selection
   - **What to check:**
     - Logo upload flow (lines 148-206)
     - Color preset definitions (lines 12-21)
     - Color selection UI (lines 441-523)
     - Logo background checkbox (lines 525-726)
     - How `upsert` saves to database

3. **themeBackground.ts**
   - **Path:** `app/utils/themeBackground.ts`
   - **Purpose:** Background application logic
   - **What to check:**
     - `applyArtistBackground()` function
     - Logo vs primary color precedence
     - Cache-busting implementation
     - CSS variable setting

### How to Access Zeyoda Code

**Method 1: Direct GitHub URL**
```
https://raw.githubusercontent.com/nodrinksonthepiano/zeyoda-nextjs-52925/feature/coin-colors-live-update/app/components/ThemeOrbitRenderer.tsx
```

**Method 2: Terminal curl**
```bash
curl -s https://raw.githubusercontent.com/nodrinksonthepiano/zeyoda-nextjs-52925/feature/coin-colors-live-update/app/components/ProfileEditPanel.tsx | head -200
```

**Method 3: Browser Navigation**
- Navigate to: `https://github.com/nodrinksonthepiano/zeyoda-nextjs-52925/tree/feature/coin-colors-live-update`
- Browse to file: `app/components/ProfileEditPanel.tsx`
- View raw: Click "Raw" button

---

## Next Steps: Add Color Options & Logo/Background Upload

### Current State

**LogoPanel** (`components/LogoPanel.tsx`):
- ✅ File upload UI exists
- ✅ Upload API endpoint exists (`/api/uploadLogo`)
- ✅ Background checkbox exists
- ✅ Saves to `profiles.logo_url` and `profiles.logo_use_background`
- ⚠️ Saves to `curriculum_answers` with `question_key: 'logo_uploaded'` but may not be working

**ColorPanel** (`components/ColorPanel.tsx`):
- ✅ Color preset buttons exist (8 presets: gold, silver, bronze, emerald, sapphire, ruby, black, white)
- ✅ Color picker inputs exist
- ✅ Live preview via `onPreviewChange`
- ✅ Saves to `profiles.primary_color` and `profiles.accent_color`
- ⚠️ Saves to `curriculum_answers` with `question_key: 'colors_set'` but may not be working

### What Needs to Be Done

**1. Fix Panel Save Operations**

**Issue:** Panel `upsert` operations may be failing silently

**Files to check:**
- `components/LogoPanel.tsx` Lines 86-96
- `components/ColorPanel.tsx` Lines 52-65
- `components/FontPanel.tsx` Lines 66-79

**Zeyoda Reference:** Check how Zeyoda's `ProfileEditPanel.tsx` saves panel completions

**Action:**
- Add error handling/logging to `upsert` operations
- Verify `user.id` is available when panels save
- Check if `upsert` needs different syntax or error handling

---

**2. Verify Panel Trigger Flow**

**Current Flow:**
1. EmeraldChat detects `step.triggersPanel` → calls `onTriggerPanel('logo')`
2. `app/page.tsx` sets `activePanel = 'logo'` → renders `<LogoPanel />`
3. User uploads logo → `handleSave()` called
4. `handleSave()` calls `onSave({ logo_url, logo_use_background })` → updates profile
5. `handleSave()` calls `supabase.from('curriculum_answers').upsert({ question_key: 'logo_uploaded' })`
6. `handleSave()` dispatches `panelComplete` event → EmeraldChat advances

**Potential Issues:**
- `upsert` may need `user_id` check
- `upsert` may need error handling
- Panel may close before save completes

**Zeyoda Reference:** Check how Zeyoda handles panel completion saves

---

**3. Ensure Live Preview Works**

**Current Implementation:**
- LogoPanel: `onPreviewChange(previewUrl, useBackground)` → updates `previewOverrides`
- ColorPanel: `onPreviewChange({ primary_color, accent_color })` → updates `previewOverrides`
- `mergedProfile = { ...profile, ...previewOverrides }` → used for theme
- `applyLogoBackground(mergedProfile, previewUrl, previewUseBg)` → applies immediately

**Zeyoda Pattern:**
- Uses `previewConfig` state for live updates
- Dispatches `artistConfigPreview` event for live coin color updates
- Clears preview on save or artist switch

**Action:**
- Verify preview system matches Zeyoda's pattern
- Ensure background updates immediately when colors/logo change

---

## Key Files Reference

### Main Orchestration
- **`app/page.tsx`** (455 lines): Main page, orchestrates all components, manages panel state

### Curriculum & Progress
- **`lib/curriculum.ts`** (200 lines): Curriculum definition, all steps/phases
- **`hooks/useCurriculumProgress.ts`** (141 lines): Calculates progress percentages
- **`hooks/useCarouselItems.ts`** (182 lines): Generates carousel cards from answers

### Chat & Flow
- **`components/EmeraldChat.tsx`** (626 lines): Chat interface, handles question flow, triggers panels

### Panels
- **`components/LogoPanel.tsx`** (261 lines): Logo upload panel
- **`components/ColorPanel.tsx`** (189 lines): Color selection panel
- **`components/FontPanel.tsx`** (171 lines): Font selection panel

### Visual Components
- **`components/ArtisTalksOrbitRenderer.tsx`** (505 lines): Orbiting tokens
- **`components/OrbitPeekCarousel.tsx`** (1388 lines): Content carousel
- **`components/OvalGlowBackdrop.tsx`** (185 lines): Halo effect

### Profile & Theme
- **`hooks/useProfile.ts`** (125 lines): Profile data management
- **`utils/themeBackground.ts`** (137 lines): Background application (Zeyoda pattern)

### API
- **`app/api/uploadLogo/route.ts`** (126 lines): Logo upload endpoint

---

## Database Operations

### Saving Answers
**Location:** `components/EmeraldChat.tsx` Line 402
```typescript
await supabase.from('curriculum_answers').insert({
  user_id: user.id,
  question_key: currentStep.key,  // e.g., 'artist_name', 'gift_to_world'
  answer_data: { text: answer },
  project_id: null
})
```

### Saving Panel Completions
**Location:** `components/LogoPanel.tsx` Line 90, `ColorPanel.tsx` Line 58
```typescript
await supabase.from('curriculum_answers').upsert({
  user_id: user.id,
  question_key: 'logo_uploaded',  // or 'colors_set', 'font_set'
  answer_data: { text: 'Logo uploaded', url: logoPreview },
  project_id: null
})
```

**Issue:** These `upsert` operations may be failing silently. Need to add error handling.

---

## Zeyoda Comparison Checklist

When implementing features, verify against Zeyoda:

- [ ] **ORBIT_SPEED:** Should be `0.3` (not `0.15`)
- [ ] **Token Positioning:** Viewport coordinates (`position: fixed`, `left`/`top` from `getBoundingClientRect()`)
- [ ] **Panel Saves:** Check how Zeyoda saves panel completions to database
- [ ] **Live Preview:** Check Zeyoda's preview event system (`artistConfigPreview`)
- [ ] **Background Application:** Use `applyLogoBackground()` pattern exactly
- [ ] **Color Presets:** Match Zeyoda's preset definitions exactly
- [ ] **Logo Upload:** Match Zeyoda's upload flow (file validation, storage path, URL generation)

---

## Current Known Issues

1. **Panel keys not saving:** `logo_uploaded`, `colors_set`, `font_set` not in database
2. **Progress stays at 0%:** Because panel keys are missing
3. **Tokens not visible on login:** Conditional rendering requires carousel items

---

## Testing Checklist

- [ ] Logo uploads successfully to Supabase Storage
- [ ] Logo URL saves to `profiles.logo_url`
- [ ] `logo_uploaded` key saves to `curriculum_answers`
- [ ] Color selection saves to `profiles.primary_color` and `profiles.accent_color`
- [ ] `colors_set` key saves to `curriculum_answers`
- [ ] Font selection saves to `profiles.font_family`
- [ ] `font_set` key saves to `curriculum_answers`
- [ ] Progress percentages update when panel keys are saved
- [ ] Token fills become visible when progress > 0
- [ ] Background updates live when colors/logo change
- [ ] Panel completion advances to next step

---

## Quick Start for New Chat

1. **Read this file:** `PROJECT_BREAKDOWN.md`
2. **Check current state:** Review `components/LogoPanel.tsx` and `components/ColorPanel.tsx`
3. **Reference Zeyoda:** Use URLs above to access Zeyoda's `ProfileEditPanel.tsx`
4. **Verify database:** Check `curriculum_answers` table for panel keys
5. **Fix panel saves:** Ensure `upsert` operations succeed
6. **Test progress:** Verify progress percentages update correctly
7. **Verify fill:** Check token fills become visible

---

## Important Notes

- **Always use Zeyoda as reference:** User wants exact replication, not new solutions
- **Prove with facts:** When referencing Zeyoda, use actual code/line numbers
- **Panel saves are critical:** Without panel keys in database, progress will always be 0%
- **Viewport coordinates:** Tokens use viewport positioning (matches Zeyoda)
- **ORBIT_SPEED:** Must be `0.3` (matches Zeyoda exactly)

---

**Last Updated:** Based on current codebase state as of this session

