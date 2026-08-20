# Rebound.ai — Page Map

*Drafted 2026-08-18. A researched menu of possible pages/screens to prune from — not a spec, not built yet.
See `Rebound.ai PRD.md`'s "Designs" section (still TBD) — this is groundwork for that, not a replacement for real
designs.*

Researched against: workout-logging apps (Strong, Hevy), wearable/recovery apps (Whoop, Oura), general fitness
(MyFitnessPal, Peloton), AI-coached training (Freeletics, Nike Training Club), the closest clinical competitors
(Sword Health, Hinge Health — see PRD's Competitive Landscape), and Duolingo's structure in detail, both its
marketing site and in-app screens/gamification/paywall placement.

## State as of 2026-08-18

The app is currently minimal: 6 screen files total, **zero bottom-nav tabs** (`apps/mobile/app/(app)/_layout.tsx`
is a plain `Stack`, not a tab navigator), and `apps/web/src/app/page.tsx` (the web root) is actually the
**signed-in dashboard**, not a public marketing page — `proxy.ts` protects everything except sign-in/up, privacy,
and terms, so nobody can see what Rebound.ai is without an account. Settings is a single large-text toggle. No
billing code exists anywhere in the repo.

32 candidate screens below, across 5 categories. 9 already exist, 23 are proposed.

## Marketing & Public — 6 screens, 1 exists

The biggest structural gap: no public landing page exists at all.

| Screen | Status | Description | Inspired by |
|---|---|---|---|
| Landing / Home | Proposed | Hero, how-it-works, proof, app download CTA — the page a first-time visitor actually lands on | Every app researched has this; Rebound.ai's public pages currently don't |
| How It Works / Method | Proposed | Plain-language explainer of Flow A/B and the escalation monitor — trust-building given there's no clinician review | Duolingo's Efficacy page; Sword/Hinge Health's clinical framing |
| Safety & Guardrails | Proposed | Public explainer of red-flag screening, escalation thresholds, "when to see a real doctor." Also mitigates the PRD's open Red-Flag Screen legal gap | Sword/Hinge Health clinical-trust framing |
| Pricing | Proposed | Plan and trial explanation — needs the Business Model's still-open price point decided first | Duolingo Super pricing page |
| About | Proposed | Mission/positioning — lower priority, easy to defer | Duolingo's about.duolingo.com |
| Privacy & Terms | **Exists** | Already built, reachable without an account | `apps/web/src/app/privacy`, `/terms` |

## Onboarding & Auth — 7 screens, 3 exist

Onboarding today is one long form (`onboarding.tsx`). Duolingo and Freeletics both stretch this into a
deliberately sequenced ~25–30 screen flow — not to add friction, but to place a small win before any
monetization touch.

| Screen | Status | Description | Inspired by |
|---|---|---|---|
| Sign in / Sign up | **Exists** | Clerk-backed auth, both apps | `apps/mobile/app/(auth)`, `apps/web/src/app/sign-in`, `sign-up` |
| Goal & health screen | **Exists** | Structured questionnaire + red-flag screen, currently one combined form | `apps/mobile/app/(app)/onboarding.tsx` |
| Sequenced intro steps | Proposed | Break the single form into a guided sequence: reason for using the app → goal → risk questions → done. Same data, less overwhelming on first open | Duolingo's ~30-screen onboarding; Freeletics' goal/level/equipment sequence |
| "Building your plan" moment | Proposed | An animated wait screen while Flow A drafts the regime, instead of a plain spinner | Freeletics' animated plan-building step |
| Regime reveal | **Exists** | First plan shown for review/activation | `regime/[regimeId]` |
| Notification permission primer | Proposed | Explain the twice-daily reminders before the OS prompt fires, and again once a streak exists ("protect what you've built"). Currently notifications are scheduled silently with no user-facing ask at all | Duolingo's two-touch notification-permission pattern |
| First-session win | Proposed | Not a new screen — a sequencing principle: let the user complete one real session before any settings/paywall noise interrupts | Duolingo's engineered-win-before-monetization pattern |

## Core Loop — 6 screens, 2 exist

Today's single screen does sessions, pain check-in, streak text, sign-out, and account deletion all at once. The
additions here are mostly about giving the product's own efficacy story (PRD's Success Metrics: measurable,
sustained improvement) somewhere to actually show up.

| Screen | Status | Description | Inspired by |
|---|---|---|---|
| Today | **Exists** | Morning/evening session cards, streak line, daily pain check-in. Candidate to slim down once other screens absorb settings/account | `apps/mobile/app/(app)/index.tsx` |
| Exercise detail | Proposed | Tap an exercise for instructions, form cues, sets/reps/timer. Today it's a flat text list with no drill-down at all | Strong/Hevy exercise-detail pages; Nike Training Club's workout player |
| My Plan | **Exists** | Full current regime, both sessions, version number — worth promoting from a one-time reveal to a persistent, revisitable screen | `regime/[regimeId]` |
| History / trend | Proposed | Past sessions and pain score over time. No screen currently shows this at all, despite it being the whole basis of the product's efficacy claim | Strong's History tab; Whoop's trend charts; MyFitnessPal's Progress tab |
| Adjustment explainer | Proposed | Promote the hold/rollback banner into a real moment: what changed in the plan and why, when Flow B or the escalation monitor acts | Sword/Hinge Health's care-team-style check-ins; serves the PRD's reversal-rate metric |
| Adjustment history log | Proposed | A running list of every Flow B decision and why — direct surface for the Adjustment Event data model | Inferred from Rebound.ai's own Data Model, not observed directly in researched apps |

## Engagement & Motivation — 4 screens, 0 exist

A judgment call flagged, not resolved: public leaderboards fit Duolingo's model but sit oddly next to
pain/injury data — if any social layer is wanted, it should be private/opt-in only.

| Screen | Status | Description | Inspired by |
|---|---|---|---|
| Streak detail | Proposed | Calendar view of streak history — today it's a single line of text on the home screen | Duolingo's streak calendar / Streak Freeze |
| Progress dashboard | Proposed | Pain trend graph, adherence %, weeks active — a "how am I doing" screen that leads with the answer, not raw logs | Whoop's score-first home surface |
| Milestones | Proposed | "First week complete," "pain score down 2 points" — optional, lower priority than the two above | Duolingo achievements/badges |
| Notification settings | Proposed | User control over reminder times — currently fully automatic with zero user-facing settings | Duolingo's Reminders/Friends/Leaderboards notification toggles |

## Account, Settings & Commerce — 9 screens, 3 exist

Billing has zero code today — no Stripe integration exists anywhere in the repo. The PRD already specs the
behavior (trial through first regime cycle, paywall at first adjustment, cancel-at-period-end with a reason
code); these screens are what that spec needs to land somewhere.

| Screen | Status | Description | Inspired by |
|---|---|---|---|
| Settings hub | **Exists** | Currently just the large-text toggle — real estate to expand into sub-sections below | `apps/mobile/app/(app)/settings.tsx` |
| Profile | Proposed | Name, stated goal, join date. No profile screen exists at all right now | General pattern across every app researched |
| Accessibility | **Exists** | Large-text toggle, could become its own sub-page once Settings splits up | `lib/accessibility.tsx` |
| Subscription / Billing | Proposed | Plan status, trial countdown, manage payment. No billing code exists anywhere yet — the single largest unbuilt gap in the whole product | Standard across every subscription app researched |
| Paywall / upgrade | Proposed | Surfaced at the natural trigger point (first Flow B adjustment) rather than an upfront gate — matches the PRD's own spec | Duolingo's contextual paywall, not Freeletics' aggressive immediate one |
| Cancellation flow | Proposed | Reason-code capture, downgrade-to-presets confirmation — already specced in Business Model, just not built | `Rebound.ai PRD.md` § Business Model |
| Delete account | **Exists** | Currently an inline confirm modal on the home screen — could move under Settings once that's less bare | `DeleteAccountSection` in `index.tsx` |
| Help / FAQ | Proposed | Not built. Lower priority but a common expectation, especially pre-clinician-review | General pattern |
| Legal (in-app) | Proposed | Privacy/Terms links reachable from inside the app, not just the public web pages | General pattern |

## One candidate bottom-nav structure

Not a recommendation to lock in — just what falls out naturally if the Core Loop and Engagement sections above get
built. Today has zero tabs; this is the four-tab shape closest researched apps converge on:

**Today · Progress · Plan · Account**

## Patterns worth stealing

1. **Score-first home surfaces.** Whoop leads with three tiles answering "how should I train today" before anything else. Rebound.ai has zero progress visualization anywhere right now — the biggest single leverage point, given the whole product pitch is measurable improvement.
2. **Contextual paywalls, not upfront gates.** Duolingo surfaces its paywall at natural friction points (hearts running out), not immediately at signup. Freeletics' immediate double-paywall is the pattern to avoid. This already matches what the PRD specs — worth protecting when billing gets built.
3. **One consolidated "today" surface.** MyFitnessPal recently merged diary, macros, habits, and streak into a single Today tab instead of scattering them. Validates keeping Today as the landing screen rather than fragmenting it further — the fix is trimming what's on it, not replacing it.
4. **An engineered small win before any monetization ask.** Duolingo's first lesson, Freeletics' "building your plan" — Rebound.ai's Flow A regime generation and first completed session already are this moment. Worth deliberately not interrupting it with settings or paywall noise.
5. **Primed, two-touch notification permission.** Duolingo explains the ask before the OS prompt, then re-asks once a streak exists ("protect what you've built"). Rebound.ai currently schedules notifications with zero user-facing permission framing at all, despite the whole product hinging on a twice-daily habit.
6. **Program-based entry points, once there's more than one track.** Sword Health segments by program (Thrive/Bloom/Move/Mind) rather than one feed. Not relevant at Rebound.ai's current single-goal-type stage, but worth remembering if multi-goal tracking (already flagged as a deferred PRD item) ever ships.

## Sources

App-store listings and screenshots, product teardown sites (screensdesign, UX Collective, Dr. Muscle, RepReturn,
925studios, PeloBuddy, DuoPlanet, Class Central), and Duolingo's own engineering blog (blog.duolingo.com). Mapped
against `apps/mobile` and `apps/web` as of 2026-08-18.
