# STEP_PLAN.md — ArtisTalks Launch Plan

**Status:** Private beta at `artistalks8526.vercel.app`.

Sprint 1 save-and-restore proven:
- first OTP saves profile + free-taste `curriculum_answers`;
- authenticated Data Reset signs out without deleting DB memory;
- claimed-name return restores progress;
- resume at the first genuinely unanswered step;
- new answers after login persist across Data Reset and return.

**Code baseline:** `ef49879` — Add PayPal subscription entitlement flow
**Last updated:** 2026-08-25

**MVP authority:** ArtisTalks is one page. The curriculum is the experience.
Coaching language inspires curriculum copy. Product behavior comes from this
file and explicit approval.

> ArtisTalks teaches. Artistocks launches. Zeyoda protects. GOSHBOT routes memory.
> Read `ECOSYSTEM_MEMORY_MAP.md` before routing mixed concepts.

---

## 0. The Product Promise

**The artist answers the emerald chat, and the page comes alive.**

Everything in this plan serves that one sentence. If a proposed feature does not make the page come alive for an artist answering the chat, it is not in this lane.

### Chargeable path (locked)

```text
EmeraldChat
→ page comes alive
→ free email save and restore
→ CURRENT_FOCUS_PILLAR fork (two routes, not sequential):
   → Continue ArtisTalks — $8/month DIY SaaS
   OR
   → Apply to Orbit Launch (free) → Jai review → tuition only if approved
→ $8 DIY: Stripe Card + PayPal sandbox proven; Venmo unproven; launch payment order undecided
→ Active Orbit includes ArtisTalks for the Orbit term (no double $8)
```

Parked for now: Final Cut, Blender, workshop automation, NFC coin claim port,
LLM Guide (last), dreamboard/tesseract, Google working studio.
(DIY `$8` Stripe/PayPal rails are proven — see Locked 2026-08-25. Launch payment order waits on Venmo evidence.)

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

- **lowercase "my champion"** — term of address for **every** artist using the SaaS. Anyone who lands on the page is greeted this way, including the Orbit Launch group.
- **capitalized "Champions"** — the named ArtisTalks Orbit Launch cohort.

So every artist is addressed as *my champion*. Becoming a *Champion* is what the Orbit gives them.

### Never "founders"

ArtisTalks Orbit Launch artists are **never** called founders, founding artists, founding members, or any variation.

Two reasons, and the second is the load-bearing one:

1. "Founder" refers to Jai only.
2. **The Orbit Launch cohort is revolving.** It mixes existing mastermind members with new artists and changes over time. A revolving cohort cannot have founders — the word would be inaccurate as well as off-brand.

**Audit result (2026-08-01):** zero occurrences of "founder" exist in this repository. Every occurrence anywhere in the ecosystem is in `zeyoda-nextjs-051126` and refers to Jai himself, which is correct usage. This is therefore a **rule to enforce going forward**, not a cleanup task. It is recorded in `.cursor/rules/constraints.mdc`.

### Pay What You CANCakes vs `cancakes`

- Customer-facing phrase: **Pay What You CANCakes** (spoken/known path — never a
  visible UI control, button, coupon field, or “have a code?” prompt)
- Server-side access/payment-path code: **`cancakes`**
- Never an OTP or login credential. Validated only after identity is verified.
- Always invisible: the artist types `cancakes` naturally into EmeraldChat at
  the payment moment because Jai gave them the word. Server recognizes silently
  → “What can you pay today?” → amount → approved CANCakes / comp path.
- Never ship: “Have a code?”, “Beta access”, “Coupon code”, “Pay What You
  CANCakes” button, or “Enter secret word.”

---

## 3. Product ladder and pricing

### Final product ladder

```text
FREE TASTE
→ build the beginning of the sanctuary
→ free email save and restore

STANDALONE ARTISTALKS (DIY path)
→ $8/month
→ ongoing curriculum, saved sanctuary, secure return, and continued building

ARTISTALKS ORBIT LAUNCH (done-with-you path)
→ application is free and separate from saving
→ approval is separate from payment
→ tuition only after approval ($500/mo × 6 or $2,000 upfront)
→ ArtisTalks included during the Orbit term (no double $8)
```

### Free taste

Artists may begin building their sanctuary, experience the Living Affirmation,
and save and restore the free-taste result through verified email.

Saving does not automatically:

- start a subscription;
- submit an Orbit application;
- approve access;
- create a payment obligation.

### ArtisTalks SaaS

Ongoing ArtisTalks access is **$8/month**.

The subscription provides ongoing access to the one-page ArtisTalks experience:
continued curriculum, saved sanctuary, secure return, and continued building on
the artist's living page.

**ArtisTalks `$8/month` is the DIY path** — guided artist-development software
artists use on their own.

Jai may issue a coupon or comp that reduces or waives the subscription for an
individual artist. A discount is an **explicit exception**, not an included Orbit benefit.

### ArtisTalks Orbit Launch

Orbit is a separate six-month done-with-you / mastermind program.

**Application is free.** Tuition is offered only after Jai approves.

Pricing after approval:

- **$3,000** standard total;
- **$500/month** for six months;
- **$2,000** paid in full upfront, saving $1,000;
- **Pay What You CANCakes** by approval.

**`$8` and Orbit are two different paths, not sequential upsells.**

```text
CURRENT_FOCUS_PILLAR
→ What kind of support do you want?
→ ArtisTalks DIY / SaaS ($8/month)
   OR
→ Orbit Launch (apply free → Jai reviews → tuition only if approved)
```

- Choosing **Apply to Orbit** bypasses the `$8` checkout entirely.
- After Orbit **submit**: confirmation
  (“Application received. Jai will review your Orbit application.”) →
  continue at `FAN_CONNECTION` → deeper curriculum while Jai reviews.
  **No `$8` required** after submit. `$8` remains the separate DIY route.
- Orbit application status unlock rules (proven at `6596ad0`):
  - `draft` — resume apply only; does **not** unlock deeper curriculum
  - `submitted` | `approved` — Orbit-route entitlement; continue past
    `CURRENT_FOCUS_PILLAR` without `$8`
  - `declined` — no Orbit-route entitlement; DIY `$8` remains available
- Orbit is **not** a prerequisite for `$8`, and `$8` is **not** a prerequisite
  for Orbit.
- Artists may apply for Orbit **without** first subscribing to the `$8/month` SaaS.
- If Orbit is not the fit, ArtisTalks remains available for `$8/month`.

**Orbit includes ArtisTalks during the Orbit term.** Active Orbit artists do not
also owe `$8/month`. Internally, SaaS status and Orbit status stay separate;
Orbit activation may mark ArtisTalks access included/`comped` for the term
(Sprint 5). An existing `$8` member who later joins Orbit must not be
double-charged — Orbit activation replaces the separate `$8` obligation while
Orbit is active.

Applying, approval, SaaS subscription, and Orbit tuition remain separate states.

### Payment rails (private beta)

```text
PROVEN
  Stripe $8 sandbox Card
  → in-chat Payment Element → webhook → active → FAN_CONNECTION
  → failed-payment → past_due (access remains)

  PayPal $8 sandbox
  → subscription → verified PAYMENT.SALE.COMPLETED
  → provider=paypal, provider_status=ACTIVE
  → saas_subscription_status=active → existing welcome / FAN_CONNECTION

NEXT
  PayPal funding cleanup (disable card, credit, paylater;
    keep PayPal wallet + any eligible Venmo)
  → real-phone Venmo surface QA
  → then Jai decides launch UX order (Venmo/PayPal vs Card)
```

- Stripe Card and PayPal `$8` sandbox are **proven**. Venmo is **unproven**.
  Final launch payment order is **undecided** pending Venmo evidence.
- Access only from **server-verified** provider/webhook confirmation — never a
  client-side “payment succeeded” flag or success-URL alone.
- Do not route ArtisTalks payments through Artistocks wallet/token rails.
- SEC-001 stays in force: no agent touches wallet-signing code; `fundWallet` stays disabled.
- Orbit tuition stays Sprint 5 (after approval).

### Important data boundary

Do **not** combine these into one status:

```text
SaaS subscription (DIY access gate)
- inactive  → no DIY access
- active    → access
- past_due  → ACCESS REMAINS ON (failed recurring payment; Jai handles manually)
- comped    → access

(No automatic boot on payment failure. Jai manually sets inactive to revoke.)

Orbit application/access
- not_applied (no row)
- draft
- submitted
- approved
- declined
- later (not Sprint 4): interview_scheduled, waitlisted, orbit_member

Orbit tuition
- not_required
- unpaid
- payment_plan
- paid_in_full
- pay_what_you_cancakes
- comped
- completed
```

A coupon affects the SaaS price. It must **not** automatically approve an application, activate Orbit access, or mark Orbit tuition paid.

Legacy note: older docs used a single `access_status` / `payment_status` pair. New work must use the three concepts above. Coin-granted / invite flags (when used) remain permission markers and still do not collapse SaaS vs Orbit tuition.

---

## 4. Entry, recognition, and claimed names

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
- email is asked **only** at the free-taste **save** gate, after the Living Affirmation
- save does **not** submit an Orbit application

### If the artist name is claimed

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

The mitigation is **not** the response copy. It is the rate limit. Requirements for the recognition / claim-challenge endpoint:

- server-side only; no cohort or artist list in any client bundle
- returns `{ claimed: boolean }` (and send ack when claimed) — never email
- no email in the response body, the UI, error messages, or logs
- normalized artist name/slug with a unique index
- rate-limited on recognition **and** on OTP attempts, shipped in the same commit as the endpoint
- after too many wrong codes, a calm "ask Jai for help" state

---

## 5. The Free Taste — 10 Steps / 7 Questions / 3 Visual Brand Steps

**Do not call this the six-question free taste.** That phrase is retired.

Accurate count:

```text
10 total steps
7 written questions
3 visual brand steps (Logo → Colors → Font)
```

Brand steps are panels, not written questions. The free-taste end remains `BUSINESS_OFFERING` / `business_type_products_services`.

| # | Step ID | Key | Question? |
|---|---|---|---|
| 1 | `INIT` | `artist_name` | yes |
| 2 | `LOGO_PANEL` | `logo_uploaded` | no — panel (upload, describe, or skip) |
| 3 | `COLORS_PANEL` | `colors_set` | no — panel |
| 4 | `FONT_PANEL` | `font_set` | no — panel (headline + optional body) |
| 5 | `GIFT_PRESENCE` | `gift_to_world` | yes |
| 6 | `KNOWN_FOR_LEGACY` | `known_for_legacy` | yes |
| 7 | `KNOWN_FOR_EXPRESSION` | `known_for_expression` | yes |
| 8 | `TARGET_REACH` | `target_reach` | yes |
| 9 | `GENRE_ASSOCIATIONS` | `genre_associations` | yes |
| 10 | `BUSINESS_OFFERING` | `business_type_products_services` | yes |

The Living Affirmation completes at **step 10**. The email **save** gate follows (not an automatic Orbit application).

Canonical gift language (do not paraphrase):

> Acknowledge yourself. What makes your presence a gift to the world?

Logo panel wording (do not paraphrase):

> Upload your logo—or describe the logo you imagine.

Skip counts as answered (`skipped: true`). Each brand step writes **one** curriculum answer row and creates **one** useful card — never three hidden rows from one Save, and never status phrases (`"Colors set"`, `"Font set"`, `"Logo uploaded"`) as answer text.

Fonts A (minimal): `profiles.font_family` = headline; nullable `profiles.body_font_family` = body (Geist until chosen). One Font step / one Font card / two optional choices.

Returning artists who completed the old combined brand panel (`colors_set`) are bridged so Logo + Colors + Font count as satisfied — do not force them backward through brand onboarding.

Code authority for order and `FREE_TASTE_LAST_STEP_ID`: `lib/curriculum.ts`.

---

## 6. The Living Affirmation

The Living Affirmation is the emotional payoff at the end of the free taste.
It assembles from the artist's own curriculum answers at the save gate.

### Core structure

> I am so happy and grateful now that **[ARTIST]** is stepping fully into **[GENRE / WORLD]**, creating **[BUSINESS / OFFER]**, known for **[EXPRESSION]**, and celebrated for **[LEGACY]**.

| Slot | Key |
|---|---|
| ARTIST | `artist_name` |
| GENRE / WORLD | `genre_associations` |
| BUSINESS / OFFER | `business_type_products_services` |
| EXPRESSION | `known_for_expression` |
| LEGACY | `known_for_legacy` |

Assembler: `lib/livingAffirmation.ts`. Exact artist strings; no silent rewrite.

### Presentation

- Show the artist's actual name prominently with the affirmation.
- Keep emerald/gold/etched ArtisTalks presentation.
- Let the artist edit the assembled affirmation before saving.
- Persist the edited version in `profiles.affirmation_text`.
- Editing the affirmation updates `affirmation_text` only. Source curriculum answers stay unchanged.

### Save gate copy (locked)

```text
This is worth saving. Write it down, print it, or put it somewhere you'll see it every day.

Enter your email to save your affirmation and keep building.
```

CTA button: **Save this affirmation — Free**

Broader coaching — one thing, momentum, radical action, hard thing first —
lives in later curriculum copy as the artist progresses.

### On return

- The saved edited affirmation persists in `profiles.affirmation_text`.
- After save and after login, curriculum continues in the emerald conversation.
- When the artist revisits the affirmation through the existing one-page experience, show the saved edited version.

`profiles.affirmation_text` already exists in Supabase. Restore application
support for the existing column. No schema work is required.

---

## 7. Post-save experience

ArtisTalks is one page: carousel, phase coins, emerald conversation, and the
artist's growing living page. The curriculum is the experience.

### Flow

```text
Artist begins curriculum
→ page becomes theirs (name, logo, colors, font, answers)
→ Living Affirmation assembles
→ artist edits affirmation
→ Save this affirmation — Free
→ email + six-digit OTP
→ work saved (profile + curriculum_answers + affirmation_text)
→ curriculum continues in the emerald conversation
→ artist leaves
→ artist returns securely
→ work restores
→ curriculum continues from the appropriate step
→ prior cards remain viewable and editable
→ new answers keep building the same page
```

### After free-taste save

- The next relevant curriculum question appears in the emerald panel.
- `CURRENT_FOCUS_PILLAR` asks where the artist is in their journey:
  - creating something new
  - finishing something in progress
  - promoting something finished
  - not sure yet
- The artist keeps answering. Each answer makes the page more personal.
- Prior carousel cards remain accessible and editable.
- Action-oriented coaching deepens through the spine as the artist progresses.
- Vision connects to action through curriculum questions.

### Curriculum as progress

- `curriculum_answers` stores the artist's curriculum answers and powers their growing ArtisTalks page.
- The MVP ships enough spine to demonstrate the experience and let real artists continue meaningfully.
- Real artist usage guides future curriculum expansion.

---

## 8. Code reality snapshot (audit 2026-08-03; still authoritative until next audit)

Do **not** trust the old 2026-08-01 “Verified Current Reality” claims (AuthPanel-only poster, no draft, no recognition). They are obsolete.

### Already in the repo

- Anonymous free taste + local draft (`lib/draft.ts`)
- Poster → portal; live artist name
- Living Affirmation at save gate
- Email OTP save + draft migration
- Returning claimed-name flow (`claim-challenge`, `verify-otp`, returning marker skips migrate)
- Progressive sanctuary accordion
- Rate-limited claim path

### Proven on private beta

- Resend SMTP and external six-digit OTP
- First-time and returning OTP
- Claimed-name recognition
- No email returned in the public claim/verify JSON
- Profiles can save artist name and brand colors
- Authenticated artist name satisfies INIT
- Color-only authenticated profiles restore saved primary/brand color

### Restore/save reliability — proven at `cd2dd56`

Proven working:
- first-time external six-digit OTP;
- returning claimed-name OTP;
- profile artist-name restoration;
- authenticated profile artist name satisfies INIT;
- saved color background restores instead of forcing the CreationCreator logo;
- first OTP persists free-taste answers into `curriculum_answers`;
- migrate clears the anonymous draft only after profile and every draft answer are confirmed stored;
- zero source answers at migrate is failure (draft kept + sanctuary banner), not success;
- authenticated Data Reset signs out without deleting `profiles` or `curriculum_answers` (no `localStorage.clear()`);
- anonymous Data Reset clears local unsaved draft only;
- claimed-name return restores progress; resume at first genuinely unanswered step;
- answers saved after login persist across Data Reset and return.

Historical note: earlier zero-row results for test artist `JT` / `a4d4dfa` were contaminated by destructive authenticated Data Reset and/or pre-guard silent clear on empty migrate — not the current behavior.

Approved invariants:
- never report sanctuary save success if curriculum_answers failed;
- never clear the anonymous draft until profile and answers are stored;
- profile.artist_name satisfies INIT;
- every other completed free-taste answer persists in curriculum_answers;
- returning artists resume after all durably answered questions;
- color-only authenticated profiles use saved primary/brand color;
- the CreationCreator marketing logo is only for untouched anonymous landing;
- one Data Reset button: Zeyoda-like exit when authenticated; local draft clear when anonymous;
- no current_step database column;
- no backfill;
- verify with fresh artists.

### Known gaps before warm beta MVP

**Current objective:** PayPal `$8` button funding cleanup (later code — not this
docs checkpoint), then Venmo surface QA on eligible US/mobile, then Jai decides
launch payment order. Sprint 5 Orbit tuition stays later.

**Shipped through Sprint 4 flow QA (`6596ad0`) plus `$8` rails (`ef49879`):**
- MVP core free-taste → save → restore → continue
- Smallest `$8/month` ongoing-access layer (chat-only DIY; silent invisible
  `cancakes` path — see §2 / Locked payments)
- Native Orbit application conversational flow + post-submit → `FAN_CONNECTION`
- Stripe Card `$8` sandbox proven; PayPal `$8` sandbox `PAYMENT.SALE.COMPLETED`
  entitlement proven (Locked 2026-08-25)

**Backlog:**
- Browser SaaS self-promotion security proof (Slice E follow-up)
- PayPal funding cleanup: disable card, credit, paylater; keep PayPal wallet
  and any eligible Venmo (verify current PayPal SDK funding-source identifiers
  before code). Then Venmo surface QA. Launch order undecided until then.
- A/B curriculum experiments (measure without rewriting canonical artist record)
- Treasure-hunt / growth experiments that unlock the hidden CANCakes path
  (not a new subscription status)
- Phase coin polish
- Journey fork branching in spine
- Admin dashboard (private beta uses Supabase Table Editor / SQL only)
- Sprint 5 Orbit tuition after approval

Code authority: `lib/curriculum.ts`, `app/page.tsx`, `components/EmeraldChat.tsx`, `components/ArtisTalksOrbitRenderer.tsx`.
`$8` PayPal: `lib/paypal.ts`, `lib/saasPaypalDb.ts`, `app/api/webhooks/paypal/route.ts`, `components/SaasPaypalButtons.tsx`.

---

## 9. Private beta plan

This is **not** the public launch of `artistalks.org`.

### Phase 1 — warm private beta

Invite via word of mouth, existing relationships, Rock N Roll Opry, personal outreach, QR/NFC as physical invitations (digital coin system later).

Measure: name entered; free taste completed; affirmation edited; save; OTP arrives;
return/restore; curriculum continues; prior cards editable; apply; SaaS vs Orbit choice.

Warm private beta begins when:

- the full real-phone core loop passes (§10 Slice D);
- external OTP and return restoration work reliably.

Real artist usage during the warm beta helps guide further curriculum work.

Paid SaaS access (Slice E) shipped at `fe8d869`; conversational Orbit + flow QA
complete at `6596ad0`; Stripe Card + PayPal `$8` sandbox proven at `ef49879`
(Locked 2026-08-25). Next: PayPal funding cleanup, then Venmo surface QA;
launch payment order undecided. Orbit tuition/payment remains Sprint 5.

---

## 10. Surgical MVP sprint order

One approved slice at a time: implement, test, approve, commit.
See §11 for chat/carousel drift — out of scope during MVP core sprints.

### Sprint 1 — Deploy and prove identity ✓ complete

Completed:
- private beta deployed;
- Resend custom SMTP;
- external first-time OTP;
- returning claimed-name OTP;
- claimed-name privacy;
- saved artist-name restoration;
- authenticated artist name satisfies INIT;
- saved color-background restoration;
- free-taste `curriculum_answers` persist on first OTP save;
- migrate clears draft only after profile + all draft answers confirmed;
- authenticated Data Reset is non-destructive (sign out; DB memory kept);
- return restores progress without replaying answered questions;
- resume at the first genuinely unanswered allowed step;
- post-login answers persist across Data Reset and return.

### Sprint 2 — MVP core ✓ complete

**Slice A — Artist name card**
- Carousel card prominently shows the artist's actual name (e.g. JAITEA).
- Files: `hooks/useCarouselItems.ts`, `components/OrbitPeekCarousel.tsx`

**Slice B — Living Affirmation + save**
- Name heading, gold/emerald editable affirmation at save gate
- Gate copy and CTA locked in §6
- `profiles.affirmation_text` persistence
- Files: `LivingAffirmation.tsx`, `EmeraldChat.tsx`, `lib/draft.ts`,
  `lib/migrateDraft.ts`, `hooks/useProfile.ts`, `lib/curriculum.ts`

**Slice C — Reliability**
- OTP rate-limit stability
- Data Reset event chain
- Geist/system font load
- Files: `ClaimedArtistGate.tsx`, `DataReset.tsx`, `lib/sessionReset.ts`,
  `EmeraldChat.tsx`, `app/page.tsx`, `utils/loadWebFont.ts`

**Slice D — Real-phone MVP test**

```text
New artist
→ Artist Name
→ Logo
→ Colors
→ Font
→ early curriculum
→ Living Affirmation
→ edit affirmation
→ Save this affirmation — Free
→ email OTP
→ saved account
→ curriculum continues
→ close/leave
→ return later
→ authenticate
→ work restores
→ prior cards viewable/editable
→ curriculum continues forward
```

Slice D must pass on a real phone before Slice E begins.

### Sprint 3 — SaaS access ($8/month) — Slice E ✓ complete

Checkpoint: `fe8d869 — Add paid ArtisTalks access gate`

- Smallest intentional paid continuation for ongoing ArtisTalks access
- Slice E era: Venmo/manual review acceptable for private beta
  *(rail order now Locked 2026-08-09 — Real payments: Stripe test-first;
  Venmo / PayPal launch-primary)*
- Orbit application remains separate from SaaS subscription
- Coupons/comps reduce or waive `$8` for an individual — explicit exception only

**Backlog from Slice E:**
- Browser SaaS self-promotion security proof

### Sprint 4 — Native Orbit application ✓ complete (flow QA @ `6596ad0`)

Checkpoint: `6596ad0 — Fix Orbit and SaaS conversation flows`

Proven conversational scope:

- After `CURRENT_FOCUS_PILLAR`, EmeraldChat offers **two routes** (not sequential
  upsells):
  1. **Continue ArtisTalks — $8/month** (DIY)
  2. **Apply to Orbit Launch** (free)
- Orbit application is **not** a curriculum step and must not live inside the
  curriculum state machine; save ≠ apply
- Curriculum continuation past `CURRENT_FOCUS_PILLAR` is gated by SaaS
  `active`/`comped` **or** Orbit application `submitted`/`approved`
  (`hasOrbitRouteAccess`). `draft` does **not** unlock deeper curriculum;
  `declined` does **not** grant Orbit-route entitlement
- Proven Orbit path: apply free → submit → confirmation
  (“Application received. Jai will review your Orbit application.”) →
  `FAN_CONNECTION` → deeper curriculum while Jai reviews. No `$8` required
  after submit
- Proven DIY path (temporary test): chat-only; no artist-facing access-word /
  beta UI; no `SaasAccessGate` component; silent server-side `cancakes`
  recognition → “What can you pay today?” → `0` comps once → one-shot
  `FAN_CONNECTION`. Browser self-promotion security proof stays backlog
- Apply to Orbit bypasses `$8` checkout; applying is free
- Authenticated artists may apply whether `saas_subscription_status` is
  `inactive`, `active`, or `comped`
- Native EmeraldChat conversation replaces Tally and any sanctuary form UI;
  no admin dashboard; no tuition/payment in this sprint; no SMS; no Artistocks;
  no Orbit membership activation
- Display existing sanctuary/profile/curriculum on the living page; do **not**
  snapshot/duplicate them into `orbit_applications`
- `orbit_applications` holds only new application fields + status/timestamps
  (never Orbit fields in `curriculum_answers`)
- Minimum new questions (one at a time in EmeraldChat):
  1. Best phone number
  2. Why Orbit now / what to accomplish over the next six months
  3. Ready to commit to six months of focused artist development? Yes / Not yet
  → then explicit Submit Orbit application
- Status: no row = `not_applied`; stored `draft | submitted | approved | declined`
- Draft editable by artist; **submitted is read-only** to the artist for MVP
- Artist cannot self-set `approved` or `declined` (server/admin only)
- Jai reviews manually in Supabase (application + linked profile +
  `curriculum_answers`); sets approved or declined
- Temporary product copy stays plain — do not invent Guide “apply yourself”
  poetry (`ARTISTALKS_GUIDE_VOICE.md` §6 remains `[NEEDS JAI]`)

**Next objective:** PayPal `$8` funding cleanup, then Venmo surface QA ← current
(see Locked 2026-08-25). Not Orbit tuition. Launch payment order undecided.

### Payments — SaaS `$8` (after Sprint 4; before Sprint 5)

1. Wire `past_due` into DB + access: `active | past_due | comped` continue;
   only `inactive` blocks DIY. Failed recurring payment → `past_due`; **no
   automatic boot** — Jai manually sets `inactive` to revoke. **Proven.**
2. Stripe `$8` sandbox Card: in-chat Payment Element → webhook → subscription
   row → `active` → `FAN_CONNECTION`; failed-payment → `past_due`. **Proven.**
3. PayPal `$8` sandbox on the same entitlement architecture:
   subscription → verified `PAYMENT.SALE.COMPLETED` → `provider='paypal'` →
   `provider_status='ACTIVE'` → `saas_subscription_status='active'`. **Proven.**
   Venmo remains unproven. Next: funding cleanup (disable PayPal card, credit,
   paylater; keep PayPal wallet + eligible Venmo), then real-phone Venmo
   surface QA, then Jai decides launch UX order.
4. `cancakes` remains permanently invisible (silent EmeraldChat recognition).
5. Zero Orbit tuition code in this lane.

### Sprint 5 — Orbit payment and activation

- Explicitly later — **zero Orbit tuition code until this sprint**
- After approval only:
  `approved → choose $500/mo × 6 or $2,000 upfront → pay →
  Orbit active → ArtisTalks included for the Orbit term`
- SaaS status and Orbit status remain separate internally; activation may
  include/`comp` ArtisTalks access so there is no double charge
- Pay What You CANCakes and other paths as needed

---

## 11. Do Not Touch During the MVP Core Sprints

**The chat/carousel drift bug.** `EmeraldChat.currentStepId` and `page.activeStepId` can drift apart. `ARTISTALKS_EXPERIENCE_ARCHITECTURE.md` §1.3 documents a June 2026 regression where a partial focus/objective split made the app feel broken and had to be reverted.

If it is touched while the funnel is being rewired, we will not know which change broke what. It gets its own sprint, later, or it does not get touched.

Also not yet: NFC claim port from Zeyoda, wallets/tokens, Artistocks commerce,
automated enrichment, Twilio-required marketing SMS, LLM rewriting, unfinished
accounting modules. (DIY `$8` Stripe/PayPal is the current payments lane — not
parked. Orbit tuition remains Sprint 5.)

---

## 12. Where New Curriculum Goes

Jai has more curriculum arriving from other chats. Routing per `ECOSYSTEM_MEMORY_MAP.md`:

| Material | Destination |
|---|---|
| Curriculum questions, milestones, after-answer flavor | `CURRICULUM_V2.md` (canonical) |
| Release checklist — creative, distribution, marketing, legal, post-release | `CURRICULUM_V2.md` as a PROD/POST module |
| Tone of voice, signature phrases, how Jai greets and calls artists higher | `ARTISTALKS_GUIDE_VOICE.md` |
| Mastermind facilitation — breakout rooms, declarations, flips, coherence teaching | `ARTISTALKS_GUIDE_VOICE.md` — facilitation layer, not app curriculum |
| Artist testimonials | `ARTISTALKS_GUIDE_VOICE.md`, voice evidence — not curriculum, not Jai's voice |
| Mastermind executive summary and authority statements | Marketing copy. Uses "Founder:" correctly — that is Jai |
| Action-oriented curriculum / check-in questions | `CURRICULUM_V2.md` as spine steps inside emerald curriculum |

**Outstanding:** ten Instagram reels are behind Instagram's login wall and cannot be fetched or transcribed by an agent. To use that material, the files need to be downloaded locally or transcribed to text first.

---

## 13. Locked decisions

### From Sprint 0 (still in force)

1. First question is always artist name only. Never "artist name or email."
2. Artist name renders live at the top as they type.
3. Unclaimed names continue the free taste; email is asked only at the **save** gate.
4. Claimed names get a locked door: code to the email on file, no email shown, no mask, no continue-anyway.
5. `cancakes` is a payment-path code, never a login code.
6. The free taste is 10 steps / 7 written questions / 3 visual brand steps to the affirmation (supersedes older “8 steps / 7 questions” count).
7. "Six-question free taste" is retired language.
8. lowercase "my champion" = every artist; capitalized "Champions" = the Orbit Launch cohort.
9. Orbit Launch artists are never called founders. The cohort revolves.
10. The ArtisTalks Guide is the emerald chat voice, is not GOSHBOT, and is built last.
11. The product promise: the artist answers the emerald chat, and the page comes alive.
12. ArtisTalks is one page: carousel, phase coins, emerald conversation, and the artist's growing living page.
13. The curriculum is the experience. Curriculum answers power the growing page.
14. Coaching language inspires curriculum copy. New product behavior requires explicit approval.

### Locked 2026-08-05 — business + curriculum

1. Saving and applying are **separate**. Never auto-submit an application on save.
2. Free email save and restore of free-taste stay free.
3. Ongoing SaaS is **$8/month** for DIY ArtisTalks users.
   *(Superseded for Orbit stacking: see Locked 2026-08-07 — $8 vs Orbit
   two-route pricing. Active Orbit includes ArtisTalks; no double $8.)*
4. Orbit tuition is separate from the DIY `$8` path and is charged only after
   approval. *(Superseded stacking rule: SaaS is included during active Orbit.)*
5. Coupons/comps may reduce or waive `$8` for an individual — explicit exception only.
6. Artists may apply for Orbit without first subscribing to SaaS.
7. SaaS subscription status, Orbit application/access status, and Orbit tuition status stay separate.
8. Post-save experience continues through the curriculum spine (§7).
9. First launch is private beta. *(Payment rail order superseded by Locked
   2026-08-09 — Real payments: build/test Stripe first; Venmo / PayPal
   primary at launch.)*
10. Sprint order in §10 is current; old Sprint 1–10 funnel list is retired.

### Locked 2026-08-05 — restore / first-save reliability

1. Never report successful sanctuary save if curriculum_answers migration failed.
2. Never clear the anonymous draft until profile and curriculum answers are both
   stored.
3. Authenticated profile.artist_name satisfies INIT; all other completed
   free-taste answers must persist in curriculum_answers.
4. Color-only authenticated profiles restore saved primary/brand color; do not
   force the CreationCreator marketing logo merely because logo_url is null.
5. Logo background applies only when logo_url exists and
   logo_use_background === true.
6. No current_step database column and no test-account backfill.
7. Save-failure recovery copy:
   “Your account is connected, but your sanctuary has not finished saving yet.
   Your work is still safe in this browser. Try saving again.”
8. Returning artists must never replay a durably answered question. Resume waits
   until profile and curriculum-answer hydration are ready, then selects the
   first genuinely unanswered allowed step.
9. Fresh test artist `JT` under `a4d4dfa` showed INIT/color restore while
   `curriculum_answers` appeared empty — historical. Later proven causes included
   destructive authenticated Data Reset and/or silent clear on empty migrate;
   current behavior is governed by items below and checkpoint `cd2dd56`.
10. Do not change RLS, grants, or schema without a precise error proving the need.

### Locked 2026-08-05 — Data Reset + first-save confirm

1. One Data Reset button (Zeyoda-like when authenticated): sign out; clear
   temporary returning-claim marker; preserve `profiles` and `curriculum_answers`.
2. Anonymous Data Reset clears the local unsaved draft only.
3. Never clear the anonymous draft until profile and every draft answer are
   confirmed stored (inserted or already existed).
4. Zero source answers at migrate is failure — keep the draft and show the
   sanctuary-not-finished-saving banner; never treat it as success.
5. Authenticated Data Reset must never delete database rows and must never call
   `localStorage.clear()`.
6. Post-login answers auto-save to `curriculum_answers` and must survive Data
   Reset and claimed-name return.

### Locked 2026-08-06 — brand spine (Logo → Colors → Font)

1. Free taste order: Name → Logo → Colors → Font → Gift → rest; end stays
   `business_type_products_services`.
2. Three real curriculum steps with keys `logo_uploaded`, `colors_set`,
   `font_set` — one answer row and one purposeful card per step.
3. No mega brand panel; no mini-wizard; no three orphan rows from one Save.
4. Logo: upload, describe, or skip. Skip saves `{ skipped: true, step_id: "LOGO_PANEL" }`
   and counts as answered.
5. Fonts A minimal: `font_family` = headline; add nullable `body_font_family`;
   one Font step / one Font card; body defaults to Geist; artist sanctuary
   content uses those fonts; app chrome stays readable.
6. Panel saves use select-then-update-or-insert (`user_id` + `question_key` +
   `project_id IS NULL`). Partial unique index is a race backstop, not the
   update mechanism. Disable Save while submitting.
7. Old combined-brand artists (`colors_set` present) are bridged across Logo,
   Colors, and Font for resume.
8. No status phrases stored as normal answer text. No carousel-motion work in
   this change.

### Locked 2026-08-06 — MVP core

1. Flow: curriculum → affirmation → edit → save → curriculum continues →
   return → restore → continue (§7).
2. Gate copy and CTA locked in §6.
3. `profiles.affirmation_text` stores the edited affirmation; source curriculum
   answers stay unchanged.
4. After login, curriculum continues. Show saved affirmation text when the
   artist revisits affirmation through the existing one-page experience.
5. Paid `$8/month` access begins only after Slice D real-phone QA passes.
6. Artist-name card shows the actual name prominently.
7. Implement behavior Jai specifies. Present new UX separately for approval.

### Locked 2026-08-07 — Sprint 4 Native Orbit application

1. Sprint 3 / Slice E complete at `fe8d869 — Add paid ArtisTalks access gate`.
   Sprint 5 Orbit tuition stays later — **no Orbit payment code in Sprint 4**.
   *(Sprint 4 current-status superseded by Locked 2026-08-09.)*
2. After `CURRENT_FOCUS_PILLAR`, EmeraldChat offers two routes (not sequential
   upsells): **Continue ArtisTalks — $8/month** or **Apply to Orbit Launch**.
   Orbit application is conversational inside EmeraldChat; not a sanctuary form;
   not a curriculum StepId. Save ≠ apply.
3. Authenticated artists may apply with SaaS `inactive`, `active`, or `comped`.
   Apply bypasses `$8` checkout. Applying is free.
4. No SMS consent in Sprint 4. Contact field is phone number only. Email is
   already known from authenticated identity.
5. Do not snapshot sanctuary data into `orbit_applications`. Store only new
   Orbit fields + status/timestamps. Jai reviews linked profile and
   `curriculum_answers` in Supabase.
6. Minimum questions (one at a time): phone; why Orbit now / six-month goals;
   commit Yes / Not yet; then Submit.
7. Status: no row = `not_applied`; stored `draft | submitted | approved | declined`.
   Draft editable; submitted read-only to artist for MVP; approved/declined
   server/admin only.
8. Jai reviews in Supabase Table Editor / SQL only — no admin dashboard.
9. After submit:
   “Application received. Jai will review your Orbit application.”
   → `FAN_CONNECTION` → deeper curriculum while Jai reviews.
   No `$8` is required after Orbit submit.
   Approved tuition/payment remains Sprint 5 only.
10. Guide voice §6 remains `[NEEDS JAI]`. Plain product copy only.
11. Backlog: browser SaaS self-promotion security proof (Slice E follow-up).

### Locked 2026-08-07 — $8 vs Orbit two-route pricing

1. **ArtisTalks `$8/month`** = DIY guided artist-development software.
2. **Orbit** = done-with-you/mastermind. Application free. Tuition only after
   approval (`$500/mo × 6` or `$2,000` upfront for private beta).
3. `$8` and Orbit are **alternative paths**, never step 1 then step 2.
4. Orbit applicants do **not** need to buy `$8` first.
5. Active Orbit membership **includes ArtisTalks** during the Orbit term — no
   double payment. SaaS status and Orbit status stay separate internally;
   activation may include/`comp` ArtisTalks access (Sprint 5).
6. An existing `$8` member who later joins Orbit must not pay both; Orbit
   activation replaces the separate `$8` obligation while Orbit is active.
7. If Orbit is not approved / not the fit, ArtisTalks remains available for
   `$8/month`.
8. Supersedes older “every Orbit artist also pays `$8` on top” stacking copy.

### Locked 2026-08-09 — Sprint 4 flow QA complete; payments assessment next

1. Checkpoint `6596ad0 — Fix Orbit and SaaS conversation flows`. Sprint 4
   conversational Orbit + DIY flow QA is **complete**.
2. Proven DIY path: Continue ArtisTalks → `$8` / silent invisible `cancakes`
   → “What can you pay today?” → amount → `FAN_CONNECTION`.
   No artist-facing access-word/beta UI; no `SaasAccessGate`.
3. Proven Orbit path: Apply free → submit →
   “Application received. Jai will review your Orbit application.” →
   `FAN_CONNECTION` → deeper curriculum while Jai reviews. No `$8` required
   after submit. `$8` remains the separate DIY choice.
4. Unlock rules: `draft` = resume apply only (no deeper unlock);
   `submitted` | `approved` = Orbit-route curriculum continuation;
   `declined` = no Orbit entitlement (DIY `$8` still available).
5. Payments assessment complete. Current objective: `$8` Stripe sandbox test
   implementation — see Locked 2026-08-09 — Real payments decisions.
6. Sprint 5 Orbit tuition stays later (`$500/mo × 6` or `$2,000`). Active Orbit
   includes ArtisTalks — no double `$8`. SaaS / Orbit application / Orbit
   tuition remain separate concepts. No Orbit fields in `curriculum_answers`.
7. Confirms Locked 2026-08-07 item 9 (submit → `FAN_CONNECTION`; no `$8` after submit).

### Locked 2026-08-09 — Real payments decisions

1. Payments **assessment complete**. Current objective: `$8` Stripe sandbox
   test implementation, then PayPal / Venmo.
2. **Build/test order:** Stripe `$8` first (checkout, webhook, DB subscription
   record, `active` → `FAN_CONNECTION`, failed-payment → `past_due`). Then
   PayPal / Venmo on the same entitlement architecture.
3. **Launch UX order:** **Venmo / PayPal** primary; **Card** (Stripe) secondary.
   Not Card-first with Venmo as an afterthought.
4. Access only from server-verified provider/webhook confirmation. Never trust
   client “payment succeeded” or success-URL alone.
5. **`past_due` retains access.** DIY gate:
   `inactive` = no access; `active` | `past_due` | `comped` = access.
   Failed recurring payment → `past_due`; artist keeps ArtisTalks; Jai handles
   manually. **No automatic boot.** Revoke only when Jai sets `inactive`.
6. **`cancakes` always invisible.** Never: “Have a code?”, “Beta access”,
   “Coupon code”, “Pay What You CANCakes” button, or “Enter secret word.”
   Artist types `cancakes` in EmeraldChat at the payment moment → silent
   server recognition → “What can you pay today?” → amount → approved path.
7. **Backlog (not now):** A/B curriculum experiments (measure without rewriting
   the canonical artist record); treasure-hunt / growth experiments that unlock
   the hidden CANCakes path (not a new subscription status).
8. Sprint 5 Orbit tuition remains later. Do not collapse SaaS, Orbit
   application, and Orbit tuition.
9. Supersedes “Venmo before Stripe” engineering order and “assessment only /
   do not wire SDKs” as the current objective.

### Locked 2026-08-25 — Stripe Card + PayPal `$8` sandbox proven

Checkpoint: `ef49879 — Add PayPal subscription entitlement flow`.

1. Stripe Card `$8` sandbox is **proven**: in-chat Payment Element → webhook
   (`invoice.paid` → `active`; `invoice.payment_failed` → `past_due`) →
   WELCOME TO ARTISTALKS → `FAN_CONNECTION`. `past_due` keeps access.
   `comped` is protected. Cancel does not automatically revoke.
2. PayPal `$8` sandbox E2E is **proven**:
   sandbox PayPal subscription
   → verified `PAYMENT.SALE.COMPLETED`
   → `provider='paypal'`
   → `provider_status='ACTIVE'`
   → `saas_subscription_status='active'`
   → existing ArtisTalks entitlement flow (welcome → `FAN_CONNECTION`).
   Client `onApprove` is UX-only. `custom_id` is the opaque attempt UUID.
3. PayPal grant scope remains limited: only `PAYMENT.SALE.COMPLETED` sets
   `active`. Failed-payment / cancellation lifecycle is not implemented.
4. Venmo is **unproven**. It is not a separate engine. Do not promise it.
5. **Launch payment order is undecided** pending Venmo surface evidence.
   Locked 2026-08-09 item 3 (Venmo/PayPal primary, Card secondary) remains
   historical intent, not a re-lock. Current shipped UI is Card CTA with
   PayPal under it.
6. **Later** PayPal funding cleanup (not this docs checkpoint; do not
   implement until SDK identifiers are verified): disable PayPal `card`,
   `credit`, and `paylater`; keep the PayPal wallet path and any eligible
   Venmo funding source if/when PayPal surfaces it. Stripe already owns
   the Card experience inside EmeraldChat.
7. Current objective after this checkpoint: that funding cleanup, then
   Venmo surface QA on eligible US/mobile, then Jai decides launch order.
   Sprint 5 Orbit tuition stays later.
8. Supersedes Locked 2026-08-09 items 1–2 as the **current objective**
   (those rails are now proven). Does not rewrite 2026-08-09. Items 4–8
   of that note remain in force (webhook-only access, `past_due` keeps
   access, invisible `cancakes`, no Orbit/SaaS/tuition collapse).
