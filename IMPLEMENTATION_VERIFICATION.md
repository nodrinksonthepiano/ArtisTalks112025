# Implementation Verification - Token Redesign

## ✅ Verified Details

### 1. Progress Structure ✅

**File:** `hooks/useCurriculumProgress.ts`  
**Lines:** 5-16

**Return Type:**
```typescript
export interface CurriculumProgress {
  preProgress: number    // ✅ Matches plan
  proProgress: number    // ✅ Matches plan
  postProgress: number   // ✅ Matches plan
  loopProgress: number   // ✅ Matches plan (maps to 'legacy' phase)
  currentModule?: {...}
}
```

**Status:** ✅ **VERIFIED** - Structure matches plan exactly. Plan can use `progress.preProgress`, `progress.proProgress`, etc.

---

### 2. answeredKeys State Location ⚠️

**Current Location:** `components/EmeraldChat.tsx`  
**Line:** 31

```typescript
const [answeredKeys, setAnsweredKeys] = useState<Set<string>>(new Set())
```

**Status:** ⚠️ **NEEDS LIFTING**

**Current Usage:**
- `EmeraldChat.tsx`: Used for `findFirstUnansweredStep()` (line 73)
- `EmeraldChat.tsx`: Updated when answers saved (line 440)

**Required Usage:**
- `ArtisTalksOrbitRenderer.tsx`: Needed for `findFirstUnansweredStepInPhase()`

**Solution:** Lift `answeredKeys` to `page.tsx` and pass to both components

---

### 3. Profile Type ✅

**File:** `hooks/useProfile.ts`  
**Line:** 4

```typescript
export interface Profile {
  id: string
  artist_name: string | null
  mission_statement: string | null
  email: string | null
  logo_url?: string | null
  primary_color?: string | null
  accent_color?: string | null
  font_family?: string | null
  logo_use_background?: boolean | null
  brand_color?: string | null
}
```

**Status:** ✅ **VERIFIED** - Profile type is exported and available. Plan can import and use.

**Current Usage in page.tsx:**
- Line 25: `const { profile, updateProfile, loading: profileLoading } = useProfile()`
- Profile is already available in `page.tsx` ✅

---

### 4. Progress Hook Usage ✅

**File:** `app/page.tsx`  
**Line:** 54

```typescript
const progress = useCurriculumProgress(user?.id ?? null)
```

**Status:** ✅ **VERIFIED** - Progress is already available in `page.tsx`. Can pass directly to `ArtisTalksOrbitRenderer`.

---

## ⚠️ Required Changes

### State Lifting: answeredKeys

**Current:** Local state in `EmeraldChat.tsx`

**Required:** Lift to `page.tsx` and pass to both components

**Implementation Steps:**

1. **Create hook or lift state in page.tsx:**

```typescript
// Option A: Create shared hook
// hooks/useAnsweredKeys.ts
export function useAnsweredKeys(userId: string | null): Set<string> {
  const [answeredKeys, setAnsweredKeys] = useState<Set<string>>(new Set())
  const supabase = createClient()
  
  useEffect(() => {
    // ... existing load logic from EmeraldChat.tsx lines 85-132
  }, [userId, supabase])
  
  return answeredKeys
}

// Option B: Lift directly to page.tsx
// In app/page.tsx
const [answeredKeys, setAnsweredKeys] = useState<Set<string>>(new Set())

useEffect(() => {
  // ... load logic
}, [user?.id])
```

2. **Update EmeraldChat props:**

```typescript
// components/EmeraldChat.tsx
interface EmeraldChatProps {
  // ... existing props
  answeredKeys: Set<string>  // ADD
  setAnsweredKeys: (keys: Set<string> | ((prev: Set<string>) => Set<string>)) => void  // ADD
}
```

3. **Update ArtisTalksOrbitRenderer props:**

```typescript
// components/ArtisTalksOrbitRenderer.tsx
interface ArtisTalksOrbitRendererProps {
  // ... existing props
  answeredKeys: Set<string>  // ADD
}
```

**Recommendation:** Option A (shared hook) is cleaner - keeps logic isolated and reusable.

**Note:** EmeraldChat currently updates `answeredKeys` optimistically (line 440) when saving. The hook should expose a setter to allow optimistic updates for better UX. The subscription will also update automatically when database changes.

---

## ✅ Implementation Readiness Checklist

- [x] Progress structure verified (`preProgress`, `proProgress`, `postProgress`, `loopProgress`)
- [x] Profile type verified (exported, available in page.tsx)
- [x] Progress hook verified (already used in page.tsx)
- [ ] answeredKeys state lifting (needs implementation)
- [x] Profile prop available (already in page.tsx)
- [x] Click vs drag distinction (uses existing `draggingTokenRef`)

---

## Updated Implementation Order

1. **Create `useAnsweredKeys` hook** (or lift to page.tsx)
2. **Update EmeraldChat** to receive `answeredKeys` as prop
3. **Update ArtisTalksOrbitRenderer** props (add `profile`, `progress`, `answeredKeys`)
4. **Implement token redesign** (labels inside, colors, click handler)
5. **Add progressive reveal** logic
6. **Test click vs drag** distinction

---

## Code Changes Summary

### Files to Modify:

1. **`hooks/useAnsweredKeys.ts`** (NEW) - Extract answeredKeys logic
2. **`components/EmeraldChat.tsx`** - Remove local answeredKeys, receive as prop
3. **`components/ArtisTalksOrbitRenderer.tsx`** - Add props, implement redesign
4. **`app/page.tsx`** - Use `useAnsweredKeys`, pass to components
5. **`lib/curriculum.ts`** (optional) - Add `findFirstUnansweredStepInPhase` helper

---

## Final Verification

**All technical details verified except:**

- ⚠️ `answeredKeys` state lifting (required before implementation)

**Everything else is ready for implementation.**

