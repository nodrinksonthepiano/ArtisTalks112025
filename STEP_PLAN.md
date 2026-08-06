# STEP_PLAN.md — ArtisTalks Launch Plan

**Status:** Private beta at `artistalks8526.vercel.app`.

Sprint 1 save-and-restore proven:
- first OTP saves profile + free-taste `curriculum_answers`;
- authenticated Data Reset signs out without deleting DB memory;
- claimed-name return restores progress;
- resume at the first genuinely unanswered step;
- new answers after login persist across Data Reset and return.

Planning checkpoint: `6319649`.
Prior restore checkpoint: `a4d4dfa` (partial — INIT/color only).
Current checkpoint: `cd2dd56` (non-destructive Data Reset + first-save confirm-before-clear).

**Code baseline:** `feature/artist-accordion-hub` @ `cd2dd56`. Do not merge to main.
**Last updated:** 2026-08-05

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
→ optional Orbit application
→ $8/month ongoing ArtisTalks SaaS
→ separate Orbit tuition after approval
→ Venmo activation and manual review for private beta
```

Parked for now: Final Cut, Blender, workshop automation, NFC coin claim port, Stripe, LLM Guide (last), dreamboard/tesseract, Google working studio.

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

- Customer-facing phrase: **Pay What You CANCakes**
- Server-side access/payment-path code: **`cancakes`**
- Never an OTP or login credential. Validated only after identity is verified.

---

## 3. Product ladder and pricing

### Final product ladder

```text
FREE TASTE
→ build the beginning of the sanctuary
→ free email save and restore

STANDALONE ARTISTALKS
→ $8/month
→ ongoing playground, check-ins, versions, links and continued building

ARTISTALKS ORBIT LAUNCH
→ application is separate from saving
→ approval is separate from payment
→ $8/month ArtisTalks SaaS continues
→ PLUS six-month Orbit tuition
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

The subscription provides the limited saved playground, including approved
features such as:

- recurring action commitments;
- deadlines;
- return check-ins;
- reporting what was implemented;
- new asset versions;
- progress history;
- dinosaur/old-internet links;
- continued sanctuary building.

**Every active SaaS user pays $8/month, including Orbit participants.**

Jai may issue a coupon or comp that reduces or waives the subscription for an
individual artist. A discount is an **explicit exception**, not an included Orbit benefit.

### ArtisTalks Orbit Launch

Orbit is a separate six-month guided program.

Pricing:

- **$3,000** standard total;
- **$500/month** for six months;
- **$2,000** paid in full upfront, saving $1,000;
- **Pay What You CANCakes** by approval.

An Orbit artist therefore normally pays:

```text
$8/month SaaS
+
their approved Orbit tuition arrangement
```

Applying, approval, SaaS subscription, and Orbit tuition are separate states.

Artists may apply for Orbit **without** first subscribing to the $8/month SaaS.

### Payment rails (private beta)

- Venmo before Stripe.
- Manual Venmo verification is acceptable.
- Do not route ArtisTalks payments through Artistocks wallet/token rails.
- SEC-001 stays in force: no agent touches wallet-signing code; `fundWallet` stays disabled.

### Important data boundary

Do **not** combine these into one status:

```text
SaaS subscription
- inactive
- trialing
- active
- past_due
- canceled
- comped

Orbit application/access
- not_applied
- draft
- submitted
- interview_scheduled
- approved
- waitlisted
- declined
- orbit_member

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

Gate-only. Do not move into the middle of free taste, the page subtitle, or a carousel card.

Template:

> I am so happy and grateful now that **[ARTIST]** is stepping fully into **[GENRE / WORLD]**, creating **[BUSINESS / OFFER]**, known for **[EXPRESSION]**, and celebrated for **[LEGACY]**.

| Slot | Existing key |
|---|---|
| ARTIST | `artist_name` |
| GENRE / WORLD | `genre_associations` |
| BUSINESS / OFFER | `business_type_products_services` |
| EXPRESSION | `known_for_expression` |
| LEGACY | `known_for_legacy` |

Assembler: `lib/livingAffirmation.ts`. Exact artist strings; no silent rewrite.

---

## 7. Limited saved playground (post-save boundary)

### The gap in current code

After free-taste save, the code currently continues into the **full remaining curriculum spine** (`CURRENT_FOCUS_PILLAR` onward). That is incorrect for MVP. Bound the experience to the limited playground below. Stop before exposing unfinished mastermind curriculum.

### Playground contents (approved)

**Where are you in your journey?**

- creating something new;
- finishing something;
- preparing to release or promote;
- building the larger artist world;
- not sure yet;
- add my own.

**Bring in the work**

- upload a demo, song, photo, artwork, lyrics, or video;
- mark one asset as featured;
- later upload a newer version;
- preserve earlier versions rather than replacing them invisibly.

**Dinosaur links** (optional; supporting material, not the center)

- website, Instagram, TikTok, YouTube, Bandcamp, Spotify/Apple, Facebook/X, add another.

**Dream direction**

- artists to collaborate with;
- artists to be on tour with;
- stages, venues, festivals, or communities they are moving toward.

**Action commitment**

> What will you do, and by when?

Store: action; target date; optional proof or uploaded version; status: planned, in progress, implemented, revised.

**Return check-in**

> What did you implement?

Then: acknowledge completed action; ask what changed; allow a new asset version; compare old and new; ask what comes next and by when.

### Beta success loop

```text
Decide
→ act
→ return
→ report
→ upload the next version
→ see progress
→ choose the next action
```

That loop is the useful SaaS product before the full mastermind curriculum exists.

### Post-save choice (UI intent)

After the sanctuary is safely saved:

```text
[Keep building my sanctuary]

[Apply for the ArtisTalks Orbit Launch]
```

`$8/month` unlocks ongoing playground activity. Free email save/restore of free-taste remains free.

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

### Known gaps / bugs to fix in upcoming sprints

- After save, spine continues past free taste (playground unbound)
- Phase coins over-reveal (wrong tags + imperative opacity override)
- Anonymous logo still triggers login alert after blob preview
- Font picker lists fonts that are not loaded (only Geist via `next/font`)
- Journey fork does not branch (`nextStep` hardcoded)
- Native application, SaaS/Orbit status fields, Venmo, admin queue: **absent**
- No LLM / Guide API yet (correct — last)

Code authority: `lib/curriculum.ts`, `app/page.tsx`, `components/EmeraldChat.tsx`, `components/ArtisTalksOrbitRenderer.tsx`.

---

## 9. Private beta plan

This is **not** the public launch of `artistalks.org`.

### Phase 1 — warm private beta

Invite via word of mouth, existing relationships, Rock N Roll Opry, personal outreach, QR/NFC as physical invitations (digital coin system later).

Measure: name entered; free taste completed; save; OTP arrives; return/restore; playground use; action commitment; implementation report; apply; SaaS vs Orbit choice.

### Phase 2 — controlled cold testing

Only after warm artists prove understanding and return. Split-test invitation promise, not radically different products. Same proven core onboarding until evidence justifies change.

Do not treat artistalks.org as a broad public launch until:

- external OTP works;
- return restoration works;
- the limited playground boundary is intentional;
- native application works;
- Venmo review and activation work.

---

## 10. Surgical MVP sprint order

Each sprint is one clear objective. Do not broaden. Do not touch chat/carousel drift during these sprints (see §11).

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

Next: Sprint 2.

### Sprint 2 — First-impression truth ← current

- no coins before artist name;
- PRE only during early onboarding;
- fix opacity override and phase tags;
- remove anonymous logo login alert;
- show only fonts that truly load.

### Sprint 3 — Bound the saved playground

Implement only:

- journey;
- dinosaur links;
- featured asset;
- version upload;
- dream collaborators / On Tour With;
- “What will you do, and by when?”;
- return check-in: “What did you implement?”;
- intentional stop before unfinished curriculum.

### Sprint 4 — SaaS access

- free saved preview of free-taste restore;
- `$8/month` status;
- manually administered Venmo-first SaaS payment initially;
- preserve application access without requiring SaaS purchase;
- coupons/comps reduce or waive `$8` only — never auto-approve Orbit.

### Sprint 5 — Native application

- replace Tally;
- prefill existing answers;
- phone field;
- separate optional SMS consent (unchecked by default; wording/version/timestamp/source);
- application draft and submission;
- simple Jai review queue;
- interview request.

### Sprint 6 — Orbit payment and activation

- `$3,000` standard;
- `$2,000` paid in full;
- `$500/month`;
- server-protected `cancakes`;
- Pay What You CANCakes;
- Venmo QR/reference;
- pending-review state;
- manual verification;
- access activation;
- keep SaaS subscription status independent of tuition.

### After private-beta MVP (not blocking warm beta)

- Wire journey routing for real (if still linear)
- Extend undo/redo beyond chat steps
- ArtisTalks Guide (last)
- Enrichment, dreamboard/tesseract, social dinosaur polish, Google working studio
- Stripe after Venmo is proven

---

## 11. Do Not Touch During the Funnel / Playground Sprints

**The chat/carousel drift bug.** `EmeraldChat.currentStepId` and `page.activeStepId` can drift apart. `ARTISTALKS_EXPERIENCE_ARCHITECTURE.md` §1.3 documents a June 2026 regression where a partial focus/objective split made the app feel broken and had to be reverted.

If it is touched while the funnel is being rewired, we will not know which change broke what. It gets its own sprint, later, or it does not get touched.

Also not yet: NFC claim port from Zeyoda, wallets/tokens, Artistocks commerce, automated enrichment, Twilio-required marketing SMS, Stripe, LLM rewriting, unfinished accounting modules.

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
| Limited playground questions / action loop | This file §7; implement in product, keep unfinished mastermind spine out of post-save UX |

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

### Locked 2026-08-05 — business + playground

1. Saving and applying are **separate**. Never auto-submit an application on save.
2. Free email save and restore of free-taste stay free.
3. Ongoing SaaS is **$8/month for every active user**, including Orbit/mastermind artists.
4. Orbit tuition is separate. SaaS is **not** included in Orbit tuition.
5. Coupons/comps may reduce or waive `$8` for an individual — explicit exception only.
6. Artists may apply for Orbit without first subscribing to SaaS.
7. SaaS subscription status, Orbit application/access status, and Orbit tuition status stay separate.
8. Limited playground contents and beta success loop are defined in §7.
9. First launch is private beta; Venmo before Stripe; manual review OK.
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
