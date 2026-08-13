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
-- Exercise / Preset / PresetExercise are intentionally excluded — shared
-- library content, not user-scoped.

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
