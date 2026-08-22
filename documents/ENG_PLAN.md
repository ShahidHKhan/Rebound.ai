# Rebound.ai — Engineering Plan

*Execution roadmap: what's built, what's next, sequencing, and risks. For architecture, see [`TDD.md`](./TDD.md). For product requirements, see [`PRD.md`](./PRD.md). For the detailed session-by-session build log (commits, exact verification steps, tooling gotchas), see the repo's `HANDOFF.md` — this document is the planning-level summary, not a replacement for it.*

**Ownership**: solo build (Shahid Khan), AI-paired via Claude Code. No team to sequence around; "milestones" below are self-imposed, not stakeholder commitments.

## Current status

**Live**: beta deployed on Vercel (`main` branch), real Supabase Postgres + Clerk (Development instance) + Anthropic/Gemini APIs. Full Flow A → Flow B → escalation-monitor loop works end-to-end against real infrastructure. REST API (migrated off tRPC), Postgres RLS enforced and CI-checked, rate limiting live on all routes, nonce-based CSP.

**A real gap in this project's own record-keeping, discovered while writing this document**: the actual code shows two significant changes with no corresponding write-up anywhere in `HANDOFF.md` — (1) Flow A now retrieves a matching "skeleton" preset (`packages/agents/src/skeleton-retrieval.ts`, `PresetKind.SKELETON`, `PresetSlot` model) and has the LLM fill its slots, rather than drafting fully freeform; (2) production's default model changed from Sonnet 5 to `gemini-3.6-flash` (`packages/agents/src/client.ts`, comment-dated "provider-swap session, 2026-08-20" — a date `HANDOFF.md` has no session entry for at all). A guided session player (`/session/[slot]`, `WorkoutSession.durationSeconds`) is also present as uncommitted work in progress (`git status`). **Before trusting any "what's built" claim below or in `TDD.md`, re-verify against the actual code** — this gap is exactly why: the log missed real work once already. Whoever picks this up next should backfill `HANDOFF.md` with what happened in that undocumented window, or the gap will compound.

## Milestone history (condensed)

1. **Foundation** — monorepo scaffold, Prisma schema, Supabase, Clerk, Anthropic integration; exercise library seeded (873 rows, Free Exercise DB).
2. **Flow A / Flow B core loop** — hybrid rules+LLM regime generation and recursive adjustment, real-time escalation monitor, structural + clinical validation, retry/fallback handling for LLM failures.
3. **Postgres RLS** — two-tier trust model (privileged vs. restricted connection), policy-per-table, later hardened with CI coverage enforcement and a real cross-user isolation test after a real regression (`preset_slots` briefly had no RLS decision recorded).
4. **Mobile app** — Expo Router port of the full web flow, real-device tested (not just simulator), local two-notification-a-day system confirmed delivering on a real device.
5. **Accessibility baseline** — font scaling + 44px tap targets, both apps.
6. **Security hardening pass** — privacy policy, AI-usage disclosure, crisis-response screening, the full 20-item vulnerability checklist audited and closed, then a second later pass adding rate limiting, the RLS coverage gap fix, and nonce-based CSP.
7. **First production deploy** — Vercel, `main` branch, live URL.
8. **Admin experimentation tooling** — LLM call logging, dry-run engine (fixture-driven Flow A/B trigger + trace inspection), then the scenario simulator (chained Flow A → Flow B cycles against synthetic pain trajectories, with diffing and charts) — built specifically to give the still-open "Flow A/B quality" work a real test harness.
9. **Page-map screen batch** — 24 screens built across both apps in one coordinated push (marketing pages, sequenced onboarding, billing/paywall previews, core-loop screens, engagement/progress screens), closing nearly the entire original screen-inventory gap.
10. **REST migration** — tRPC → OpenAPI-contracted REST across both apps, phased and verified at each step, zero tRPC remaining.
11. **Second security-hardening pass** — Postgres-backed rate limiting (reversing an earlier explicit deferral), RLS coverage CI enforcement, `withAdminOnlyAuth` narrowed to a compiler/runtime-enforced table allowlist, nonce-based CSP.
12. **(Undocumented) Flow A skeleton-preset architecture + provider swap to Gemini + in-progress guided session player** — see the gap called out above. Real work, real current state, missing narrative.

## What's next

**Primary, per the last confirmed direction (2026-08-22) and unchanged since**: Flow A/B regime-generation quality. The stated goal is making generated regimes "actually clinically effective rather than gimmicky" — start by reading `packages/agents/src/flow-a.ts`/`flow-b.ts` and running real scenarios through `/admin/experiments/scenarios` before deciding what to change. The skeleton-preset retrieval addition (see above) appears to already be a step in this direction; confirm with whoever's picking this up whether it's considered complete or a first iteration.

**Immediate housekeeping before deeper work**:
- Reconcile `HANDOFF.md` against actual repo state (see the gap above) — confirm `git status`/`git log` rather than trusting the doc's own "current as of" claims.
- Commit and merge the in-progress guided session player work currently sitting uncommitted (`apps/mobile/app/(app)/session/`, `apps/web/src/app/session/`, plus the modified handlers/schema/contracts around it).
- Add `DATABASE_URL`/`DATABASE_URL_RLS` as GitHub Actions repo secrets — without them, CI's RLS cross-user isolation test silently *skips* rather than fails, so CI currently reports green without ever having proven isolation in that environment.

## Backlog, roughly in suggested order

**Legal & Compliance** — done. Privacy policy, AI-usage disclosure, third-party processor disclosure, data-deletion handling, crisis-response screening all shipped.

**Security** — largely done for beta scale. Remaining: re-confirm every Clerk Dashboard security setting (email verification, password strength, rate limiting, bot protection) on the **Production** instance specifically once that cutover happens — everything so far was confirmed on Development, and Clerk's Dev/Prod settings are independent. Add the Production Clerk frontend-API domain to the CSP allowlist at the same time, or sign-in breaks under the nonce policy.

**Clerk Production cutover** — blocked on having a custom domain; otherwise ready to execute per the plan already documented in the git-history record.

**Performance** — fully unstarted. In rough priority order once real traffic exists: compress API responses in transit, batch DB writes where they happen in a loop, add a circuit breaker for slow external dependencies, apply optimistic UI updates on user actions, trim over-fetching queries, audit for N+1 queries, confirm unused DB connections are closed, confirm no hidden background jobs hold connections open.

**UX polish** — a targeted pass (loading states, success/error banners, confirmation modals) shipped ahead of a demo; ~16 smaller items remain unstarted (sticky headers, skip-to-content link, mobile hamburger menu, hover states, scroll progress bar, site search, expandable FAQ, dark-mode toggle, cookie-consent banner, copy-to-clipboard, print stylesheet, password-visibility toggle, UTM tracking). Low priority relative to Flow A/B quality and the real design pass.

**A real UI/UX design pass** — deliberately deferred until the core loop + billing exist. Billing exists only as a non-functioning preview, so the trigger condition for this is arguably still not fully met — worth a deliberate call on whether "preview is enough" or this waits for real Stripe. See `DESIGN_BRIEF.md` for the full framing once this starts.

**Billing / Stripe** — no account or keys exist yet. The product-logic trigger point (paywall at first real adjustment) is already correctly implemented and waiting; this is purely "connect a real payment processor," not a design or logic gap.

**Old Supabase project decommissioning** — the pre-migration Supabase project still exists, untouched, fate undecided.

## Risks & open items

- **Clinical sign-off is the largest single launch blocker.** `determineRiskTier`'s thresholds and the change-ceiling `ABSOLUTE_BOUNDS` are still invented defaults, not reviewed by a PT/clinical advisor. A literature cross-check (done, not a substitute for real review) found the "10% rule" specifically is weaker evidence than the PRD's "evidence-informed" framing implies — never validated in a peer-reviewed trial, and a key systematic review found no injury-risk difference between 10% and 24% weekly load increases, with the real risk signal being single-session spikes rather than a weekly percentage. The 0–3/4–6/7–10 pain-tier split is a legitimate general clinical convention but doesn't precisely match the specific pain-monitoring model the PRD gestures at by name. **Get a real PT/clinical advisor review before launch** — the admin scenario simulator exists specifically to give that reviewer a concrete, realistic test set (`pnpm --filter @rebound/db seed:test-fixtures`'s three named trajectories: plateauing, worsening, contradictory) rather than asking them to review abstractly.
- **Unit economics unconfirmed.** The switch to a cheaper default model is a real cost-conscious move but hasn't been validated against the ~$14.99/mo reference price point with actual measured volume — `LlmCall` now provides real per-call cost data to do this with, which didn't exist when the PRD's Tech-Stack section was written.
- **Risk tier is set once, never reassessed.** No product or technical path exists for a user to report a new injury or flare-up after onboarding, despite it being the only lever controlling how aggressively their regime can progress.
- **Legal review not started.** TOS, medical disclaimers, liability insurance scoping, state health-data law applicability, App Store/Play health-data requirements — all still open, all need digital-health counsel, none are code-fixable.
- **Concentration/vendor risk** — single-vendor dependency on Vercel/Supabase/Clerk, plus the demo-only AscendAPI free tier (explicitly disposable, not a real risk to the funded plan which already accounts for the paid swap).
- **`HANDOFF.md` reliability** — see the discovered gap above. Treat any narrative claim in it (or in this document, derived partly from it) as provisional until checked against the actual code, git log, and running system.

## Verification standard

Every item above that claims "done" was, at the time it was built, verified against the real Supabase DB and real Anthropic/Gemini API — not mocked — including real cross-user RLS isolation tests, real forced-failure tests (invalid API keys to exercise fallback paths), and real device testing for mobile-specific behavior (notifications, safe-area handling, gesture support). Hold any future work to the same standard: `pnpm typecheck && pnpm test && pnpm check:rls` at minimum, plus a real click-through for anything UI-facing, before calling something done.
