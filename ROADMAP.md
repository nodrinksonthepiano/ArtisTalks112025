# Artistocks Protocol — Full System Roadmap

**Last updated: 2026-02-22**

---

## What Exists and Works Today

### Zeyoda

| Feature | Status |
|---------|--------|
| Magic.link email login | ✅ Done |
| Whitelist (`whitelist_emails`) | ✅ Done |
| Middleware route protection | ✅ Done |
| networkGuard.ts (chainId 84532 only) | ✅ Done |
| guardedSigner.ts (safe wallet) | ✅ Done |
| apiGuard.ts (rate limit, x-internal-secret) | ✅ Done |
| Proxy routes `/api/public/*` | ✅ Done |
| Artist token deployment | ✅ Done |
| LP seeding + AMM pricing | ✅ Done |
| Live price indicator | ✅ Done |
| Token swap (USD → Artist token) | ✅ Done |
| Featured download purchase ($5, ERC-1155) | ✅ Done |
| Artist earnings in wallet | ✅ Done |
| Cash (USD) balance in wallet | ✅ Done |
| Deposit/Withdraw Cash buttons | ⚠️ Stubbed |
| Venmo/PayPal/Card buttons | ⚠️ Stubbed |
| fundWallet | ❌ Disabled (403) |

### ArtisTalks

| Feature | Status |
|---------|--------|
| Supabase auth | ✅ Done |
| Single-page design | ✅ Done |
| Orbital carousel (OrbitPeekCarousel) | ✅ Done |
| Phase tokens (ArtisTalksOrbitRenderer) | ✅ Done |
| Chat (EmeraldChat) | ✅ Done |
| Curriculum flow (pre/prod/post/legacy) | ✅ Done |
| Inline pickers (colors, logo, font, asset) | ✅ Done |
| Card generation from curriculum_answers | ✅ Done |
| activeStepId sync (cardEdit, cardNavigate) | ✅ Done |
| Live preview (profilePreview events) | ✅ Done |
| applyLogoBackground (from Zeyoda) | ✅ Done |

---

## What Is Broken / In Progress

| Feature | Branch | Issue |
|---------|--------|-------|
| Chat + carousel sync | fix-chat-carousel-sync-navigation | State can drift when switching edit/progress mode or when swipe and auto-center overlap |
| Middleware cleanup | feat/secure-middleware-whitelist-clean | Route whitelist explicit definition |

---

## New Supabase Tables Needed

| Table | Phase | Purpose |
|-------|-------|---------|
| `feedback` | 2 | User/admin feedback tickets |
| `wallet_funding_audit` | 3 | Log every wallet funding (one per address) |
| `funding_address_allowlist` | 3 | Approved addresses for funding |
| `pending_payments` | 4 | Venmo pending records |
| `play_events` | 5 | Counted listens (idempotency) |
| `playlists` | 7 | Mixtape tokens |

---

## New API Routes Needed

| Route | Method | Phase | Purpose |
|-------|--------|-------|---------|
| `/api/feedback` | POST | 2 | Submit feedback |
| `/api/payments/create` | POST | 4 | Create pending payment |
| `/api/payments/venmo-webhook` | POST | 4 | Venmo confirmation |
| `/api/toppins` | POST | 5 | Deduct $0.02 per listen |
| `/api/artist/withdraw` | POST | 6 | Artist withdrawal |
| `/api/artist/transfer-sovereignty` | POST | 9 | transferEverything() |

---

## Build Phases (In Order)

### Phase 0 — Prep
- Fill carousel-001 bug description
- Confirm SEC-001 remediation (key rotation, .env permissions)
- Drop docs into repos

### Phase 1 — Security Foundation
- `wallet_funding_audit` table
- `funding_address_allowlist` table
- SEC-001 docs complete

### Phase 2 — Feedback & Admin
- `feedback` table
- POST /api/feedback
- Feedback button (mic→speaker) in chat
- Dinosaur button
- GOSHEESH token → admin panel
- Admin: feedback inbox, PRD items

### Phase 3 — Wallet Funding Re-enable
- Re-secure fundWallet with all guards
- Admin: funding controls, audit log

### Phase 4 — Venmo Payment Rail
- pending_payments table
- /api/payments/create
- Venmo webhook
- Top-up prompt in chat

### Phase 5 — Media Player & Toppins
- Protocol-aware player
- 60s teaser
- play_events table
- POST /api/toppins
- Free play tracking

### Phase 6 — Artist Withdrawal
- POST /api/artist/withdraw
- USDC/Coinbase Commerce

### Phase 7 — Playlisting
- playlists table
- Play queue, play next
- Mixtape tokens in orbit

### Phase 8 — Wallet Messaging
- Schema design

### Phase 9 — Sovereignty
- transferEverything() UI
- Artist data export

---

## Open Questions (Blocking)

| # | Question | Blocks |
|---|----------|--------|
| Q-001 | Carousel sync: exact bug symptom? | carousel-001 |
| Q-002 | Venmo webhooks reliable? | Phase 4 |
| Q-003 | Venmo memo format for matching? | Phase 4 |
| Q-004 | Who pays gas on withdrawal? | Phase 6 |
| Q-005 | Minimum withdrawal threshold? | Phase 6 |

---

## Sovereignty Arc

```
TODAY                    MIDDLE                    END
─────────────────────────────────────────────────────────
Protocol holds:          Artist takes:            Artist holds:
• Contracts         ──►  • Contract ownership     • Everything
• LP                     • Vault tokens           • Their fan graph
• Custody                • LP tokens              • Their data
• Fees              ──►  • Their fees             • Their revenue
• Artist data            • Data export            Protocol: out.
                    transferEverything()
```
