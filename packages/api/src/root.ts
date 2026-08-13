import { healthRouter } from "./routers/health";
import { onboardingRouter } from "./routers/onboarding";
import { regimeRouter } from "./routers/regime";
import { sessionLogRouter } from "./routers/session-log";
import { router } from "./trpc";

export const appRouter = router({
  health: healthRouter,
  onboarding: onboardingRouter,
  regime: regimeRouter,
  sessionLog: sessionLogRouter,
});

export type AppRouter = typeof appRouter;
