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
- `runRegimeGenerationJob` — retry/backoff loop for the async job (3 attempts, marks `FAILED` on exhaustion — **preset fallback is NOT implemented**, see gaps)
- `submit_adjustment` tool → `proposeAdjustment` (Flow B draft)
- `runFlowBForUser` — trailing Session Log window, `validateRegime` **with** delta check, one-retry-with-rejection-feedback, persists new regime version + `AdjustmentEvent`
- `applyEscalationRollback` — shared helper, actually flips regime status + logs the event; used by both the real-time monitor and the day-4 check

**`packages/api`** (real tRPC routers, wired into `apps/web`'s route handler):
- `onboarding.submit` / `onboarding.getJobStatus` — real async job pattern via Next's `after()`, with a fire-and-forget fallback for when `after()` is called outside a live request (matters for testing, see gotchas)
- `regime.activate` — review/edit → re-validate server-side → go live → creates today's `WorkoutSession` rows (placeholder 7am/6pm times, see gaps)
- `sessionLog.create` — writes the log, runs the escalation monitor inline, applies real rollback if triggered

**`apps/web`**:
- `/api/cron/flow-b` — due-user query (7-day cadence) + runs Flow B per user, `CRON_SECRET`-gated
- `/api/cron/day-4-check` — post-rollback settle check, all three branches (resumed/re-escalated/inconclusive) verified

**Regression test scripts** (all hit the real DB — good re-verification tools):
```
packages/agents:  smoke-test, tool-use-test, flow-a-test, flow-a-persist-test,
                  classifier-test, onboarding-test, flow-b-test
packages/api:     e2e-test, escalation-e2e-test, setup-cron-test-user,
                  setup-day4-test-users
```
Run via `pnpm --filter @rebound/agents <script>` / `pnpm --filter @rebound/api <script>`.

## What's NOT built yet

- **No real UI at all.** No sign-in/sign-up pages, no onboarding form, no regime review screen, no daily check-in UI. Everything above is only exercised via scripts and tRPC's `createCaller`. This is almost certainly the next big area of work.
- Streak/accountability logic — `WorkoutSession` rows get created but nothing computes or displays a streak
- Notification system — not started at all
- General presets — `Preset`/`PresetExercise` tables exist, zero rows seeded, and the "fall back to nearest preset" behavior on job failure is explicitly not implemented (see gaps)
- Admin panel (`/admin`)
- Accessibility baseline
- Non-engineering: Figma designs, legal/ToS, unit economics confirmation, risk-tier reassessment path

## Known gaps / provisional decisions (flag these, don't silently "fix" them without discussing)

- **`determineRiskTier`'s exact thresholds are invented**, not specified by the PRD (which gives tier *behavior* but not the onboarding→tier mapping algorithm). Same "needs PT/clinical sign-off before launch" status as the change-ceiling numbers themselves.
- **`ABSOLUTE_BOUNDS`** in `packages/clinical-rules/src/change-ceilings.ts` are provisional conservative defaults, same caveat.
- **`WorkoutSession` scheduling times are hardcoded** (7am/6pm placeholders in `regime.activate`) — real wake-time/sunset logic is still-open PRD Question #3, not built.
- **Flow B's due-user query** (`/api/cron/flow-b`) is a simplified interpretation of "anchor to the later of the regular schedule or the most recent escalation rollback" — it anchors to whichever `AdjustmentEvent` is most recent (any type), or regime `createdAt` if none exists. Reasonable, not spec-perfect.
- **No preset fallback.** `runRegimeGenerationJob` marks the job `FAILED` after 3 exhausted attempts instead of assigning the nearest preset — because no presets exist yet. Building preset seeding is a prerequisite before this can be finished properly.

## Tooling gotchas hit this session (avoid rediscovering these)

1. **Every new `packages/*/tsconfig.json` needs `"include": ["src", "scripts"]` and must NOT set `rootDir`.** Setting `rootDir: "src"` while `scripts/` is also included causes "File is not under rootDir" errors. Hit this identically for `packages/db` and `packages/agents`.
2. **VS Code can silently use the wrong TypeScript version** in this monorepo — `apps/mobile`'s Expo scaffold pins a different major TS version than everything else. Root `.vscode/settings.json` now pins `typescript.tsdk` to the repo root's own install. If "cannot find name console/fetch/process" type errors reappear despite correct tsconfig, check the TS version in the status bar first, not the code.
3. **Anthropic tool-use calls need `max_tokens: 4096`, not 2048**, in both `flow-a.ts` and `flow-b.ts` — echoing back a full 10-12 exercise regime plus reasoning routinely needs more than the smaller default.
4. **`after()` (Next.js) throws when called outside a real HTTP request.** This matters when testing tRPC procedures via `createCaller` from a plain script — there's no live request scope. `onboarding.submit` wraps `after()` in try/catch with a fire-and-forget fallback specifically for this; it's intentional, not a bug to "fix."
5. **`RegimeGenerationJob.userId` is a required FK to `User`.** The user row must exist before the job row is created — this is why `upsertUserForOnboarding` runs synchronously in `onboarding.submit` before job creation, not inside the backgrounded `draftAndPersistRegime`.
6. **Test scripts using a fixed `test-user-*` id must reset prior state before re-running**, respecting FK delete order: `AdjustmentEvent` and `SessionLog` before `Regime` (neither cascades; only `RegimeExercise` cascades from `Regime`). Every script that creates data follows this pattern now — copy it rather than re-deriving.
7. **Never put real secrets in any `.env.example` file** — those are tracked by git (the real `.env` files are gitignored). This happened twice this session and had to be cleaned up both times. Real credentials belong only in `apps/web/.env`, `packages/db/.env`, `packages/agents/.env`, `packages/api/.env` (all gitignored, all currently pointing at the same real Supabase DB / Anthropic key — check those files directly rather than asking the user to repaste credentials).

## First things to do in a new session

1. `pnpm install && pnpm typecheck` — confirm the whole monorepo is still green.
2. Pick up the "What's NOT built yet" list — real UI is the obvious next big area.
3. Keep the task-by-task, explain-then-hand-off-code collaboration pattern from the top of this doc.
