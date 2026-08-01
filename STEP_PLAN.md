# STEP_PLAN.md — ArtisTalks Launch Plan

**Status:** Sprint 0 complete. Sprint 1 next. No application code has been changed.
**Last updated:** 2026-08-01

> ArtisTalks teaches. Artistocks launches. Zeyoda protects. GOSHBOT routes memory.
> Read `ECOSYSTEM_MEMORY_MAP.md` before routing mixed concepts.

---

## 0. The Product Promise

**The artist answers the emerald chat, and the page comes alive.**

Everything in this plan serves that one sentence. If a proposed feature does not make the page come alive for an artist answering the chat, it is not in this lane.

The chargeable path:

```
Emerald chat → artist page comes alive → save/apply → guided curriculum → paid ArtisTalks Orbit
```

Parked for now: Final Cut, Blender, workshop automation.

---

## 1. Architecture — Two Separate Systems

These must never share access, tools, memory, or authority.

```
GOSHBOT                          ArtisTalks Guide
Private Jai system               Public artist-facing curriculum voice
Telegram / planning / memory     Lives inside the artistalks.org emerald chat
Reports                          No access to main GOSHBOT
No artist access                 No tools
                                 No external actions
                                 No file system
                                 No payments
                                 Context = current artist draft + curriculum only
```

The ArtisTalks Guide is **not** a separate product and **not** part of GOSHBOT. It is the voice inside the emerald chat, and it is the **last** thing built.

When an artist asks something bigger than the Guide's lane:

> "That is a great one for your ArtisTalks call. For now, let's keep shaping your page."

---

## 2. Language Rules

### "my champion" vs "Champions"

- **lowercase "my champion"** — term of address for **every** artist using the SaaS. Already in the product at `components/AuthPanel.tsx:155`, `components/EmeraldChat.tsx:1021`, and `lib/curriculum.ts:99`. Anyone who lands on the page is greeted this way, including the Orbit Launch group.
- **capitalized "Champions"** — the named ArtisTalks Orbit Launch cohort.

So every artist is addressed as *my champion*. Becoming a *Champion* is what the Orbit gives them.

### Never "founders"

ArtisTalks Orbit Launch artists are **never** called founders, founding artists, founding members, or any variation.

Two reasons, and the second is the load-bearing one:

1. "Founder" refers to Jai only.
2. **The Orbit Launch cohort is revolving.** It mixes existing mastermind members with new artists and changes over time. A revolving cohort cannot have founders — the word would be inaccurate as well as off-brand.

**Audit result (2026-08-01):** zero occurrences of "founder" exist in this repository. Every occurrence anywhere in the ecosystem is in `zeyoda-nextjs-051126` and refers to Jai himself, which is correct usage. This is therefore a **rule to enforce going forward**, not a cleanup task. It is recorded in `.cursor/rules/constraints.mdc`.

---

## 3. Access Model

### First question is always artist name only

Not "artist name or email." Just the artist name.

The artist name renders **live at the top of the page as they type** — before submit. They should discover this by typing. Do not over-explain it before the moment happens.

### Recognition is server-side only

When an artist name is entered, the server checks its status. The artist list never ships to the client.

### If the artist name is unclaimed

- continue the free taste
- artist name appears live at the top
- local draft stores answers
- the page comes alive through name, colors, carousel, and affirmation
- email is asked **only** at the save/apply gate, after the living affirmation

### If the artist name is claimed / invited / coin_granted / active / paid / inner_circle

- send the OTP/code to the email already on file
- show only: **"Enter the code sent to [Artist Name]'s email."**
- do **not** reveal any email address
- do **not** show a masked email (no `j•••@gmail.com`)
- do **not** ask a returning artist for an email they already gave
- do **not** offer a "continue anyway" option — a claimed name is a locked door, not a fork in the road
- do **not** load private saved answers, assets, colors, links, or curriculum state until the code verifies

Before verification, the page may show the typed name at the top. Nothing else.

### The enumeration tradeoff — accepted consciously

A locked door reveals that a name is claimed. That is the chosen tradeoff: protecting an artist's page beats hiding that they exist.

The mitigation is **not** the response copy. It is the rate limit. Requirements for the recognition endpoint:

- server-side only; no cohort or artist list in any client bundle
- returns `{ claimed: boolean }` and nothing else, ever
- no email in the response body, the UI, error messages, or logs
- normalized artist name/slug with a unique index
- rate-limited on recognition **and** on OTP attempts, shipped in the same commit as the endpoint
- after too many wrong codes, a calm "ask Jai for help" state

If that endpoint ships without throttling, someone scripts the whole cohort in an afternoon.

---

## 4. Access and Payment Are Separate

Two independent fields. Never collapse them into one.

### Access statuses

| Status | Meaning |
|---|---|
| `unclaimed` | free taste, then apply/save gate |
| `applied` | submitted email/application, waiting |
| `invited` | allowed to verify and enter |
| `coin_granted` | bypasses apply; already granted access |
| `active` | verified and inside |
| `paid` | payment confirmed |
| `inner_circle` | special access / flexible amount |

### Payment statuses

| Status | Meaning |
|---|---|
| `unpaid` | in, but has not contributed |
| `paid` | contribution confirmed |
| `already_paid` | previously settled outside the app |
| `pay_what_you_can` | flexible amount path unlocked |
| `comped` | no contribution expected |

### Artist coin access bypasses apply

A coin-granted artist has **already** been granted access. They do not apply. They may still need to pay, contribute, or be marked already-paid after login.

Valid combination example:

```
access_status:  coin_granted
payment_status: unpaid
```

Meaning: they can enter because of the coin, and still see the option to contribute.

### "cancakes" is not a login code

`cancakes` is an **access/payment-path code**, not an OTP and never a login credential.

```
Email OTP (e.g. 428193) = proves identity, unlocks the account
Access code (cancakes)  = changes the payment path
```

It is checked **after** identity is verified, and it unlocks: pay what you can, leave a tip, continue if already paid, inner-circle handling.

### v0 is manual

- Jai marks an artist `coin_granted` or `inner_circle` by hand
- Jai marks `payment_status` by hand
- **No** wallet, NFC, or on-chain coin verification in v0

Today the coin is a permission flag. Later it can become automatic proof. NFC/on-chain verification is a Zeyoda/Artistocks problem for later, not an ArtisTalks problem for now. SEC-001 rules stay in force: no agent touches wallet-signing code, and `fundWallet` stays disabled.

---

## 5. The Free Taste — 8 Steps, 7 Questions

**Do not call this the six-question free taste.** That phrase is retired. Colors stay at position 2 and `TARGET_REACH` stays in, which makes the accurate count 8 steps / 7 questions.

Step 2 is a panel, not a question, which is why the two numbers differ.

| # | Step ID | Key | Question? |
|---|---|---|---|
| 1 | `INIT` | `artist_name` | yes |
| 2 | `COLORS_PANEL` | `colors_set` | no — panel |
| 3 | `GIFT_PRESENCE` | `gift_to_world` | yes |
| 4 | `KNOWN_FOR_LEGACY` | `known_for_legacy` | yes |
| 5 | `KNOWN_FOR_EXPRESSION` | `known_for_expression` | yes |
| 6 | `TARGET_REACH` | `target_reach` | yes |
| 7 | `GENRE_ASSOCIATIONS` | `genre_associations` | yes |
| 8 | `BUSINESS_OFFERING` | `business_type_products_services` | yes |

The living affirmation completes at **step 8**. The email save/apply gate follows.

Step 9 (`CURRENT_FOCUS_PILLAR`) is the journey fork — see §7.

---

## 6. The Living Affirmation Is Already Assemblable

The conversion gate requires **zero new questions**. Every slot maps to a key that already exists and is already saved and carded.

Template:

> I am so happy and grateful now that **[ARTIST]** is stepping fully into **[GENRE / WORLD]**, creating **[BUSINESS / OFFER]**, known for **[EXPRESSION]**, and celebrated for **[LEGACY]**.

| Slot | Existing key | Defined at |
|---|---|---|
| ARTIST | `artist_name` | `lib/curriculum.ts:101` |
| GENRE / WORLD | `genre_associations` | `lib/curriculum.ts:149` |
| BUSINESS / OFFER | `business_type_products_services` | `lib/curriculum.ts:157` |
| EXPRESSION | `known_for_expression` | `lib/curriculum.ts:133` |
| LEGACY | `known_for_legacy` | `lib/curriculum.ts:125` |

The affirmation is a **render** problem, not a data-collection problem. It should grow line by line as each key is answered. Jai may rewrite the sentence in his own voice; the slots stay the same.

---

## 7. Verified Current Reality

Facts confirmed by reading the code on 2026-08-01. This section is why the work is *reorganization*, not a rebuild.

### The blocker — two lines

```
app/page.tsx:374   {user ? (      ← gates header, mission line, halo, carousel, orbit tokens
app/page.tsx:602   {user && (     ← gates EmeraldChat
```

An anonymous visitor sees `AuthPanel` and nothing else. This is the single architectural decision blocking the entire funnel.

### The auth field contradicts its own label

`components/AuthPanel.tsx:162` reads `placeholder="Enter Artist Name or Email"`, but the value goes straight into `signInWithOtp({ email })` at lines 28–34. Typing an artist name today produces a Supabase invalid-email error. There is **no** artist-name lookup anywhere in the repo — no query, no endpoint, no table mapping name to email.

`components/AuthPanel.tsx:94` currently prints the full, unmasked email back to the screen. There is no masking logic anywhere to remove, so we skip straight to the correct behavior.

### Live typing already works, but writes to the database

`components/EmeraldChat.tsx:460-474` debounces 50ms and calls `onProfileUpdate`, which updates React state optimistically — so the header **is** live for logged-in users. But every debounce tick also fires a Supabase upsert at `hooks/useProfile.ts:104-110`. Typing an artist name produces a database round trip roughly every 50ms.

The local draft store fixes the anonymous problem and this performance problem in the same move.

### No local storage exists

One hit in the entire repo, and it is a wipe, not a write: `components/DataReset.tsx:31`. The draft store is net-new with nothing to untangle.

### "Choose your own journey" does not exist yet

`lib/curriculum.ts:164` hardcodes `nextStep: 'FAN_CONNECTION'` on `CURRENT_FOCUS_PILLAR`. The fork answer is collected and then discarded. Every artist gets the identical linear march.

This is good news: we are adding a fork to a clean spine, not untangling a broken one.

### The chat is 100% scripted — no AI in the repo

`package.json` has no `openai`, no `anthropic`, no AI SDK. One API route exists in the whole app (`app/api/uploadLogo/route.ts`). `lib/curriculum.ts:94` says it plainly: `// The Deterministic "Script" for all phases`.

The ArtisTalks Guide is the only genuinely net-new system in this plan. That is exactly why it goes last.

### Security posture

No `middleware.ts`, no rate limiting, no whitelist, no admin route in this repo. `signInWithOtp` is called with `shouldCreateUser: true` (`components/AuthPanel.tsx:31`), so any email can create an account today. Nothing leaks an artist list right now — but the recognition endpoint **creates** that surface, which is why §3 requires throttling in the same commit.

---

## 8. Sprints

Each sprint is one sitting with a test runnable in a private browser window. Nothing later gets touched early.

### Sprint 0 — Docs and decisions. No code. ✓

Write `STEP_PLAN.md`, `ARTISTALKS_GUIDE_VOICE.md`, the constraints/rules update, and fix the stale V1 flow order in `ARTISTALKS_KNOWLEDGE_BASE.md`.

**Done when:** the docs describe the code that actually exists, and the decisions are frozen.

### Sprint 1 — Anonymous free taste ← current

Open the emerald chat without login. Local draft store. Live artist name at the top. Zero Supabase traffic while anonymous.

**Touches:** `app/page.tsx` (auth gates at lines 374, 484, 602), new `lib/draft.ts`, new `hooks/useDraft.ts`, `components/EmeraldChat.tsx` (draft read/write; guard all Supabase paths when `!user`).

**Done when:**

- a private browser opens the emerald chat with no account
- the first prompt is artist name only
- the artist name appears live at the top as they type
- anonymous answers write locally and survive refresh
- the Network tab shows **zero** Supabase calls while typing or answering anonymously
- no private saved artist data loads before verification
- no auth, payment, phase-tag, enrichment, or accordion work in this sprint

### Sprint 2 — Phase-tag fix (tiny, isolated)

**Proposed, not yet applied.** `lib/curriculum.ts` only — `phase` values. The `nextStep` chain does **not** change.

The run to the affirmation is currently tagged `pre, pre, pre, legacy, pre, post, pre, pre`. Two steps jump the orbit tokens out of the `pre` lane and back for a single step, which makes the token fill look random during the most important minute of the funnel:

- `KNOWN_FOR_LEGACY` at `lib/curriculum.ts:127` is tagged `legacy` → flickers the LEGACY token early
- `TARGET_REACH` at `lib/curriculum.ts:143` is tagged `post` → flickers the POST token early

`ARTISTALKS_EXPERIENCE_ARCHITECTURE.md` §1.4 independently flagged scrambled phase tags. This sprint stays its own tiny commit so a token-fill regression is unambiguous.

**Done when:** the orbit tokens fill in a pattern that reads as intentional.

### Sprint 3 — The living affirmation

New card assembling the five keys in §6. Grows line by line.

**Done when:** after step 8, the artist reads a complete sentence built from their own words.

### Sprint 4 — Email gate and draft migration

Ask for email after the affirmation. `signInWithOtp`. On verify, migrate the local draft into `curriculum_answers` and `profiles`.

**Done when:** the anonymous answers survive login as rows and cards, nothing duplicated, nothing lost.

### Sprint 5 — Server-side recognition

New `app/api/artist/recognize/route.ts`. Service role. Returns `{ claimed: boolean }` only. Needs a normalized `artist_name_slug` column with a unique index, plus rate limiting in the same commit. See §3 for the full requirement list.

**Done when:** a curl loop gets throttled; no response body contains an email under any input; a production bundle grep finds no artist list.

### Sprint 6 — The locked door

Rewrite `AuthPanel`. Artist name only — delete "or Email" from line 162, delete the `{email}` render at line 94. Copy becomes "Enter the code sent to [Artist Name]'s email." No continue-anyway. Private data does not load until the code verifies.

**Done when:** a returning artist types only their name, gets a code, and no email appears in the UI, the network response, or the console — and their private data is provably absent from the page before verification.

### Sprint 7 — Access and payment as two columns

`access_status` and `payment_status` on `profiles`, set by hand in the Supabase dashboard. `cancakes` checked after identity verification, changing only the payment path. No wallet code.

**Done when:** flipping someone to `coin_granted` lets them skip apply; flipping `pay_what_you_can` shows the flexible amount.

### Sprint 8 — Wire the fork ("choose your own journey")

Prerequisite: the enriched step schema in `ARTISTALKS_EXPERIENCE_ARCHITECTURE.md` §5, which lets `next` be a branch map instead of a hardcoded string. Then `CURRENT_FOCUS_PILLAR` actually routes.

**Done when:** picking "promoting something finished" routes to the promo questions and not the creating-new ones.

### Sprint 9 — Uploads

Local object-URL preview before login; real storage upload only after verification. Permanent storage begins only once the artist saves/applies, so anonymous visitors cannot fill storage. The existing upload route already enforces `user.id` ownership, so this is mostly a client-side gate.

### Sprint 10 — The ArtisTalks Guide

Last. Boundaries per §1. The only net-new system in the plan.

---

## 9. Launch Criticality

| Sprints | Status |
|---|---|
| 1–7 | Launch-critical. Must ship for the Orbit Launch. |
| 8–10 | Can land during the Orbit rather than before it. |

---

## 10. Do Not Touch During the Funnel Sprints

**The chat/carousel drift bug.** `EmeraldChat.currentStepId` and `page.activeStepId` can drift apart. It is real, and it has a warning label: `ARTISTALKS_EXPERIENCE_ARCHITECTURE.md` §1.3 documents a June 2026 regression where a partial focus/objective split made the app feel broken and had to be reverted.

If it is touched while the funnel is being rewired, we will not know which change broke what. It gets its own sprint, later, or it does not get touched.

Also not yet: payments beyond manual flags, enrichment APIs, the accordion hub, broad carousel redesign, database migrations beyond the columns named above, and any wallet/NFC/on-chain work.

---

## 11. Where New Curriculum Goes

Jai has more curriculum arriving from other chats. Routing per `ECOSYSTEM_MEMORY_MAP.md`:

| Material | Destination |
|---|---|
| Curriculum questions, milestones, after-answer flavor | `CURRICULUM_V2.md` (canonical, already 659 lines) |
| Release checklist — creative, distribution, marketing, legal, post-release | `CURRICULUM_V2.md` as a PROD/POST module. The Principle Card JSON format at `CURRICULUM_V2.md:590-602` exists for exactly this |
| Tone of voice, signature phrases, how Jai greets and calls artists higher | `ARTISTALKS_GUIDE_VOICE.md` |
| Mastermind facilitation — breakout rooms, declarations, flips, coherence teaching | `ARTISTALKS_GUIDE_VOICE.md`, "how I call them higher". Facilitation layer, not app curriculum |
| Artist testimonials | `ARTISTALKS_GUIDE_VOICE.md`, voice evidence section. Not curriculum, not Jai's voice |
| Mastermind executive summary and authority statements | Marketing copy. Uses "Founder:" correctly — that is Jai |

**Outstanding:** ten Instagram reels are behind Instagram's login wall and cannot be fetched or transcribed by an agent. To use that material, the files need to be downloaded locally or transcribed to text first. It is likely the highest-value voice input available.

---

## 12. Decisions Frozen in Sprint 0

1. First question is always artist name only. Never "artist name or email."
2. Artist name renders live at the top as they type.
3. Unclaimed names continue the free taste; email is asked only at the save/apply gate.
4. Claimed names get a locked door: code to the email on file, no email shown, no mask, no continue-anyway.
5. Artist coin access bypasses apply.
6. Access and payment are separate fields.
7. `cancakes` is a payment-path code, never a login code.
8. The free taste is 8 steps / 7 questions to the affirmation.
9. "Six-question free taste" is retired language.
10. The phase-tag fix is documented as Sprint 2, not yet applied.
11. lowercase "my champion" = every artist; capitalized "Champions" = the Orbit Launch cohort.
12. Orbit Launch artists are never called founders. The cohort revolves.
13. The ArtisTalks Guide is the emerald chat voice, is not GOSHBOT, and is built last.
14. The product promise: the artist answers the emerald chat, and the page comes alive.
