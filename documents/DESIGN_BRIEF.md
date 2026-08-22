# Rebound.ai — Design Brief

*Frames the design problem before a real visual design pass starts — goal, constraints, target user, tone, and current-state inventory. Not a spec for final UI. For step-by-step flows through these screens, see [`USERFLOW.md`](./USERFLOW.md). For product requirements behind them, see [`PRD.md`](./PRD.md).*

## The actual design problem

Almost every screen this product needs has been **functionally built** — 24+ screens shipped across both apps in a single implementation batch, covering marketing, onboarding, the core loop, engagement, and account/billing. What hasn't happened yet, at all: a real visual design pass. Every screen in both apps is still hand-rolled — inline `style={{...}}` objects per page on web, a small shared style-token factory on mobile — with no component library, no design system, and (on mobile) no navigation structure beyond a plain screen stack despite 17+ distinct mobile screens now existing.

**This brief exists to hand a designer (or a future design pass) the real constraints — audience, tone, safety-critical exceptions, and what's already built — so that pass starts from the actual product, not a blank page or a stale screen inventory.**

## Goal

Give Rebound.ai a real visual identity and information architecture that matches its actual scope (24+ screens, not the single-screen MVP it started as), without touching product logic, copy meaning, or the safety-critical screens named below.

## Target user & key use cases

Primary marketed audience: **athletes** (amateur through competitive) — see `PRD.md`'s Intended Audience and Brand Positioning. The underlying product and every safety guardrail also fully serve fitness/general-training users, patients with chronic/autoimmune conditions, and elderly users; the marketing lead is athletes, not the eligibility.

Key use cases the design must serve well:
1. A first-time visitor deciding whether to sign up (marketing pages) — currently the biggest structural gap `page-map.md`'s original research found, now closed functionally (landing, how-it-works, safety, pricing, about all exist) but not designed.
2. A new user completing onboarding without feeling like they're filling out a medical intake form.
3. A daily returning user completing two short sessions and a check-in — this loop needs to feel fast and low-friction, since adherence is the whole product bet.
4. A user experiencing a safety event (escalation rollback) — this moment needs to read as serious and trustworthy, not glossy.
5. An admin reviewing flagged users or running Flow A/B experiments — lowest design priority, internal tooling.

## Brand tone

Athletic, energetic, performance-and-recovery framing — closer to how a lifestyle-fitness brand like Celsius markets to a broad fitness audience than to a clinical "physical therapy" brand. This is deliberate positioning (see `PRD.md`'s Brand Positioning), not a claim that the underlying guardrails are any less serious.

**Explicit exception — these stay clinical and serious regardless of brand tone elsewhere, never gamified or glossed over:**
- The crisis-resources screen (self-harm language detected)
- The red-flag exit screen ("see a doctor/PT")
- Escalation-rollback "stop & consult a professional" messaging

Everywhere else — onboarding, the daily loop, progress/engagement screens, marketing pages — can and should carry the energetic athletic tone.

## Constraints

- **No component library in either app today.** A design system introduced now should account for retrofitting 24+ existing screens, not just new ones going forward.
- **Accessibility baseline is already shipped and must be preserved**: font scaling (mobile: a `largeText` toggle scaling type ~1.3×; web: a root-`font-size` CSS lever) and a 44px minimum tap target on all interactive elements. Any new design system must not regress either.
- **Zero new native dependencies without a real reason** — every screen built so far deliberately avoided adding libraries; mobile in particular pays a real cost (a native rebuild cycle) for any new native dependency. This directly caused the current asymmetry where web's progress chart is real SVG and mobile's is a plain bar chart.
- **No social/leaderboard/community features** — deliberately excluded even from the original screen menu; pain/injury data sits oddly next to any public comparison feature. If any social layer is ever wanted, it must be private/opt-in only.
- **Mobile has no bottom-tab navigation yet** — `(app)/_layout.tsx` is still a plain `Stack`, despite the screen count long since outgrowing single-stack navigation. This is the single most overdue structural fix for whoever does the real design/IA pass.

## Current-state screen inventory

Status current as of this writing — nearly everything from the original research-driven screen menu is now built; what's missing is design quality and navigation structure, not screens.

| Category | Screens (web / mobile) | Status |
| --- | --- | --- |
| **Marketing & Public** | Landing (`/`), How It Works, Safety & Guardrails, Pricing, About, Privacy & Terms | All built (web only — no mobile equivalent needed, see `USERFLOW.md`) |
| **Onboarding & Auth** | Sign in/up, sequenced onboarding wizard, wait screen, regime review/activate, notification-permission primer (first touch only) | All built |
| **Core Loop** | Today, guided session player (`/session/[slot]`), My Plan (regime view), History/trend, Exercise detail, Adjustment explainer + history log | All built |
| **Engagement & Motivation** | Streak detail, Progress dashboard, Milestones, Notification settings | All built |
| **Account, Settings & Commerce** | Settings hub, Profile, Accessibility toggle, Subscription/Billing (preview, no real Stripe), Paywall preview, Cancellation, Regime restart, Help/FAQ, in-app Legal links | All built |

**What's genuinely still missing, not just undesigned:**
- Mobile bottom-tab navigation (still a plain `Stack`)
- The second "protect your streak" notification-permission touch (only the first, pre-OS-prompt touch shipped)
- A risk-tier re-assessment flow (no screen exists for a user to report a new injury/flare-up post-onboarding)
- Most of the smaller UX-polish checklist (sticky headers, skip-to-content, mobile hamburger menu, hover states, scroll progress, site search, expandable FAQ, dark-mode toggle, cookie-consent banner, copy-to-clipboard, print stylesheet, password-visibility toggle) — see `ENG_PLAN.md` for the full remaining list

## One candidate bottom-nav structure (not locked in)

Not a recommendation to build as-is — just what falls out naturally from the screens that now exist:

**Today · Progress · Plan · Account**

## Patterns worth stealing (from the original research pass)

Researched against workout-logging apps (Strong, Hevy), wearable/recovery apps (Whoop, Oura), general fitness (MyFitnessPal, Peloton), AI-coached training (Freeletics, Nike Training Club), the closest clinical competitors (Sword Health, Hinge Health), and Duolingo's structure (marketing site + in-app).

1. **Score-first home surfaces.** Whoop leads with three tiles answering "how should I train today" before anything else. Rebound.ai's progress dashboard now exists functionally but hasn't had a design pass to actually lead with this — currently more of a data dump than an answer.
2. **Contextual paywalls, not upfront gates.** Duolingo surfaces its paywall at natural friction points, not immediately at signup. Freeletics' immediate double-paywall is the pattern to avoid. The current build already matches this at the product-logic level (paywall card only appears in Settings after the first real adjustment, never a blocking interstitial) — worth protecting when real billing lands.
3. **One consolidated "today" surface.** MyFitnessPal recently merged diary, macros, habits, and streak into a single Today tab instead of scattering them. The Today screen has grown several cards (sessions, check-in, streak, adjustment explainer) — worth watching that it doesn't re-fragment as more gets added.
4. **An engineered small win before any monetization ask.** Duolingo's first lesson, Freeletics' "building your plan" — Rebound.ai's Flow A regime generation and first completed session already are this moment (the cycling wait-screen copy is a direct implementation of this pattern). Worth deliberately not interrupting it with settings or paywall noise.
5. **Primed, two-touch notification permission.** Duolingo explains the ask before the OS prompt, then re-asks once a streak exists ("protect what you've built"). Only the first touch is built — see "what's genuinely still missing" above.
6. **Program-based entry points, once there's more than one track.** Sword Health segments by program (Thrive/Bloom/Move/Mind) rather than one feed. Not relevant at Rebound.ai's current single-goal-type stage, but worth remembering if multi-goal tracking (already a deferred PRD item) ever ships.

## Success criteria for the real design pass

- Every screen above gets a real visual treatment (color, type, spacing, layout) from an actual design system — not more incremental hand-rolled polish.
- The three safety-critical screens named above read as unambiguously serious, distinguishable from the rest of the app's tone.
- Accessibility baseline (font scaling, 44px targets) survives the transition, not just gets preserved by accident.
- Mobile gets real navigation structure (tabs or equivalent), not a growing flat `Stack`.
- No regression to the "zero new native dependencies without reason" discipline that's kept both apps lean so far — any new dependency (an SVG/charting library, a component library) should be a deliberate, scoped decision, not incidental to the design pass.

## Sources

App-store listings and screenshots, product teardown sites (screensdesign, UX Collective, Dr. Muscle, RepReturn, 925studios, PeloBuddy, DuoPlanet, Class Central), and Duolingo's own engineering blog (blog.duolingo.com). Original research pass mapped against `apps/mobile`/`apps/web` as of the repo's page-map research session; screen-build status re-verified directly against the current repo for this document.
