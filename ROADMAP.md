# ArtisTalks Roadmap — Public Curriculum + Ecosystem Routing

**Last updated: 2026-02-22**

---

## Memory Routing Note

Use `ECOSYSTEM_MEMORY_MAP.md` before interpreting mixed ArtisTalks / Artistocks / Zeyoda concepts.

- **ArtisTalks teaches.**
- **Artistocks launches.**
- **Zeyoda protects.**
- **GOSHBOT routes memory.**

Preserve useful ecosystem memory, but route each idea through the correct project lane before suggesting work.

---

## What Exists and Works Today

### ArtisTalks Technical — Works Today

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

### Shared Ecosystem Patterns — Works Today

| Pattern | Source / Use |
|---------|--------------|
| Halo / live preview | Zeyoda theming patterns applied in ArtisTalks |
| Orbit tokens | Shared orbit language adapted for ArtisTalks phase progress |
| Chat-first UX | Shared ecosystem pattern: chat is the guide |
| Profile theme handling | Colors, logo, font, and preview events |
| Agent workflow memory | Docs, PRD, and Cursor rules now route through `ECOSYSTEM_MEMORY_MAP.md` |

### Routed Elsewhere — Artistocks / Zeyoda Commerce & Infrastructure

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

---

## What Is Broken / In Progress

| Feature | Branch | Issue |
|---------|--------|-------|
| Chat + carousel sync | fix-chat-carousel-sync-navigation | State can drift when switching edit/progress mode or when swipe and auto-center overlap |
| Middleware cleanup | feat/secure-middleware-whitelist-clean | Route whitelist explicit definition |

---

## ArtisTalks Public Roadmap

Public ArtisTalks is legacy music-business coaching and release preparation. This lane should not mention Artistocks, tokens, wallets, payments, treasury, swaps, funding, or web3 unless intentionally routed through Future Bridge.

- Curriculum v2
- First 20 questions
- Champion Heart release-prep path
- Artist identity
- Branding / colors / logo / font
- Visual world / halo data module
- Project planning
- Rights / publishing awareness
- Marketing / content plan
- Budget / accounting basics
- Launch planning
- Feedback
- Legacy

---

## ArtisTalks Technical Roadmap

- Chat / card sync
- Carousel polish
- Orbit behavior
- Card labels and useful output-card taxonomy
- Saved answers
- Supabase `curriculum_answers`
- Upload polish
- Profile customization
- Live preview behavior
- Feedback button (mic → speaker) in chat
- Feedback inbox / admin view for ArtisTalks operations

---

## Shared Ecosystem Patterns

- Halo / orbit lessons
- Theme preview lessons
- Onboarding lessons
- Component fixes
- Design system lessons
- GOSHBOT / Cursor workflow lessons
- Dinosaur button as shared ecosystem language, not default public commerce language

---

## Future Bridge

Hidden/admin/safeword/advanced path only. Preserve this memory, but do not surface it in public ArtisTalks until intentionally activated.

- Advanced ownership education
- Web3 literacy
- Future Artistocks readiness bridge
- GOSHEESH token → admin panel
- Protocol-aware media player
- Wallet messaging
- Mixtape token in orbit
- `transferEverything()` UI
- Artist data export
- Sovereignty arc

---

## Routed To Artistocks Or Zeyoda

These ideas are real ecosystem memory, but they are not public ArtisTalks curriculum.

### Artistocks Lane

- Commerce
- Stock up
- Artist pages
- Fan action
- Tokens
- Purchases / downloads
- Payments
- Venmo / PayPal / Card rails
- Pending payments
- Toppins
- Treasury
- Withdrawals
- Swaps
- Play events tied to commerce

### Zeyoda Foundation Lane

- Auth/security infrastructure
- Contracts
- APIs
- Middleware
- `wallet_funding_audit`
- `funding_address_allowlist`
- Network guards
- Guarded signer
- API guard
- SEC-001 remediation
- Key rotation and `.env` permissions — human only

---

## Open Questions (Blocking / Routed)

| # | Question | Blocks |
|---|----------|--------|
| Q-001 | Carousel sync: exact bug symptom? | ArtisTalks Technical — carousel-001 |
| Q-002 | Venmo webhooks reliable? | Artistocks / Zeyoda — payment rail |
| Q-003 | Venmo memo format for matching? | Artistocks / Zeyoda — payment rail |
| Q-004 | Who pays gas on withdrawal? | Artistocks / Zeyoda / Future Bridge |
| Q-005 | Minimum withdrawal threshold? | Artistocks / Zeyoda / Future Bridge |

---

## Future Bridge / Ecosystem Context — Sovereignty Arc

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
