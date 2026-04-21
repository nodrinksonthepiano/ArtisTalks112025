# AGENT_NOTES.md — Artistocks Protocol: Cross-Project Working Memory

> **For the AI agent**: Read this before making changes to features, architecture, auth, or payment flows. Never read or modify `.env`. Never run git commands. Always state your plan in chat before touching files.

---

## 1. The Mission

This is a **protocol for artist sovereignty on the internet.**

Artists rent their audience from platforms (Spotify, Instagram, TikTok). They do not own their fan relationships, revenue, or data. Artistocks flips this: every artist gets their own token, fan graph, revenue stream, and a path to full sovereignty via `transferEverything()`.

**Training wheels, not a trap.** The goal is for artists to eventually hold their own contracts and data. When that happens, the protocol steps out.

---

## 2. The QR Code On-Ramp

A QR code replaces the artist's Linktree. Fan scans at a Broadway show → lands on artist page → tips via Venmo (existing behavior) → that tip becomes their wallet, fan connection, and entry into the protocol.

Zero new behavior from the fan. Venmo is the on-ramp.

---

## 3. The New Internet Layer

A dinosaur button in the UI reveals links to Instagram, Facebook, etc.) framed as "the old internet layer." Artistocks is the new layer where artists own everything.

Like social media, but the artist owns the graph. Like Spotify, but money goes directly to the artist. Interoperable — artists can still be on Spotify and Instagram as distribution channels.

---

## 4. Project Map

```
Zeyoda (foundation)          ArtisTalks (UI)
├── Magic.link auth          ├── Supabase auth
├── Middleware, whitelist     ├── Single page, orbital carousel
├── API routes, payments     ├── Chat, curriculum, panels
├── networkGuard, guardedSigner, apiGuard
├── Proxy pattern (/api/public/*)
└── fundWallet DISABLED      └── Curriculum flow, carousel
```

**Zeyoda** (`zeyoda-nextjs-091825`): Foundation, contracts, API, auth, security.
**ArtisTalks** (`ArtisTalks112025`): UI, chat, curriculum, carousel, orbit tokens.

---

## 5. The UI (Single Page)

**Top:** Artist name, mission statement, halo (glow behind content).

**Center:** Orbital carousel — cards with media, tokens orbiting around. Cards from `curriculum_answers` + current question card. Swipe to navigate.

**Above chat:** Panel that changes by context — onboarding, purchase options, logo/colors/font panels.

**Bottom:** Chat input bar — always visible. EmeraldChat.

**Events:** `cardEdit` (pencil click → edit mode), `cardNavigate` (swipe → sync chat), `profilePreview`, `logoPreviewChange`, `primaryColorChange`, `panelComplete`.

---

## 6. Carousel Sync

- **activeStepId** = single source of truth for chat and carousel.
- **cardEdit** = Pencil on card → edit mode, navigate to that card.
- **cardNavigate** = Swipe → update activeStepId, sync chat.
- **isEditMode** = blocks auto-center; user stays on edited card.
- **isUserSwipeRef** = prevents auto-center from fighting during swipe.

**Bug:** Chat and carousel can drift when switching edit/progress mode or when swipe and auto-center overlap. Branch: `fix-chat-carousel-sync-navigation`.

---

## 7. SEC-001 Security Incident

**Date:** Oct 2025. **Amount:** ~$11 USD.

**What happened:** AI agent (Cursor) called `/api/fundWallet` with mainnet RPC. No network guard. Funds sent to scammer address.

**Root causes:** No chainId check, `NEXT_PUBLIC_RPC` used server-side, no address allowlist, world-readable `.env`.

**Current status:**
- `networkGuard.ts` ✅ — `requireBaseSepolia(provider)` blocks mainnet
- `guardedSigner.ts` ✅ — `createGuardedSigner` uses networkGuard
- `apiGuard.ts` ✅ — rate limit, x-internal-secret
- `fundWallet` ✅ **DISABLED** (returns 403)
- `funding_address_allowlist` ❌ Not implemented
- `wallet_funding_audit` ❌ Not in schema (wallet_funding exists, different)
- Key rotation, .env permissions — human only

**Rule:** No agent may touch wallet-signing code or re-enable fundWallet until human confirms all remediation is done.

---

## 8. Standing Rules

- **Never** read or modify `.env` or `.env.local`
- **Never** run git commands
- **Never** touch wallet-signing code without human review
- **Always** state plan in chat before editing files
- **Always** check `buildOrder` in PRD.json before starting any feature
- **Always** verify SEC-001 remediation before touching wallet code

---

## 9. Key Files

**Zeyoda:**
- `middleware.ts` — route whitelist
- `app/utils/networkGuard.ts` — chainId check
- `app/utils/guardedSigner.ts` — safe wallet
- `app/utils/apiGuard.ts` — rate limit, secret
- `app/utils/server/whitelistCheck.ts` — verifyWhitelist
- `app/api/fundWallet/route.ts` — DISABLED
- `app/api/public/*` — proxy routes

**ArtisTalks:**
- `app/page.tsx` — main page, carousel, activeStepId
- `components/EmeraldChat.tsx` — chat, curriculum
- `components/OrbitPeekCarousel.tsx` — cards, swipe
- `components/ArtisTalksOrbitRenderer.tsx` — orbit tokens
- `hooks/useCarouselItems.ts` — card generation
- `lib/curriculum.ts` — steps

---

## 10. Session Log

| Date | Session |
|------|---------|
| 2026-02-22 | Initial AGENT_NOTES.md. Full codebase read. Created AGENT_NOTES, ROADMAP, PRD v3, updated ZEYODA_KNOWLEDGE_BASE. |
