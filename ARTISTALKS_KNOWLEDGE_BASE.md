# ArtisTalks Knowledge Base - Complete System Breakdown

## Table of Contents
1. [Product Boundary & Memory Routing](#product-boundary--memory-routing)
2. [System Architecture Overview](#system-architecture-overview)
3. [Database Schema & Structure](#database-schema--structure)
4. [Curriculum Flow System](#curriculum-flow-system)
5. [How to Add/Reorder Questions](#how-to-addreorder-questions)
6. [Inline Picker System](#inline-picker-system)
7. [Card Generation Logic](#card-generation-logic)
8. [Live Preview System](#live-preview-system)
9. [Critical Patterns & Gotchas](#critical-patterns--gotchas)
10. [Known Issues & Fixes Needed](#known-issues--fixes-needed)
11. [Upstream: Zeyoda](#upstream-zeyoda-foundation)

---

## Product Boundary & Memory Routing

Read `ECOSYSTEM_MEMORY_MAP.md` before routing mixed ArtisTalks / Artistocks / Zeyoda concepts.

- **ArtisTalks teaches.**
- **Artistocks launches.**
- **Zeyoda protects.**
- **GOSHBOT routes memory.**

Public ArtisTalks is legacy music-business coaching and release preparation.

In this file, "orbit tokens" and "phase tokens" refer to ArtisTalks UI progress tokens, not Artistocks commerce tokens.

Public ArtisTalks questions should use legacy music-business language: identity, brand, visual world, project, rights awareness, publishing notes, marketing, budget/accounting basics, launch plan, feedback, and legacy. Ownership/web3/Artistocks concepts belong to Future Bridge unless intentionally activated.

---

## System Architecture Overview

### Core Components

**`app/page.tsx`** - Main page component
- Manages user authentication state
- Renders carousel, orbit tokens, halo, and EmeraldChat
- Handles profile updates and preview overrides
- Listens for color/logo preview events

**`components/EmeraldChat.tsx`** - Chat interface component
- Manages curriculum flow and step progression
- Renders inline pickers (colors, logo, font) within chat
- Handles form submission and curriculum advancement
- Tracks answered questions via `answeredKeys` Set
- Uses `findFirstUnansweredStep` to determine next question

**`lib/curriculum.ts`** - Curriculum definition
- Defines all steps with `StepId` type
- Each step has: `id`, `question`, `nextStep`, `key`, `placeholder`, `triggersPanel?`, `phase`
- `key` maps to `curriculum_answers.question_key` in database
- `nextStep` defines the flow order

**`hooks/useCarouselItems.ts`** - Card generation hook
- Queries `curriculum_answers` table for user's answers
- Creates cards from answered questions
- Adds current question card if not answered yet
- Updates live as user types (debounced)

**`hooks/useCurriculumProgress.ts`** - Progress calculation
- Calculates completion percentage per phase
- Used for token fill animations

---

## Database Schema & Structure

### `profiles` Table
Stores user profile data (branding, colors, fonts, logo)

**Key Columns:**
- `id` (uuid, primary key)
- `user_id` (uuid, foreign key to auth.users)
- `artist_name` (text)
- `primary_color` (text, hex color)
- `accent_color` (text, hex color)
- `brand_color` (text, hex color) - usually same as primary_color
- `font_family` (text, CSS font-family string)
- `logo_url` (text, URL to uploaded logo)
- `logo_use_background` (boolean, whether to use logo as background)
- `mission_statement` (text, gift to the world)
- `created_at`, `updated_at` (timestamps)

**How it works:**
- Updated immediately when user selects colors/fonts/logo (live preview)
- Changes persist automatically via `onProfileUpdate` callback
- Used for live preview and theme application

---

### `curriculum_answers` Table
Stores answers to curriculum questions (one row per answered question)

**Key Columns:**
- `id` (uuid, primary key)
- `user_id` (uuid, foreign key to auth.users)
- `question_key` (text) - Maps to `CURRICULUM[stepId].key`
- `answer_data` (jsonb) - Flexible JSON structure:
  ```json
  {
    "text": "Answer text",
    "primary": "#FFD700",  // For colors
    "accent": "#B8860B",   // For colors
    "font": "Bungee, cursive",  // For font
    "url": "https://...",   // For logo/asset
    "imageUrl": "...",      // For media
    "videoUrl": "...",
    "audioUrl": "..."
  }
  ```
- `project_id` (uuid, nullable) - Links to project if applicable
- `created_at` (timestamp) - Used for carousel ordering

**Critical Behavior:**
- **One row per question** - `upsert` with `user_id + question_key` ensures no duplicates
- **Cards are created from this table** - Each row = one card in carousel
- **Order matters** - Cards appear in `created_at` order (oldest first)
- **Only saved when user clicks Send** - Not on every selection (prevents duplicate cards)

**Example Rows:**
```
user_id: abc123, question_key: 'artist_name', answer_data: {"text": "JaiTea"}
user_id: abc123, question_key: 'colors_set', answer_data: {"text": "Colors set", "primary": "#FFD700", "accent": "#B8860B"}
user_id: abc123, question_key: 'logo_uploaded', answer_data: {"text": "Logo uploaded", "url": "https://..."}
```

---

## Curriculum Flow System

### Step Definition Structure

Each step in `lib/curriculum.ts` follows this pattern (interface at `lib/curriculum.ts:54-63`):

```typescript
STEP_ID: {
  id: 'STEP_ID',                    // Unique identifier
  question: "Question text",        // Shown to user
  nextStep: 'NEXT_STEP_ID',        // Where to go after this step
  key: 'question_key',             // Database key (curriculum_answers.question_key)
  placeholder?: "Placeholder...",  // Input placeholder (optional)
  triggersPanel?: 'colors' | 'asset',  // Inline picker type (optional)
  input?: StepInput,               // Typed input descriptor (optional)
  phase?: 'pre' | 'prod' | 'post' | 'legacy'  // Phase for progress tracking
}
```

`StepInput` (`lib/curriculum.ts:42-45`) is one of:

```typescript
| { kind: 'text'; placeholder?: string }
| { kind: 'select'; options: { label: string; value: PillarChoice }[] }
| { kind: 'panel'; panel: 'colors' | 'asset' }
```

**Only two panel types exist:** `colors` and `asset`. There is no separate `logo` or `font` panel type in the step schema — logo and font are handled inside the inline colors picker, which saves the `logo_uploaded` and `font_set` answer keys on Send (see `components/EmeraldChat.tsx:602-641`). The standalone `LogoPanel` and `FontPanel` components still exist and are reachable via `activePanel`, but the main V2 flow does not route through them.

### Current Flow Order (Curriculum V2 spine)

This is the flow the code actually implements. Verified against `lib/curriculum.ts` on 2026-08-01.

| # | Step ID | Key | `phase` tag |
|---|---------|-----|-------------|
| 1 | `INIT` | `artist_name` | `pre` |
| 2 | `COLORS_PANEL` (panel: colors) | `colors_set` | `pre` |
| 3 | `GIFT_PRESENCE` | `gift_to_world` | `pre` |
| 4 | `KNOWN_FOR_LEGACY` | `known_for_legacy` | `legacy` ⚠️ |
| 5 | `KNOWN_FOR_EXPRESSION` | `known_for_expression` | `pre` |
| 6 | `TARGET_REACH` | `target_reach` | `post` ⚠️ |
| 7 | `GENRE_ASSOCIATIONS` | `genre_associations` | `pre` |
| 8 | `BUSINESS_OFFERING` | `business_type_products_services` | `pre` |
| 9 | `CURRENT_FOCUS_PILLAR` (select) | `current_focus_pillar` | `pre` |
| 10 | `FAN_CONNECTION` | `fan_connection` | `post` |
| 11 | `FAN_STRUGGLES` | `fan_struggles` | `prod` |
| 12 | `FAN_DREAMS` | `fan_dreams` | `prod` |
| 13 | `AUDIENCE_AVATAR` | `audience_avatar` | `post` |
| 14 | `COLLABORATORS` | `collaborators_wishlist` | `prod` |
| 15 | `OPEN_FOR_SUPPORT` | `open_for_support_targets` | `post` |
| 16 | `PLAYLIST_CONTEXT` | `playlist_context` | `post` |
| 17 | `SPONSOR_BRAND_ALLIES` | `sponsor_brand_allies` | `post` |
| 18 | `INFLUENCERS_COMMUNITIES` | `influencers_communities` | `post` |
| 19 | `WARDROBE_IMAGE` | `wardrobe_public_image` | `pre` |
| 20 | `SIGNATURE_WORLD` | `signature_world_elements` | `post` |
| 21 | `GRATITUDE_MOMENTUM` | `gratitude_momentum` | `legacy` |
| 22 | `COMPLETE` | `completed` | `legacy` (end state) |

Steps 1–8 are the **free taste**: 8 steps, 7 questions (step 2 is a panel, not a question). The living affirmation completes at step 8, followed by the email save/apply gate. See `STEP_PLAN.md` §5.

⚠️ **Known issue — scrambled phase tags.** Steps 4 and 6 jump the orbit tokens out of the `pre` lane and back for a single step, which makes the token fill look random during the free taste. A fix is documented as Sprint 4 in `STEP_PLAN.md` and has **not** been applied. Also flagged in `ARTISTALKS_EXPERIENCE_ARCHITECTURE.md` §1.4.

⚠️ **Known issue — the journey fork is collected but never used.** `CURRENT_FOCUS_PILLAR` (step 9) asks the branching question, but its `nextStep` is hardcoded to `FAN_CONNECTION` at `lib/curriculum.ts:164`. Every artist gets the identical linear march. Choose-your-own-journey is not broken — it has not been built yet. See `STEP_PLAN.md` Sprint 10 and `ARTISTALKS_EXPERIENCE_ARCHITECTURE.md` §1.1.

### Compatibility stubs

`lib/curriculum.ts` also defines 13 legacy step IDs (`MISSION_GIFT`, `PRE_COMPLETE`, `PROJECT_NAME`, `PROJECT_DESCRIPTION`, `ASSET_UPLOAD_PANEL`, `PROD_COMPLETE`, `PROMO_STRATEGY`, `TARGET_AUDIENCE`, `LAUNCH_DATE`, `POST_COMPLETE`, `GRATITUDE`, `LEGACY_VISION`, `FEEDBACK_LOOP`) at lines 278–379. These exist so older saved cards and events still resolve. **The main V2 flow does not route through them.** An earlier version of this document described that older flow as current; it was stale and has been corrected.

---

## How to Add/Reorder Questions

### Adding a New Question

**Step 1: Add StepId to type**
```typescript
// In lib/curriculum.ts, add to StepId type:
export type StepId = 
  | 'INIT'
  | 'MY_NEW_STEP'  // ← Add here
  | 'COMPLETE'
```

**Step 2: Define the step**
```typescript
// In lib/curriculum.ts CURRICULUM object:
MY_NEW_STEP: {
  id: 'MY_NEW_STEP',
  question: "What is your favorite color?",
  nextStep: 'NEXT_STEP_ID',  // Where to go after
  key: 'favorite_color',      // Database key (must be unique)
  placeholder: "Enter color...",
  phase: 'pre'  // Which phase this belongs to
}
```

**Step 3: Insert into flow**
Update the `nextStep` of the step that should come before it:
```typescript
PREVIOUS_STEP: {
  // ...
  nextStep: 'MY_NEW_STEP'  // Changed from 'OLD_NEXT_STEP'
}
```

**Step 4: Update next step's nextStep**
```typescript
MY_NEW_STEP: {
  // ...
  nextStep: 'OLD_NEXT_STEP'  // Continue the flow
}
```

**Step 5: Handle in EmeraldChat (if needed)**
- If it's a text question: No changes needed (handled automatically)
- If it needs an inline picker: Add conditional render in EmeraldChat.tsx (see Inline Picker System below)

---

### Reordering Questions

**Example: Move LOGO_PANEL before FONT_PANEL**

**Current order:**
```
FONT_PANEL → LOGO_PANEL → PRE_COMPLETE
```

**New order:**
```
LOGO_PANEL → FONT_PANEL → PRE_COMPLETE
```

**Changes needed:**

1. Update `FONT_PANEL.nextStep`:
```typescript
FONT_PANEL: {
  // ...
  nextStep: 'PRE_COMPLETE'  // Changed from 'LOGO_PANEL'
}
```

2. Update `LOGO_PANEL.nextStep`:
```typescript
LOGO_PANEL: {
  // ...
  nextStep: 'FONT_PANEL'  // Changed from 'PRE_COMPLETE'
}
```

3. Update the step that comes before `FONT_PANEL`:
```typescript
MISSION_GIFT: {
  // ...
  nextStep: 'LOGO_PANEL'  // Changed from 'FONT_PANEL'
}
```

**That's it!** The `findFirstUnansweredStep` function will automatically follow the new order.

---

## Inline Picker System

### How It Works

When a step has `triggersPanel: 'colors' | 'logo' | 'font' | 'asset'`, EmeraldChat renders an inline picker component instead of a text input.

**Components:**
- `InlineColorPicker.tsx` - For color selection
- `InlineLogoPicker.tsx` - For logo upload
- `InlineFontPicker.tsx` - For font selection

**Rendering Logic (EmeraldChat.tsx lines 523-616):**
```typescript
{currentStep.triggersPanel === 'colors' ? (
  <InlineColorPicker ... />
) : currentStep.triggersPanel === 'logo' ? (
  <InlineLogoPicker ... />
) : currentStep.triggersPanel === 'font' ? (
  <InlineFontPicker ... />
) : (
  <h1>{currentStep.question}</h1>  // Normal text question
)}
```

**Key Behaviors:**
1. **Input field is hidden** when picker is active (line 740)
2. **Send button is enabled** even without input (line 754)
3. **Chat height expands** to fit picker (line 513)
4. **Live preview** updates immediately on selection
5. **Profile updates** immediately (autosave)
6. **curriculum_answers saved** only when Send is clicked (line 406)

---

## Card Generation Logic

### How Cards Are Created

**File:** `hooks/useCarouselItems.ts`

**Process:**
1. Query `curriculum_answers` for user's answers (ordered by `created_at` ASC)
2. Map each answer to a `CarouselItem`:
   - Extract `answer_data.text` for card title
   - Extract `answer_data.url/imageUrl/videoUrl/audioUrl` for media
   - Format title as: `"Question Key: Answer"` (e.g., "Artist Name: JaiTea")
3. Add current question card if not answered yet (shows live typing)
4. Return array of items

**Card Title Format:**
- Answered: `"Artist Name: JaiTea"`
- Typing: `"Artist Name: Jai..."` (updates live)
- Empty: `"Artist Name: "`

**Critical:**
- **One card per `question_key`** - If duplicate rows exist, multiple cards appear
- **Order is `created_at` ASC** - Oldest answer = first card
- **Current question card** appears at end if not answered

---

## Live Preview System

### How Live Updates Work

**Pattern:** Zeyoda-based event-driven architecture

**Components:**

1. **InlineColorPicker** - Updates primary/accent colors
   - Updates CSS variables (`--primary-color`, `--accent-color`)
   - Updates body background color directly
   - Calls `applyLogoBackground()` for CSS vars
   - Dispatches `profilePreview` event for token updates
   - Dispatches `primaryColorChange` event for halo updates
   - Updates profile immediately (autosave)

2. **InlineLogoPicker** - Updates logo/background
   - Updates logo preview state
   - Calls `applyLogoBackground()` with logo URL
   - Dispatches `logoPreviewChange` event for page.tsx
   - Updates profile immediately (autosave)

3. **InlineFontPicker** - Updates font family
   - Updates `document.body.style.fontFamily`
   - Updates `h1` element font family
   - Calls `applyLogoBackground()` for CSS vars
   - Updates profile immediately (autosave)

**Event Listeners:**

**`app/page.tsx`:**
- Listens to `profilePreview` → Updates `previewOverrides` → Updates `mergedProfile` → Updates halo
- Listens to `logoPreviewChange` → Updates `previewOverrides` → Prevents logo reapplication

**`components/ArtisTalksOrbitRenderer.tsx`:**
- Listens to `profilePreview` → Updates `previewConfig` → Updates token colors live
- Listens to `profilePreviewClear` → Clears preview → Reverts to saved colors

**`utils/themeBackground.ts`:**
- `applyLogoBackground()` function applies background with precedence:
  1. Logo URL (if `logo_use_background === true`)
  2. Primary color (fallback)
- Updates CSS variables (`--primary-color`, `--accent-color`, etc.)
- Updates body background styles

---

## Critical Patterns & Gotchas

### 1. Primary Color vs Accent Color Separation

**CRITICAL:** Primary and accent colors are handled separately!

**Primary Color (`updatePrimaryColor`):**
- Updates: Background, halo, tokens, slides
- Does NOT update: Text color, fonts
- Dispatches: `primaryColorChange` (halo), `profilePreview` (tokens)

**Accent Color (`updateAccentColor`):**
- Updates: Text color, fonts, CSS variables
- Does NOT update: Background, halo, tokens, slides
- Only updates: `--accent-color` CSS var, header text color

**Why:** Matches Zeyoda's pattern - background color should never automatically set font color.

---

### 2. Logo Background Override Logic

**Problem:** When user sets primary color, logo should be cleared. When user unchecks logo checkbox, should revert to primary color.

**Solution:**
- Primary color changes: Pass `null, false` to `applyLogoBackground()` to override logo
- Logo checkbox unchecked: Pass `null` for logo URL to force primary color branch
- `page.tsx` useEffect: Checks `previewOverrides` to prevent reapplying logo

**Key Code:**
```typescript
// In InlineColorPicker - when primary color changes:
applyLogoBackground(previewConfig, null, false)  // Override logo

// In InlineLogoPicker - when checkbox unchecked:
const logoUrlToUse = checked ? currentLogoUrl : null  // Force primary color
applyLogoBackground(updatedProfile, logoUrlToUse, checked)
```

---

### 3. Curriculum Answers Save Timing

**CRITICAL:** Only save to `curriculum_answers` when Send is clicked, NOT on every selection!

**Wrong Pattern (creates duplicate cards):**
```typescript
onColorChange={async (updates) => {
  await onProfileUpdate(updates)  // ✅ Update profile
  await supabase.from('curriculum_answers').upsert(...)  // ❌ Creates card immediately
}}
```

**Correct Pattern:**
```typescript
// In picker onChange:
onColorChange={async (updates) => {
  setCurrentPickerState({ colors: updates })  // Track state
  await onProfileUpdate(updates)  // Update profile only
}}

// In handleSubmit (when Send clicked):
if (currentStep.triggersPanel === 'colors') {
  await supabase.from('curriculum_answers').upsert({
    question_key: currentStep.key,
    answer_data: { ...currentPickerState.colors }
  })
}
```

---

### 4. Step Advancement Logic

**File:** `components/EmeraldChat.tsx`

**`findFirstUnansweredStep()` function:**
- Starts from `INIT` (or provided start point)
- Follows `nextStep` chain
- Checks if `step.key` exists in `answeredKeys` Set
- Returns first step where `answeredKeys.has(step.key) === false`
- Skips steps that trigger panels? **NO** - Panel steps are now part of flow

**`handleSubmit()` function:**
- If picker step: Save to `curriculum_answers`, mark as answered, advance
- If text step: Save answer, mark as answered, advance
- Uses `currentStep.nextStep` to determine next step

**Initialization:**
- On mount: Sets `currentStepId` to `INIT`
- After `answeredKeys` loads: Calls `findFirstUnansweredStep()` to jump to first unanswered
- Uses `hasInitializedRef` to prevent overriding manual advancement

---

### 5. Logo Removal Detection

**Problem:** If user uploads logo then removes it before clicking Send, should not save "Logo uploaded".

**Solution:** Track current picker state in `currentPickerState`:
```typescript
const [currentPickerState, setCurrentPickerState] = useState<{
  logo?: { logo_url?: string | null }
}>({})

// In InlineLogoPicker onChange:
setCurrentPickerState(prev => ({
  ...prev,
  logo: { logo_url: updates.logo_url }  // Captures null when removed
}))

// In handleSubmit:
if (currentPickerState.logo?.logo_url === null) {
  return  // Don't save, don't advance
}
```

---

## Known Issues & Fixes Needed

### Issue 1: PRE_COMPLETE shows even if logo not uploaded

**Problem:** `PRE_COMPLETE` step advances even if user hasn't uploaded a logo (or removed it).

**Current Behavior:**
- `LOGO_PANEL` → `PRE_COMPLETE` (always advances)
- No check for actual logo existence

**Fix Needed:**
In `handleSubmit()` for `LOGO_PANEL` step:
```typescript
if (currentStep.triggersPanel === 'logo') {
  const logoUrl = currentPickerState.logo?.logo_url !== undefined 
    ? currentPickerState.logo.logo_url 
    : profile?.logo_url
  
  if (!logoUrl) {
    // Logo not uploaded - don't advance, show error or keep on LOGO_PANEL
    alert('Please upload a logo before continuing')
    return
  }
  
  // Save and advance...
}
```

**Or:** Make `PRE_COMPLETE` conditional:
```typescript
// In findFirstUnansweredStep or handleSubmit:
// Check if logo exists before allowing PRE_COMPLETE
if (currentStepId === 'PRE_COMPLETE') {
  const hasLogo = profile?.logo_url || currentPickerState.logo?.logo_url
  if (!hasLogo) {
    // Skip PRE_COMPLETE, go back to LOGO_PANEL
    return 'LOGO_PANEL'
  }
}
```

---

### Issue 2: Multiple cards from duplicate saves

**Fixed:** Moved `curriculum_answers` save from picker `onChange` to `handleSubmit`.

**Verification:** Check that only one card appears per question.

---

### Issue 3: Logo persists after primary color change

**Fixed:** Pass `null, false` to `applyLogoBackground()` when primary color changes, and update `previewOverrides` to clear logo.

**Verification:** Set primary color → logo should disappear immediately.

---

## File Reference Guide

### Core Files

**`lib/curriculum.ts`**
- Defines all curriculum steps
- **Edit this to add/reorder questions**

**`components/EmeraldChat.tsx`**
- Manages chat flow and step progression
- Renders inline pickers
- Handles form submission
- **Edit this to add new picker types or modify submission logic**

**`hooks/useCarouselItems.ts`**
- Generates cards from `curriculum_answers`
- **Edit this to change card format or add filtering**

**`hooks/useCurriculumProgress.ts`**
- Calculates progress percentages
- **Edit this to change progress calculation logic**

### Picker Components

**`components/InlineColorPicker.tsx`**
- Color selection UI
- Live preview updates
- Autosaves to profile

**`components/InlineLogoPicker.tsx`**
- Logo upload UI
- Logo removal handling
- Background checkbox

**`components/InlineFontPicker.tsx`**
- Font selection UI
- Preset fonts + searchable dropdown

### Utility Files

**`utils/themeBackground.ts`**
- `applyLogoBackground()` function
- Applies background with logo/primary color precedence
- Updates CSS variables

**`utils/supabase/client.ts`**
- Supabase client creation
- Used for all database queries

---

## Database Queries Reference

### Get User's Answers
```typescript
const { data: answers } = await supabase
  .from('curriculum_answers')
  .select('question_key, answer_data, created_at')
  .eq('user_id', userId)
  .order('created_at', { ascending: true })
```

### Save Answer
```typescript
await supabase.from('curriculum_answers').upsert({
  user_id: user.id,
  question_key: 'artist_name',  // Must match CURRICULUM[stepId].key
  answer_data: { text: 'JaiTea' },  // Flexible JSON structure
  project_id: null
})
```

### Update Profile
```typescript
await supabase
  .from('profiles')
  .update({ primary_color: '#FFD700' })
  .eq('user_id', user.id)
```

### Check if Question Answered
```typescript
const { data: answer } = await supabase
  .from('curriculum_answers')
  .select('id')
  .eq('user_id', user.id)
  .eq('question_key', 'artist_name')
  .single()

const isAnswered = !!answer
```

---

## Testing Checklist

When adding/modifying questions:

- [ ] Step appears in correct order
- [ ] Question text displays correctly
- [ ] Input/picker renders correctly
- [ ] Answer saves to `curriculum_answers` with correct `question_key`
- [ ] Card appears in carousel after answering
- [ ] Step marked as answered in `answeredKeys`
- [ ] Next step advances correctly
- [ ] Progress percentage updates
- [ ] Token fill animation updates

When modifying pickers:

- [ ] Live preview works immediately
- [ ] Profile updates immediately
- [ ] Background/colors/fonts update correctly
- [ ] No duplicate cards created
- [ ] Send button works
- [ ] Step advances on Send
- [ ] Removal/clearing works correctly

---

## Upstream: Zeyoda (Foundation)

ArtisTalks is built on **Zeyoda** patterns. Zeyoda provides the foundation for theming, events, and UI conventions.

Zeyoda references here are shared ecosystem patterns for UI, theming, events, and implementation lessons unless routed elsewhere by `ECOSYSTEM_MEMORY_MAP.md`.

**Zeyoda Repository:** `https://github.com/nodrinksonthepiano/zeyoda-nextjs-52925`  
**Branch:** `feat/secure-middleware-whitelist-clean`  
**Knowledge Base:** `ZEYODA_KNOWLEDGE_BASE.md` (in Zeyoda repo)

### Integration Points

| Concern | Zeyoda Source | ArtisTalks Usage |
|---------|---------------|------------------|
| Background/theme | `app/utils/themeBackground.ts` | `applyLogoBackground()` — logo/primary color precedence |
| Event-driven preview | `profilePreview`, `primaryColorChange`, `logoPreviewChange` | Token colors, halo, live preview |
| Panel UI patterns | `ProfileEditPanel.tsx`, `ThemeOrbitRenderer.tsx` | InlineColorPicker, InlineLogoPicker, ArtisTalksOrbitRenderer |
| CSS variables | `--primary-color`, `--accent-color` | Same pattern for theming |

### Key Zeyoda Files to Reference

- `app/utils/themeBackground.ts` — `applyLogoBackground()`
- `app/components/ProfileEditPanel.tsx` — Panel UI and color/font/logo handling
- `app/components/ThemeOrbitRenderer.tsx` — Token color updates via events

### Patterns Inherited

- Event-driven preview system (`profilePreview`, `profilePreviewClear`)
- Immediate CSS variable updates
- `applyLogoBackground(profile, logoUrl?, useBackground?)` — background precedence logic
- Primary vs accent color separation (background vs text)

---

## Summary

**To add a question:**
1. Add `StepId` to type
2. Define step in `CURRICULUM` object
3. Update `nextStep` chain
4. If picker needed: Add conditional render in EmeraldChat

**To reorder questions:**
1. Update `nextStep` properties in `CURRICULUM`
2. Flow automatically follows new order

**Database:**
- `profiles` = User branding data (updated immediately)
- `curriculum_answers` = Question answers (saved on Send click)
- One row per question (upsert prevents duplicates)

**Live Preview:**
- Profile updates immediately (autosave)
- CSS variables update immediately
- Events dispatch for token/halo updates
- `curriculum_answers` saved only on Send click

**Critical Fix Needed:**
- PRE_COMPLETE should check if logo exists before showing




