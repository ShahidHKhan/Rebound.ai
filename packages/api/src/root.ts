import { adjustmentEventRouter } from "./routers/adjustment-event";
import { adminRouter } from "./routers/admin";
import { adminExperimentsRouter } from "./routers/admin-experiments";
import { exerciseRouter } from "./routers/exercise";
import { healthRouter } from "./routers/health";
import { onboardingRouter } from "./routers/onboarding";
import { progressRouter } from "./routers/progress";
import { regimeRouter } from "./routers/regime";
import { sessionLogRouter } from "./routers/session-log";
import { userRouter } from "./routers/user";
import { workoutSessionRouter } from "./routers/workout-session";
import { router } from "./trpc";

export const appRouter = router({
  health: healthRouter,
  onboarding: onboardingRouter,
  progress: progressRouter,
  regime: regimeRouter,
  sessionLog: sessionLogRouter,
  workoutSession: workoutSessionRouter,
  adjustmentEvent: adjustmentEventRouter,
  exercise: exerciseRouter,
  admin: adminRouter,
  adminExperiments: adminExperimentsRouter,
  user: userRouter,
});

export type AppRouter = typeof appRouter;
