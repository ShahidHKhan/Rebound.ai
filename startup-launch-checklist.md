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

## Category B: Security

This is the largest and highest-stakes category, so it's split into three
sub-sections. Go through them roughly in order: checklist first (broad
coverage, mostly already done below), then the 20-holes audit (specific,
common vulnerabilities — new, not yet audited), then the targeted prompt
pack (deeper, narrower issues — new, not yet run). All are meant to be
worked through one item at a time, testing after each fix.

### B1. Pre-Launch Security Checklist — mostly reviewed 2026-08-15

Source: "20 things to have Claude do before launching your app."

**Secrets & Credentials**
1. Hide API keys (never in client-side code or committed to git) — ✅ confirmed clean, only publishable Clerk keys reach the client
2. Purge Git secrets (scrub history if any were ever committed) — ✅ confirmed no `.env` ever committed
3. Use a public/anon DB key only where appropriate — never expose service-role/admin keys to the client — N/A, no Supabase client SDK is used at all; DB access is server-only Prisma over `DATABASE_URL`/`DATABASE_URL_RLS`

**Data Access Control**
4. Enable row-level security (RLS) on your database — ✅ done pre-existing, `packages/db/sql/rls-policies.sql`
5. Encrypt sensitive data at rest — ✅ Supabase-managed Postgres, encrypted by default
6. Enforce server-side auth (never trust client-side auth checks alone) — ✅ `protectedProcedure`/`adminProcedure` in `packages/api/src/trpc.ts`
7. Lock down record access (users can only read/write their own data) — ✅ every query scoped to `ctx.userId`, plus RLS as defense-in-depth
8. Block field tampering (server validates/ignores client-supplied fields it shouldn't trust, e.g. `role`, `isAdmin`, `price`) — ✅ confirmed no router accepts these as input

**Session & Account Security**
9. Secure session cookies (httpOnly, secure, sameSite flags) — delegated to Clerk defaults; manual follow-up noted in `HANDOFF.md`
10. Hash passwords (bcrypt/argon2, never plaintext or reversible encryption) — N/A, Clerk manages all password storage
11. Rate limit login attempts — delegated to Clerk (no custom auth surface exists); manual Clerk Dashboard follow-up noted in `HANDOFF.md`

**Abuse & Input Protection**
12. Add bot protection (captcha/rate limiting on public forms and signup) — delegated to Clerk (only public form is Clerk's own sign-up); manual Clerk Dashboard follow-up noted in `HANDOFF.md`
13. Parameterize all database queries (prevent SQL injection) — ✅ reviewed 2026-08-15, already solid — Prisma throughout, only trusted infra scripts use raw SQL
14. Validate all input (server-side, not just client-side) — ✅ reviewed 2026-08-15, already solid — zod schemas on every tRPC procedure
15. Escape user-generated content before rendering (prevent XSS) — ✅ reviewed 2026-08-15, already solid — no `dangerouslySetInnerHTML` anywhere
16. Restrict file upload types/sizes (prevent malicious file uploads) — N/A, no file-upload feature exists yet

**Infrastructure**
17. Trim API responses (don't leak internal fields/extra data to the client) — ✅ Done 2026-08-15 — `admin.flaggedUsers` (`packages/api/src/routers/admin.ts`) now uses an explicit `select` instead of returning full `User` rows
18. Add security headers (CSP, X-Frame-Options, HSTS, etc.) — ✅ Done 2026-08-15 — `apps/web/next.config.ts` `headers()`; also fixed a wide-open CORS wildcard (`Access-Control-Allow-Origin: *`) in `apps/web/src/app/api/trpc/[trpc]/route.ts`, now origin-allowlisted via `ALLOWED_ORIGINS`
19. Force HTTPS everywhere — ✅ Done 2026-08-15 — explicit HSTS header added (Vercel already enforced HTTPS at the platform level)
20. Scan dependencies for known vulnerabilities (npm audit / equivalent) — ✅ Done 2026-08-15 — `.github/dependabot.yml` added (weekly, npm ecosystem covers pnpm)

**Remaining manual follow-ups (see `HANDOFF.md`):** register the Clerk account-deletion webhook, and confirm session cookie flags / login rate limiting / bot protection in the Clerk Dashboard.

**Suggested prompt for this sub-section:**
"Go through item [#] from my Pre-Launch Security Checklist. Check my
current implementation, explain any gaps, and fix them."

### B2. 20 Common Vulnerabilities in Vibe-Coded Apps — TODO, not yet audited

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
| 5 | No rate limiting on endpoints | Scripts can brute-force logins or run up AI/API bills overnight | Per-user and per-IP throttles on login, signup, and expensive routes | Partial — delegated to Clerk for auth; no rate limiting confirmed on other expensive routes (e.g. AI-calling endpoints) — TODO |
| 6 | SQL built via string concatenation | Splicing user input into a query string allows query injection | Parameterized queries or an ORM — never string-interpolated queries | ✅ Covered by B1 #13 |
| 7 | No server-side input validation | Client-side form validation is skippable — anyone can POST directly to the endpoint | Validate and sanitize on the server too, with a schema library like Zod | ✅ Covered by B1 #14 |
| 8 | User content rendered as raw HTML | `dangerouslySetInnerHTML` on user text allows script injection (XSS) that steals sessions | Render user content as text; if HTML is required, sanitize with DOMPurify | ✅ Covered by B1 #15 |
| 9 | Passwords stored in plaintext | One database leak exposes every account (and reused passwords elsewhere) | Use your auth provider's hashing (bcrypt/argon2); don't roll your own | ✅ N/A, Clerk manages |
| 10 | Auth tokens kept in `localStorage` | Any XSS script can read `localStorage` and steal a live session token | httpOnly cookies on web, secure storage (e.g. `expo-secure-store`) on native | TODO — not yet explicitly confirmed for either app |
| 11 | Admin panel with no auth | `/admin` or `/debug` routes protected only by obscurity | Auth-gate every internal route; strip debug endpoints from production builds | TODO — not yet audited |
| 12 | CORS set to `*` | Lets any site on the internet call your API with a logged-in user's credentials attached | Allowlist your own origins only | ✅ Covered by B1 #18 (fixed 2026-08-15) |
| 13 | No email verification on signup | Enables fake accounts, spam, and account-takeover via unclaimed addresses | Verify email before granting access to anything real | TODO — confirm Clerk's default email verification is actually enforced |
| 14 | Predictable IDs with no ownership check | `/order/1001` → `/order/1002` lets someone read a stranger's data | On every fetch/mutation, confirm the resource belongs to the requesting user | TODO — B1 #7 covers query scoping generally, but IDOR-style ownership checks haven't been audited specifically |
| 15 | Whole request body saved on updates | Lets a user smuggle `"role": "admin"` or `"is_premium": true` into their own update | Allowlist the exact fields a user can set; ignore the rest of the body | ✅ Covered by B1 #8 |
| 16 | Webhooks with no signature check | A forged `payment_succeeded` POST can unlock premium features for free | Verify the signature against your webhook secret before processing the payload | ✅ Confirmed 2026-08-16 — `apps/web/src/app/api/webhooks/clerk/route.ts` verifies the svix signature (`svix-id`/`svix-timestamp`/`svix-signature` headers via the `svix` package) before processing any event, and rejects if `CLERK_WEBHOOK_SECRET` is unset |
| 17 | Stack traces shown in production | Verbose errors leak file paths, table names, and library versions | Generic error messages to users; real details go to logs only | TODO — not yet audited |
| 18 | Dependencies never updated | Old packages carry public CVEs with exploit code already written | Run `npm audit`, enable Dependabot, patch on a schedule | ✅ Covered by B1 #20 |
| 19 | No password strength or breach check | Without a minimum length and breach check, `password123` becomes a live account | Set a minimum length and enable your auth provider's leaked-password check (Supabase has one built in) | TODO — confirm Clerk's password/breach-check settings |
| 20 | File uploads with no validation | Accepting any file risks a script being uploaded and later served/executed | Check type and size, store outside the web root or in object storage, never execute uploaded files | N/A — no file-upload feature exists yet |

**Suggested prompt for this sub-section (paste the whole table above with it):**
> "Audit my codebase against the 20 issues below. For each one, tell me
> whether my code has the problem, cite the specific file and line, and
> give me the fix. Don't change anything yet, just report first."

### B3. Security Prompt Pack (June 18) — TODO, not yet run

Source: "Free Prompt Pack – App Security." Copy-paste prompts for Claude
Code, Codex, Cursor, or similar. Run **one at a time**, testing the app
after each change. These go deeper/narrower than B1 and B2 — good for a
second pass once the basics are covered.

**1. Close ORM-level injection vectors**
> "Review how my ORM or query builder is used and find places where its
> raw-query, raw-fragment, or dynamic-condition features are fed user
> input unsafely. Replace unsafe raw fragments with parameterized
> equivalents, validate any user input used to choose column names, sort
> fields, or operators against an allowlist, and ensure dynamic filters
> cannot be manipulated into unintended queries. Summarize the unsafe ORM
> usage you found and how you fixed it."

**2. Trim over-exposed fields in responses**
> "Audit my API responses for excessive data exposure, where endpoints
> return more fields than the client needs. For each endpoint, define an
> explicit output shape that includes only the fields required, and strip
> internal flags, security-relevant fields, and other users' data rather
> than serializing whole database records. Pay special attention to user,
> account, and nested related objects, and report which endpoints were
> over-sharing and what you removed."

**3. Prevent server-side request forgery (SSRF)**
> "Audit any feature where my server fetches a URL or makes a request
> based on user input — webhooks, link previews, importers, or image
> fetchers — for server-side request forgery. Validate and restrict the
> target so it cannot reach internal addresses, the loopback interface, or
> cloud metadata endpoints, using an allowlist of permitted hosts where
> possible and blocking redirects to disallowed targets. Confirm the
> checks survive DNS and redirect tricks, and report each fetch you
> secured."

**4. Prevent stored XSS in content**
> "Audit the paths where user-submitted content is saved and later
> displayed to other users for stored cross-site scripting. Ensure
> content is validated and sanitized appropriately when stored and
> consistently encoded when rendered, so a payload saved by one user
> cannot execute in another user's browser. Check less obvious surfaces
> too — usernames, file names, notification text, and admin views — and
> report each stored-content flow you secured."

**5. Configure CORS without dangerous wildcards**
> "Review my Cross-Origin Resource Sharing configuration for unsafe
> settings. Replace any wildcard origin — especially when combined with
> credentials — with an explicit allowlist of trusted origins, allow only
> the methods and headers actually needed, and never reflect the incoming
> Origin header back without validating it against the allowlist. Confirm
> that credentials are only permitted for trusted origins, and explain the
> final CORS policy you set."

*(Note: #5 largely overlaps with the CORS fix already done in B1 #18 —
worth a quick re-check rather than a full pass.)*

---

## Category C: UX / Frontend Polish Features — TODO

Source: "20 things you can tell Claude to add to your website" (Pt. 3).
These are smaller UX/frontend touches — good for polishing an app that's
functionally done but feels unfinished. None of these have been started
yet.

**Navigation & Layout**
1. Sticky headers
2. Skip-to-content link (accessibility)
3. Back-to-top button
4. Mobile menu (hamburger/responsive nav)
5. Floating contact button

**Feedback & State**
6. Loading animations
7. Hover states on interactive elements
8. Form success state
9. Form error state
10. Confirmation modals (for destructive actions like delete)
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
   and high-value to fix early. Mostly done — item 5's Clerk webhook
   registration is the one manual step left.
2. **Category B (Security)** — do this fully before any real users touch
   the app. This is the highest-stakes category. B1 is largely done; work
   through B2 next (especially #16, webhook signature verification, given
   the new Clerk webhook), then B3.
3. **Category D (Performance)** — worth doing once core features are
   stable, before you have real traffic to break.
4. **Category C (UX Polish)** — do this last; it's the most "nice to
   have" and easiest to iterate on post-launch.

---

*This document is a personal reference compiled from saved tips/screenshots.
Legal items in Category A are general guidance, not legal advice — consider
a lawyer's review of your actual Privacy Policy / Terms of Service before
launch.*
