# ArtisTalks Knowledge Base - Complete System Breakdown

## Table of Contents
1. [System Architecture Overview](#system-architecture-overview)
2. [Database Schema & Structure](#database-schema--structure)
3. [Curriculum Flow System](#curriculum-flow-system)
4. [How to Add/Reorder Questions](#how-to-addreorder-questions)
5. [Inline Picker System](#inline-picker-system)
6. [Card Generation Logic](#card-generation-logic)
7. [Live Preview System](#live-preview-system)
8. [Critical Patterns & Gotchas](#critical-patterns--gotchas)
9. [Known Issues & Fixes Needed](#known-issues--fixes-needed)

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

Each step in `lib/curriculum.ts` follows this pattern:

```typescript
STEP_ID: {
  id: 'STEP_ID',                    // Unique identifier
  question: "Question text",        // Shown to user
  nextStep: 'NEXT_STEP_ID',        // Where to go after this step
  key: 'question_key',             // Database key (curriculum_answers.question_key)
  placeholder?: "Placeholder...",  // Input placeholder (optional)
  triggersPanel?: 'colors' | 'logo' | 'font' | 'asset',  // Inline picker type (optional)
  phase: 'pre' | 'prod' | 'post' | 'legacy'  // Phase for progress tracking
}
```

### Current Flow Order

**PRE Phase:**
1. `INIT` → `COLORS_PANEL` (key: `artist_name`)
2. `COLORS_PANEL` → `MISSION_GIFT` (key: `colors_set`, triggers: `colors`)
3. `MISSION_GIFT` → `FONT_PANEL` (key: `gift_to_world`)
4. `FONT_PANEL` → `LOGO_PANEL` (key: `font_set`, triggers: `font`)
5. `LOGO_PANEL` → `PRE_COMPLETE` (key: `logo_uploaded`, triggers: `logo`)
6. `PRE_COMPLETE` → `PROJECT_NAME` (key: `pre_complete`)

**PROD Phase:**
7. `PROJECT_NAME` → `PROJECT_DESCRIPTION` (key: `project_name`)
8. `PROJECT_DESCRIPTION` → `ASSET_UPLOAD_PANEL` (key: `project_description`)
9. `ASSET_UPLOAD_PANEL` → `PROD_COMPLETE` (key: `asset_uploaded`, triggers: `asset`)
10. `PROD_COMPLETE` → `PROMO_STRATEGY` (key: `prod_complete`)

**POST Phase:**
11. `PROMO_STRATEGY` → `TARGET_AUDIENCE` (key: `promo_strategy`)
12. `TARGET_AUDIENCE` → `LAUNCH_DATE` (key: `target_audience`)
13. `LAUNCH_DATE` → `POST_COMPLETE` (key: `launch_date`)
14. `POST_COMPLETE` → `GRATITUDE` (key: `post_complete`)

**LEGACY Phase:**
15. `GRATITUDE` → `LEGACY_VISION` (key: `gratitude_practice`)
16. `LEGACY_VISION` → `FEEDBACK_LOOP` (key: `legacy_vision`)
17. `FEEDBACK_LOOP` → `COMPLETE` (key: `feedback_loop`)
18. `COMPLETE` → `COMPLETE` (key: `completed`, end state)

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

## Zeyoda Code References

**Repository:** `https://github.com/nodrinksonthepiano/zeyoda-nextjs-52925/tree/feature/coin-colors-live-update`

**Key Files:**
- `app/components/ProfileEditPanel.tsx` - Panel UI and color/font/logo handling
- `app/components/ThemeOrbitRenderer.tsx` - Token color updates via events
- `app/utils/themeBackground.ts` - Background application logic

**Patterns Used:**
- Event-driven preview system (`artistConfigPreview` / `profilePreview`)
- Immediate CSS variable updates
- `applyArtistBackground` / `applyLogoBackground` function
- Preview config state for live token updates

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


