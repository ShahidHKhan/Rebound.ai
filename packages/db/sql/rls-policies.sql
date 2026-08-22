-- Row Level Security policies for user-owned tables.
--
-- Two-tier trust model (see packages/db/scripts/setup-rls-role.ts and
-- packages/api/src/trpc.ts):
--   - The table-owning role (DATABASE_URL) is never subject to RLS by
--     default in Postgres. packages/agents and the /api/cron/* routes use
--     it directly and are completely unaffected by anything below.
--   - The `rebound_app` role (DATABASE_URL_RLS) IS subject to these
--     policies. Only packages/api's tRPC context uses it, with
--     `app.user_id` / `app.is_admin` set per-request via set_config()
--     inside a transaction before any query runs.
--
-- Column names are unquoted-camelCase as Prisma created them (no @map on
-- these fields), so they must be double-quoted here — Postgres folds
-- unquoted identifiers to lowercase.
--
-- Exercise / Preset / PresetExercise / LlmCall / TestFixture / TestRun /
-- Scenario are not user-scoped, so they were originally left with RLS
-- disabled entirely on the theory that "not user data" meant "doesn't need
-- a policy." Supabase's own security linter correctly flagged that as a
-- real gap (`rls_disabled_in_public`) 2026-08-19: RLS being *disabled* — not
-- just policy-free — means every public-schema table is exposed wide open
-- through Supabase's auto-generated PostgREST REST API regardless of
-- whether this app's own code happens to use that API. See below for how
-- each of the two categories is actually locked down.

-- users: the tenant root, keyed by id (Clerk's user id) rather than a
-- separate userId column.
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS users_isolation ON users;
CREATE POLICY users_isolation ON users
  USING (id = current_setting('app.user_id', true) OR current_setting('app.is_admin', true) = 'true')
  WITH CHECK (id = current_setting('app.user_id', true) OR current_setting('app.is_admin', true) = 'true');

-- regimes
ALTER TABLE regimes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS regimes_isolation ON regimes;
CREATE POLICY regimes_isolation ON regimes
  USING ("userId" = current_setting('app.user_id', true) OR current_setting('app.is_admin', true) = 'true')
  WITH CHECK ("userId" = current_setting('app.user_id', true) OR current_setting('app.is_admin', true) = 'true');

-- workout_sessions
ALTER TABLE workout_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS workout_sessions_isolation ON workout_sessions;
CREATE POLICY workout_sessions_isolation ON workout_sessions
  USING ("userId" = current_setting('app.user_id', true) OR current_setting('app.is_admin', true) = 'true')
  WITH CHECK ("userId" = current_setting('app.user_id', true) OR current_setting('app.is_admin', true) = 'true');

-- session_logs
ALTER TABLE session_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS session_logs_isolation ON session_logs;
CREATE POLICY session_logs_isolation ON session_logs
  USING ("userId" = current_setting('app.user_id', true) OR current_setting('app.is_admin', true) = 'true')
  WITH CHECK ("userId" = current_setting('app.user_id', true) OR current_setting('app.is_admin', true) = 'true');

-- adjustment_events
ALTER TABLE adjustment_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS adjustment_events_isolation ON adjustment_events;
CREATE POLICY adjustment_events_isolation ON adjustment_events
  USING ("userId" = current_setting('app.user_id', true) OR current_setting('app.is_admin', true) = 'true')
  WITH CHECK ("userId" = current_setting('app.user_id', true) OR current_setting('app.is_admin', true) = 'true');

-- regime_generation_jobs
ALTER TABLE regime_generation_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS regime_generation_jobs_isolation ON regime_generation_jobs;
CREATE POLICY regime_generation_jobs_isolation ON regime_generation_jobs
  USING ("userId" = current_setting('app.user_id', true) OR current_setting('app.is_admin', true) = 'true')
  WITH CHECK ("userId" = current_setting('app.user_id', true) OR current_setting('app.is_admin', true) = 'true');

-- regime_exercises: no userId of its own — scoped via the parent regime.
ALTER TABLE regime_exercises ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS regime_exercises_isolation ON regime_exercises;
CREATE POLICY regime_exercises_isolation ON regime_exercises
  USING (EXISTS (
    SELECT 1 FROM regimes r
    WHERE r.id = regime_exercises."regimeId"
      AND (r."userId" = current_setting('app.user_id', true) OR current_setting('app.is_admin', true) = 'true')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM regimes r
    WHERE r.id = regime_exercises."regimeId"
      AND (r."userId" = current_setting('app.user_id', true) OR current_setting('app.is_admin', true) = 'true')
  ));

-- workout_session_exercises: no userId of its own — scoped via the parent
-- workout session.
ALTER TABLE workout_session_exercises ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS workout_session_exercises_isolation ON workout_session_exercises;
CREATE POLICY workout_session_exercises_isolation ON workout_session_exercises
  USING (EXISTS (
    SELECT 1 FROM workout_sessions ws
    WHERE ws.id = workout_session_exercises."workoutSessionId"
      AND (ws."userId" = current_setting('app.user_id', true) OR current_setting('app.is_admin', true) = 'true')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM workout_sessions ws
    WHERE ws.id = workout_session_exercises."workoutSessionId"
      AND (ws."userId" = current_setting('app.user_id', true) OR current_setting('app.is_admin', true) = 'true')
  ));

-- exercises / presets / preset_exercises: shared library content, read by
-- every user via the restricted `rebound_app` role (packages/api's
-- protectedProcedure — e.g. exercise.getById, regime.getById's exercise
-- joins, workoutSession.today). RLS must be enabled (closes the PostgREST
-- exposure gap) but reads must stay open to everyone, or every screen that
-- shows an exercise name breaks. No write policy on purpose: seeding
-- (packages/db/scripts/seed-exercises.ts, seed-presets.ts) runs as the
-- table-owning role, which bypasses RLS entirely — `rebound_app` was never
-- meant to write these tables, and the absence of an INSERT/UPDATE/DELETE
-- policy keeps that true even with RLS on.
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS exercises_public_read ON exercises;
CREATE POLICY exercises_public_read ON exercises FOR SELECT USING (true);

ALTER TABLE presets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS presets_public_read ON presets;
CREATE POLICY presets_public_read ON presets FOR SELECT USING (true);

ALTER TABLE preset_exercises ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS preset_exercises_public_read ON preset_exercises;
CREATE POLICY preset_exercises_public_read ON preset_exercises FOR SELECT USING (true);

-- preset_slots: same shared-library category as presets/preset_exercises —
-- the slot templates packages/agents/src/skeleton-retrieval.ts narrows
-- search_exercises against. This table was missing from this file entirely
-- until 2026-08-22, which meant RLS was never enabled on it and it sat
-- exposed through Supabase's auto-generated PostgREST API — the exact gap
-- the header comment describes for the other non-user tables. Found by
-- packages/db/scripts/check-rls-coverage.ts, which now runs in CI so a new
-- Prisma model can never again ship without a decision recorded here.
ALTER TABLE preset_slots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS preset_slots_public_read ON preset_slots;
CREATE POLICY preset_slots_public_read ON preset_slots FOR SELECT USING (true);

-- llm_calls / test_fixtures / test_runs / scenarios: internal admin-only
-- data (packages/api/src/routers/admin-experiments.ts's `adminOnlyProcedure`
-- deliberately uses the privileged `prisma` client, not `prismaRls` — see
-- that router's own comment for why). `rebound_app` never legitimately
-- touches these tables at all, so RLS is enabled with zero policies —
-- full default-deny for any non-owner role, which is exactly what should
-- happen here. The table-owning role (packages/agents, cron routes, and
-- admin-experiments's own queries) is unaffected, same as every other
-- table in this file.
ALTER TABLE llm_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_fixtures ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenarios ENABLE ROW LEVEL SECURITY;

-- rate_limits: counters keyed by user id or client IP
-- (packages/api/src/rate-limit.ts). Written only by the privileged client,
-- before any RLS transaction is opened, so `rebound_app` has no legitimate
-- reason to touch it — same zero-policy default-deny as llm_calls above.
-- Left unlisted, it would expose per-user request patterns through
-- PostgREST.
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
