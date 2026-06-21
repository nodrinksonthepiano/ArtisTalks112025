# ArtisTalks — Experience Architecture (Product Contract)

**Status:** Draft for review. No code changes implied by this document.

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

### 1.3 — Browsing can hijack the objective.

Carousel swipe dispatches `cardNavigate`; `EmeraldChat` listens and calls `setCurrentStepId` plus reloads the input. So *looking* at a past card can silently change *what the chat is asking*. This is the core clunk.

### 1.4 — Two sources of truth and a forward-pull.

`EmeraldChat.currentStepId` and `page.activeStepId` both behave like "the current objective" and can drift out of sync. On top of that, `findFirstUnansweredStep` walks focus forward to the next blank even after the artist deliberately navigated somewhere. Together these make the app feel like it is jumping on its own.

Two smaller real issues found in passing:

- the `phase` tags are scrambled in the current V2 spine (for example, genre is `pre` sitting between post-lane steps; fan struggles is `prod`)
- only two panel trigger types exist today: `colors` and `asset`

---

## 2. The Core Rule

The previous simple answer — "swipe should be review-only" — is too blunt. A frozen carousel turns a living launchpad into a museum. But "swipe always changes the chat" causes hijack. The resolution is to separate two ideas that the code currently fuses:

- **Focus** = what the artist is *looking at* (carousel attention, current card, visual focus). Cheap, free to move.
- **Objective** = the step the chat is *committed to completing/saving an answer for*. Sacred, changes only on intent.

> **Chat owns the objective. The carousel moves focus. Only an intentional act promotes focus into the objective.**

What counts as an intentional act:

| Artist action | Moves focus? | Changes objective? |
|---|---:|---:|
| Swipe to an **answered** card (review) | Yes | No |
| Swipe to an **unanswered** question, then **start typing / tap "Answer this"** | Yes | Yes — engagement promotes it |
| Tap **Edit / pencil** on a saved card | Yes | Yes — edit is explicit |
| Tap a **phase token** | Yes | Yes — intentional season jump |
| Submit an answer | — | Yes — advances forward |

This keeps the launchpad alive and stops accidental hijack. Browsing is free; committing requires a deliberate move.

`findFirstUnansweredStep` may only run on forward completion — never to override a manual focus or objective.

---

## 3. Modes

Most proposed "modes" are content types, not artist mental modes. The artist should only ever feel one of three intents:

1. **Answering** — the chat is on an objective; an input or panel helps complete it.
2. **Browsing** — the artist is moving attention across the launchpad without committing.
3. **Editing** — the artist intentionally reopens a saved asset to improve it.

Everything else — text input, select input, upload, panel, lesson, card, checklist — is a **content type** that renders inside those intents. Keeping intents and content types separate is what stops the architecture from sprawling.

---

## 4. Who Owns What

- **Chat** owns the objective and the journey. It is the guide.
- **Panels / inputs** help complete the current objective. They do not navigate by themselves.
- **Cards** are the saved artifacts of the journey — read in Browsing, reopened in Editing.
- **Carousel** is the launchpad surface: it moves focus, displays cards, and features the current objective. It is not a second driver of the objective.
- **Phase tokens** are intentional season navigation, not passive browsing.

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

Unify to one objective state. Separate focus from objective. Stop `findFirstUnansweredStep` from overriding manual navigation. Fix the scrambled `phase` tags. Outcome: swipe feels intentional, not random, without making the carousel read-only.

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
5. Swipe back through answered cards to review, while the chat objective stays put.
6. Tap edit on one card, improve it, submit, and land back in guided flow.

If that sitting feels alive and never argues with itself, the room rules are right.

