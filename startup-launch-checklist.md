# Startup Pre-Launch Reference Doc

This document is a personal reference of tips, checklists, and copy-paste
prompts collected for preparing an app/startup for launch. It is organized
by category so specific sections can be handed to Claude Code (or another
coding agent) one at a time, instead of dumping the whole thing at once.

**How to use this with Claude Code:** Tell it which category (or which
numbered item within a category) you want implemented, e.g. "Implement
items 1-4 from the Security category" or "Do item 7 from Legal/Compliance."
Do not ask it to implement the entire document in one go — go
category-by-category, and test the app after each change.

---

## Category A: Legal & Compliance Risk (avoid getting sued)

Source: "10 ways your vibecoded app is getting sued" — these are common
gaps in AI-built apps that create real legal/financial exposure. Rough
dollar figures are illustrative of relative risk/severity, not guaranteed
amounts.

| # | Issue | Why it matters | Relative risk | Status |
|---|-------|-----------------|----------------|--------|
| 1 | No Privacy Policy | Legally required in most jurisdictions if you collect any user data | Low-moderate | ✅ Done 2026-08-15 — `apps/web/src/app/privacy/page.tsx`, linked from sign-up + global footer |
| 2 | Privacy Policy doesn't disclose "we collect user data" | Must explicitly state what data is collected | Moderate | ✅ Done 2026-08-15 — covered in the new Privacy Policy |
| 3 | No mention of AI usage in the Privacy Policy | If you use AI (e.g. LLMs) to process user data, this must be disclosed | Moderate | ✅ Done 2026-08-15 — Anthropic/Claude usage disclosed |
| 4 | No mention of third-party data processors/collectors in the Privacy Policy | Any analytics, payment, or AI vendors touching user data need to be named | Moderate | ✅ Done 2026-08-15 — Clerk, Supabase, Anthropic, Vercel all named |
| 5 | Not deleting user uploads when requested/on account deletion | Data retention/right-to-delete violations | Low-moderate | ✅ Done 2026-08-15 — `user.deleteMyAccount` mutation + `/api/webhooks/clerk` safety net; "Delete my account" in both apps' home screens. Manual step remaining: register the webhook in Clerk Dashboard (see `HANDOFF.md`) |
| 6 | Storage bucket set to public | Massive data exposure risk — one of the most common real-world breaches | Low-moderate (but high breach severity) | N/A — no storage bucket/file-upload feature exists yet; revisit if one is added |
| 7 | Fake testimonials / reviews | FTC violation (deceptive advertising) — high-dollar exposure | High | N/A — no marketing/landing page exists yet |
| 8 | Cancellation flow longer/harder than sign-up flow | Violates "click to cancel" style consumer protection rules | High | N/A — no billing/subscription flow exists yet (Stripe is only planned, per PRD) |
| 9 | Auto-renewing subscriptions without a reminder notice | Requires refund in many jurisdictions if not disclosed properly | Full refund liability | N/A — no billing integration exists yet |
| 10 | AI features with no self-harm/crisis response handling | Safety liability if your app has any chat/AI interaction surface | Moderate | ✅ Done 2026-08-15 — onboarding free-text now screened for crisis language (extends the existing red-flag classifier); triggers a dedicated crisis-resources screen (988, Crisis Text Line) in both apps |

**Suggested prompt to give Claude Code for this category:**
"Review my app for [insert item]. Tell me what's currently in place, what's
missing, and implement a fix. Don't change unrelated functionality."

---

## Category B: Security Hardening (pre-launch checklist)

Source: "20 things to have Claude do before launching your app." These are
security fundamentals — treat this as a checklist to go through top to
bottom before going live.

### B1. Secrets & Credentials — ✅ reviewed 2026-08-15, already solid, no change needed
1. Hide API keys (never in client-side code or committed to git) — confirmed clean, only publishable Clerk keys reach the client
2. Purge Git secrets (scrub history if any were ever committed) — confirmed no `.env` ever committed
3. Use a public/anon DB key only where appropriate — never expose service-role/admin keys to the client — N/A pattern doesn't apply here: no Supabase client SDK is used at all, DB access is server-only Prisma over `DATABASE_URL`/`DATABASE_URL_RLS`

### B2. Data Access Control — ✅ reviewed 2026-08-15, already solid, no change needed
4. Enable row-level security (RLS) on your database — done pre-existing, `packages/db/sql/rls-policies.sql`
5. Encrypt sensitive data at rest — Supabase-managed Postgres, encrypted by default
6. Enforce server-side auth (never trust client-side auth checks alone) — `protectedProcedure`/`adminProcedure` in `packages/api/src/trpc.ts`
7. Lock down record access (users can only read/write their own data) — every query scoped to `ctx.userId`, plus RLS as defense-in-depth
8. Block field tampering (server validates/ignores client-supplied fields it shouldn't trust, e.g. `role`, `isAdmin`, `price`) — confirmed no router accepts these as input

### B3. Session & Account Security
9. Secure session cookies (httpOnly, secure, sameSite flags) — delegated to Clerk defaults; manual follow-up noted in `HANDOFF.md`
10. Hash passwords (bcrypt/argon2, never plaintext or reversible encryption) — N/A, Clerk manages all password storage
11. Rate limit login attempts — delegated to Clerk (no custom auth surface exists); manual Clerk Dashboard follow-up noted in `HANDOFF.md`

### B4. Abuse & Input Protection
12. Add bot protection (captcha/rate limiting on public forms and signup) — delegated to Clerk (only public form is Clerk's own sign-up); manual Clerk Dashboard follow-up noted in `HANDOFF.md`
13. Parameterize all database queries (prevent SQL injection) — ✅ reviewed 2026-08-15, already solid — Prisma throughout, only trusted infra scripts use raw SQL
14. Validate all input (server-side, not just client-side) — ✅ reviewed 2026-08-15, already solid — zod schemas on every tRPC procedure
15. Escape user-generated content before rendering (prevent XSS) — ✅ reviewed 2026-08-15, already solid — no `dangerouslySetInnerHTML` anywhere
16. Restrict file upload types/sizes (prevent malicious file uploads) — N/A, no file-upload feature exists yet

### B5. Infrastructure
17. Trim API responses (don't leak internal fields/extra data to the client) — ✅ Done 2026-08-15 — `admin.flaggedUsers` (`packages/api/src/routers/admin.ts`) now uses an explicit `select` instead of returning full `User` rows
18. Add security headers (CSP, X-Frame-Options, HSTS, etc.) — ✅ Done 2026-08-15 — `apps/web/next.config.ts` `headers()`; also fixed a wide-open CORS wildcard (`Access-Control-Allow-Origin: *`) in `apps/web/src/app/api/trpc/[trpc]/route.ts`, now origin-allowlisted via `ALLOWED_ORIGINS`
19. Force HTTPS everywhere — ✅ Done 2026-08-15 — explicit HSTS header added (Vercel already enforced HTTPS at the platform level)
20. Scan dependencies for known vulnerabilities (npm audit / equivalent) — ✅ Done 2026-08-15 — `.github/dependabot.yml` added (weekly, npm ecosystem covers pnpm)

**Suggested prompt to give Claude Code for this category:**
"Go through item [#] from my Security Hardening checklist. Check my
current implementation, explain any gaps, and fix them."

---

## Category C: UX / Frontend Polish Features

Source: "20 things you can tell Claude to add to your website" (Pt. 3).
These are smaller UX/frontend touches — good for polishing an app that's
functionally done but feels unfinished.

### C1. Navigation & Layout
1. Sticky headers
2. Skip-to-content link (accessibility)
3. Back-to-top button
4. Mobile menu (hamburger/responsive nav)
5. Floating contact button

### C2. Feedback & State
6. Loading animations
7. Hover states on interactive elements
8. Form success state
9. Form error state
10. Confirmation modals (for destructive actions like delete)
11. Scroll progress bar

### C3. Content & Discovery
12. Site search
13. Expandable FAQ section
14. Last-updated date on content/pages

### C4. Utility Features
15. Dark mode toggle
16. Simple cookie-consent banner
17. Copy-to-clipboard button
18. Print stylesheet
19. Password visibility toggle (on password fields)
20. UTM tracking on marketing links

**Suggested prompt to give Claude Code for this category:**
"Add [item] to my site. Match my existing design system/styling and don't
change layout elsewhere."

---

## Category D: Performance Optimization (copy-paste prompts)

Source: "Free Prompt Pack – App Performance" (June 21). These are meant to
be run **one at a time**, testing the app after each change, using Claude
Code, Codex, Cursor, or similar.

### D1. Network & Data Transfer
**1. Compress API responses in transit**
> "Check whether my API responses are compressed in transit. Enable gzip
> or brotli compression on the server or edge for JSON and text responses
> above a small size threshold, and confirm the client negotiates it via
> Accept-Encoding. Avoid double-compressing already-compressed payloads.
> Verify response transfer sizes drop significantly and responses still
> parse correctly on the client."

**5. Cache rendered pages or fragments**
> "Find server-rendered pages or fragments whose output is identical (or
> nearly so) across many users and changes infrequently. Cache the
> rendered output and serve it directly, regenerating on a schedule or on
> content change, while keeping personalized regions dynamic via holes or
> client-side hydration. Ensure cache keys account for meaningful
> variations like locale. Verify these pages serve much faster and
> rendering load decreases."

### D2. Database
**2. Batch inserts and updates**
> "Find code that performs many individual INSERT or UPDATE statements in
> a loop where a single batched operation would work. Replace them with
> bulk/batched writes (multi-row inserts, batch updates, or a single
> statement) inside an appropriate transaction. Chunk very large batches
> to avoid oversized statements or long locks. Verify write-heavy
> operations complete far faster with fewer round trips."

### D3. Resilience
**3. Add a circuit breaker for slow dependencies**
> "Identify external dependencies whose slowness or failures could
> cascade into my app, exhausting threads or connections while everyone
> waits. Add a circuit breaker that trips when a dependency is failing or
> too slow, fast-failing or serving a fallback until it recovers, with
> timeouts and limited concurrency to that dependency. Verify that a
> degraded dependency no longer drags down unrelated parts of the app and
> recovers cleanly."

### D4. Perceived Performance
**4. Apply optimistic UI updates**
> "Identify user actions (likes, toggles, adds, edits, deletes) that
> currently wait for the server response before updating the screen. Make
> them optimistic: update the UI immediately as if the action succeeded,
> then reconcile with the server result and roll back gracefully if it
> fails. Include clear error handling and a visible rollback so users
> aren't misled. Verify the happy path feels instant and failures restore
> the correct state."

**Suggested prompt to give Claude Code for this category:**
Just copy/paste the individual quoted prompt above for the item you want,
one at a time, and test after each.

---

## Suggested Order of Operations

For a pre-launch app, a reasonable order is:

1. **Category A (Legal)** — items 1-4 (privacy policy basics) are cheap
   and high-value to fix early.
2. **Category B (Security)** — do this fully before any real users touch
   the app. This is the highest-stakes category.
3. **Category D (Performance)** — worth doing once core features are
   stable, before you have real traffic to break.
4. **Category C (UX Polish)** — do this last; it's the most "nice to
   have" and easiest to iterate on post-launch.

---

*This document is a personal reference compiled from saved tips/screenshots.
Legal items in Category A are general guidance, not legal advice — consider
a lawyer's review of your actual Privacy Policy / Terms of Service before
launch.*
