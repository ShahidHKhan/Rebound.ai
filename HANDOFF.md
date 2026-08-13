# Rebound.ai — Engineering Handoff

Written 2026-08-13, for a fresh Claude session picking up this build. Read this before touching code, then read `Rebound.ai PRD.md` for full product context (Clinical Risk Framing, Data Model, System Design sections especially).

## Read this first: how this project is being built

The user is building this app **as a hands-on AI-engineering learning exercise**, not just shipping a product. The established collaboration pattern for feature work:

- Break work into small, numbered tasks. For each: explain *what* and *why*, then give full code as fenced blocks for the user to paste into their own editor and run themselves.
- Wait for their result (they paste terminal output back) before moving to the next task.
- The user sometimes says "implement steps X" or "do it yourself" — that's an **explicit, one-time override** for that specific step, not a standing change. Default back to guide-mode afterward unless told otherwise.
- Verification commands (`pnpm typecheck`, `pnpm test`, running a script to confirm something works) are fine to run directly regardless of mode — the restriction is specifically about writing the *feature implementation* for them.
- The monorepo scaffold (Turborepo, Prisma schema, tRPC skeleton, `packages/clinical-rules`) was built directly by Claude *before* this pattern was established — everything since (Flow A, Flow B, the API layer) followed it.

**Do not skip this** — reverting to "just implement everything directly" defeats the actual point of the exercise for the user.

## What Rebound.ai is

AI-powered PT app (see PRD for full detail). Core loop: onboarding → AI drafts a two-session daily exercise regime (Flow A) → user logs pain/completion daily → a recursive agent adjusts the regime weekly (Flow B) → a separate real-time escalation monitor watches every log for pain spikes. Heavy emphasis on rules-based safety guardrails wrapping the LLM, not just LLM judgment alone — see PRD's "Clinical Risk Framing" section.

## Repo layout

```
apps/web        Next.js 16, Clerk auth, tRPC route handler, cron routes
apps/mobile     Expo, Clerk mobile auth, tRPC client — UI is just a health-check placeholder
packages/db     Prisma schema (real Supabase Postgres), exercise-library seed script
packages/api    tRPC routers — the real backend API surface
packages/clinical-rules   Pure deterministic safety logic, zero DB/LLM deps, 41 unit tests
packages/agents Anthropic SDK orchestration — Flow A, Flow B, classifiers, job runner
```

## What's built and verified (all against the real Supabase DB + real Anthropic API)

**Foundation**
- Monorepo scaffold, real Supabase, real Clerk, real Anthropic key all configured and working
- Exercise library seeded: 873/873 from Free Exercise DB

**`packages/clinical-rules`** (pure functions, no I/O, fully unit tested):
- `checkRedFlags` — structured red-flag screen
- `determineRiskTier` — **provisional policy**, not exactly PRD-specified (see Known Gaps below)
- `validateStructure` (Zod) + `validateRegime` (absolute bounds + change-ceiling delta check)
- `checkEscalation` — the real-time pain-spike threshold table

**`packages/agents`** (all LLM orchestration):
- `search_exercises` tool, `submit_regime` tool → `generateInitialRegime` (Flow A draft, self-corrects invalid exercise IDs)
- `classifyFreeTextRedFlags` — Haiku classifier catching red-flag disclosures the structured screen misses
- `screenOnboarding` (sync gates) + `upsertUserForOnboarding` + `draftAndPersistRegime` (slow path) + `runOnboarding` (convenience wrapper combining all three — used by test scripts)
- `runRegimeGenerationJob` — retry/backoff loop for the async job (3 attempts); on exhaustion falls back to `assignFallbackPreset` (`packages/agents/src/preset-fallback.ts`), which clones the closest-matching `Preset` into a personal `DRAFT` regime for the user
- `assignFallbackPreset` — matches by risk tier (falls back to a tier-agnostic preset, then any preset, if no exact match), re-validates the cloned draft through `validateStructure`/`validateRegime` before persisting, computes `versionNumber` the same way `draftAndPersistRegime` does
- `submit_adjustment` tool → `proposeAdjustment` (Flow B draft)
- `runFlowBForUser` — trailing Session Log window, `validateRegime` **with** delta check, one-retry-with-rejection-feedback, persists new regime version + `AdjustmentEvent`
- `applyEscalationRollback` — shared helper, actually flips regime status + logs the event; used by both the real-time monitor and the day-4 check

**`packages/api`** (real tRPC routers, wired into `apps/web`'s route handler):
- `onboarding.submit` / `onboarding.getJobStatus` — real async job pattern via Next's `after()`, with a fire-and-forget fallback for when `after()` is called outside a live request (matters for testing, see gotchas)
- `regime.activate` — review/edit → re-validate server-side → go live → creates today's `WorkoutSession` rows (placeholder 7am/6pm times, see gaps)
- `sessionLog.create` — writes the log, runs the escalation monitor inline, applies real rollback if triggered

**`apps/web`** (backend routes):
- `/api/cron/flow-b` — due-user query (7-day cadence) + runs Flow B per user, `CRON_SECRET`-gated
- `/api/cron/day-4-check` — post-rollback settle check, all three branches (resumed/re-escalated/inconclusive) verified

**`apps/web`** (real UI — built and click-tested end-to-end this session, including a genuine escalation rollback):
- `/sign-in`, `/sign-up` — Clerk auth pages. `proxy.ts` now protects every route by default (was previously `/admin`-only), exempting sign-in/sign-up and `/api/*` (which self-protect via `protectedProcedure`/`CRON_SECRET`)
- `/onboarding` — full questionnaire matching `onboardingSubmissionSchema` exactly, submits to `onboarding.submit`, polls `onboarding.getJobStatus` every 2s, branches on red-flagged vs. job-complete vs. job-failed
- `/regime/[regimeId]` — review screen (exercises grouped by Morning/Evening, editable sets/reps/duration/frequency/slot), calls `regime.activate`; only sends an edited exercise list if something actually changed (else `createdBy` stays `AGENT`)
- `/` — the daily loop: today's two `WorkoutSession` cards with mark-complete, the daily check-in form (`sessionLog.create`), and streak display. Surfaces "stop & consult a professional" messaging when `escalation.action === "rollback"` comes back from a log submission
- `/admin` — metrics (activation funnel, adverse events, Flow A/B failure counts, reversal rate) + flagged-users list (escalation rollbacks, "made it worse" flags, failed Flow A jobs) with a manual-hold toggle. Gated by `adminProcedure`'s DB-backed role check, not by route-level role checking (see gaps)

**New backend additions supporting the UI above** (didn't exist before this session):
- `regime.getById` query (`packages/api/src/routers/regime.ts`) — was missing; needed to fetch a drafted regime with exercise details for review
- `workoutSession.today` / `workoutSession.complete` (`packages/api/src/routers/workout-session.ts`, new router) — bundles active regime + today's sessions + today's log status + current streak in one round trip
- `computeCurrentStreak` (`packages/api/src/streak.ts`) — pure function, walks backward from today (or yesterday, if today hasn't happened yet) counting consecutive days with ≥1 completed session
- `admin.flaggedUsers` / `admin.setManualHold` / `admin.metrics` (`packages/api/src/routers/admin.ts`, new router)

**`/api/cron/flow-b` — now verified through the real route**, not just `flow-b-test`. `pnpm --filter @rebound/api setup-cron-test-user` backdates `test-user-cron-due`'s regime 8 days; hitting the route with `Authorization: Bearer $CRON_SECRET` processed that user (real Anthropic call, real `validateRegime`, real `AdjustmentEvent` persisted — outcome was `held`, expected since the fixture has zero `SessionLog` history to act on). A second call immediately after returned `processed: 0`, confirming the anchor-reset logic correctly excludes a user right after they're processed.

**Flow B verified against a real account too**, not just the synthetic fixture: backdated the real test account's last `AdjustmentEvent.triggeredAt` by 8 days (restored afterward), triggered the route, got `status: "adjusted"` — the LLM saw a real pain=9 log, reasoned correctly against the account's `LIGHT_INJURY` tier, and proposed a reduced-intensity adjustment (not a full rollback) that passed `validateRegime`'s delta check and persisted as regime v3, `ACTIVE`, v2 `SUPERSEDED`. Home page (`/`) now shows a "Regime v{N}" label so this is visible without cross-referencing exercise values by hand.

**Preset fallback — seeded and verified end-to-end.** `pnpm --filter @rebound/db seed:presets` creates 3 fixed-id presets (`preset-general`, `preset-light-injury`, `preset-heavier-chronic-elderly`), one per risk tier, built from low-difficulty STRETCH/MOBILITY exercises (conservative-by-design, same caveat as `ABSOLUTE_BOUNDS`). Required adding `PRESET_FALLBACK` to the `RegimeCreatedBy` enum (schema change, pushed to the real Supabase DB via `prisma db push`). **Verified with a real forced-exhaustion test**: ran `runRegimeGenerationJob` against a `LIGHT_INJURY` test user with `ANTHROPIC_API_KEY` overridden to an invalid value (isolated to that one script's process, real key untouched) so all 3 attempts fail fast on real 401s instead of waiting on slow/costly real failures — job ended `status: FAILED` (correctly still flagged for admin review) with `resultRegimeId` pointing at a new `DRAFT` regime (`createdBy: PRESET_FALLBACK`, 5 exercises matching `preset-light-injury`) and `fallbackPresetId` set. `/onboarding`'s UI now has a third branch (`FAILED` + `resultRegimeId` present) offering "Review your starter regime" — the regime itself is a normal `Regime` row, so `/regime/[id]` and `regime.activate` needed no changes to support it.

**Four real bugs found and fixed while building/verifying the UI (not provisional decisions — restored already-intended behavior):**
- `draftAndPersistRegime` (`packages/agents/src/onboarding.ts`) hardcoded `versionNumber: 1`, so a second onboarding submission for the same user collided with the `@@unique([userId, versionNumber])` constraint and silently failed all 3 retries. Now computed as `(max existing version for user) + 1`, matching the pattern `flow-b-runner.ts` already used.
- `sessionLog.create`'s inline escalation monitor never checked `user.manualHold` before calling `applyEscalationRollback` — Flow B's cron route already filtered held users out, but this call site didn't. Now gated with `&& !user.manualHold`. **Verified via `createCaller`**: with `manualHold: true`, a pain=9 log still correctly computes `escalation.action: "rollback"` internally, but `AdjustmentEvent` count and the active regime are unchanged — the suppression genuinely works, not just typechecks.
- `setup-cron-test-user.ts` was missing the `adjustmentEvent`/`sessionLog` cleanup steps that gotcha #6 below describes — deleting `Regime` first threw a FK constraint error on any re-run after the fixture had been processed once. Fixed to match the reset order `setup-day4-test-users.ts` already used correctly.
- `sessionLog.create` had no once-daily enforcement — `@@unique([userId, loggedAt])` never actually collides since `loggedAt` defaults to the exact submission instant. Added an explicit guard (`packages/api/src/date-utils.ts`'s `startOfToday()`, shared with `workout-session.ts`) that throws `CONFLICT` on a second same-day log. **Verified via `createCaller`**: first log of the day succeeds, second is rejected with `"You've already logged today."`

**Regression test scripts** (all hit the real DB — good re-verification tools):
```
packages/agents:  smoke-test, tool-use-test, flow-a-test, flow-a-persist-test,
                  classifier-test, onboarding-test, flow-b-test
packages/api:     e2e-test, escalation-e2e-test, setup-cron-test-user,
                  setup-day4-test-users
packages/db:      seed (exercise library), seed:presets (fallback presets)
```
Run via `pnpm --filter @rebound/agents <script>` / `pnpm --filter @rebound/api <script>` / `pnpm --filter @rebound/db <script>`.

## What's NOT built yet

- **Mobile app UI** — `apps/mobile` is still just a health-check placeholder; none of the auth/onboarding/regime/daily-loop screens have been ported there. Same backend, no new API work needed.
- **Notification system** — not started at all
- **Accessibility baseline** — not started
- Non-engineering: Figma designs, legal/ToS, unit economics confirmation, risk-tier reassessment path

## Known gaps / provisional decisions (flag these, don't silently "fix" them without discussing)

- **`determineRiskTier`'s exact thresholds are invented**, not specified by the PRD (which gives tier *behavior* but not the onboarding→tier mapping algorithm). Same "needs PT/clinical sign-off before launch" status as the change-ceiling numbers themselves.
- **`ABSOLUTE_BOUNDS`** in `packages/clinical-rules/src/change-ceilings.ts` are provisional conservative defaults, same caveat.
- **`WorkoutSession` scheduling times are hardcoded** (7am/6pm placeholders in `regime.activate`) — real wake-time/sunset logic is still-open PRD Question #3, not built.
- **Flow B's due-user query** (`/api/cron/flow-b`) is a simplified interpretation of "anchor to the later of the regular schedule or the most recent escalation rollback" — it anchors to whichever `AdjustmentEvent` is most recent (any type), or regime `createdAt` if none exists. Reasonable, not spec-perfect.
- **No Postgres RLS policies exist anywhere in the repo**, despite the PRD and `trpc.ts`'s own comments describing app-layer role/ownership checks as running "alongside RLS at the database layer." User-data isolation currently rests entirely on `ctx.userId`/`adminProcedure` checks in application code, not a DB-enforced guarantee. Found while building the admin panel; not on any prior known-gaps list. Worth its own task — real SQL policies plus Clerk JWT claim wiring, not a quick patch.
- **`AdjustmentEvent.wasReversed` has no writer anywhere in the codebase.** The Data Model always intended this to be "set retroactively," but that retroactive-marking job/logic doesn't exist yet. The admin panel's reversal-rate metric reports this honestly (always 0 right now) rather than faking a computation.

## Tooling gotchas hit this session (avoid rediscovering these)

1. **Every new `packages/*/tsconfig.json` needs `"include": ["src", "scripts"]` and must NOT set `rootDir`.** Setting `rootDir: "src"` while `scripts/` is also included causes "File is not under rootDir" errors. Hit this identically for `packages/db` and `packages/agents`.
2. **VS Code can silently use the wrong TypeScript version** in this monorepo — `apps/mobile`'s Expo scaffold pins a different major TS version than everything else. Root `.vscode/settings.json` now pins `typescript.tsdk` to the repo root's own install. If "cannot find name console/fetch/process" type errors reappear despite correct tsconfig, check the TS version in the status bar first, not the code.
3. **Anthropic tool-use calls need `max_tokens: 4096`, not 2048**, in both `flow-a.ts` and `flow-b.ts` — echoing back a full 10-12 exercise regime plus reasoning routinely needs more than the smaller default.
4. **`after()` (Next.js) throws when called outside a real HTTP request.** This matters when testing tRPC procedures via `createCaller` from a plain script — there's no live request scope. `onboarding.submit` wraps `after()` in try/catch with a fire-and-forget fallback specifically for this; it's intentional, not a bug to "fix."
5. **`RegimeGenerationJob.userId` is a required FK to `User`.** The user row must exist before the job row is created — this is why `upsertUserForOnboarding` runs synchronously in `onboarding.submit` before job creation, not inside the backgrounded `draftAndPersistRegime`.
6. **Test scripts using a fixed `test-user-*` id must reset prior state before re-running**, respecting FK delete order: `AdjustmentEvent` and `SessionLog` before `Regime` (neither cascades; only `RegimeExercise` cascades from `Regime`). Every script that creates data follows this pattern now — copy it rather than re-deriving.
7. **Never put real secrets in any `.env.example` file** — those are tracked by git (the real `.env` files are gitignored). This happened twice this session and had to be cleaned up both times. Real credentials belong only in `apps/web/.env`, `packages/db/.env`, `packages/agents/.env`, `packages/api/.env` (all gitignored, all currently pointing at the same real Supabase DB / Anthropic key — check those files directly rather than asking the user to repaste credentials).
8. **On Windows, `prisma generate` fails with `EPERM: operation not permitted, rename ... query_engine-windows.dll.node`** if the Next.js dev server (or anything else with the Prisma client loaded) is currently running — it locks the native engine DLL. Ask the user to stop `pnpm --filter @rebound/web dev` before running `prisma generate` or `prisma db push` (push itself succeeds; it's the auto-triggered generate step after it that fails), then they can restart it once generation succeeds.
9. **To force a fast, deterministic LLM failure for testing** (e.g. exercising a retry-exhaustion path) without waiting on real slow failures or burning real API calls: override `process.env.ANTHROPIC_API_KEY` to a garbage value and load `@rebound/agents` via a *dynamic* `import()` afterward, from a script with no static import of it. `client.ts` builds the Anthropic client eagerly at module load, so a static import (hoisted before any code runs) would still capture the real key. Used to verify the preset-fallback path this session.

## First things to do in a new session

1. `pnpm install && pnpm typecheck` — confirm the whole monorepo is still green.
2. Pick up the "What's NOT built yet" list — mobile parity and notifications are the open threads.
3. Keep the task-by-task, explain-then-hand-off-code collaboration pattern from the top of this doc. Note: this session drifted into implementing most UI tasks directly rather than re-asking for the override each time, since the user didn't push back — confirm with the user which mode they want before assuming that's still fine.
