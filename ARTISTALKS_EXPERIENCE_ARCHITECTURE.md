# ArtisTalks — Experience Architecture (Product Contract)

**Status:** Draft for review — revised after lived test (Jun 2026). No code changes implied by this document.

**Agent note:** Swipe **must** dispatch `cardNavigate` and sync chat to the visible card. Do **not** remove that dispatch unless the full focus/objective split (`focusStepId`, "Answer this" promotion, browse-mode UI) ships together. A partial split feels broken: carousel moves, Emerald stays on a different question.

**Purpose:** Settle the "room rules" so chat, carousel, cards, panels, and tokens stop arguing over who owns the artist's focus. Everything downstream — branching, living cards, lessons, park-for-later — depends on these rules being decided first.

---

## 0. North Star

> One chat. One featured focus. One question or objective at a time. Move one needle. Remove the overwhelm.

ArtisTalks is a **chat-led creative-business launchpad**. The artist pours into the chat; the app captures the useful datapoints; the launchpad fills in over time — identity, brand, audience, release plan, protection, promotion, legacy. The interface should feel like a mastermind coach walking the artist through their dream one clean step at a time, not a dashboard they have to manage.

The test case is **Champion Heart**. If this system genuinely helps Jai organize his thoughts and release his own song, it will help other artists. That is the bar for every decision below.

---

## 1. Current Reality

This is what the code actually does today — not what the docs aspire to. Four facts matter:

### 1.1 — The journey fork is asked but not wired.

`CURRENT_FOCUS_PILLAR` asks the most important branching question in the app ("creating new / finishing / promoting?"), but in `lib/curriculum.ts` its `nextStep` is hardcoded to `FAN_CONNECTION`. The answer is *collected, never acted on*. Every artist gets the identical linear march. Choose-your-own-journey is not broken — it was not built yet. That is good news: we are adding a fork to a clean spine, not untangling one.

### 1.2 — The step schema cannot express what the vision needs.

Today a step is:

```ts
{
  id,
  question,
  nextStep,
  key,
  placeholder?,
  triggersPanel?: 'colors' | 'asset',
  phase?
}
```

This shape cannot represent selectable options, custom genres, per-question upload, multi-select, branching, lesson content, or living-card metadata. Most of the roadmap is blocked on this one shape, not on the chat/carousel plumbing.

### 1.3 — Swipe-sync is working behavior, not the villain.

Carousel swipe dispatches `cardNavigate`; `page.tsx` and `EmeraldChat` both listen and sync to the visible card's `stepId`. That is the intended navigation model today: **swipe = navigate the visible journey**.

A Jun 2026 experiment removed the swipe → `cardNavigate` dispatch (partial "focus vs objective" split). Result: carousel moved but Emerald stayed on a different question — with no separate `focusStepId`, no "Answer this" button, and no browse-mode UI to explain the mismatch. That felt broken. **Swipe-sync was restored.** Do not repeat the half-built split.

### 1.4 — The real clunk: drift, forward-pull, and scrambled phases.

Three issues actually make the app feel like it is jumping on its own:

1. **Two objective states** — `EmeraldChat.currentStepId` and `page.activeStepId` both behave like "the current step" and can drift apart.
2. **Forward-pull** — `findFirstUnansweredStep` walks focus forward to the next blank even after the artist deliberately navigated somewhere (e.g. after swipe or token jump).
3. **Scrambled `phase` tags** — in the current V2 spine, some steps have wrong phase values (for example, genre is `pre` sitting between post-lane steps; fan struggles is `prod`), which makes phase tokens feel random.

Two smaller real issues found in passing:

- only two panel trigger types exist today: `colors` and `asset`
- auto-center and edit-mode handoffs can still fight during transitions (see `AGENT_NOTES.md` §6)

---

## 2. The Core Rule (current shipping behavior)

> **Swipe navigates the visible journey. Chat follows the card you are on. Edit is explicit. Submit moves forward.**

This is what the code does today and what Champion Heart testing confirmed feels right:

| Artist action | Carousel | Chat (`currentStepId` / `activeStepId`) |
|---|---|---|
| **Swipe** to any card | Moves to that card | Syncs via `cardNavigate` — question + input reload for that `stepId` |
| **Edit / pencil** on a saved card | Navigates to that card | Enters edit mode via `cardEdit` |
| **Phase token** click | Auto-centers on current question | Jumps to first unanswered in that phase via `tokenNavigate` |
| **Submit** an answer | Snaps to current question card (index 0) | Advances to next unanswered step |

`findFirstUnansweredStep` may only run on **forward completion** (submit, continue on celebration steps, initial load) — never to override a deliberate navigation the artist just made.

### Optional future polish (not Phase 0)

A stricter **focus vs objective** split (swipe = look only on answered cards; typing or "Answer this" promotes to objective) remains a possible future UX. It requires shipping together: `focusStepId`, promotion UI, and browse-mode affordances. **Do not implement piecemeal.** The partial experiment caused the Jun 2026 regression.

---

## 3. Modes

Most proposed "modes" are content types, not artist mental modes. The artist should only ever feel one of three intents:

1. **Answering** — the chat is on a step; an input or panel helps complete it. Swiping to another card switches which step is active (synced chat).
2. **Editing** — the artist taps pencil on a saved card to revise it (`cardEdit`, edit mode).
3. **Advancing** — submit or continue moves the journey forward to the next unanswered step.

Everything else — text input, select input, upload, panel, lesson, card, checklist — is a **content type** that renders inside those intents. Keeping intents and content types separate is what stops the architecture from sprawling.

A separate passive **Browsing** mode (look without changing chat) is deferred until the focus/objective machinery exists.

---

## 4. Who Owns What

- **Chat** owns the journey copy and input. It is the guide. Step changes flow through `cardNavigate`, `cardEdit`, `tokenNavigate`, and submit.
- **Panels / inputs** help complete the current step. They do not navigate by themselves.
- **Cards** are the saved artifacts of the journey — swiped to revisit, reopened via pencil for editing.
- **Carousel** is the launchpad surface: swipe dispatches `cardNavigate` so the visible card and chat stay aligned.
- **Phase tokens** are intentional season jumps to the first unanswered step in that phase.
- **`activeStepId` (page) and `currentStepId` (EmeraldChat)** should converge toward one source of truth (Phase 0 cleanup).

---

## 5. Future Step Schema

This is the leverage point. One enriched shape unlocks genres-with-options, per-question upload, and the journey fork at once:

```ts
interface CurriculumStep {
  id: StepId
  question: string
  key: string
  phase: 'pre' | 'prod' | 'post' | 'legacy'
  input:
    | { kind: 'text'; placeholder?: string }
    | { kind: 'select'; options: string[]; allowCustom?: boolean; max?: number }
    | { kind: 'upload'; accept?: string; optional?: boolean }
    | { kind: 'panel'; panel: 'colors' | 'asset' }
  next: StepId | ((answer: Answer) => StepId)
}
```

The chat renders one input component that switches on `input.kind`. Existing steps migrate to `kind: 'text'` with no behavior change. Genre becomes `select` plus `allowCustom`. The fork becomes a branching `next` on `CURRENT_FOCUS_PILLAR`.

Before implementation, decide whether branching should be represented as a function or as a data-readable branch map. A branch map is easier to serialize, test, and eventually store in a CMS/database; a function is faster to prototype in TypeScript.

Important direction: the schema enrichment and first branch should be designed together. The branching mechanism is part of the schema.

---

## 6. Living Card Direction

A card is currently an answer receipt. The target is an asset that grows in clarity as the artist progresses:

```text
[ Saved answer ]
[ Attached media, if uploaded ]
[ Current status ]
[ Next action ]
[ Later: lesson video, example, template, checklist ]
```

Same underlying answer data, richer render. This is a render + metadata change, not a new app. It depends on the step schema direction above, so it comes after the room rules and schema plan.

---

## 7. Phased Rescue Roadmap

### Phase 0 — Stop the app fighting the artist.

**Keep swipe-sync** (`cardNavigate` on swipe). Fix the three real culprits:

1. Collapse `EmeraldChat.currentStepId` and `page.activeStepId` toward one source of truth (stop drift).
2. Stop `findFirstUnansweredStep` from overriding manual navigation (forward-pull only on submit / continue / initial load).
3. Fix scrambled `phase` tags in `lib/curriculum.ts` so tokens match the journey lane.

Do **not** remove swipe-sync or build a partial focus/objective split in this phase.

### Phase 1 — Enrich the step schema and wire the fork.

Add input kinds and branching. Migrate current text steps to `kind: 'text'`. Ship genre as `select` plus `allowCustom`, per-question upload where needed, and the `CURRENT_FOCUS_PILLAR` branch.

### Phase 2 — Living cards.

Add status, next action, and media awareness to the card render.

### Phase 3 — Lessons on cards.

Add lesson video, example, template, and checklist support.

### Phase 4 — Park-for-later / skip queue.

Only after the room rules are proven. A parked question should feel like "this is alive; we will return when it serves the journey," not like failure or missing homework.

---

## 8. What Not To Build Yet

- No partial focus/objective split (no removing `cardNavigate` on swipe without full `focusStepId` + promotion UI).
- No skip/park queue yet.
- No video lesson cards yet.
- No broad carousel redesign.
- No database migration until schema direction is approved.
- No Zeyoda inspection unless a specific input-type, theming, or event-pattern problem appears.

---

## 9. Voice Rule

Use positive direction. The app should never feel like it is correcting the artist.

Prefer:

- "This is evidence of the gift."
- "This protects the work."
- "Make the picture clear."
- "This gives the next step somewhere to land."
- "We are building the container that can hold your gift."

Avoid defaulting to confrontational "not / don't / this is not" phrasing where possible. Protective is good; scolding is not.

---

## 10. Acceptance Test

Run the whole thing against Champion Heart.

The architecture is working when Jai can, in one sitting and without the app jumping on its own:

1. Name the artist, set colors, and watch the page become his.
2. Reach the genre question, pick from options, and add a genre that is not listed.
3. Hit the fork, choose "promoting a finished work," and have the journey actually route there.
4. Upload the Champion Heart cover on a question that should accept it.
5. Swipe back through answered cards to review — Emerald follows each card (question + saved answer visible).
6. Tap edit on one card, improve it, submit, and land back in guided flow without the app jumping on its own.

If that sitting feels alive and never argues with itself, the room rules are right.

