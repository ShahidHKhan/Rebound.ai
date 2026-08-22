# Startup Pre-Launch Reference Doc

This document is a personal reference of tips, checklists, and copy-paste
prompts collected for preparing an app/startup for launch. It is organized
by category so specific sections can be handed to Claude Code (or another
coding agent) one at a time, instead of dumping the whole thing at once.

**How to use this with Claude Code:** Tell it which category (or which
numbered item/sub-section within a category) you want implemented, e.g.
"Implement items 1-4 from Security > Pre-Launch Checklist" or "Run prompt
3 from Security > Prompt Pack (June 18)." Do not ask it to implement the
entire document at once — go section by section, and test the app after
each change.

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
| 5 | Not deleting user uploads when requested/on account deletion | Data retention/right-to-delete violations | Low-moderate | ✅ Done 2026-08-15, webhook registered 2026-08-17 — `user.deleteMyAccount` mutation + `/api/webhooks/clerk` safety net; "Delete my account" in both apps' home screens. Webhook registered in Clerk Dashboard (Development instance) against the live Vercel URL, subscribed to `user.deleted`; `CLERK_WEBHOOK_SECRET` pushed to Vercel Production and redeployed |
| 6 | Storage bucket set to public | Massive data exposure risk — one of the most common real-world breaches | Low-moderate (but high breach severity) | N/A — no storage bucket/file-upload feature exists yet; revisit if one is added |
| 7 | Fake testimonials / reviews | FTC violation (deceptive advertising) — high-dollar exposure | High | N/A — no marketing/landing page exists yet |
| 8 | Cancellation flow longer/harder than sign-up flow | Violates "click to cancel" style consumer protection rules | High | N/A — no billing/subscription flow exists yet (Stripe is only planned, per PRD) |
| 9 | Auto-renewing subscriptions without a reminder notice | Requires refund in many jurisdictions if not disclosed properly | Full refund liability | N/A — no billing integration exists yet |
| 10 | AI features with no self-harm/crisis response handling | Safety liability if your app has any chat/AI interaction surface | Moderate | ✅ Done 2026-08-15 — onboarding free-text now screened for crisis language (extends the existing red-flag classifier); triggers a dedicated crisis-resources screen (988, Crisis Text Line) in both apps |

**Suggested prompt to give Claude Code for this category:**
"Review my app for [insert item]. Tell me what's currently in place, what's
missing, and implement a fix. Don't change unrelated functionality."

---

## Category B: Security

This is the largest and highest-stakes category, so it's split into three
sub-sections: checklist (broad coverage), the 20-holes audit (specific,
common vulnerabilities), then the targeted prompt pack (deeper, narrower
issues). All three are now audited (B1 2026-08-15, B2/B3 2026-08-16) —
see each sub-section for status and the few remaining non-code follow-ups
(Clerk Dashboard settings, mostly). Rate limiting (B2 #5) was implemented
2026-08-22, reversing the earlier deferral — see that item for detail.

### B1. Pre-Launch Security Checklist — mostly reviewed 2026-08-15

Source: "20 things to have Claude do before launching your app."

**Secrets & Credentials**
1. Hide API keys (never in client-side code or committed to git) — ✅ confirmed clean, only publishable Clerk keys reach the client
2. Purge Git secrets (scrub history if any were ever committed) — ✅ confirmed no `.env` ever committed
3. Use a public/anon DB key only where appropriate — never expose service-role/admin keys to the client — N/A, no Supabase client SDK is used at all; DB access is server-only Prisma over `DATABASE_URL`/`DATABASE_URL_RLS`

**Data Access Control**
4. Enable row-level security (RLS) on your database — ✅ done pre-existing, `packages/db/sql/rls-policies.sql`. **Coverage is now CI-enforced** (2026-08-22): `pnpm check:rls` fails the build if any `schema.prisma` table has no recorded RLS decision — added after finding `preset_slots` had silently regressed to zero RLS (same class of gap as a 2026-08-19 Supabase-linter fix — see `HANDOFF.md`'s "Supabase security fix" session — just on a table added after that fix). A real cross-user isolation test also now runs against the live DB (`packages/db/src/__tests__/rls-isolation.test.ts`) — previously nothing automated actually proved RLS blocks a cross-user read/write, only that the policy file looked right on inspection.
5. Encrypt sensitive data at rest — ✅ Supabase-managed Postgres, encrypted by default
6. Enforce server-side auth (never trust client-side auth checks alone) — ✅ `protectedProcedure`/`adminProcedure` in `packages/api/src/trpc.ts`
7. Lock down record access (users can only read/write their own data) — ✅ every query scoped to `ctx.userId`, plus RLS as defense-in-depth
8. Block field tampering (server validates/ignores client-supplied fields it shouldn't trust, e.g. `role`, `isAdmin`, `price`) — ✅ confirmed no router accepts these as input

**Session & Account Security**
9. Secure session cookies (httpOnly, secure, sameSite flags) — ✅ delegated to Clerk defaults, not a dashboard-configurable setting; `@clerk/nextjs`/`@clerk/clerk-expo` hardcode this, confirmed at the code level 2026-08-16 (see B2 #10 below)
10. Hash passwords (bcrypt/argon2, never plaintext or reversible encryption) — N/A, Clerk manages all password storage
11. Rate limit login attempts — ✅ Confirmed 2026-08-17 — Clerk Dashboard > Protect > Rules > **Lockout policy**: Enabled (Development instance)

**Abuse & Input Protection**
12. Add bot protection (captcha/rate limiting on public forms and signup) — ✅ Confirmed 2026-08-17 — Clerk Dashboard > Protect > Rules > **Bot sign-up protection**: Enabled (Cloudflare Turnstile, Development instance)
13. Parameterize all database queries (prevent SQL injection) — ✅ reviewed 2026-08-15, already solid — Prisma throughout, only trusted infra scripts use raw SQL
14. Validate all input (server-side, not just client-side) — ✅ reviewed 2026-08-15, already solid — zod schemas on every tRPC procedure
15. Escape user-generated content before rendering (prevent XSS) — ✅ reviewed 2026-08-15, already solid — no `dangerouslySetInnerHTML` anywhere
16. Restrict file upload types/sizes (prevent malicious file uploads) — N/A, no file-upload feature exists yet

**Infrastructure**
17. Trim API responses (don't leak internal fields/extra data to the client) — ✅ Done 2026-08-15 — `admin.flaggedUsers` (`packages/api/src/routers/admin.ts`) now uses an explicit `select` instead of returning full `User` rows
18. Add security headers (CSP, X-Frame-Options, HSTS, etc.) — ✅ Done 2026-08-15 — `apps/web/next.config.ts` `headers()`; also fixed a wide-open CORS wildcard (`Access-Control-Allow-Origin: *`) in the API route, now origin-allowlisted via `ALLOWED_ORIGINS` (`apps/web/src/lib/rest/with-cors.ts` post-REST-migration). **CSP upgraded 2026-08-22** — moved from a static header (`next.config.ts`, `'unsafe-inline' 'unsafe-eval'` unconditionally in `script-src`, which made it close to decorative against XSS) to a per-request nonce generated in `apps/web/src/proxy.ts`. `'unsafe-eval'` is now dev-only; `'unsafe-inline'` stays only as a CSP2 fallback that modern browsers ignore once the nonce is present. Verified live against a running dev server (header nonce matches the nonce stamped on rendered `<script>` tags, differs across requests). Deliberately does **not** use `'strict-dynamic'` — testing found Clerk's own script loads without a nonce, so `'strict-dynamic'` would have broken sign-in in any CSP3 browser; the host allowlist plus the nonce do the job instead. Still open: the allowlist only covers Clerk's Development domain, needs the Production one added at Clerk cutover time.
19. Force HTTPS everywhere — ✅ Done 2026-08-15 — explicit HSTS header added (Vercel already enforced HTTPS at the platform level)
20. Scan dependencies for known vulnerabilities (npm audit / equivalent) — ✅ Done 2026-08-15 — `.github/dependabot.yml` added (weekly, npm ecosystem covers pnpm)

**Remaining manual follow-ups:** none — the webhook is registered and session cookie/rate limiting/bot protection are all confirmed as of 2026-08-17 (see items 5, 9, 11, 12 above). Still open: cutting the Development instance over to Production before real (non-invited) users touch the app — Dev/Prod settings are independent, so this pass should be re-confirmed on Production when that happens.

**Suggested prompt for this sub-section:**
"Go through item [#] from my Pre-Launch Security Checklist. Check my
current implementation, explain any gaps, and fix them."

### B2. 20 Common Vulnerabilities in Vibe-Coded Apps — audited 2026-08-16

Source: "20 security holes in your vibe-coded app." These are the holes
that show up constantly because AI coding tools optimize for "working,"
not "safe." Each has a one-line cause and fix. A few clearly overlap with
B1 items already fixed (noted below) — the rest are genuinely new ground
to check, especially now that webhooks (Clerk account-deletion) exist.

| # | Issue | Cause | Fix | Status |
|---|-------|-------|-----|--------|
| 1 | `.env` committed to GitHub | Secrets in a public repo get scraped by bots within minutes; git history keeps them even after deletion | Add `.env` to `.gitignore`, keep secrets server-side, rotate every key that ever touched a commit | ✅ Covered by B1 #2 |
| 2 | Real API keys in frontend code | Anything in the JS bundle ships to the browser; `NEXT_PUBLIC_`/`EXPO_PUBLIC_` prefixes mean public | Only publishable keys go client-side; real keys live in edge functions or backend | ✅ Covered by B1 #1 |
| 3 | Row level security (RLS) off | With RLS disabled, the anon key becomes a master key to read/write every user's rows | RLS on by default, policies scoped to `auth.uid()`, tested with a second account | ✅ Covered by B1 #4 |
| 4 | Permission checks done in the frontend | `if (user.isAdmin)` in React stops nobody — users can edit responses or call the API directly | Every permission check runs server-side; frontend only decides what to show | ✅ Covered by B1 #6/#7 |
| 5 | No rate limiting on endpoints | Scripts can brute-force logins or run up AI/API bills overnight | Per-user and per-IP throttles on login, signup, and expensive routes | ✅ Implemented 2026-08-22 — login throttling still delegated to Clerk (unchanged), but every `/api/v1` route now has a Postgres-backed limiter (`packages/api/src/rate-limit.ts`, applied via `apps/web/src/lib/rest/with-rate-limit.ts`): onboarding 5/hr, admin-triggered LLM work 30/hr, mutations 60/min, reads 300/min, anonymous/IP-keyed 20/min. Atomic under concurrency (verified with 10 parallel requests against the live DB, exactly 5 allowed), fails open on a DB error (advisory, not the last line of defense — RLS is). The PRD's original "defer until beta opens beyond a trusted cohort" call was reversed early after a security review; see `HANDOFF.md`'s 2026-08-22 session for the full writeup, including a real operational finding (Supabase's connection pooler caps at 15 clients) surfaced while testing it |
| 6 | SQL built via string concatenation | Splicing user input into a query string allows query injection | Parameterized queries or an ORM — never string-interpolated queries | ✅ Covered by B1 #13 |
| 7 | No server-side input validation | Client-side form validation is skippable — anyone can POST directly to the endpoint | Validate and sanitize on the server too, with a schema library like Zod | ✅ Covered by B1 #14 |
| 8 | User content rendered as raw HTML | `dangerouslySetInnerHTML` on user text allows script injection (XSS) that steals sessions | Render user content as text; if HTML is required, sanitize with DOMPurify | ✅ Covered by B1 #15 |
| 9 | Passwords stored in plaintext | One database leak exposes every account (and reused passwords elsewhere) | Use your auth provider's hashing (bcrypt/argon2); don't roll your own | ✅ N/A, Clerk manages |
| 10 | Auth tokens kept in `localStorage` | Any XSS script can read `localStorage` and steal a live session token | httpOnly cookies on web, secure storage (e.g. `expo-secure-store`) on native | ✅ Confirmed 2026-08-16 — web uses `@clerk/nextjs` defaults (httpOnly session cookie, no custom token storage); mobile's `tokenCache` (`apps/mobile/lib/clerk-token-cache.ts`) is Clerk's recommended `expo-secure-store`-backed pattern (Keychain/Keystore, not `AsyncStorage`). The only `localStorage` usage anywhere (`apps/web/src/app/layout.tsx`) is the large-text accessibility preference, unrelated to auth |
| 11 | Admin panel with no auth | `/admin` or `/debug` routes protected only by obscurity | Auth-gate every internal route; strip debug endpoints from production builds | ✅ Confirmed 2026-08-16 — two independent layers: route-level (`apps/web/src/proxy.ts` protects every route by default, `/admin` included) and data-level (`adminProcedure` in `packages/api/src/trpc.ts` does a DB-backed `role === "ADMIN"` check before any admin query resolves). No admin surface exists in `apps/mobile` |
| 12 | CORS set to `*` | Lets any site on the internet call your API with a logged-in user's credentials attached | Allowlist your own origins only | ✅ Covered by B1 #18 (fixed 2026-08-15) |
| 13 | No email verification on signup | Enables fake accounts, spam, and account-takeover via unclaimed addresses | Verify email before granting access to anything real | ✅ Fully confirmed 2026-08-16 — code-level: both apps' sign-up flows only call `setActive()` (creating a real session) after Clerk's `attemptEmailAddressVerification` returns `status: "complete"`, no code path skips this. Dashboard-level: user confirmed Clerk's "Verify at sign-up" toggle is ON with "Email verification code" selected (User & Authentication > Email), matching the `email_code` strategy both apps use. Worth a quick re-check on the Production instance specifically before launch — Clerk's Development/Production instances have independent settings and this was confirmed on one of them |
| 14 | Predictable IDs with no ownership check | `/order/1001` → `/order/1002` lets someone read a stranger's data | On every fetch/mutation, confirm the resource belongs to the requesting user | ✅ Audited 2026-08-16 — every ID-taking procedure explicitly checks ownership before returning/mutating: `regime.getById`, `regime.activate`, `workoutSession.complete`, `onboarding.getJobStatus` all compare the resource's `userId` against `ctx.userId` and throw `FORBIDDEN` on mismatch. `sessionLog.create` takes no client-supplied ID at all (scoped entirely to `ctx.userId`). Backed by RLS as defense-in-depth either way |
| 15 | Whole request body saved on updates | Lets a user smuggle `"role": "admin"` or `"is_premium": true` into their own update | Allowlist the exact fields a user can set; ignore the rest of the body | ✅ Covered by B1 #8 |
| 16 | Webhooks with no signature check | A forged `payment_succeeded` POST can unlock premium features for free | Verify the signature against your webhook secret before processing the payload | ✅ Confirmed 2026-08-16 — `apps/web/src/app/api/webhooks/clerk/route.ts` verifies the svix signature (`svix-id`/`svix-timestamp`/`svix-signature` headers via the `svix` package) before processing any event, and rejects if `CLERK_WEBHOOK_SECRET` is unset |
| 17 | Stack traces shown in production | Verbose errors leak file paths, table names, and library versions | Generic error messages to users; real details go to logs only | ✅ Fixed 2026-08-16 — `stack` was already dev-gated by tRPC's default (`config.isDev`, tied to `NODE_ENV`), but `message` was not: any uncaught exception (e.g. a raw Prisma error) had its `.message` forwarded to the client verbatim regardless of environment. Added an `errorFormatter` (`packages/api/src/trpc.ts`) that replaces the message with a generic string for `INTERNAL_SERVER_ERROR`-coded errors in production, logging the real cause server-side instead. Also found and fixed a live instance of exactly this: `RegimeGenerationJob.error` (raw internal exception text) was returned wholesale by `onboarding.getJobStatus` and rendered directly to the end user in `apps/web`'s onboarding page (`Details: {jobStatus.data.error}`) on a Flow A failure — `getJobStatus` now selects an explicit safe field set (`id`/`status`/`resultRegimeId`/`createdAt`/`completedAt`), and the web page's raw-error render was removed |
| 18 | Dependencies never updated | Old packages carry public CVEs with exploit code already written | Run `npm audit`, enable Dependabot, patch on a schedule | ✅ Covered by B1 #20 |
| 19 | No password strength or breach check | Without a minimum length and breach check, `password123` becomes a live account | Set a minimum length and enable your auth provider's leaked-password check (Supabase has one built in) | ✅ Confirmed 2026-08-16 — user enabled minimum length + compromised-password detection under User & Authentication > Password in the Clerk Dashboard |
| 20 | File uploads with no validation | Accepting any file risks a script being uploaded and later served/executed | Check type and size, store outside the web root or in object storage, never execute uploaded files | N/A — no file-upload feature exists yet |

**Suggested prompt for this sub-section (paste the whole table above with it):**
> "Audit my codebase against the 20 issues below. For each one, tell me
> whether my code has the problem, cite the specific file and line, and
> give me the fix. Don't change anything yet, just report first."

**Manual Clerk Dashboard follow-ups:** email verification and password strength/breach-check both confirmed ON 2026-08-16 (see #13/#19 above; re-check the Production instance separately before launch, since Clerk's Dev/Prod settings are independent).

### B3. Security Prompt Pack (June 18) — audited 2026-08-16

Source: "Free Prompt Pack – App Security." Copy-paste prompts for Claude
Code, Codex, Cursor, or similar. Run **one at a time**, testing the app
after each change. These go deeper/narrower than B1 and B2 — good for a
second pass once the basics are covered.

**1. Close ORM-level injection vectors** — ✅ Confirmed clean 2026-08-16. Every raw-SQL call site (`packages/api/src/trpc.ts`'s `set_config()` calls, `packages/db/scripts/{apply-rls-policies,setup-rls-role}.ts`) is either a parameterized tagged template or a trusted infra script never fed by user/client input — RLS role setup, not request handling. No dynamic column/sort/operator selection driven by user input exists anywhere (no generic "sort by field" endpoints).
> "Review how my ORM or query builder is used and find places where its
> raw-query, raw-fragment, or dynamic-condition features are fed user
> input unsafely. Replace unsafe raw fragments with parameterized
> equivalents, validate any user input used to choose column names, sort
> fields, or operators against an allowlist, and ensure dynamic filters
> cannot be manipulated into unintended queries. Summarize the unsafe ORM
> usage you found and how you fixed it."

**2. Trim over-exposed fields in responses** — 🔧 Fixed 2026-08-16, same fix as B2 #17: `onboarding.getJobStatus` was returning the full `RegimeGenerationJob` row (including raw internal `error` text) instead of an explicit shape; now selects only `id`/`status`/`resultRegimeId`/`createdAt`/`completedAt`. Re-confirmed `admin.flaggedUsers`/`admin.metrics` (fixed under B1 #17) still use explicit `select`s, and that `AdjustmentEvent.rationale` (which can carry internal system-level text, per its schema comment) is never returned by any `packages/api` procedure to any client, admin included.
> "Audit my API responses for excessive data exposure, where endpoints
> return more fields than the client needs. For each endpoint, define an
> explicit output shape that includes only the fields required, and strip
> internal flags, security-relevant fields, and other users' data rather
> than serializing whole database records. Pay special attention to user,
> account, and nested related objects, and report which endpoints were
> over-sharing and what you removed."

**3. Prevent server-side request forgery (SSRF)** — N/A, confirmed 2026-08-16. No feature anywhere fetches a URL derived from user input (no webhooks-out, link previews, importers, or image fetchers) — the only inbound webhook (`/api/webhooks/clerk`) receives, never originates, requests.
> "Audit any feature where my server fetches a URL or makes a request
> based on user input — webhooks, link previews, importers, or image
> fetchers — for server-side request forgery. Validate and restrict the
> target so it cannot reach internal addresses, the loopback interface, or
> cloud metadata endpoints, using an allowlist of permitted hosts where
> possible and blocking redirects to disallowed targets. Confirm the
> checks survive DNS and redirect tricks, and report each fetch you
> secured."

**4. Prevent stored XSS in content** — ✅ Confirmed clean 2026-08-16 (re-check of B1 #15 with a stored-content-specific lens). Only `dangerouslySetInnerHTML` in the codebase is a static, hardcoded anti-flash script in `apps/web/src/app/layout.tsx` — not user content. Every path that stores and later re-displays free text (`symptomsText`, `lifestyleContextText`, `targetMovement` at onboarding; `manualHoldReason` in the admin panel) is rendered through plain React text interpolation (auto-escaped), never as raw HTML.
> "Audit the paths where user-submitted content is saved and later
> displayed to other users for stored cross-site scripting. Ensure
> content is validated and sanitized appropriately when stored and
> consistently encoded when rendered, so a payload saved by one user
> cannot execute in another user's browser. Check less obvious surfaces
> too — usernames, file names, notification text, and admin views — and
> report each stored-content flow you secured."

**5. Configure CORS without dangerous wildcards** — ✅ Re-confirmed 2026-08-16, largely overlaps with the CORS fix already done in B1 #18: `apps/web/src/app/api/trpc/[trpc]/route.ts` allowlists origins via `ALLOWED_ORIGINS`, reflects the incoming `Origin` only when it matches the allowlist (never a bare wildcard), and never combines a wildcard with credentials.
> "Review my Cross-Origin Resource Sharing configuration for unsafe
> settings. Replace any wildcard origin — especially when combined with
> credentials — with an explicit allowlist of trusted origins, allow only
> the methods and headers actually needed, and never reflect the incoming
> Origin header back without validating it against the allowlist. Confirm
> that credentials are only permitted for trusted origins, and explain the
> final CORS policy you set."

---

## Category C: UX / Frontend Polish Features — partially done (targeted pass)

Source: "20 things you can tell Claude to add to your website" (Pt. 3).
These are smaller UX/frontend touches — good for polishing an app that's
functionally done but feels unfinished. Items 6/8/9/10 done 2026-08-17;
the rest are still unstarted.

**Navigation & Layout**
1. Sticky headers
2. Skip-to-content link (accessibility)
3. Back-to-top button
4. Mobile menu (hamburger/responsive nav)
5. Floating contact button

**Feedback & State**
6. Loading animations — ✅ Done 2026-08-17 — hand-rolled spinner (web: `.spinner` CSS class in `globals.css`; mobile: `ActivityIndicator` via a new `loading` prop on `components/Button.tsx`), applied to onboarding submit, regime activate, session log, mark-session-complete, and initial page loads. No new dependency.
7. Hover states on interactive elements
8. Form success state — ✅ Done 2026-08-17 — distinct green success banner on a fresh session-log submission (vs. plain "already logged" text on a later revisit); the regime-activation success screen restyled as a banner and (on web) fixed a dead-end by adding a "Go to today's sessions →" link, matching mobile
9. Form error state — ✅ Done 2026-08-17 — every existing error message restyled into a bordered/colored banner (web: `.banner-error`; mobile: `errorBanner` style token), consistent across onboarding, regime review, session log, and account deletion
10. Confirmation modals (for destructive actions like delete) — ✅ Done 2026-08-17 — "Delete my account" converted from an inline confirm-then-swap-text pattern to a real modal: native HTML `<dialog>` on web, native `Alert.alert()` on mobile. No new dependency either app.
11. Scroll progress bar

**Content & Discovery**
12. Site search
13. Expandable FAQ section
14. Last-updated date on content/pages

**Utility Features**
15. Dark mode toggle
16. Simple cookie-consent banner
17. Copy-to-clipboard button
18. Print stylesheet
19. Password visibility toggle (on password fields)
20. UTM tracking on marketing links

**Deliberately deferred: a real UI/UX design pass.** Both apps are still fully
hand-rolled — inline style objects per page on web, a small shared style
factory on mobile, no component library or design system. That's the right
call for now (see `HANDOFF.md`'s "how this project is being built"), but it
means visual design (color, type, spacing, layout) has never had a
deliberate pass, only incremental fixes like items 6/8/9/10 above. **Once
the core product loop is fully implemented (Flow A/B, escalation monitor,
billing at minimum), do an actual full UI/UX overhaul** — from real Figma
designs (see the PRD's still-open "Designs" section), not more hand-rolled
polish on top of hand-rolled polish.

**Suggested prompt to give Claude Code for this category:**
"Add [item] to my site. Match my existing design system/styling and don't
change layout elsewhere."

---

## Category D: Performance Optimization — TODO

Source: "Free Prompt Pack – App Performance" (June 21). These are meant to
be run **one at a time**, testing the app after each change, using Claude
Code, Codex, Cursor, or similar. None of these have been started yet.

**Network & Data Transfer**

*1. Compress API responses in transit*
> "Check whether my API responses are compressed in transit. Enable gzip
> or brotli compression on the server or edge for JSON and text responses
> above a small size threshold, and confirm the client negotiates it via
> Accept-Encoding. Avoid double-compressing already-compressed payloads.
> Verify response transfer sizes drop significantly and responses still
> parse correctly on the client."

*5. Cache rendered pages or fragments*
> "Find server-rendered pages or fragments whose output is identical (or
> nearly so) across many users and changes infrequently. Cache the
> rendered output and serve it directly, regenerating on a schedule or on
> content change, while keeping personalized regions dynamic via holes or
> client-side hydration. Ensure cache keys account for meaningful
> variations like locale. Verify these pages serve much faster and
> rendering load decreases."

**Database**

*2. Batch inserts and updates*
> "Find code that performs many individual INSERT or UPDATE statements in
> a loop where a single batched operation would work. Replace them with
> bulk/batched writes (multi-row inserts, batch updates, or a single
> statement) inside an appropriate transaction. Chunk very large batches
> to avoid oversized statements or long locks. Verify write-heavy
> operations complete far faster with fewer round trips."

**Resilience**

*3. Add a circuit breaker for slow dependencies*
> "Identify external dependencies whose slowness or failures could
> cascade into my app, exhausting threads or connections while everyone
> waits. Add a circuit breaker that trips when a dependency is failing or
> too slow, fast-failing or serving a fallback until it recovers, with
> timeouts and limited concurrency to that dependency. Verify that a
> degraded dependency no longer drags down unrelated parts of the app and
> recovers cleanly."

**Perceived Performance**

*4. Apply optimistic UI updates*
> "Identify user actions (likes, toggles, adds, edits, deletes) that
> currently wait for the server response before updating the screen. Make
> them optimistic: update the UI immediately as if the action succeeded,
> then reconcile with the server result and roll back gracefully if it
> fails. Include clear error handling and a visible rollback so users
> aren't misled. Verify the happy path feels instant and failures restore
> the correct state."

**Backend Efficiency**

*6. Trim over-fetching backend queries*
> "Audit my backend for backend queries pulling in more info than the UI
> needs and resolve."

*7. Fix N+1 queries*
> "Audit my backend for all N+1 queries and optimize the SQL/query."

*8. Close unused DB connections*
> "Audit the backend and ensure all unused DB connections are getting
> closed properly."

*9. Clean up orphaned object storage*
> "Audit my object storage and ensure there are no orphaned blobs."

*10. Check for hidden background jobs holding connections*
> "Ensure there are no hidden background jobs maintaining DB connections
> in the pool."

**Suggested prompt for this category:**
Just copy/paste the individual quoted prompt above for the item you want,
one at a time, and test after each.

---

## Suggested Order of Operations

For a pre-launch app, a reasonable order is:

1. **Category A (Legal)** — items 1-4 (privacy policy basics) are cheap
   and high-value to fix early. Fully done as of 2026-08-17, including
   item 5's Clerk webhook registration.
2. **Category B (Security)** — do this fully before any real users touch
   the app. This is the highest-stakes category. B1/B2/B3 are all fully
   audited and closed out (2026-08-15/16/17), including every manual
   Clerk Dashboard follow-up. Rate limiting (B2 #5) shipped 2026-08-22,
   along with an RLS coverage gap fix + CI enforcement and a CSP upgrade
   to per-request nonces (see B1 #4/#18 above). What remains: the separate
   Clerk Production-instance cutover decision, and re-confirming this
   whole category's Clerk Dashboard settings on that Production instance
   once it exists.
3. **Category D (Performance)** — worth doing once core features are
   stable, before you have real traffic to break. Still fully unstarted.
4. **Category C (UX Polish)** — a targeted pass (loading/success/error
   states, confirmation modals) was done 2026-08-17 ahead of schedule for
   a demo; the remaining 16 items are still "do last, iterate
   post-launch." A full UI/UX design overhaul is separately deferred
   until the core product loop is complete — see the note at the end of
   Category C above.

---

*This document is a personal reference compiled from saved tips/screenshots.
Legal items in Category A are general guidance, not legal advice — consider
a lawyer's review of your actual Privacy Policy / Terms of Service before
launch.*
