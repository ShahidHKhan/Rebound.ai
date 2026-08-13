import { healthRouter } from "./routers/health";
import { onboardingRouter } from "./routers/onboarding";
import { router } from "./trpc";

export const appRouter = router({
  health: healthRouter,
  onboarding: onboardingRouter,
});

export type AppRouter = typeof appRouter;
